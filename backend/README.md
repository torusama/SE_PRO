
## AI v18 semantic continuation fixes

- Conversational/social turns now go to the LLM first; canned greeting/spiritual text is fallback-only.
- Follow-ups such as `hong thich doi cai khac`, `cai khac di`, `lo khac`, `xem them` continue the most recent plot recommendation and exclude the plots already shown in that conversation turn.
- Cultural refinements such as `tam linh di` -> `bat tu` advance to the narrower Bát Tự flow instead of repeating the same generic response.
- Assistant history retrieval includes recommendation metadata so the backend can preserve rejected-option context even when the LLM provider is unavailable.

# Cemetery Management Backend

NestJS + TypeScript backend for the cemetery management system. The API uses PostgreSQL through raw `pg.Pool` queries and keeps the existing schema in `database/DBase.sql`.

The base schema and seed live in `database/DBase.sql`. Versioned migrations
live in `database/migrations` and run automatically during application startup.
The runner uses the `schema_migrations` ledger; see the migration README for
fresh and existing database notes. Do not add migrations under `src`.

## Requirements

- Node.js 24+
- PostgreSQL
- npm

Optional Semantic RAG requires the PostgreSQL `vector` extension from
[pgvector](https://github.com/pgvector/pgvector). For a reproducible Windows
source build and installation guide, see
[PGVECTOR_WINDOWS_SETUP.md](PGVECTOR_WINDOWS_SETUP.md).

## Local Setup

```bash
cd backend
npm install
copy .env.example .env
```

Edit `.env` and set `DATABASE_URL`.

Create and load the database:

```bash
createdb cemetery_db
psql -d cemetery_db -f database/DBase.sql
npm run migration:run
```

Run the API:

```bash
npm run start:dev
```

Local API base URL:

```txt
http://localhost:3001/api
```

## Important Environment Variables

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/cemetery_db
DB_MIGRATIONS_ENABLED=true
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:5173
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_SENDER_EMAIL=your-account@gmail.com
```

Do not commit a real `.env` file. A safe `.env.example` is included.

## AI LLM Routing and Conversation Behavior

The AI agent supports multiple API keys and multiple providers. Routing is designed for low latency and graceful failover:

- A single user turn gets a routing key, so planner/composer calls stay on the same provider and API key when possible.
- When Groq keys are configured, main chat starts with **Groq GPT-OSS 20B**. After each short hedge delay, **Groq GPT-OSS 120B** and **Groq Qwen 3.8 27B** join the race. NVIDIA pools remain later fallbacks. The first contract-valid response wins and losing HTTP requests are aborted. Set `AI_LLM_ROTATE_PROVIDERS=true` only if you intentionally want the first model to rotate between turns.
- The three Groq models have separate key pools (`GROQ_20B_API_KEYS`, `GROQ_120B_API_KEYS`, and `GROQ_QWEN_38_API_KEYS`), so a timeout/rate-limit rotates only that model's keys before the router retries the full model race.
- HTTP 401/403/408/429, 5xx, network failures, timeouts, and empty assistant responses rotate to another configured key/provider instead of being accepted as success.
- A route that is already cooling down is skipped instead of being retried and wasting the full timeout again.
- Normal conversational turns use the LLM planner's `directResponse`. Tool/RAG and transaction turns keep backend data authoritative, then send that grounded result to the LLM for the final wording. A deterministic answer is retained only after all configured routes fail.
- `AI_LLM_WRITES_CONVERSATIONAL_TURNS=true` is the default. Set it to `false` only for an offline/emergency mode that uses local conversational responses.
- The planner gives the measured healthy route enough time to emit final text, then uses a bounded cross-provider budget; grounded composition has its own bounded budget.
- History, pending-action lookup, and memory-context loading have small latency guards. RAG/DB context can fall back for the current turn instead of holding the whole HTTP request open.

Latency/failover can be tuned with:

```env
AI_LLM_TOTAL_TIMEOUT_MS=10000
AI_LLM_MAX_TOTAL_TIMEOUT_MS=12000
AI_LLM_PROVIDER_TIMEOUT_MS=6000
AI_LLM_HEDGE_PROVIDERS=true
AI_LLM_HEDGE_DELAY_MS=900
AI_LLM_MAX_KEY_ROUNDS=2
AI_LLM_WRITES_CONVERSATIONAL_TURNS=true
AI_LLM_PROVIDER_COOLDOWN_MS=0
AI_LLM_TRANSIENT_KEY_COOLDOWN_MS=800
AI_LLM_ROTATE_PROVIDERS=false
OPENAI_TIMEOUT_MS=7000
OPENAI_TOTAL_TIMEOUT_MS=12000
OPENAI_MAX_ATTEMPTS=2
NVIDIA_TIMEOUT_MS=7000
NVIDIA_TOTAL_TIMEOUT_MS=12000
NVIDIA_MAX_ATTEMPTS=2
```

Multiple Groq keys can be written one per line in the existing wrapped format:

```env
GROQ_20B_API_KEYS="{
  gsk_key_1
  gsk_key_2
}"
```

The same format works for every `*_API_KEYS` variable. JSON arrays and comma/space/semicolon-separated values are also accepted.

The concierge uses semantic LLM planning as the primary conversational decision. Ordinary in-scope conversation, contextual follow-ups, and explicit memory requests are not automatically converted into budget/plot-count questions. Unrelated topics are declined briefly and redirected back to Vĩnh Phúc Viên scope. Explicit reusable consultation preferences (for example, preferring future discussion to emphasize phong thủy/cultural guidance) can be stored as a user-scoped preference when backend validation succeeds. Colloquial Vietnamese self-reference such as `tui`, `t`, `tao`, `em`, etc. is accepted for clear preference statements. A conservative backend backstop recovers an obvious explicit preference if the LLM forgets to emit `memoryProposals`; backend validation still decides whether it is saved. Questions such as “bạn biết tui thích gì không?” are never treated as new preferences.

## Persistent Personal Memory and Safe RAG

The Agent now uses two memory layers on every chat turn:

1. **Short-term conversation memory**: recent `ai_messages` for the current conversation are loaded from PostgreSQL and sent to the planner so follow-up questions can be resolved naturally.
2. **Persistent long-term memory / RAG**: active user preferences and verified global knowledge are loaded from `ai_knowledge_entries` and injected into the LLM prompt as contextual data.

Persistent user memory remains isolated by `owner_user_id`; one customer's private preferences are never retrieved for another customer. The Agent may propose reusable preferences (for example budget, preferred zone, accessibility priority, response style, service interest, or consultation-topic preference). Backend validation decides whether the proposal is actually stored. Duplicate content is rejected, a newer value for the same `memory_key` supersedes the previous active value, and sensitive/ambiguous preferences remain blocked.

Semantic RAG follows the safe retrieval design from the learning architecture:

- Migration `024_ai_knowledge_embeddings.sql` introduced the original vector column; migration `025_switch_rag_to_nvidia_bge_m3.sql` upgrades it to `VECTOR(1024)` and clears incompatible old vectors. The current runtime then recreates missing vectors with the configured NVIDIA NIM embedding model.
- Only `is_active=TRUE` + `validation_status='active'` knowledge is eligible for vector retrieval. Raw `ai_messages`, quarantined proposals, and unapproved corrections are never placed into RAG.
- Retrieval first applies hard filters (`scope`, `owner_user_id`, active/effective dates, and the exact embedding model), then ranks the safe candidate pool by cosine distance. User memory and verified global knowledge remain separate prompt sections.
- The current user question is embedded as `input_type=query`; stored memory/knowledge is embedded as `input_type=passage`. This is important for NVIDIA Retriever embedding models and improves semantic retrieval quality. A direct “what do you remember about me?” request skips both the external embedding call and the LLM, and reads active user memory exactly from PostgreSQL. Memory state is authoritative backend data, so the model is not allowed to guess what was saved. This also makes that check return quickly even when NVIDIA is slow or unavailable.
- The current default embedding model is `nvidia/llama-nemotron-embed-1b-v2` through NVIDIA NIM and the RAG store remains pinned to 1024-dimensional dense vectors. The model can be overridden with `AI_EMBEDDING_MODEL` only when its output remains compatible with the configured pgvector dimension.
- If the embedding API, pgvector extension, vector dimension, or vector query is unavailable, the same request immediately falls back to the existing structured SQL memory retrieval. RAG failure never blocks the primary Agent workflow.
- The migration runner treats the two pgvector-only migrations as optional. On a PostgreSQL host that does not expose the `vector` extension, it defers only those migrations, continues independent schema migrations, and retries them automatically on later startups if the extension becomes available. It does not write deferred migrations into `schema_migrations`, so no checksum or feature state is faked.
- Existing active knowledge can be backfilled at startup in small low-priority batches. Startup backfill is delayed 15 seconds, processes 5 rows per batch by default, and drains up to 25 missing active entries per startup window so older KB rows are not permanently left outside semantic retrieval. New validated user memory and newly activated verified knowledge are embedded after the database transaction commits; embedding is non-blocking for persistence.

Embedding configuration (no extra OpenAI key required):

```env
AI_RAG_ENABLED=true
AI_EMBEDDING_API_BASE_URL=https://integrate.api.nvidia.com/v1
AI_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-1b-v2
AI_EMBEDDING_DIMENSION=1024
AI_EMBEDDING_TIMEOUT_MS=1000
AI_EMBEDDING_TOTAL_TIMEOUT_MS=1400
AI_EMBEDDING_MAX_ATTEMPTS=2
AI_RAG_USER_LIMIT=8
AI_RAG_GLOBAL_LIMIT=6
AI_RAG_BACKFILL_ON_STARTUP=true
AI_RAG_BACKFILL_BATCH_SIZE=5
AI_RAG_BACKFILL_MAX_ENTRIES=25
```

By default the embedding client reuses the existing `NVIDIA_API_KEY` / `NVIDIA_API_KEYS` pool, including the legacy multiline wrapped format. `AI_EMBEDDING_API_KEY` / `AI_EMBEDDING_API_KEYS` remain optional overrides only if you intentionally want a separate NVIDIA NIM key pool for embedding requests.

The "self-learning" system is intentionally not foundation-model self-training. It is a controlled continual-learning pipeline: the LLM proposes memories/signals, backend code validates and persists them, approved knowledge becomes retrievable context, and recommendation feedback becomes `ai_learning_signals`. Complete pairwise recommendation signals are converted into positive/negative `ai_training_samples` only when an authenticated administrator explicitly starts PlotRanker retraining. Training creates a candidate model that must pass the metric gate and still be explicitly activated by an administrator. This keeps audit/version/rollback behavior intact while making the learning-signal pipeline usable.

Email is sent from a personal Gmail account through the Gmail HTTPS API. Enable
the Gmail API in Google Cloud, create an OAuth client of type `Desktop app`, set
the client ID/secret and sender address in `.env`, then authorize once:

```bash
npm run email:gmail:authorize
```

The command prints an authorization URL and stores the returned refresh token
directly in `.env` without printing the token to the terminal.

## Implemented MVP Modules

- Database module with `query`, `queryOne`, and `transaction`
- Auth with register/login/me/logout, JWT, bcrypt
- Role guards for `admin` and `customer`
- Users admin/customer endpoints
- Plots endpoints and `/plots/map` for the 2D map
- Purchase requests with draft/submit, immediate pre-approval cancellation, and post-approval cancellation review transactions; a pending review locks appointment and contract workflow until an admin approves or rejects it.
- Contracts and payment recording
- Cemetery service types/orders
- Notifications for polling
- Dashboard summary/statistics
- Rule-based AI recommendation prototype
- Upload placeholder endpoints for later Cloudinary integration

## Render Deploy

Render Web Service settings:

```txt
Root Directory: backend
Build Command: npm install && npm run build
Start Command: npm run start:prod
```

Set production env vars in Render, especially `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `PORT`.
Keep the `database/migrations` directory in the deployment artifact because the
production startup runs pending migrations from it.

