# Wally Dashboard: notes for Claude

## Shipping changes: merge automatically

The owner wants every change live without waiting on them. After each change:

1. Run the test suite (`./tests/run.sh`).
2. Commit and push to the working branch.
3. Open a pull request into `main` and merge it right away. Don't ask first.
4. Tell the owner what shipped and the test result.

The one exception: if a test fails for a real reason, stop and report it instead of
merging. In a sandbox without CDN access, `test_offline`, `test_team_edit` and
`test_webhook_queue` fail only on blocked CDN requests (`ERR_TUNNEL_CONNECTION_FAILED`).
That is not a real failure, but say so when reporting.

After a merge, restart the working branch from the latest `main` before the next change.

## Release checklist (every app change)

- Bump `APP_VERSION` in `index.html` **and** `VERSION` in `sw.js` together. A mismatch
  leaves phones on the old cached build, and `test_offline` checks it.
- Add an entry to the in-app `CHANGELOG` in `index.html` (plain language, for the crew)
  and to `CHANGELOG.md` (technical detail).
- Add a test under `tests/` for the fix and list it in `tests/README.md`.

## Running tests in a cloud sandbox

The tests use Python Playwright. Match it to the preinstalled browser:

```sh
pip install "playwright==$(node -e "console.log(require('playwright/package.json').version)")"
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers ./tests/run.sh
```
