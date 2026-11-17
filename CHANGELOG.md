# Changelog

## Unreleased

- Read OpenAI OAuth credentials whose `active` flag is unset (`NULL`) as inactive
  instead of failing with `DATABASE_SCHEMA`. OpenCode leaves the flag unset for
  credentials imported from a legacy `auth.json`.

## 0.1.1 — 2026-11-16

- Use integrated SQLite instead of requiring an external `sqlite3` executable.
  Hosts without an integrated module report `SQLITE_UNAVAILABLE`; no new sign-in
  or account switching is introduced.
- Add a full-panel bug report action with a reviewable, filtered diagnostic;
  reports are submitted manually on GitHub, never sent automatically.

- Remove the sidebar summary pills and labels; keep only accounts and tickets.
- Replace Refresh and View panel text buttons with compact icons. In the full
  panel, Refresh sits beside the settings gear.

The account reader passes Windows CI under Bun. Packaged Windows/Electron still
needs a real installation check; no live credit consumption has been verified.

## 0.1.0 — 2026-10-28

First public release.

- View reset credits for each ChatGPT account already connected in OpenCode.
- Confirm before using a credit; uncertain results lock further attempts instead
  of automatically retrying an irreversible action.
- Open a full panel or use the Work Status section with Compact, Tickets and Mini views.
- Configure the default panel view and sidebar layout, account visibility,
  ordering and limit; see an availability summary at the top of the sidebar section.
- English/French interface, prebuilt installation archive and checksum.

Known limits: requires local OpenCode 2 credentials and sqlite3. Internal ChatGPT
endpoints may change; expired logins must be renewed through OpenCode. Uncertain
redemption locks are memory-only, and restarting is not proof a redemption failed.
No live redemption is exercised by automated tests.
