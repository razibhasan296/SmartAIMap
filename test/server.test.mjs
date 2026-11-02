import { spawn } from "node:child_process";
import { once } from "node:events";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";

const port = 19000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), GEMINI_API_KEY: "test-placeholder" },
    stdio: "ignore",
  });
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("API server did not start")), 8000);
    const poll = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) {
          clearTimeout(deadline);
          resolve();
          return;
        }
      } catch {}
      if (server.exitCode !== null) {
        clearTimeout(deadline);
        reject(new Error(`API server exited with code ${server.exitCode}`));
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  });
});

after(() => {
  server?.kill("SIGTERM");
});

test("health endpoint reports the API service", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "smart-ai-map-api" });
});

test("unknown routes return 404", async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(response.status, 404);
});

test("generation endpoint rejects non-JSON requests", async () => {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not json",
  });
  assert.equal(response.status, 415);
});


test("unknown generation operations are rejected", async () => {
  const response = await fetch(`${baseUrl}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "unlisted-operation", prompt: "hello" }) });
  assert.equal(response.status, 400);
});

test("structured extraction rejects unsupported schema keywords", async () => {
  const response = await fetch(`${baseUrl}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "structured-json", prompt: "extract names", schema: JSON.stringify({ type: "OBJECT", properties: { name: { type: "STRING", $ref: "#/bad" } } }) }) });
  assert.equal(response.status, 400);
});

test("structured extraction rejects deeply nested schemas", async () => {
  let schema = { type: "STRING" };
  for (let index = 0; index < 8; index += 1) schema = { type: "ARRAY", items: schema };
  const response = await fetch(`${baseUrl}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "structured-json", prompt: "extract", schema: JSON.stringify(schema) }) });
  assert.equal(response.status, 400);
});
