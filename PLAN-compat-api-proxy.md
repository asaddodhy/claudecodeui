# Plan: OpenAI & Anthropic Compatible API Proxy

## Context

The app already runs an Express server on port 3001 with a working Claude Code SDK integration (`server/claude-sdk.js`). There's an existing `/api/agent` endpoint (`server/routes/agent.js`) that demonstrates the full pattern: HTTP request → `queryClaudeSDK()` → streaming/non-streaming response via `SSEStreamWriter`/`ResponseCollector`.

The goal is to add standard API endpoints so any app on the machine using an OpenAI or Anthropic SDK can point its `base_url` to `http://localhost:3001/v1` and get Claude Code responses — making this app act as a local AI gateway.

## New Files

```
server/routes/compat/
  index.js                      — Router mounting both sub-routers + /v1/models
  openai-compat.js              — POST /v1/chat/completions
  anthropic-compat.js           — POST /v1/messages
  middleware/
    compat-auth.js              — Bearer token + X-API-Key validation
    compat-gate.js              — Feature toggle check (off by default)
    concurrency-limiter.js      — Semaphore, returns 429 when full
  translators/
    openai-translator.js        — OpenAI messages[] ↔ prompt/response translation
    anthropic-translator.js     — Anthropic messages[] ↔ prompt/response translation
    model-map.js                — Model name → Claude Code internal model
```

## Key Modified Files

- **`server/index.js`** — Add `app.use('/v1', compatRoutes)` near existing route registrations (~line 219)
- **`server/routes/settings.js`** — Add GET/PUT `/api/settings/compat-api` for toggling the feature

## How It Works

### Request Flow

```
Client (e.g. Cursor, Continue, any OpenAI SDK app)
  → POST /v1/chat/completions  (or /v1/messages)
  → [compat-gate] → [compat-auth] → [concurrency-limiter]
  → Translate request format → extract prompt + model
  → queryClaudeSDK(prompt, { permissionMode: 'bypassPermissions', ... }, writer)
  → Writer intercepts NormalizedMessages, translates to OpenAI/Anthropic SSE format
  → Stream back to client
```

### Request Translation

**OpenAI** (`/v1/chat/completions`):
- `messages[]` concatenated into a single prompt (system messages prepended, assistant messages included as context, last user message is the prompt)
- `model` mapped via `model-map.js` (e.g. `gpt-4` → default, `claude-sonnet-4-*` → sonnet)
- `stream` boolean determines writer type
- `tools`, `temperature`, `top_p` etc. silently accepted and ignored

**Anthropic** (`/v1/messages`):
- `system` (top-level) + `messages[]` → prompt
- `model` mapped similarly
- `max_tokens` accepted but ignored (SDK manages its own limits)

### Response Translation

The writers intercept `NormalizedMessage` objects (kinds: `text`, `stream_delta`, `stream_end`, `thinking`, `tool_use`, `tool_result`, `complete`, `error`, `status`, etc.) and translate:

**OpenAI streaming**: Each text/stream_delta → `data: {"choices":[{"delta":{"content":"..."}}]}`, completion → `data: [DONE]`

**Anthropic streaming**: `message_start` → `content_block_start` → `content_block_delta` (per chunk) → `content_block_stop` → `message_delta` → `message_stop`

Internal events (`tool_use`, `tool_result`, `permission_request`, `status`, `session_created`) are skipped — the caller only sees the final assistant text output.

Non-streaming modes collect all messages and return a single JSON response in the respective format.

### Auth

Reuses existing `apiKeysDb.validateApiKey()` from `server/modules/database/repositories/api-keys.ts`. Accepts:
- `Authorization: Bearer <api-key>` (what OpenAI/Anthropic SDKs send)
- `X-API-Key: <api-key>` (existing app convention)

### Feature Gate

Off by default. Toggled via new setting `compat_api_enabled` stored in `appConfigDb`. The gate middleware returns 403 when disabled. A settings endpoint lets the frontend toggle it.

### Concurrency

Simple in-memory counter (default max: 2). Requests beyond the limit get 429 with `Retry-After`. Counter decrements on `res.on('close')` to handle client disconnects.

### SDK Call

Follows the exact pattern from `agent.js:959-966`:
```js
await queryClaudeSDK(prompt, {
  projectPath,
  cwd: projectPath,
  sessionId: null,          // always new session
  model: resolvedModel,
  permissionMode: 'bypassPermissions'
}, writer);
```

Project path comes from `compat_api_default_project_path` setting, overridable per-request via `X-Project-Path` header.

## Implementation Order

1. `model-map.js` — model name resolution
2. `compat-gate.js` + `compat-auth.js` + `concurrency-limiter.js` — middleware
3. `openai-translator.js` — request/response translation
4. `openai-compat.js` — route handler with custom SSE/collector writers
5. `anthropic-translator.js` — request/response translation  
6. `anthropic-compat.js` — route handler
7. `index.js` (compat router) + mount in `server/index.js`
8. Settings endpoint for enable/disable
9. `/v1/models` endpoint

## Known Limitations

1. **No real multi-turn** — each request creates a new Claude Code session; conversation history in `messages[]` is flattened into a single prompt
2. **No function/tool calling passthrough** — Claude Code uses its own tools internally; caller-defined tools are ignored
3. **No embeddings** — no `/v1/embeddings` endpoint
4. **No image input** — multi-modal content blocks rejected
5. **Token usage approximate** — `usage` fields may be zeros
6. **Latency** — Claude Code operations (file edits, test runs) can take 30-120s; first content chunk may be delayed
7. **Single project context** — all requests target one project directory unless `X-Project-Path` is sent
8. **No abort** — client disconnect triggers cleanup attempt but session teardown isn't instant

## Verification

1. Enable via settings endpoint, create an API key in the app
2. Test with `curl` — streaming and non-streaming for both endpoints
3. Test with OpenAI Python SDK: `openai.OpenAI(base_url="http://localhost:3001/v1", api_key="ck_...")`
4. Test with Anthropic Python SDK: `anthropic.Anthropic(base_url="http://localhost:3001/v1", api_key="ck_...")`
5. Verify 403 when feature disabled, 401 with bad key, 429 at concurrency limit
