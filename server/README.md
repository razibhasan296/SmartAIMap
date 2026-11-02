# SmartAIMap API

A dependency-free Node.js API boundary for Gemini requests.

## Run

1. Use Node.js 20 or newer.
2. Set `GEMINI_API_KEY` in the server environment (never in a Vite client variable).
3. Start with `npm run server`.
4. Check `GET /api/health`.
5. Send `POST /api/generate` with JSON: `{"prompt":"..." }`.

The API limits request bodies, validates prompt length, applies a basic per-IP in-memory rate limit, times out upstream calls, and does not return provider error bodies or credentials.

For production, put this service behind HTTPS and a trusted reverse proxy; replace the in-memory limiter with a shared store (such as Redis), add authentication/authorization, structured audit logging, and provider spend quotas. The in-memory limiter is process-local and is not a substitute for an edge/API gateway.
