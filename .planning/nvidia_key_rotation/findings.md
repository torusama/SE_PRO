# Findings

- The UI fallback appeared after about 60.3 seconds, which is consistent with the AI provider request timing out before the orchestrator used its rule-based fallback.
- The requested behavior is credential rotation/failover for several NVIDIA API keys, while retaining the existing single-key configuration.
- `NvidiaNemotronService` currently performs exactly two attempts with the same `NVIDIA_API_KEY`.
- Each attempt uses the configured 30-second timeout, explaining the observed roughly 60-second fallback.
- Only HTTP 5xx and timeout errors are retried today; rate limits, invalid credentials, and network failures do not move to another credential.
- Configuration currently exposes only `ai.nvidia.apiKey`; multi-key and cooldown settings do not exist yet.
- `backend/.env` currently contains one unique legacy NVIDIA key and no `NVIDIA_API_KEYS` value.
- A live direct provider smoke request returned HTTP 200 in 869 ms, so the configured key is currently valid; the screenshot was a transient timeout rather than a permanently invalid key.
- The restarted backend returned HTTP 200 with 36 plots in 554 ms.
