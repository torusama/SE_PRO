# NVIDIA API key rotation

## Goal

Keep the AI agent available when one NVIDIA API key times out, is rate-limited, or fails by rotating across configured keys and failing over within the same chat request.

## Phases

- [completed] Inspect the current NVIDIA client, configuration, tests, and the latest fallback evidence.
- [completed] Implement secure multi-key parsing, round-robin selection, retry/failover, and cooldowns.
- [completed] Add focused tests for rotation, retryable failures, and non-retryable failures.
- [completed] Build, lint, restart the backend, and verify the live API.

## Constraints

- Never print or log API key values.
- Keep `NVIDIA_API_KEY` backward compatible.
- Accept multiple keys through `NVIDIA_API_KEYS`.
- Try a configured key at most once per logical NVIDIA request.
- Do not retry request/schema failures that another key cannot fix.
- Bound per-key and total wait time so failover does not multiply the current 60-second delay.

## Decisions

- The first implementation rotates NVIDIA credentials for the same API/provider and model.
- The database and deterministic backend tools remain authoritative; only the AI provider call is retried.
- Up to three distinct keys are attempted by default within a shared 55-second budget.
- Keys that fail with timeout/network/429/5xx are cooled for 60 seconds; 401/403 keys are cooled for 10 minutes.
- HTTP 400-class request errors other than 401/403/408/429 fail immediately because changing credentials cannot repair the request.

## Errors

- The restart check initially raced the Windows port table and reported no listener; the launched process was actually healthy and owned port 5000. A diagnostic second launch correctly reported `EADDRINUSE`, confirming the first process was already serving.
