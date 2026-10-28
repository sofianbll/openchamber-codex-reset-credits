# Development & compatibility

## Local workflow

```sh
bun install --frozen-lockfile
bun test
bun run typecheck
bun run build
bun run preview
```

Tests use synthetic credentials, temporary databases and mocked HTTP responses.
The isolated preview has no access to OpenCode accounts or ChatGPT. Use it for
Compact/Tickets/Mini, settings, narrow layouts, English/French, keyboard focus and
confirmation/uncertain-result checks. Public screenshots must use synthetic data.

Install the built checkout by folder in **Settings → Extensions**. Rebuild and
reload after source changes; disable and re-enable after service changes. Users
install ready-to-run `panel/` and `service/` entries, not TypeScript source.

```sh
bun run package /absolute/path/to/new/openchamber-codex-reset-credits-0.1.0
bun run docs:dev
bun run docs:build
```

The docs use VitePress 1.6.4, with English and French pages, local search and base
`/openchamber-codex-reset-credits/`. Keep both languages aligned when behaviour changes.
Packaging creates a new installable folder, `.tar.gz` archive and `.sha256` file;
the output paths must not already exist.

## Boundaries to preserve

- Manifest: OpenChamber **>=2.5.0**, API version **1**, SDK development dependency **2.5.3**.
- One rail panel, one Work Status section, one host service with `sqlite3` execution.
- Read-only access to the default local OpenCode 2 credential schema only.
- Fixed internal ChatGPT endpoints; access tokens never leave the service except
  in authenticated requests to ChatGPT. No refresh-token handling or account switching.
- Irreversible consumption requires explicit confirmation, fresh validation and
  duplicate-attempt protection. Unknown results must never become retryable failures.

The manifest’s minimum version is not a claim that every host/version combination
has been tested. Remote OpenCode, custom database paths, V1 `auth.json`, VS Code and
mobile hosting are outside scope. No live credit consumption has been verified.

For small fixes, send a pull request; discuss larger changes in an issue first.
See [Contributing on GitHub](https://github.com/sofianbll/openchamber-codex-reset-credits/blob/main/CONTRIBUTING.md).
Do not include credentials or private account data in fixtures, logs or screenshots.
