# Security notes

- Never commit API keys, access tokens, or private credentials.
- Gemini credentials must be set only in the server runtime environment.
- Browser camera and microphone features must be started by an explicit user action and remain subject to browser permission prompts.
- Location access must be opt-in and explain why coordinates are needed.
- UI-generated sensor values and simulated bot motion are demonstrations, not verified hardware telemetry.
- The included in-memory rate limiter is a starter control only. Production deployments need a shared rate-limit store, authentication where appropriate, HTTPS, monitoring, and provider spend limits.
