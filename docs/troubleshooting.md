# Troubleshooting

Start with **Refresh**. It bypasses the normal 30-second read cache. Do not interpret
an account error as zero credits; other readable accounts can still show their credits.

::: danger Uncertain consumption
For `REDEMPTION_UNKNOWN` or `ALREADY_REQUESTED`, **do not retry**. Refresh and check
the account’s usage on ChatGPT. Do not restart to bypass the lock: memory-only locks
can disappear without resolving the upstream result. [Safety details](privacy.md).
:::

## Find the matching message

| Message or code | What to do |
| --- | --- |
| No ChatGPT OAuth accounts | Connect a ChatGPT account in **Settings → Providers**, then refresh. API keys do not count. |
| `SIGN_IN_REQUIRED`, `ACCOUNT_ID_MISSING` | Sign in again through **Settings → Providers** in OpenCode/OpenChamber, then refresh here. The extension cannot renew the login. |
| Service permission / capability denied, disabled or unavailable | Allow and enable the extension’s host service in **Settings → Extensions**, then refresh. |
| `SQLITE_MISSING` | Install `sqlite3` on the OpenChamber host and ensure it is available to the host process. |
| `DATABASE_UNAVAILABLE` | Check that OpenCode has connected accounts in its default local database and that the host user can read it. Do not change database permissions blindly. |
| `DATABASE_SCHEMA` | The database does not match the supported schema. Check [compatibility](development.md); report the code without sharing the database. |
| `RATE_LIMITED` | Wait before refreshing; repeated refreshes do not help. |
| `NOT_SUPPORTED`, `ACCESS_DENIED` | Codex does not expose reset credits to this account. Refresh later or check its availability on ChatGPT; do not assume zero credits. |
| `CODEX_UNREACHABLE`, `CODEX_ERROR` | Check the host’s network access to ChatGPT and refresh later. |
| `INVALID_RESPONSE` | The internal API may have changed. Refresh once; if it persists, report the bounded code and extension version, not raw responses or tokens. |
| `CREDIT_UNAVAILABLE`, `ACCOUNT_NOT_FOUND` | The credit or account changed. Refresh before choosing anything else. |
| `INVALID_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `SERVICE_ERROR`, `REQUEST_FAILED` | Check that the extension and host are compatible and the service is enabled; refresh. If it persists, report the bounded code and versions. |

## An account is missing from the sidebar

Open the full panel. Mini hides unavailable accounts by default, and an account
limit can hide others. Check **+N others** and the panel’s gear
settings. These sidebar preferences do not remove accounts or hide them in the full panel.

## A credit has no expiry

**Not provided** means Codex did not supply a date, not that the credit never expires.
Only available, unexpired credits with no previous attempt can be confirmed.

For help, [open an issue](https://github.com/sofianbll/openchamber-codex-reset-credits/issues)
with versions, the fixed error code and reproduction steps. Never attach tokens,
credential databases or private account details.
