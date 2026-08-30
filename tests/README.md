# Tests

End-to-end tests for the Wally Dashboard. Each one drives a real headless
Chromium against `index.html`, so they exercise the app as it actually runs
rather than testing functions in isolation.

They exist because the app is a single 4,000-line file with no build step and
no framework: the only way to know a change to the DOP tab did not quietly
break the grace window is to open the page and check.

## Running them

```sh
./tests/run.sh              # everything
./tests/run.sh roster obs   # only tests matching these words
```

`run.sh` serves the repo on port 8899 (override with `WALLY_TEST_PORT`) and
reuses a server already listening there. A test passes when it prints
`ALL PASS`; failures print their whole output.

The full suite launches a browser per test and takes several minutes. Running
one file directly is much faster while iterating:

```sh
cd tests && python3 test_dop_dynamic.py
```

## One-time setup

```sh
python3 -m pip install --user playwright
python3 -m playwright install chromium
```

On macOS the `playwright` binary installs to `~/Library/Python/3.9/bin`;
`run.sh` adds that to `PATH` itself.

## What is covered

| Test | Covers |
| --- | --- |
| `test_hour_math` | Whole-minute hour math, matching the TMS (seconds dropped) |
| `test_dop_dynamic` | Roles follow hours: most = Belt, next two = Bulk, rest Unload |
| `test_cut_ranking` | Cut employees stay ranked on frozen hours, not pinned to a role |
| `test_cut_hours` | Cutting stops the clock without discarding hours |
| `test_cut_edit` | Editing a cut employee's start and end times |
| `test_uncut` / `test_reinstate_hours` | Reinstating resumes from hours already banked |
| `test_grace` | Grace window anchored to the shift-start minute, not `:00` |
| `test_shift_meter` | Start pill transforms into the live hours/PPH meter |
| `test_start_prompt` | Onboarding while idle offers to start the shift, once |
| `test_pph` / `test_live_pph` | PPH against the 500 target; red under, green at or above |
| `test_hours_tile` / `test_derived` | Dashboard tiles mirror the DOP tab |
| `test_observation` | Rotation, skip, and cycle behaviour |
| `test_obs_dop_gate` | Reassignment waits until DOP is met, not the first clock-in |
| `test_obs_edit` | Editing a past observation, and what that does to the cycle |
| `test_checklist` | Nightly checklist, observation two-way sync, share on completion |
| `test_roster` | PS9 Twilight badging, permanent members, shift-end purge |
| `test_reset_backup` | Reset keeps setup; backup round-trips; bad files refused |
| `test_layout_fit` | Dashboard fits without scrolling at iPhone sizes |

## Writing one

`_boot.py` has the shared setup: it launches the browser, loads the page,
collects console and page errors, and stubs out the observation DOP check so
it does not fire mid-test.

```python
from _boot import boot
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b, pg, errs = boot(p)
    ok = True
    # ... drive the page, set ok &= <assertion> ...
    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
```

Two things worth knowing, both of which have caused false failures before:

- **Hours advance on whole minutes.** A test that reads hours, waits, and
  reads again will see a jump if a real minute rolls over in between. Wait
  clear of the boundary first, as `test_cut_hours` does.
- **Do not hardcode clock times.** A test that clocks someone in at 19:00
  breaks when run in the morning. Use offsets from `Date.now()`.

Screenshots written by tests go to `tests/screenshots/`, which is ignored.