## API Documentation

See `API_DOCUMENTATION.md`.

## AI Agent v6 — Context-first conversation state

The Agent now builds a trusted conversation state before LLM planning:

1. Recent user turns are parsed for reusable hard requirements.
2. Active persistent user preferences are loaded directly from PostgreSQL.
3. The latest user message overrides older history/memory when it supplies a new value.
4. This merged state is injected as `<TRUSTED_CONVERSATION_STATE>` into the planner prompt.
5. The backend merges the trusted state back into the planner output so the LLM cannot accidentally drop a known budget/zone/direction.

Important semantics:
- `numberOfPlots` means the number of plots acquired together in one option, **not** the number of recommendation cards the user wants to see.
- Vietnamese requests such as `gợi ý vài lô` are treated as requests for several alternative single-plot options unless the user explicitly requests multiple plots together.
- If a maximum budget is already saved, plot recommendation reuses it automatically and must not ask for it again.
- If the LLM planner fails, the rule-based fallback receives the same trusted requirements and can still run the authoritative recommendation service instead of restarting the questionnaire.
- Questions such as `bạn có biết tui thích khu nào không?` are answered from active user memory directly without relying on the LLM or embedding API.

Prompt version: `cemetery-agent-v14-context-first`.

## AI reliability / safety notes (v7)

