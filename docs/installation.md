# Install & update

## Requirements

- OpenChamber **2.5.0 or newer**, desktop or web, with extension hosting enabled.
- OpenCode **2**, with ChatGPT OAuth accounts in its default local credential database.
- The **`sqlite3` executable on the OpenChamber host**, not just on the device
  displaying the web UI. macOS includes it; other hosts may require installation.

Only `~/.local/share/opencode/opencode.db` and the observed OpenCode 2 `credential`
schema are supported. Remote OpenCode servers and custom paths are not supported.

## Install from GitHub

1. Open **Settings → Extensions → Add extension**.
2. Paste the repository URL:

   ```text
   https://github.com/sofianbll/openchamber-codex-reset-credits
   ```

3. Review and allow the **host service**, including execution of `sqlite3`, then
   enable **Codex resets**. The service reads access tokens and contacts ChatGPT
   with your account’s access; [review the boundaries](privacy.md).
4. Open **Codex resets** in the rail or **Work Status**. Use Work Status’s section
   controls to show, hide or reorder it.

Compiled entries are included: no Bun, dependency installation or build is needed.
Git must be available to OpenChamber for URL installs. The service is **not an OS sandbox**.

## Updates & fixed versions

Use the extension update controls in **Settings → Extensions**. To pin the initial
release once published, use:

```text
https://github.com/sofianbll/openchamber-codex-reset-credits#v0.1.0
```

A pinned tag stays on that version. The unpinned URL follows the default branch.

## Alternative: release archive

Once published, download the prebuilt `.tar.gz` and its SHA-256 checksum from
[GitHub Releases](https://github.com/sofianbll/openchamber-codex-reset-credits/releases).
Verify the archive against the published checksum before extracting it:

```sh
shasum -a 256 /path/to/downloaded-archive.tar.gz
```

Compare the printed hash exactly with the release checksum. Extract into a
permanent folder and select that folder in **Add extension**. To update a folder
install, disable the extension, replace it with the new release and re-enable it.
Keep the old folder for rollback.

## Remove

Disable or uninstall in **Settings → Extensions**. No OpenCode migration or account
rollback is needed. Do not delete your development source directory to uninstall
its registration. Uninstalling or rolling back does not undo a consumed credit.
