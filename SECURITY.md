# Security notes

## Current protections

- Never commit API keys, access tokens, or private credentials.
- The backend foundation reads Gemini credentials only from the server runtime environment.
- Browser camera and microphone features must be started by an explicit user action and remain subject to browser permission prompts.
- Location access must be opt-in and explain why coordinates are needed.
- UI-generated sensor values and simulated bot motion are demonstrations, not verified hardware telemetry.
- The included in-memory rate limiter is a starter control only. Production deployments need a shared rate-limit store, authentication where appropriate, HTTPS, monitoring, and provider spend limits.

## Migration status: incomplete

The existing browser-side Gemini service still initializes `GoogleGenAI` from `process.env.API_KEY`. The Vite build configuration has historically exposed API-key environment values to browser code. The backend foundation does not, by itself, remove that exposure.

Do not deploy this branch as a completed secret-migration fix. Before public deployment:

1. Move every Gemini operation behind server-owned endpoints with a fixed operation allowlist and server-selected model/configuration.
2. Validate each operation's inputs, MIME types, output sizes, and timeouts on the server. Never trust a browser-supplied model, schema, or generation configuration.
3. Preserve the current service function contracts while replacing browser SDK calls with same-origin API requests.
4. Cover text, structured JSON, location analysis, image generation, audio transcription and speech, video analysis, chat history, and Veo's long-running operation/poll/download flow.
5. Remove the browser SDK dependency and Vite key definitions only after all call sites have migrated.
6. Run type checks and a production build; inspect generated assets to confirm that no provider key or privileged credential is present.

## Known frontend Gemini operation inventory

- Structured extraction: `generateJsonFromPrompt`
- Location report: `generateLocationData`
- Panorama image: `generate360View`
- Video analysis: `analyzeVideo`
- Complex reasoning: `complexReasoning`
- Audio transcription: `transcribeAudio`
- Speech synthesis: `generateSpeech`
- Voice command parsing: `processVoiceCommand`
- Chat: `chatWithGemini`
- Maps grounding: `getMapsGrounding` (no active caller identified in the reviewed source search)
- High-resolution image: `generateHighResImage`
- Veo video generation: `generateVeoVideo`
- Codex entries: `getCodexEntries`
- Classified-code narrative: `decryptClassifiedCode` (AI-generated narrative only; not cryptographic decryption or authorization)

## Production hardening

The process-local IP limiter is not suitable as a production abuse-control boundary: it resets on restart, is not shared across instances, and its client map is unbounded. Use a shared store and trusted-proxy-aware client identity. Add authentication/authorization, request quotas, provider spend caps, structured monitoring, and HTTPS before exposing generation endpoints publicly.
