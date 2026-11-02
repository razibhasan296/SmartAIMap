import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_RATE_LIMIT_KEYS = 10_000;
const clients = new Map();

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

async function readJson(req) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error("Request body too large"), { status: 413 });
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
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

  if (req.method !== "POST" || req.url !== "/api/generate") {
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
    const body = await readJson(req);
    const allowedOperations = ["generate", "reasoning", "voice-command", "codex-entries", "location-report", "chat", "structured-json", "location-demo"];
    const operation = body.operation ?? "generate";
    if (typeof operation !== "string" || !allowedOperations.includes(operation)) {
      return json(res, 400, { error: "Unsupported generation operation." });
    }
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > 12_000) {
      return json(res, 400, { error: "prompt must contain 1–12000 characters." });
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
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(operation === "reasoning" || operation === "location-demo" ? "gemini-3-pro-preview" : operation === "voice-command" || operation === "codex-entries" || operation === "location-report" ? "gemini-3-flash-preview" : MODEL)}:generateContent`,
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
          generationConfig: { maxOutputTokens: 2048, ...(operation === "structured-json" ? { responseMimeType: "application/json", responseSchema: customOutputSchema } : operation === "location-demo" ? { responseMimeType: "application/json", responseSchema: demoLocationSchema } : {}), ...(operation === "voice-command" ? { responseMimeType: "application/json", responseSchema: voiceSchema } : operation === "codex-entries" ? { responseMimeType: "application/json", responseSchema: codexSchema } : operation === "location-report" ? { responseMimeType: "application/json", responseSchema: locationSchema } : {}) },
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

    const text = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || "";
    return json(res, 200, { text });
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
