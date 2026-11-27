# Plan: bring the DOP app's features into Wally's DOP tab

**For the session that runs this plan:** do the work in this repo (`wally_demodev`).
Follow `CLAUDE.md`: release checklist, tests, PR, merge. The DOP app itself is in
`docs/dop-port/dop-app-reference.html`, a copy of `daboneman911/dop` `index.html` at
v2.14.1. It is reference only: don't link it from the app or cache it in `sw.js`.

**Since 7.31 the app is split into files.** Line numbers below refer to the old single
`index.html`. The DOP tab's markup is still in `index.html`, its code is in `js/hours.js`
and its styles are in `css/app.css`. See "Where things are" in `CLAUDE.md`.

**The rule for the whole port: Wally's defaults win.** Bring over DOP's *features* (what
you can do), not its look or its policies. That means you keep Wally's:

- colour scheme, tokens (`--accent-*`, `--glass-*`, `--radius-*`, `--shadow-*`), fonts, row layout and icons;
- role engine `htAssignRoles()`: most hours = Belt Tender, next two = Bulk Sweep, the rest Unload, with pins;
- DOP math with the belt tender counted, `1 + 2 + N` (so 9/2 = 12 on the floor);
- "N/2" plan labels, a default plan of 6/2, the weekly shift schedule and Auto Start & End Shift;
- master team list in Settings, PS9 Twilight / permanent flags, the observation rotation and backups.

Anything in the DOP app that would replace one of these is listed under **Not ported** at
the end. Keep it out of scope unless the owner says otherwise.

---

## 1. Plan picker: 5/2 to 9/2 *peak

Wally has two hard-coded buttons (`#ht-dop6`, `#ht-dop5`, around line 795).
`dopConfig` is the unloader count, and the DOP bar, toast and observation gate already
work for any N.

- Add `const HT_DOP_PLANS=[5,6,7,8,9];` beside `HT_DOP_ICON_MAP`.
- Make five `.ht-dop-btn` buttons, `#ht-dop5` to `#ht-dop9`, in ascending order and labeled `5/2` … `9/2`.
  Each gets a `<small>` note line: `&nbsp;` on all of them except 9/2, which reads `*peak`.
  Every button has the line so the labels sit at the same height.
- CSS (around line 414): change `.ht-dop-btn` padding `8px 16px` → about `6px 12px`, add `line-height:1.15`, and add
  `.ht-dop-btn small{display:block;font-size:9px;font-weight:700;opacity:.75}`. All five must fit at 375px.
- `htSyncDOPButtons()`: loop over `HT_DOP_PLANS`.
- `htSetDOP(n)`: ignore anything not in `HT_DOP_PLANS`.
- `htLoadState()`: after loading, `if(!HT_DOP_PLANS.includes(hoursState.dopConfig))hoursState.dopConfig=6;`
- `htBuildBreakdown()`: update the comment "always 2 for 5/2 and 6/2" to say every plan is N/2.

## 2. Roster: the owner's final list

The owner decided this on 2026-11-26. It replaces both apps' lists.

**PS9 Twilight (core + permanent), in this order:**
Robert, Matt, Lorena, Russell, Tre, David, Eddie, Luis, Elliot

**Doubles (permanent, not core):** Solis, Damian, Johnny, Jeremiah

Doubles are not PS9 staff. They stay on the roster every shift, but they get no PS9 chip and are
**not in the observation rotation**. `obsEligible()` already filters by `isPS9Core()`, so keeping
them out of `PS9_CORE` is enough. Add a test that proves it.

| Change | Names |
| --- | --- |
| Drop the last initial | Robert W → Robert, Matt R → Matt, Lorena R → Lorena, Russell H → Russell, Trevon C → Tre, David F → David, Eddie F → Eddie |
| Remove | Arce J, Evan (Wally); Gilbert, Pablo (DOP app; already gone from Wally since v7.17) |
| Add | **Jeremiah**: a Double (permanent, not core, not observed) |
| Unchanged | Luis, Elliot, Solis, Damian, Johnny |

"Tre" is Trevon C (owner confirmed). Core goes from 10 to 9 (−Arce J), so **a full observation
cycle becomes 9 shift days**. Say so in the changelog. Permanent stays at 13 (−Arce J, −Evan, +Jeremiah).

**Code:**
- `DEFAULT_TEAM`, `PS9_CORE` and `PS9_PERMANENT` get the lists above.
  `PS9_PERMANENT = PS9_CORE.concat(['Solis','Damian','Johnny','Jeremiah'])`.