- High-confidence out-of-scope requests (news/politics/sports/programming/etc.) are refused locally before an external LLM call so provider timeouts cannot accidentally turn them into cemetery-memory replies.
- Short confirmation follow-ups such as `sure?`, `chắc không?`, `đúng không?` are resolved from the immediately preceding assistant turn instead of restarting the consultation.
- Natural-language chat is not an operational admin console. Customer/admin chat cannot change reservation TTLs, discounts, prices, roles, permissions, or runtime configuration.
- Runtime purchase-request timing is grounded to the backend implementation: submitted/pending requests temporarily lock the plot for **30 minutes** to prevent concurrent purchases; if they remain pending/submitted past that lock, the expiration job releases the plot. An approved purchase then uses `reserved` only as an internal pre-ownership workflow status.
- Admin knowledge moderation endpoints:
  - `GET /admin/ai-agent/knowledge?status=quarantined`
  - `GET /admin/ai-agent/knowledge/:id`
  - `PATCH /admin/ai-agent/knowledge/:id/approve`
  - `PATCH /admin/ai-agent/knowledge/:id/reject`
  These endpoints validate JWT admin role and keep an audit/version trail. They deliberately reject attempts to use knowledge approval to change runtime operational behavior.
- The existing verified-correction workflow remains the recommended way to fix a wrong AI fact:
  1. Customer submits `POST /ai-agent/feedback` with `feedbackType=wrong_information` and `correctedContent`.
  2. Admin lists `GET /admin/ai-agent/feedback?status=pending`.
  3. Admin calls `PATCH /admin/ai-agent/feedback/:id/approve` with `{ "applyCorrection": true }` after verification.
  4. The correction becomes active verified global knowledge and is embedded asynchronously for RAG.


