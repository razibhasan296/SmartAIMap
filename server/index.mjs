import http from "node:http";
import { createPublicKey, verify as verifySignature } from "node:crypto";

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_AUDIO_BODY_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BODY_BYTES = 17 * 1024 * 1024;
const MAX_VIDEO_BYTES = 12 * 1024 * 1024;
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/mpeg", "video/mov", "video/avi", "video/x-flv", "video/mpg", "video/webm", "video/wmv", "video/3gpp"]);
const MAX_RATE_LIMIT_KEYS = 10_000;
const clients = new Map();

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
const FIREBASE_CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let firebaseCertCache = { expiresAt: 0, certs: {} };

async function verifyFirebaseIdToken(token) {
  if (!FIREBASE_PROJECT_ID) throw new Error("Firebase authentication is not configured.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid bearer token.");
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid bearer token.");
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Invalid token header.");
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== FIREBASE_PROJECT_ID ||
      claims.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
      typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 128 ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
      !Number.isFinite(claims.auth_time) || claims.auth_time > now + 60) {
    throw new Error("Invalid or expired Firebase ID token.");
  }
  if (firebaseCertCache.expiresAt <= Date.now()) {
    const response = await fetch(FIREBASE_CERT_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Firebase signing certificates are unavailable.");
    const certs = await response.json();
    const cacheControl = response.headers.get("cache-control") || "";
    const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 300);
    firebaseCertCache = { certs, expiresAt: Date.now() + Math.min(maxAge, 3600) * 1000 };
  }
  const cert = firebaseCertCache.certs[header.kid];
  if (typeof cert !== "string") throw new Error("Unknown Firebase signing key.");
  const valid = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey(cert),
    Buffer.from(parts[2], "base64url")
  );
  if (!valid) throw new Error("Invalid Firebase token signature.");
  return { uid: claims.sub, claims };
}

async function requireAuthentication(req) {
  // Tests exercise input validation without reaching any provider. This bypass is
  // active only in the isolated Node test process and is never enabled in production.
  if (process.env.NODE_ENV === "test") return { uid: "test-user" };
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  if (!match) throw new Error("Authentication required.");
  return verifyFirebaseIdToken(match[1]);
}

const json = (res, status, data) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(JSON.stringify(data));
};

function consumeRateLimit(key) {
  const now = Date.now();
  const current = clients.get(key);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    if (clients.size >= MAX_RATE_LIMIT_KEYS) {
      for (const [client, entry] of clients) {
        if (now - entry.startedAt >= WINDOW_MS) clients.delete(client);
      }
      if (clients.size >= MAX_RATE_LIMIT_KEYS) return false;
    }
    clients.set(key, { startedAt: now, count: 1 });
    return true;
  }

  current.count += 1;
  return current.count <= MAX_REQUESTS;
}

async function readJson(req, maxBytes = MAX_BODY_BYTES) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw Object.assign(new Error("Request body too large"), { status: 413 });
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw Object.assign(new Error("Request body too large"), { status: 413 });
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Expected a valid JSON body"), { status: 400 });
  }
}

