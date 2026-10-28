# Privacy & safety

## What is read

The host service runs `sqlite3 -readonly` against
`~/.local/share/opencode/opencode.db`. It selects OpenAI OAuth rows only: credential
ID, label, active state, access token and ChatGPT account ID. It does **not** select
the whole credential blob, refresh tokens, API keys or MCP credentials.

The service runs with your user’s permissions, **not in an OS sandbox**. Its local
HTTP listener binds to `127.0.0.1` and requires OpenChamber’s service bearer token,
including for health checks. Display preferences use the host’s extension storage.

## What is sent

- **GET** `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` reads credits.
- **POST** to the same URL plus `/consume` requests consumption only after confirmation.
- Both use the account’s access token and `ChatGPT-Account-Id` header. Consumption
  sends `credit_id` and a generated UUID `redeem_request_id`.

The HTTPS origin is fixed and redirects are rejected. Tokens stay in the service;
the panel receives account labels/IDs, credit metadata and fixed error codes.
Upstream error bodies and child-process diagnostics are not forwarded or logged.

## What never happens

No database writes, account switching, automatic sign-in, token refresh, automatic
redemption or automatic consumption retry. The extension does not modify Settings
→ Providers or replace OpenChamber’s usage display. Reading an inactive account
does not activate it. Tests and the synthetic preview do not consume real credits.

## An uncertain result is not a failure

Consumption is irreversible. Before sending, the service re-reads the selected
credit. Duplicate attempts are blocked across surfaces and duplicate credentials
for the same ChatGPT account. A recognized response is shown with Codex’s result
code; HTTP 200 alone is not interpreted as success.

If the response is lost or unrecognized after sending, the result is **unknown**.
The service blocks another attempt for that credit for its remaining lifetime.
**Do not retry.** Refresh to reconcile credit status and verify usage on ChatGPT
before any further action.

These locks are **memory-only**. Restarting, pausing or uninstalling clears the
service’s locks, not the upstream action. It is never evidence that consumption failed.

## Compatibility limits

ChatGPT’s endpoints are internal and may change. Only the default local OpenCode 2
database/schema is supported: not remote servers, custom paths, V1 `auth.json`,
VS Code or mobile hosting. Existing logins can require renewal through OpenCode.
No live credit consumption has been verified. This community extension is not
affiliated with OpenAI.
