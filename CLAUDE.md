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

## Where things are

The app is plain HTML, CSS and JS, served by GitHub Pages with no build step. It runs on
one device only.

- `index.html`: markup only, plus the small encoding guard in `<head>`.
- `css/app.css`: all styles.
- `js/*.js`: classic scripts (not ES modules) loaded in order from the bottom of
  `index.html`. They share one global scope, which inline `onclick` handlers and the
  tests rely on. Keep it that way: no `type="module"`, no bundler.

## Release checklist (every app change)

- Bump `APP_VERSION` in `js/core.js` **and** `VERSION` in `sw.js` together. A mismatch
  leaves phones on the old cached build, and `test_offline` checks it.
- Add an entry to the in-app `CHANGELOG` in `js/changelog.js` (plain language, for the
  crew) and to `CHANGELOG.md` (technical detail).
- A new file under `js/` or `css/` must also be added to `APP_FILES` in `sw.js`, or the
  app breaks offline. `test_offline` checks this.
- Add a test under `tests/` for the fix and list it in `tests/README.md`.

## Running tests in a cloud sandbox

The tests use Python Playwright. Match it to the preinstalled browser:

```sh
pip install "playwright==$(node -e "console.log(require('playwright/package.json').version)")"
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers ./tests/run.sh
```
