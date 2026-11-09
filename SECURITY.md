# Security notes

## Implemented protections in this branch

- Gemini provider credentials are read by the Node.js server from `GEMINI_API_KEY`; Vite no longer injects API-key environment variables into the browser bundle.
- Browser-side Gemini SDK initialization and the legacy Veo request/download flow have been removed from the frontend service.
- The chat UI no longer advertises the legacy `/video` command.
- The existing API validates request bodies and operation inputs, applies request timeouts, and avoids returning upstream provider error bodies.
- Browser camera and microphone features must be started by an explicit user action and remain subject to browser permission prompts.
- Location access must be opt-in and explain why coordinates are needed.
- UI-generated sensor values and simulated bot motion are demonstrations, not verified hardware telemetry.

## Remaining security work — do not treat this branch as production-ready

- **Authentication enforcement is implemented on the API.** Every supported POST endpoint now requires a Firebase ID token in `Authorization: Bearer <token>`. The Node.js server validates the RS256 signature against Google's published Secure Token certificates and checks issuer, audience, subject, and token timestamps. Configure `FIREBASE_PROJECT_ID` in the server runtime. The frontend sign-in flow and per-user authorization/roles are not yet implemented; clients must obtain Firebase ID tokens through a trusted sign-in integration before calling the API.
- The in-memory IP rate limiter is process-local and is not a production abuse-control boundary. Replace it with a shared store (for example, Redis or a managed rate-limit service) and configure trusted-proxy handling.
- Add per-user quotas, provider spend caps, structured monitoring, alerting, HTTPS, and deployment-level request limits.
- The Maps grounding operation is intentionally disabled in the browser until it is migrated to a server-owned endpoint.
- Video generation is intentionally disabled. The legacy `veo-3.1-fast-generate-preview` flow must not be restored; implement and validate a supported server-side model/API flow before re-enabling it.
- `@google/genai` may remain in the dependency lockfile until the dependency cleanup and lockfile are regenerated; it is no longer imported by the browser service.

## Gemini operation migration notes

The app's remaining Gemini operations call same-origin server endpoints. The server must continue to own model selection, provider credentials, generation configuration, input validation, output limits, and upstream timeouts. Never accept a browser-supplied provider key or privileged model configuration.

Maps grounding has no active caller in the reviewed source inventory and is disabled pending a server endpoint. Video generation is disabled pending a supported server-side implementation. AI-generated location reports are estimates, not live sensor telemetry.

## Deployment gate

Do not deploy as a finished production service until the Firebase client sign-in flow is integrated, `FIREBASE_PROJECT_ID` is configured, shared rate limiting and per-user quotas are configured, and a production build has been inspected to confirm that no provider key or privileged credential is present. The test-only authentication bypass is enabled exclusively when `NODE_ENV=test`; never set that value in a deployed runtime.