- Add `'Arce J'` and `'Evan'` to `PS9_RETIRED`, for the record only; the frozen `ps9_roster_v7` step must not change.
- **Renames must carry people's data, not drop it.** A remove + add would orphan the person's DOP hours
  (`ps9_v4`), roster flags (`ps9_roster_flags`), observation history, and door/log attribution.
  `editTeamMember()` already does all of that, but behind `prompt()`/`confirm()`/`alert()`. Pull its body out into a
  non-interactive `renameTeamMember(oldName,newName,{resendLogs})`, have `editTeamMember()` call it, and
  run it from the migration. It must call `renameRosterFlags()` and `htRenameEmployee()`, rename observation
  assignments, active doors and `historyLog`. Check `test_name_edit` for everything a rename is expected to follow.
- **Webhook:** the interactive rename re-sends edited logs to Google Sheets. For the migration, pass
  `resendLogs:false`. Otherwise every phone re-posts the night's logs when it updates, and `historyLog` is pruned after
  a day anyway. Past rows in the Sheet keep the old names; tell the owner.
- Add **one new step** at the end of `ROSTER_MIGRATIONS`. It needs a new `rename` field, because the existing
  steps only have `remove`/`add`:
  ```js
  {key:'ps9_roster_v728', // use the real release version
   rename:{'Robert W':'Robert','Matt R':'Matt','Lorena R':'Lorena','Russell H':'Russell',
           'Trevon C':'Tre','David F':'David','Eddie F':'Eddie'},
   remove:['Arce J','Evan'], add:['Jeremiah']}
  ```
  In `migrateTeamRoster()`, do the renames first (only where the old name is on the team and the new one isn't), then
  removals (which already call `forgetRosterFlags`), then adds. Treat a missing `rename` as `{}` so older steps still
  run. Never edit an earlier step. Add the key to `BACKUP_KEYS` and to `importBackup()`'s non-JSON key list (see 7.17).
- **Tests to update:** `test_roster` (CORE/EXTRA lists and counts), `test_observation` (expected pool),
  `test_roster_editing` (uses `Evan`; switch to another Double such as `Johnny`), `test_obs_edit`,
  `test_reset_backup`, `test_name_edit`, `test_corrupt_storage` (they reference `Robert W`). A new check should
  seed a device that already ran `ps9_roster_v717`, with hours, flags and an observation on `Robert W`, and prove
  that after load they all belong to `Robert`, that Arce J and Evan are gone, that Jeremiah is permanent but not core, and that the observation pool is
  exactly the 9 core names, with no Solis, Damian, Johnny or Jeremiah.
- If a device has a `ps9_roster_flags` entry marking any Double as `core:true`, the migration should clear that
  entry, so the Doubles really are out of the rotation.

## 3. Tap a name to toggle working

DOP app: tapping a name puts them to work, and tapping again takes them off. Cut, moved and
locked people don't toggle; they shake and show a toast saying to use ⋯.

Wally today: inactive rows have a **Start** button. Tapping an active row opens the role modal.
There is no way to take an active person back off the board.

- Make the name/info area of a row (`.ht-emp-info`) a toggle:
  - `inactive` → `htActivateEmployee(id)` (as the Start button does now).
  - `active` → new `htDeactivateEmployee(id)`: `status='inactive'`, clear `startTime`, `customStartStr`,
    `frozenHours`, `cutTime`, `pausedMs` and `manualRole`. If they have more than 0.00 hours, `confirm()` first
    ("Take X off the board? Their hours will be cleared.").
  - `cut`, `moved` or `locked` → no change. Shake the row (`@keyframes` using Wally tokens) and show a short
    toast, reusing Wally's toast style, saying "X is cut — use ⋯ options".
- Keep the Start button: it does the same thing and is a known tap target.
- Move the role modal from "tap the row" to the new ⋯ button (section 4), so a tap means one thing.
- `htCheckOverDOP()` and the observation gate already run off `htRenderAll()`; make sure deactivating calls it.

## 4. ⋯ options sheet per employee

DOP app `renderSheet()` (around line 990 in the reference) offers these. Build it as a Wally modal:
`htOpenModal`/`htCloseModal`, Wally modal markup and tokens.

| Action | DOP app | In Wally |
| --- | --- | --- |
| Role | Auto / Unloader / Sweep / Belt | **Reuse** Wally's role modal content (Belt / Bulk / Unload pins + "Auto" = unpin). |
| Start time | Per-person start; schedules someone not yet working | **Reuse** `htOpenCustomTime()`. Add "Use shift start" to clear `customStartStr`. |
| Cut | Stop the clock | `htCutEmployee()` |
| Put back on the clock | New clock segment | `htUncutEmployee()` (Wally banks the gap in `pausedMs`, which is the same effect) |
| Mark working | | `htActivateEmployee()` |
| Move to another PS line | PS1–PS12 except PS9; stops PS9 clock, keeps hours | **New**, see below |
| Return to PS9 | Back on the clock | **New** |
| Lock / Unlock | Disables tap-to-toggle | **New**: `emp.locked` boolean, lock icon on the row |
| Remove from shift | Clears hours | `htDeactivateEmployee()` from section 3 |
| Delete added employee | Only for people added tonight | Only when `!isPermanentMember(name)`. Same path as Team Management delete, with Wally's existing hours warning. |

**Move to another line (new status `moved`):**
- `emp.status='moved'`, `emp.movedTo='PS5'`; freeze hours like a cut (`frozenHours`, `cutTime`).
- Leave them out of `htAssignRoles()` engaged and out of `htCalcDOP()` active, so they don't count toward PS9.
- Row: muted like `ht-cut`, with a tag "→ PS5" using an existing Wally tag class (for example the purple accent).
- Return to PS9 = `htUncutEmployee` logic (bank the gap), clear `movedTo`.
- Check `htEndShift()`, `htBuildBreakdown()` and the End Shift summary to make sure moved people are handled. Treat them like cut.
- Lines: `const HT_OTHER_LINES=['PS1','PS2','PS3','PS4','PS5','PS6','PS7','PS8','PS10','PS11','PS12'];`

## 5. Staggered (scheduled) starts count toward staffing

DOP app: someone given a start time later than now is "Scheduled · starts 21:30". They count
toward the DOP straight away, and their hours start at their time.

Wally: `customStartStr` already sets a later start on activation. Check that:
- an active person whose `startTime` is in the future shows "Starts 21:30" in the meta strip, earns 0.00 until
  then (`htCalcHours` should clamp at 0), and counts in `htCalcDOP()`;
- the role ranking doesn't put them at the top by mistake, since they have 0 hours.

## 6. Roster grouping (optional, ask the owner)

The DOP app groups tiles as PS9 regulars / Doubles / Added, with a coloured stripe and a
"+" badge for added people. Wally already has the PS9 chip and sorts rows by hours rank. If the owner wants
grouping, do it only for **inactive** rows (active rows stay in rank order): PS9 Twilight
(`isPS9Core`), then other permanent members, then temporary adds with an "Added" tag. Use Wally colours.

---

## Not ported (Wally's defaults win)

- **DOP's look:** dark indigo theme, tiles, avatars, segmented control, start card. Use Wally's styles.
- **Default roles** (Robert = belt, Tre/Eddie = sweep). Wally deliberately has no preferred belt tender; roles follow hours.
- **Belt tender outside the DOP.** Wally counts belt in `1+2+N`.
- **Role hours split over time** (`roleLog`). Wally's role is by rank at the moment, and its KPI tiles are
  built on that. Changing it is a separate project.
- **Plan default 7-2, "9-2" dash labels, Friday 19:30 rule, two-tap reset.** Wally has its own schedule and confirm.
- **Separate storage** (`ps9-dop-tracker`). Everything stays in `ps9_v4` and the master team list.

## Release (from CLAUDE.md)

- Bump `APP_VERSION` (js/core.js) and `VERSION` (sw.js) together.
- Add an in-app `CHANGELOG` entry (plain language) and a `CHANGELOG.md` entry (technical).
- Add tests and list them in `tests/README.md`. Suggested `tests/test_dop_port.py`:
  1. five plan buttons; each sets `dopConfig` and `.active`; MET/DOWN/OVER at `1+2+N` for every plan; a bad saved value → 6;
     *peak shows; the toggle fits at 375px with no horizontal scroll;
  2. tap toggles inactive ↔ active; taking someone off with hours asks to confirm; cut, moved and locked don't toggle;
  3. move to PS5 freezes hours, drops them from the DOP count, shows "→ PS5"; return resumes without crediting the gap;
  4. lock blocks the tap; unlock restores it;
  5. a future start counts toward the DOP and earns 0 until it arrives;
  6. roster: the section 2 migration (renames carry hours, flags and observations; Arce J, Evan out; Jeremiah a Double; observation pool = 9 core only).
- Run `./tests/run.sh`. `test_offline`, `test_team_edit` and `test_webhook_queue` fail without CDN access; that's not a real failure.
- Ship in small PRs if it helps: (1) plan picker, (2) roster names, (3) toggle + options sheet + move/lock.