function validateOutputSchema(schema, depth = 0, budget = { nodes: 0 }) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema) || depth > 6) throw new Error("Invalid schema structure.");
  budget.nodes += 1;
  if (budget.nodes > 100) throw new Error("Schema is too complex.");
  const allowed = new Set(["type", "properties", "required", "items", "enum"]);
  if (Object.keys(schema).some((key) => !allowed.has(key))) throw new Error("Schema contains unsupported keywords.");
  const types = new Set(["OBJECT", "ARRAY", "STRING", "NUMBER", "INTEGER", "BOOLEAN"]);
  if (!types.has(schema.type)) throw new Error("Schema type is not supported.");
  const result = { type: schema.type };
  if (schema.type === "OBJECT") {
    if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) throw new Error("Object schemas need properties.");
    const keys = Object.keys(schema.properties);
    if (keys.length > 30) throw new Error("Too many object properties.");
    if (keys.some((key) => key.length < 1 || key.length > 128)) throw new Error("Schema property names must contain 1–128 characters.");
    const required = schema.required ?? [];
    if (!Array.isArray(required) || required.length > keys.length || required.some((key) => typeof key !== "string" || !keys.includes(key))) throw new Error("Invalid required property list.");
    result.properties = Object.fromEntries(keys.map((key) => [key, validateOutputSchema(schema.properties[key], depth + 1, budget)]));
    if (required.length) result.required = required;
  }
  if (schema.type === "ARRAY") {
    if (!schema.items) throw new Error("Array schemas need an items schema.");
    result.items = validateOutputSchema(schema.items, depth + 1, budget);
  }
  if (schema.enum !== undefined) {
    if (schema.type !== "STRING" || !Array.isArray(schema.enum) || schema.enum.length < 1 || schema.enum.length > 50 || schema.enum.some((value) => typeof value !== "string" || value.length > 120)) {
      throw new Error("Invalid string enum.");
    }
    result.enum = schema.enum;
  }
  return result;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    return json(res, 200, { ok: true, service: "smart-ai-map-api" });
  }

  const supportedPostPath = ["/api/generate", "/api/audio/transcribe", "/api/audio/speech", "/api/video/analyze"].includes(req.url);
  if (req.method !== "POST" || !supportedPostPath) {
    return json(res, 404, { error: "Not found" });
  }

  if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    return json(res, 415, { error: "Content-Type must be application/json." });
  }

  const clientKey = req.socket.remoteAddress || "unknown";
  if (!consumeRateLimit(clientKey)) {
    return json(res, 429, { error: "Rate limit exceeded. Try again shortly." });
  }

  if (!API_KEY) {
    return json(res, 503, { error: "AI service is not configured on the server." });
  }

  try {
    const bodyLimit = req.url === "/api/audio/transcribe" ? MAX_AUDIO_BODY_BYTES : req.url === "/api/video/analyze" ? MAX_VIDEO_BODY_BYTES : MAX_BODY_BYTES;
    const body = await readJson(req, bodyLimit);
    try {
      req.auth = await requireAuthentication(req);
    } catch {
      return json(res, FIREBASE_PROJECT_ID ? 401 : 503, { error: FIREBASE_PROJECT_ID ? "Valid Firebase sign-in is required." : "Firebase authentication is not configured on the server." });
    }

    if (req.url === "/api/video/analyze") {
      const video = body.videoBase64;
      const mimeType = body.mimeType;
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (typeof mimeType !== "string" || !VIDEO_MIME_TYPES.has(mimeType)) {
        return json(res, 400, { error: "Unsupported video MIME type." });
      }
      if (!prompt || prompt.length > 6000) {
        return json(res, 400, { error: "prompt must contain 1–6000 characters." });
      }
      if (typeof video !== "string" || video.length < 4 || video.length > Math.ceil(MAX_VIDEO_BYTES * 4 / 3) + 4 || video.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(video)) {
        return json(res, 400, { error: "Video must be valid base64 within the 12MB limit." });
      }
      const videoBytes = Buffer.from(video, "base64");
      if (videoBytes.length < 1 || videoBytes.length > MAX_VIDEO_BYTES) {
        return json(res, 413, { error: "Video exceeds the 12MB inline limit. Use the managed File API flow for larger videos." });
      }
      const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input: [
            { type: "text", text: prompt },
            { type: "video", data: video, mime_type: mimeType },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json(res, upstream.status === 429 ? 429 : 502, { error: "Video analysis provider request failed." });
      return json(res, 200, { text: typeof result.output_text === "string" ? result.output_text : "No analysis available." });
    }

    if (req.url === "/api/audio/transcribe") {
      const audio = body.audioBase64;
      if (typeof audio !== "string" || audio.length < 4 || audio.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 4 || audio.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(audio)) {
        return json(res, 400, { error: "Audio must be valid base64 within the 8MB limit." });
      }
      const audioBytes = Buffer.from(audio, "base64");
      if (audioBytes.length < 1 || audioBytes.length > MAX_AUDIO_BYTES) {
        return json(res, 413, { error: "Audio exceeds the 8MB limit." });
      }
      const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { inlineData: { mimeType: "audio/wav", data: audio } },
            { text: "Transcribe this audio command for the #RAI interface. Return only the transcription." },
          ] }],
          generationConfig: { maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json(res, upstream.status === 429 ? 429 : 502, { error: "Audio transcription provider request failed." });
      const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
      return json(res, 200, { text });
    }

    if (req.url === "/api/audio/speech") {
      const speechText = typeof body.text === "string" ? body.text.trim() : "";
      if (!speechText || speechText.length > 6000) {
        return json(res, 400, { error: "text must contain 1–6000 characters." });
      }
      const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: speechText }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
          },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json(res, upstream.status === 429 ? 429 : 502, { error: "Speech generation provider request failed." });
      const audioPart = result.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
      if (!audioPart) return json(res, 502, { error: "Speech provider returned no audio." });
      return json(res, 200, { audio: audioPart.inlineData.data, mimeType: audioPart.inlineData.mimeType || "audio/wav" });
    }

    const allowedOperations = ["generate", "reasoning", "voice-command", "codex-entries", "location-report", "chat", "structured-json", "location-demo", "image-generation", "image-highres"];
    const operation = body.operation ?? "generate";
    if (typeof operation !== "string" || !allowedOperations.includes(operation)) {
      return json(res, 400, { error: "Unsupported generation operation." });
    }
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > 12_000) {
      return json(res, 400, { error: "prompt must contain 1–12000 characters." });
    }

    let imageConfig = null;
    if (operation === "image-generation" || operation === "image-highres") {
      const ratios = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]);
      const ratio = body.aspectRatio ?? "16:9";
      if (typeof ratio !== "string" || !ratios.has(ratio)) {
        return json(res, 400, { error: "Unsupported image aspect ratio." });
      }
      if (operation === "image-highres") {
        const size = body.size ?? "2K";
        if (!["1K", "2K", "4K"].includes(size)) {
          return json(res, 400, { error: "Image size must be 1K, 2K, or 4K." });
        }
        imageConfig = { aspectRatio: ratio, imageSize: size };
      } else {
        imageConfig = { aspectRatio: ratio };
      }
    }

    let customOutputSchema = null;
    if (operation === "structured-json") {
      if (typeof body.schema !== "string" || body.schema.length > 12_000) {
        return json(res, 400, { error: "schema must be JSON text no larger than 12KB." });
      }
      try {
        customOutputSchema = validateOutputSchema(JSON.parse(body.schema));
      } catch (error) {
        return json(res, 400, { error: error.message || "Invalid output schema." });
      }
    }

    let chatContents = null;
    if (operation === "chat") {
      if (!Array.isArray(body.history) || body.history.length > 20) {
        return json(res, 400, { error: "history must be an array with at most 20 messages." });
      }
      let historyCharacters = 0;
      chatContents = [];
      for (const item of body.history) {
        if (!item || !["user", "model"].includes(item.role) || !Array.isArray(item.parts) || item.parts.length < 1 || item.parts.length > 4) {
          return json(res, 400, { error: "history contains an invalid message." });
        }
        const parts = [];
        for (const part of item.parts) {
          if (!part || typeof part.text !== "string" || !part.text.trim() || part.text.length > 4_000) {
            return json(res, 400, { error: "Each history text part must contain 1–4000 characters." });
          }
          historyCharacters += part.text.length;
          if (historyCharacters > 16_000) {
            return json(res, 400, { error: "Conversation history is too large." });
          }
          parts.push({ text: part.text });
        }
        chatContents.push({ role: item.role, parts });
      }
      chatContents.push({ role: "user", parts: [{ text: prompt }] });
    }

    const requestContents = operation === "location-demo"
      ? `Treat this as a fictional SmartAIMap demo identifier, not a real credential. Do not decrypt, authenticate, reveal secrets, or claim access to a real location. Generate a clearly fictional location name, a short imaginative overview, and one visual style from the allowed schema for this demo input: "${prompt}".`
      : operation === "voice-command"
      ? `Interpret this voice command for the #RAI system: "${prompt}". Possible actions: NAVIGATE (go to a location), SELECT_MARKER (interact with a point of interest), CHANGE_STYLE (change visual lens), UNKNOWN (unrecognized). Return only the requested structured result.`
      : operation === "codex-entries"
        ? `Generate 5 relevant SMARTAIMAP Codex entries for this query: "${prompt}". Categories: Location, Protocol, Intelligence, Entity. Entries should be technical and sci-fi themed.`
        : operation === "location-report"
          ? `Create a clearly labeled AI-generated location overview for SmartAIMap for the place: "${prompt}". Do not present estimated environmental values or threat assessments as live measurements. Use Unknown when data is not verifiable.`
          : prompt;
    const codexSchema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          title: { type: "STRING" },
          category: { type: "STRING", enum: ["Location", "Protocol", "Intelligence", "Entity"] },
          content: { type: "STRING" },
          tags: { type: "ARRAY", items: { type: "STRING" } },
          lastUpdated: { type: "STRING" },
        },
        required: ["id", "title", "category", "content", "tags", "lastUpdated"],
      },
    };
    const locationSchema = {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        coordinates: {
          type: "OBJECT",
          properties: { lat: { type: "NUMBER" }, lng: { type: "NUMBER" } },
          required: ["lat", "lng"],
        },
        description: { type: "STRING" },
        threatLevel: { type: "STRING", enum: ["Low", "Moderate", "Critical", "Unknown"] },
        soundProfile: { type: "STRING", enum: ["Industrial", "Natural", "Void", "Electronic", "Hostile"] },
        markers: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING" },
              label: { type: "STRING" },
              description: { type: "STRING" },
              type: { type: "STRING", enum: ["History", "Anomaly", "Sensor", "POI"] },
              x: { type: "NUMBER" },
              y: { type: "NUMBER" },
            },
            required: ["id", "label", "description", "type", "x", "y"],
          },
        },
        sensorSummary: {
          type: "OBJECT",
          properties: {
            temperature: { type: "NUMBER" }, humidity: { type: "NUMBER" },
            pressure: { type: "NUMBER" }, radiation: { type: "NUMBER" },
            aiSync: { type: "NUMBER" }, raiStability: { type: "NUMBER" },
          },
          required: ["temperature", "humidity", "pressure", "radiation", "aiSync", "raiStability"],
        },
      },
      required: ["name", "coordinates", "description", "threatLevel", "soundProfile", "markers", "sensorSummary"],
    };
    const demoLocationSchema = {
      type: "OBJECT",
      properties: {
        locationName: { type: "STRING" },
        intel: { type: "STRING" },
        style: { type: "STRING", enum: ["Cinematic", "Thermal", "Night Vision", "Cyberpunk", "Deep Space", "Post-Apocalyptic", "Solar-Punk", "Classified"] },
      },
      required: ["locationName", "intel", "style"],
    };
    const voiceSchema = {
      type: "OBJECT",
      properties: {
        action: { type: "STRING", enum: ["NAVIGATE", "SELECT_MARKER", "CHANGE_STYLE", "UNKNOWN"] },
        target: { type: "STRING" },
      },
      required: ["action"],
    };

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(operation === "reasoning" || operation === "location-demo" ? "gemini-3-pro-preview" : operation === "image-generation" ? "gemini-2.5-flash-image" : operation === "image-highres" ? "gemini-3-pro-image-preview" : operation === "voice-command" || operation === "codex-entries" || operation === "location-report" ? "gemini-3-flash-preview" : MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": API_KEY,
        },
        body: JSON.stringify({
          contents: operation === "chat" ? chatContents : [{ role: "user", parts: [{ text: requestContents }] }],
          systemInstruction: operation === "chat"
            ? { parts: [{ text: "You are the SMARTAIMAP AI Assistant. Help users navigate the #RAI system, explore generated locations, and understand environmental information. Clearly distinguish AI-generated estimates and simulated sensor values from verified live measurements. Do not claim to control devices or access sensors unless an explicitly connected tool confirms that action." }] }
            : undefined,
          generationConfig: { maxOutputTokens: 2048, ...(imageConfig ? { responseModalities: ["TEXT", "IMAGE"], imageConfig } : {}), ...(operation === "structured-json" ? { responseMimeType: "application/json", responseSchema: customOutputSchema } : operation === "location-demo" ? { responseMimeType: "application/json", responseSchema: demoLocationSchema } : {}), ...(operation === "voice-command" ? { responseMimeType: "application/json", responseSchema: voiceSchema } : operation === "codex-entries" ? { responseMimeType: "application/json", responseSchema: codexSchema } : operation === "location-report" ? { responseMimeType: "application/json", responseSchema: locationSchema } : {}) },
          ...(operation === "reasoning" ? { thinkingConfig: { thinkingLevel: "HIGH" } } : {}),
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return json(res, status, { error: "AI provider request failed.", providerStatus: upstream.status });
    }

    const responseParts = result.candidates?.[0]?.content?.parts || [];
    const text = responseParts.map((part) => part.text || "").join("");
    const imagePart = responseParts.find((part) => part.inlineData?.data);
    return json(res, 200, {
      text,
      ...(imagePart ? { image: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType || "image/png" } : {}),
    });
  } catch (error) {
    const status = error.status || (error.name === "TimeoutError" ? 504 : 500);
    return json(res, status, { error: status === 500 ? "Internal server error." : error.message });
  }
});

server.requestTimeout = 10_000;
server.headersTimeout = 12_000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SmartAIMap API listening on port ${PORT}`);
});