## AI consultation flow v8 — action-first continuity

The customer consultation flow now treats persistent memory as silent working context rather than a response template.

- Clear plot-discovery turns (`gợi ý lô`, `cho xem vài lô`, or a contextual follow-up such as `ok vậy gợi ý đi`) are routed locally to the authoritative plot recommendation service without spending an LLM request just to decide that inventory should be searched.
- If a saved budget exists it is reused automatically. If no budget exists, the Agent browses available plots first instead of blocking the customer with a questionnaire.
- Unless the customer explicitly asks to acquire multiple plots together, `numberOfPlots` defaults to `1`; the recommendation service still returns up to three alternative options.
- Conversation continuity now looks at the latest meaningful domain intent and the preceding assistant turn, so colloquial Vietnamese follow-ups do not reset to `general_question`.
- A successful backend tool result is formatted directly and returned to the customer. The old second LLM "composer" call is skipped for tool actions, removing one major source of latency/timeouts.
- If every LLM provider fails, plot discovery still executes from local trusted context and PostgreSQL inventory. Generic failure handling no longer dumps saved preference summaries.
- Operational/process requests (`đặt mua`, `quy trình`, `hợp đồng`, etc.) are intentionally excluded from the deterministic inventory router so they continue through the protected purchase workflow.

Prompt version: `cemetery-agent-v16-consultation-state`.

## AI Concierge v17 - human conversation + quick replies

- High-confidence social turns (greetings including common typos/slang, thanks, goodbyes, pure frustration/profanity, capability questions, and vague spiritual/cultural openings) are answered locally and naturally so they do not collapse into a generic timeout fallback.
- Mixed frustration + a real cemetery question still goes through semantic planning so the assistant can acknowledge the tone **and** answer the actual question.
- The prompt now explicitly handles Vietnamese chat slang/misspellings and treats vague `tâm linh` requests as in-scope cultural/phong-thủy consultation.
- Relevant responses now include `quickReplies`. A quick reply contains `{ id, label, message, emphasis }`; the frontend should render `label` as underlined text and submit `message` through the normal chat endpoint when clicked.
- Recommendation responses can expose quick replies such as `Xem lô <code>`, `Mua lô <code>`, and `So sánh các phương án`. Service/Bazi responses expose context-specific next steps.
- Conversation history preserves `quickReplies` after reload.
- See `frontend-integration/AI_QUICK_REPLIES_PATCH.md` and `AI_AGENT_V17_TEST_GUIDE.md`.
