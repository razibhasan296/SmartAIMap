# Security notes

## Current protections

- Never commit API keys, access tokens, or private credentials.
- The backend foundation reads Gemini credentials only from the server runtime environment.
- Browser camera and microphone features must be started by an explicit user action and remain subject to browser permission prompts.
- Location access must be opt-in and explain why coordinates are needed.
- UI-generated sensor values and simulated bot motion are demonstrations, not verified hardware telemetry.
- The included in-memory rate limiter is a starter control only. Production deployments need a shared rate-limit store, authentication where appropriate, HTTPS, monitoring, and provider spend limits.

## Migration status: incomplete

Four of the 14 reviewed Gemini operations now call the same-origin backend endpoint: `complexReasoning`, `processVoiceCommand`, `getCodexEntries`, and `generateLocationData`. The server selects each operation’s model and configuration and validates structured voice-command, Codex, and location-report output against fixed JSON schemas. Location report values are AI-generated estimates, not live sensor telemetry.

The remaining browser-side Gemini service still initializes `GoogleGenAI` from `process.env.API_KEY`. The Vite build configuration has historically exposed API-key environment values to browser code. This partial migration does not remove that exposure.

Do not deploy this branch as a completed secret-migration fix. Before public deployment:

1. Move every remaining Gemini operation behind server-owned endpoints with a fixed operation allowlist and server-selected model/configuration.
2. Validate each operation's inputs, MIME types, output sizes, and timeouts on the server. Never trust a browser-supplied model, schema, or generation configuration.
3. Preserve the current service function contracts while replacing browser SDK calls with same-origin API requests.
4. Cover text, structured JSON, location analysis, image generation, audio transcription and speech, video analysis, chat history, and Veo's long-running operation/poll/download flow.
5. Remove the browser SDK dependency and Vite key definitions only after all call sites have migrated.
6. Run type checks and a production build; inspect generated assets to confirm that no provider key or privileged credential is present.

## Reviewed Gemini operation inventory

- Structured extraction: `generateJsonFromPrompt` — migrated; server validates a restricted schema subset
- Location report: `generateLocationData` — migrated to backend
- Panorama image: `generate360View` — migrated to bounded server image endpoint
- Video analysis: `analyzeVideo` — migrated to the Interactions API; inline uploads capped at 12MB and MIME allowlisted
- Complex reasoning: `complexReasoning` — migrated to backend
- Audio transcription: `transcribeAudio` — migrated to an 8MB-capped WAV endpoint
- Speech synthesis: `generateSpeech` — migrated to server-side TTS with a 6,000-character input limit
- Voice command parsing: `processVoiceCommand` — migrated to backend
- Chat: `chatWithGemini` — not migrated
- Maps grounding: `getMapsGrounding` — not migrated; no active caller identified in the reviewed source search
- High-resolution image: `generateHighResImage` — migrated with server-validated size and aspect ratio
- Video generation: `generateVeoVideo` — not migrated; the existing Veo 3.1 Preview model was shut down on 2026-10-22. Replace it with Gemini Omni Flash (`gemini-omni-1.1-flash`) using the Interactions API before enabling video generation.
- Codex entries: `getCodexEntries` — migrated to backend
- Classified-code narrative: `decryptClassifiedCode` — not migrated; AI-generated narrative only, not cryptographic decryption or authorization

## Production hardening

The process-local IP limiter is not suitable as a production abuse-control boundary: it resets on restart, is not shared across instances, and its client map is bounded only per process. Use a shared store and trusted-proxy-aware client identity. Add authentication/authorization, request quotas, provider spend caps, structured monitoring, and HTTPS before exposing generation endpoints publicly.


## Video API migration notes

- Short video analysis uses the Gemini Interactions API with `gemini-3.8-flash`; inline video is capped at 12MB and accepted MIME types are explicitly allowlisted.
- Larger/longer video uploads require a separate managed File API flow; do not raise the inline request limit without revisiting the provider's request-size guidance.
- The legacy `veo-3.1-fast-generate-preview` integration is intentionally not exposed because Veo 3.1 Preview was shut down on 2026-10-22. Video generation needs a separate migration to Gemini Omni Flash via Interactions API, including asynchronous status polling and server-controlled result retrieval.
