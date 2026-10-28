# Changelog

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
