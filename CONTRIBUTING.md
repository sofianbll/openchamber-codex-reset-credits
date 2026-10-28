# Contributing

Keep changes focused; discuss substantial changes in an issue first.
Use Bun **1.4.3**, Node **24.14.0** and synthetic fixtures:

```sh
bun install --frozen-lockfile --ignore-scripts
bun test
bun run typecheck
bun run build
bun run docs:build
bun run package /absolute/path/to/a-new-folder
bun tests/package.ts /absolute/path/to/a-new-folder
```

Both generated bundles (`panel/main.js`, `service/main.js`) must be rebuilt and
committed with source changes. CI checks that rebuilding leaves them unchanged.

- Never redeem real credits in tests. Never add credentials, account IDs, emails,
  private paths or real account screenshots to fixtures, issues or logs.
- Preserve service authentication, read-only credential access, explicit
  confirmation and uncertain-result locks. Never retry consumption automatically.
- Keep English/French UI and documentation aligned. Report checks not performed.

## Compatibility and releases

CI checks OpenChamber 2.5.0 and the latest published host daily; a manual run can
select another exact host version. The baseline SDK includes storage and
openSurface. Host lifecycle checks use an empty HOME, never local credentials.
No browser or live redemption compatibility is claimed.

The maintainer updates the version and its matching CHANGELOG section, then tags
`v<version>` after approval. The release workflow verifies tests, bundle freshness,
the archive and checksum, and publishes only that version's release notes.
Enable Pages with the **GitHub Actions** source to publish the documentation.
