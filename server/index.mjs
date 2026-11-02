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
    const operation = ["generate", "reasoning", "voice-command"].includes(body.operation) ? body.operation : "generate";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > 12_000) {
      return json(res, 400, { error: "prompt must contain 1–12000 characters." });
    }

    const requestContents = operation === "voice-command"
      ? `Interpret this voice command for the #RAI system: "${prompt}". Possible actions: NAVIGATE (go to a location), SELECT_MARKER (interact with a point of interest), CHANGE_STYLE (change visual lens), UNKNOWN (unrecognized). Return only the requested structured result.`
      : prompt;
    const voiceSchema = {
      type: "OBJECT",
      properties: {
        action: { type: "STRING", enum: ["NAVIGATE", "SELECT_MARKER", "CHANGE_STYLE", "UNKNOWN"] },
        target: { type: "STRING" },
      },
      required: ["action"],
    };

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(operation === "reasoning" ? "gemini-3-pro-preview" : operation === "voice-command" ? "gemini-3-flash-preview" : MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: requestContents }] }],
          generationConfig: { maxOutputTokens: 2048, ...(operation === "voice-command" ? { responseMimeType: "application/json", responseSchema: voiceSchema } : {}) },
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
