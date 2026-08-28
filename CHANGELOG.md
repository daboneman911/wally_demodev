# Changelog

### [6.95] - 2026-08-27

- **New:** Observation Tracker, reached via Tools → Methods (which is now a real section rather than a placeholder). Assigns one employee per shift day from a fixed eligible pool — Robert W, Matt R, Lorena R, Russell H, Trevon C, David F, Arce J, Fonseca J — drawn in order until every pool member has been observed, at which point the cycle restarts. The pool is editable from the tracker and is intersected with the live team list, so removing someone from Team Management also removes them from rotation.
- **New:** DOP cross-check. `obsValidateAgainstDOP()` runs whenever the DOP KPIs re-render, so as soon as anyone is clocked in it verifies the day's observee is among them; if not, the observation moves to the next eligible employee who *is* on the clock and a modal names both the original pick and the replacement. It deliberately holds off while nobody is clocked in, so it can't fire before the shift has really started, and won't re-fire once the pick is valid.
- **New:** Skipping defers rather than completes — the skipped employee is recorded against the day but is *not* marked done, so they resurface later in the same cycle. Verified an 8-day run assigns all eight pool members with no repeats before restarting, and that a skipped employee remains owed.
- **New:** The day's employee appears on the dashboard beneath the subtitle in small centred type, turning green with a tick once marked observed, and opens the tracker when tapped. Assignments are keyed to the *shift* day (before noon counts as the previous day), so an overnight shift keeps the same observee all night, and persist in `ps9_observations`.
- Dashboard still fits without scrolling on every tested device after adding the line (trimmed nameplate spacing to hold the budget; 23px clear at 375×812).

### [6.94] - 2026-08-26

- **Removed:** The 16-hour unloader labour threshold and its alert. Deleted `HT_LABOR_THRESHOLD`, `htLaborAlertFired`, `htCheckLaborThreshold()`, `htDismissLaborAlert()`, the call from `htRenderKPI()`, the `#ht-labor-alert` banner markup, and the eight associated CSS rules (`.ht-threshold-badge`, `.ht-kpi-card.ht-threshold-exceeded`, `.ht-labor-alert*`). The UNLOAD tile now simply reports hours — no red border, no "16h+" badge, no banner.
- `unloadHrs` is retained in `htRenderKPI()` since it still populates the tile. Verified with 25.00 unload hours on the board (well past the old 16.0 trip point) that no badge, banner or red styling appears and no console errors are raised.

### [6.93] - 2026-08-25

- **Fix:** `htUncutEmployee()` cleared `frozenHours` and let the clock run from the original `startTime`, so a reinstated employee was credited for the entire stretch they were cut — someone who worked 3.00 hrs, sat cut for 2, then returned read **5.00**. They now resume from the hours actually accumulated (3.00) and accrue from that moment.
- Implemented by banking the cut interval in a new `pausedMs` field on the employee and subtracting it in `htCalcHours()`, rather than shifting `startTime` forward. Moving the clock-in would have made the roster misreport when the person actually started; this keeps the displayed clock-in truthful while excluding the gap. `htActivateEmployee()` resets `pausedMs` so a fresh activation starts clean, and both `htApplyCustomTime()` branches subtract it so an edited start or cut time still honours the exclusion.
- Verified end to end: 3.00 hrs worked → cut → 2 hrs elapsed → reinstate returns 3.00 (not 5.00) with 2.00 h banked and the original clock-in preserved; hours keep accruing afterwards; a second cut freezes at the corrected total; and editing the cut time afterwards keeps the pause excluded.

### [6.92] - 2026-08-25

- **Fix:** `.ht-emp-row.ht-cut` carried `opacity:0.6`, which faded the row's *controls* as well as its content — so the undo (reinstate) button and both time-edit buttons looked disabled even though all three were fully functional. Row opacity is now `1`; "off the clock" is signalled instead by a neutral `--border-light` surface, a neutral left edge, muted name/hours text and the retained dashed border, leaving the controls at full contrast.
- **New:** Cut rows carry an explicit red **CUT** badge in the meta line. With the dimming gone, the state needed stating outright rather than being implied by a faded appearance.
- Verified on a cut row that all three controls still work: start-time edit opens, cut-time edit opens, and undo reinstates the employee.

### [6.91] - 2026-08-25

- **Fix:** DOP labor hours read high against the TMS because the two ends of each span were measured differently. `htParseHHMM()` zeroes seconds, so start times land on the exact minute, but `htCalcHours()` measured against `Date.now()` including seconds — so a 20:00 start read 2.0164 hrs (displayed **2.02**) at 22:00:59 where a whole-minute system reads 2.00. The error was always in the same direction (over, never under) and compounded per employee: ~30s of uncounted seconds each is ~0.08 hrs across a 10-person crew, and it also inflated the PPH denominator.
- Added `htFloorMin()` / `htSpanHours()` and routed `htCalcHours()`, `htShiftElapsed()` and both `htApplyCustomTime()` branches through them, so every span floors **both** endpoints to the whole minute. Verified a 20:00→22:00 span now returns exactly 2.0000 at 0/1/15/30/45/59 seconds past, while still advancing correctly on each minute tick.
- **Fix:** The live and edited paths disagreed for the same nominal window — a cut *edited* to 22:00 computed 2.0000 (both ends minute-exact) while a cut *taken live* at 22:00:45 carried the seconds. Both now return 2.0000.
- Consequence: displayed hours advance once per minute instead of continuously. Verified an active employee holds steady within the minute and gains exactly 1/60 h on the tick.
- Checked and found already correct, so left unchanged: 24-hour parsing (`00:00`, `08:30`, `13:45`, `20:00`, `23:59` all parse correctly — the reported military-time difference was not a parsing issue) and overnight spans (20:00 → 02:30 next day = 6.50 hrs). Trailer dwell/unload durations are a separate metric and were not altered.

### [6.90] - 2026-08-24

- **UI:** Dashboard pill restructured into two labelled rows — `Hours – 6.00` (17px value) above `PPH – 1000` (13px value, smaller as requested). Labels are fixed-width and values right-aligned with `font-variant-numeric: tabular-nums`, so digits occupy fixed columns and the figures don't shuffle as they tick. Verified against the widest realistic case (124.50 hrs / 4-digit PPH). Pill measures 152×60.
- **New:** PPH is colour-coded against `PPH_TARGET` — green at 500 **or above**, red below — and the pill's ring and glow match, so the shift reads at a glance from a distance. Verified at 1000/500/499/420: 500 exactly is green, per spec. Demo mode still takes precedence and keeps its orange ring; with no count recorded the value is a muted em-dash and the ring stays green, since the shift is still live.
- **Change:** A count older than ~75 minutes now dims the PPH row (`opacity`) rather than recolouring it amber. The previous amber treatment would have overridden the new red/green reading, hiding whether you were on target.

### [6.89] - 2026-08-24

- **New:** Live PPH tracker built on the DOP unload hours. The dashboard pill now leads with the PPH figure and carries live unload hours beneath it (`PPH · 6.00 hrs`); it reads `—` until a volume count exists. Only unload-role hours count, so the denominator matches the DOP tab's UNLOAD tile exactly (Belt Tender and Bulk Sweep hours excluded).
- **New:** Volume is entered as a **running total** via the pill → Shift Options → **Update Volume**. The sheet previews the resulting PPH live as you type, prefills the previous count, and keeps a timestamped history of every entry — each row showing that count's PPH plus the rate achieved *in that interval* (derived from the deltas between consecutive entries), which is the more useful number for spotting a slow hour.
- **Design note:** PPH is measured against `getUnloadHours()` **at the moment of entry**, stored on the log row, rather than recomputed against current hours. Recomputing would make the figure decay steadily between hourly counts and jump on each entry — reading as lost performance when it is only a stale count. Verified: with a count of 6,000 over 6.00 hrs (1,000 PPH), the figure held at 1,000 as hours advanced to 9.00, while the hours line tracked live; the next count of 15,000 correctly re-measured to 1,666.
- A count older than ~75 minutes turns the figure amber, so a stale reading is visible rather than silently trusted. `pphLog` persists in `ps9_pph_log` and is cleared by `confirmStartShift()` so counts never carry across shifts.

### [6.88] - 2026-08-24

- **Fix:** `uploadPPH()` captured `origText` from the button's *current* text before overwriting it with "Pushed!", so a second tap inside the 2s window captured "Pushed!" as the text to restore and the button was stranded on it permanently. It now restores from a fixed `PPH_PUSH_LABEL` constant and holds a single `pphPushTimer` that is cleared on each press. Verified three rapid taps now restore correctly.
- **UI:** PPH Calculator brought in line with the other reworked sheets — added the `.modal-header-row` / `.modal-close-btn` close control it was missing.
- **UI:** Replaced leftover hardcoded colours with tokens: the result panel (`#f9f9f9` → `--border-light`, `16px` → `--radius-md`), the PPH figure (`#000` → `--text-main`), and the push button's inline `background:#000` (removed, so `.btn-primary` supplies it). The differential pill's inline style writes (`#e5e5ea`/`#e8f5e9`/`#2e7d32`/`#ffebee`/`#c62828`) become a class-driven `.pph-diff` / `.under` / `.over` using `--accent-green`/`--accent-red`, and the push confirmation uses `.pph-pushed` with `--accent-green` rather than `#34c759`.
- Calculations re-verified against the 500 target after the refactor, including that clearing the inputs resets the panel and the pill state.

### [6.87] - 2026-08-24

- **Change:** PPH Calculator target lowered from 600 to 500. The literal appeared in three places — `calculatePPH()`'s `targetHours`, `uploadPPH()`'s `diffHours`, and the on-screen label — so it is now a single `PPH_TARGET` constant that the label reads from, preventing the displayed target from drifting away from the maths.
- Verified all downstream calculations follow: 10000 pkgs / 20 hrs now reads exactly 0.00 differential (500 PPH is on target, previously -3.33 vs 600); 10000 / 25 gives +5.00; 12617 / 20.63 gives -4.60. The green/red colouring still flips on the sign, and the `PPH_UPLOAD` payload pushed to Sheets carries the recalculated `diffHours` (+5.00 for 10000/25).
- Note: `apps-script/Code.gs` needs no change — it writes the app-supplied `diffHours` straight into the "PPH Submissions" sheet's `+/-` column and holds no target of its own.

### [6.86] - 2026-08-24

- **New:** Added a **Methods** placeholder tool to the Tools tab, using the existing `.tool-card` pattern (`ph-list-checks` icon) so it matches Notes Manager, PPH Calculator and Manual Add — it also completes the 2x2 grid. `openMethods()` shows a "coming soon" sheet; no functionality is wired behind it yet.

### [6.85] - 2026-08-24

- **New:** Onboarding a trailer while `shiftState === 'idle'` now prompts to start the shift, since door timers, stats and DOP hours only accrue once it's live. `maybePromptStartShift()` fires from both onboarding paths (`confirmArrival()` and `continueWithDuplicate()`).
- "Start Shift Now" calls `confirmStartShift(true)` directly, keeping the already-onboarded trailers — it deliberately bypasses the "Trailers Still Onboard / what should happen to them?" modal, because a prompt triggered *by* onboarding has already answered that question. Verified three pre-shift trailers all survive the start and no second modal appears.
- The prompt is shown once per idle period rather than per trailer, so staging several bays before the shift doesn't nag; the flag resets in `confirmStartShift()` so it can appear again after a later shift ends. Verified: prompts on the first idle onboard, stays silent on the next, never appears while live, and DOP picks the shift up on start.

### [6.84] - 2026-08-24

- **UI:** `.shift-meter` changed from a 104px circle to the same pill form as `.btn-shift` — identical `--radius-md` corners and, after pulling the 3px ring out of the vertical padding, an identical 44px height (verified 44px vs 44px, 0px delta). Hours and label now sit side by side inside the pill rather than stacked. The result reads as one control changing state instead of swapping into a different shape. Green ring and `meter-glow` pulse unchanged.

### [6.83] - 2026-08-24

- **UI:** Removed the corner shift-status label (`.shift-state-pill` / `.shift-state-dot` / `#shift-state-label`) from the dashboard nameplate. With 6.82's transforming control, the state is already unambiguous: no counter means idle, a green ring means live, an orange ring means demo. Markup, CSS rules and the `updateNameplate()` writes to those nodes were all removed together — verified no null-reference errors while cycling idle → live → demo → idle. The `@keyframes dot-pulse` rule is retained because the DOP tab's `.ht-live-dot` still uses it.
- **UI:** The live ring now pulses gently (`meter-glow`, and `meter-glow-demo` in demo) instead of carrying a static halo, so it reads as running at a glance.

### [6.82] - 2026-08-24

- **UI:** Replaced the split hours-tile/button row (6.81) with a single centred control. `.nameplate-actions` centres one element: the Start Shift button while idle, which becomes a 104px circular unload-hours meter ringed in `--accent-green` once the shift is live (`--accent-orange` in demo). The circular form echoes the bay circles rather than introducing a new shape. Verified both states render dead-centre (0.0px offset) and that the swap round-trips idle → live → demo → idle.
- **New:** Tapping the running meter opens a Shift Options sheet showing the current unload hours, with **View Breakdown** (closes the sheet and switches to the DOP tab) and **End Shift** (routes into the existing `openEndShiftModal()` confirmation, so the keep-bays-open flow is unchanged). Both verified end to end.
- The meter keeps the `nameplate-hours` / `nameplate-hours-val` ids, so `updateNameplateHours()` and the DOP mirroring from 6.77 continue to drive it untouched.

### [6.81] - 2026-08-24

- **UI:** Dashboard nameplate reworked. `.shift-state-pill` carried `flex:1`, so it consumed roughly a third of the action row to display a single word that the button already conveyed — idle showed "Ready" beside "Start Shift", live showed "Shift Live" beside "End Shift". It is now a quiet uppercase status label pinned to the card's top-right corner (dot + text, no pill background), colour-coded by state: muted when idle, green when live, orange in demo. It keeps its element id and state classes, so `updateNameplate()` drives it unchanged.
- **UI:** With the pill out of the row, the Unload hours tile and the shift button split it as two equal blocks — verified identical geometry (160×55 at 393px, same top edge). Both use `--radius-md`, matching the stat cards directly below, so the shift button no longer reads as a small mismatched chip; its type and icon were scaled up to suit the larger footprint. The hours value is centred within its block.
- Dashboard still fits without scrolling on every tested device (bays clear the tab bar by 24–156px at 375–440px wide), and all three shift states render correctly.

### [6.80] - 2026-08-24

- **Change:** Cut employees are ranked again alongside active ones, using their frozen hours, so being cut no longer locks in the position held at that moment. `htAssignRoles()` reverts to ranking `active || cut` (the v6.78 exclusion). That exclusion existed to stop a cut employee's hours jumping between KPI buckets, but the actual cause was the hardcoded `HT_BELT_DEFAULT` override removed in v6.79 — with assignment now purely time-ranked, including cut employees is stable: their clock has stopped, so they drift down the ranking as active employees accumulate past them.
- Behaviour: a Belt Tender cut at 5.00 hrs keeps Belt while 5.00 still leads, and automatically drops to Bulk once an active employee passes them. Verified end to end, including that the employee's 5.00 hrs are preserved through the transition and that the Belt/Bulk/Unload buckets still sum to every engaged employee's hours (17.00 = 17.00), so no hours are lost by the re-rank.
- Invariants hold throughout: exactly one Belt and at most two Bulk across active + cut, manual pins still claim their slot ahead of the ranking, and a cut employee's timer stays stopped while active employees keep accumulating.
- Test suites updated to the corrected model: `test_cut_hours` now asserts *no hours are lost* (buckets total everyone's hours) rather than the obsolete bucket-stability assertion, and `test_dop_dynamic` checks role shape across active + cut rather than active only.

### [6.79] - 2026-08-24

- **Fix:** DOP role assignment was not fully dynamic. `htAssignRoles()` did rank employees by hours, but a hardcoded `HT_BELT_DEFAULT = 'Robert W'` claimed Belt Tender whenever he was active and unpinned — regardless of hours. Worse, that flag was applied in the same pass that fills slots without re-checking `beltFilled`, so when he was *not* top-ranked the roster ended up with **two Belt Tenders** simultaneously (verified: with hours 5/4/3/2/1 ascending, both the 5.00-hr employee and the 1.00-hr Robert W were assigned `belt`). The hardcoded default and its `_autoBelt` flag are removed; assignment is now purely hours-ranked — most hours takes Belt, the next two take Bulk, the remainder Unload.
- **Fix:** A manual role pin could also produce two Belt Tenders. Pins were honoured inside the single hours-ranked pass, so an unpinned higher-hours employee reached the Belt slot first and the pinned employee was then assigned Belt as well. Pins now claim their slot in a dedicated pass before auto-assignment fills what remains, guaranteeing exactly one Belt and at most two Bulk.
- **UI:** Removed the "★ Default Belt" badge, which no longer describes anything — there is no preferred employee for the role.
- Verified across ascending, descending and shuffled hour orders; a live overtake (lowest-hours employee jumping to 9.00 hrs correctly takes Belt); a manual pin on the lowest-hours employee (pin respected, still exactly one Belt); and cutting the Belt Tender (cut employee keeps `belt` so their hours stay attributed, while exactly one *active* employee picks the role up).
- Note: Bulk is capped at 2 for both the 6/2 and 5/2 settings; `dopConfig` (6 or 5) is the unloader target, not the bulk count.

### [6.78] - 2026-08-23

- **Fix:** Cutting an employee moved their accumulated hours between KPI buckets instead of simply stopping the clock. `htAssignRoles()` ranked `active` **and** `cut` employees together, wiping `e.role` and recomputing it; since `htCutEmployee()` clears `manualRole`, a cut employee fell through to auto-assignment and could be re-roled — e.g. an unloader cut at 1.00 hrs reverted to the default Belt Tender, dropping the Unload total by an hour and adding it to Belt. `htAssignRoles()` now ranks only `active` employees, so a cut employee's `role` freezes alongside their `frozenHours` and their contribution stays attributed to the role they actually worked.
- The vacated role slot still frees up, because only active employees are counted when filling Belt/Bulk: cutting the Belt Tender now hands Belt to an active employee while the cut employee keeps Belt for accounting. Verified the cut person retains their role, the active roster re-covers the slot, and `htUncutEmployee()` still returns everyone to their prior roles.
- Verified end to end: with 3 unloaders (1.00 + 0.50 + 0.50) and 1 Belt Tender (1.00), cutting the 1.00-hr unloader leaves Unload at 2.00 and Belt at 1.00 — both unchanged — while that employee's timer stops (1.0001 → 1.0001) and active employees keep accumulating. The dashboard tile continues to mirror the DOP figure.

### [6.77] - 2026-08-23

- **New:** The dashboard nameplate shows live Unload hours in the slot between the shift-state pill and the Start/End Shift button. `getUnloadHours()` applies the same filter as the DOP tab's UNLOAD KPI (unload-role employees, `active` or `cut`), so the two figures always agree — verified equal on the dashboard and the DOP tab across clock-in and cut. Belt Tender and Bulk Sweep hours are excluded, matching the UNLOAD tile. The value renders green once above zero and reads `0.00` before a shift starts.
- Kept in sync from `renderDashboard()` (covering the 15s refresh loop and every re-render) and from both exit paths of `htRenderKPI()`, so a change on the DOP tab is reflected as soon as the dashboard is shown.
- **Change:** Manual Add moved out of the dashboard nameplate — where it occupied the slot the hours tile now uses — into the Tools tab as a third card beside Notes Manager and PPH Calculator, reusing the existing `.tool-card` pattern.
- **Note (pre-existing behavior, unchanged):** cutting an employee clears their `manualRole`, after which `htAssignRoles()` may auto-reassign them (e.g. the default Belt Tender reverts to `belt`), moving their hours between KPI buckets. The dashboard mirrors whatever the DOP tab shows, so the two never disagree.

### [6.76] - 2026-08-23

- **New:** Cutting an employee on the DOP tab is now reversible. Cut rows carry a green undo button (`htUncutEmployee()`) that restores `status='active'`, clears `cutTime`, and resets `frozenHours` so hours resume from the original `startTime` rather than restarting at zero — the person never actually left, so the elapsed time counts. Verified an employee cut at 1.00 hrs returns to ~1.00 hrs rather than 0.
- **New:** `htCutEmployee()` now stashes `preCutManualRole` before clearing `manualRole`, so an undo restores the manually-assigned role rather than dropping the employee back to auto-assignment.
- **New:** Cutting the last active employee sets `shiftEnded=true`; undoing that cut now clears the flag, so the shift goes live again instead of staying stuck on "Shift Complete — Final Hours Locked". `htUncutEmployee()` is a no-op on an employee who isn't cut, and guards against an employee with no `startTime`.
- **UI:** A third control did not fit on cut rows — the name collapsed to 0px and rows overflowed by 44px. Cut rows now use a compact time format (`htFmtTimeShort()`, `h:mm` without AM/PM — unambiguous on a night shift, and the full time is still shown in the edit modal), tighter button padding, and hide the redundant "hrs" label. Cut rows also lightened from 0.45 to 0.6 opacity so the undo control is legible. No row overflows at 393px or 375px, and names render in full except a 2px clip on one name at 375px.

### [6.75] - 2026-08-23

- **UI:** Unified the header treatment across all five tabs. Tools and Settings each wrapped `.header-bar` in an inline white strip (`background:var(--surface-raised)` + `border-bottom`, with negative margins on Tools), and DOP used a separate `.ht-header` panel with its own glass gradient, bottom border and a smaller 17px/900 centered title. Tools and Settings now use a plain `.header-bar` like Logs/Active, and `.ht-header` is transparent with `.ht-header-title` matching `.header-bar h1` (22px/800). Verified: all five titles render at an identical y-position (95px), font-size and weight.
- **UI:** DOP brought onto the app's card language — `.ht-kpi-card` was flat white while every comparable tile (`.stat-card`) is a glass card; it now uses the same gradient, `--glass-border`, `--radius-md` and 2px top accent bar. `.ht-emp-row` moved from `--shadow-md` to `--shadow-sm` with a 5px accent edge to match `.active-card`, `.ht-section` matches `.section-label`, and roster spacing matches `.active-tab-list` (12px).
- **Fix:** DOP employee names were truncating to "RO…" / "LOR…" — the name box measured 35px against 63px of text, because the action buttons, hours column, rank badge and role icon consumed the row. The name is now the row's primary element (15px/800 `--text-main`, normal case instead of 11px uppercase — which is no wider, since uppercase plus 0.6px tracking inflates width). Reclaimed space by trimming row padding/gaps, the rank badge (26→22px), the hours column (52→44px) and shortening the row's "Set Time" button to "Time" (the modal's own confirm keeps the full label). Tap targets unchanged. All 16 default names now render in full at both 393px and 375px, versus all 16 truncating before.
- **UI:** `.tool-card` was the only remaining flat-white card in the app; it now uses the same glass gradient and `--glass-border` as every other card.

### [6.74] - 2026-08-23

- **Change:** DOP no longer maintains a second employee list. `teamNames` (the Settings team list) is now the single source of truth, and `hoursState.employees` is *derived* from it via `htReconcileRoster()` — same people, same order, with each person's per-shift state (status, `startTime`, `frozenHours`, role) carried over by name. v6.73 kept the two lists in sync by patching each mutation site, which still allowed drift through any path that didn't call a sync helper; deriving the roster makes divergence structurally impossible.
- `htReconcileRoster()` runs on load and at the top of `htRenderAll()`, so the DOP tab always reflects the master list, and any orphaned roster entry (from an older build or a direct write) is pruned on the next render.
- **Change:** `htAddEmployee()` now writes only to the master list — it pushes to `teamNames`, saves, refreshes the unloader dropdowns and Team Management list, and lets the roster derive. It no longer touches `hoursState.employees` directly, which removes the duplicate-row path entirely.
- The load path's additive merge (which could add members but never remove them, so anyone deleted in Settings stayed on the DOP roster forever) is replaced by the same reconcile.
- `htRenameEmployee()` is retained and still runs *before* reconcile on rename, so a renamed employee keeps their accumulated hours instead of being dropped and recreated at zero.
- Verified: roster equals the master list exactly after add-from-DOP, add-from-Settings, rename, delete, an injected orphan, and a reload; hours and status survive both reconcile and rename.

### [6.73] - 2026-08-23

- **Change:** Hours tab renamed to **DOP**; the panel header now reads "DOP Tracker". Internal ids (`tab-hours`, `ht-*`, `switchTab('hours')`) are unchanged, so no behavior or stored data is affected.
- **Fix:** The DOP roster and the master Team Management list are now genuinely one list, reconciled in both directions. Previously only one direction worked, and only partially — `htAddEmployee()` pushed to `teamNames`, but `htLoadState()` merged the other way *on load only*, and it merged additively. So: a member added in Settings didn't reach the DOP tab until a reload; deleting a member in Settings left them on the DOP roster permanently (the load-merge only ever adds); and renaming a member left the old name on the roster *and* added the new one, giving two rows for one person. Added `htSyncEmployeesFromTeam()`, `htRemoveEmployeeByName()` and `htRenameEmployee()`, wired into `confirmAddTeamInline()`, `confirmAddUnloader()`, `deleteTeamMember()` and `editTeamMember()`.
- **Fix:** `htAddEmployee()` pushed to `hoursState.employees` unconditionally, so adding a name already on the roster created a duplicate row. It now checks both lists, adds only where missing, and reports when the name already exists. It also calls `renderTeamManagement()` so the Settings list reflects the addition immediately.
- **UI:** `deleteTeamMember()` now states that removal also clears the person from the DOP roster, and warns separately when that person has recorded DOP hours (active, started, or accumulated) that removal would discard.

### [6.72] - 2026-08-23

- **UI:** Grace Period prompt reworded to state the action directly: "Door 9 completed at 08:23 PM. Assign completion to previous hour or current hour." Now shows the clock time rather than just the minute, and no longer describes the grace window in the prompt itself (the Settings description still does). Because the text no longer asserts the completion fell *inside* the window, the separate wording for a simulated prompt was removed — one message is accurate for both, so a simulated prompt now previews exactly what a real one looks like.

### [6.71] - 2026-08-23

- **UI:** The Grace Period prompt now leads with the bay number so it's unambiguous which trailer is being attributed when two bays finish close together — "Door 9 completed at :19, inside the :19-:29 grace window." The simulated variant reads "Simulated — door 14 completed at :49. Tonight's window is :19-:29." Everything else (title, both button labels, Settings copy) is unchanged.

### [6.70] - 2026-08-23

- **Fix:** Grace Period (attribution window) fired inconsistently. `completeDoor()` tested `mins>=0 && mins<10` against the wall-clock minute — a window hardcoded to `:00–:10` since v6.56, despite the comment directly above it stating the window was "anchored to shift start minute". Hour buckets (`getCompletionHour()`) *were* already anchored to the shift start minute, so detection and bucketing disagreed on any start time that wasn't `:00`. The window now derives from the shift start minute via `minutesIntoShiftHour()`/`isInGraceWindow()`:

  | Shift start | Correct window | Old behavior |
  |---|---|---|
  | 20:00 (Mon/Tue) | `:00–:10` | worked, by coincidence |
  | 20:15 (Wed/Thu) | `:15–:25` | never fired; fired at `:00–:09` instead |
  | 19:30 (Fri) | `:30–:40` | never fired; fired at `:00–:09` instead |

  Verified across 18 boundary cases (first minute, last minute, one past, and out-of-window) for all three start times.
- **Fix:** `resolveAttribution()` computed the "Previous Hour" offset as `(wallClockMinutes + 1)`, rewinding past `:00` rather than past the shift-anchored boundary. Now uses `minutesIntoShiftHour() + 1`. Confirmed the previous choice lands exactly one hour bucket back for all three start times.
- **Fix:** `initAttributionSettings()` ran *before* `syncShiftStartToSchedule()` in `init()`, so the grace-window description rendered from the previous session's start time and could disagree with the actual window. Attribution UI is now initialized after the shift start is settled.
- **UI:** The Grace Period prompt now names the real window and completion minute (e.g. "Completed at :17, inside the :15–:25 grace window") instead of the fixed "first 10 minutes of the hour" text, and correctly distinguishes a forced/simulated prompt from a genuine one. The Settings description likewise shows tonight's actual window.

### [6.69] - 2026-08-23

- **Fix:** Dashboard no longer scrolls in its default view — all stats and every bay door fit on screen, verified down to 375×812 (iPhone 13 mini). Two causes: `.tab-content` reserved `--tab-height + --safe-bottom + 80px` (≈160px) of bottom padding when the floating tab bar only occupies `--safe-bottom + 88px`, and the stats grid used three rows. Padding is now `calc(var(--safe-bottom) + 100px)` — which also removes ~60px of dead space at the bottom of every other scrolling tab.
- **Fix:** The bottom row of bay circles was rendering *behind* the tab bar on 6.1" and smaller devices. Bay content ended at y≈735 while the bar's top edge sits at ≈730 once the home-indicator inset is applied. Bays now clear the bar by 43–175px depending on device.
- **UI:** Sort Statistics regrouped from three rows into two — Wallies / CPUs, then This Hour / Last Hour / Overall Total in a 3-up row. All five cards remain, at full size; bay circles and their volume-type colors are unchanged.
- **New:** Weekly shift-start schedule. Start time is now derived from the weekday and applied automatically on app open: Mon/Tue 20:00, Wed/Thu 20:15, Fri 19:30 (Sat/Sun default to 20:00, unused). Stored in `ps9_shift_schedule` and preserved across a data reset.
- **New:** Because shifts run overnight, the schedule resolves against the day the shift *started*, not the wall-clock day — `getShiftDayIndex()` rolls back to the previous day before noon, so 2 AM Tuesday correctly uses Monday's 20:00 rather than Tuesday's. Verified across all weekday and past-midnight boundaries.
- **New:** Settings → Shift Management lists all seven days with editable start times and marks tonight's. A live shift is never re-synced (`syncShiftStartToSchedule()` no-ops unless idle), so editing the schedule can't move a running shift's stats or Hours math. The existing "Shift Start Time" row still works as a one-off override for the current shift.
- **UI:** Widened `.settings-input-inline` (100px → 140px) — time values were clipping their "PM" suffix.

### [6.68] - 2026-08-23

- **New:** Onboarding sheet has a close (X) button at the top right, vertically centered against the title, so the sheet can be dismissed without scrolling down to the Cancel button. Added as reusable `.modal-header-row` / `.modal-close-btn` classes so the same treatment can be rolled out to other modals.
- **UI:** Note tag chips had `border:2px solid transparent` over a `--border-light` fill, leaving them with no visible edge against the near-white modal sheet. Chips now use a white fill with a `1.5px solid var(--border)` border, matching `.form-input` in the same sheet. Selected chips stay solid `--text-main`; custom tags keep their amber fill/border, now at the same 1.5px weight.
- **UI:** `.note-text-input` (free-text notes box) had no border and a gray fill, and `.note-custom-tag-input` had a gray fill — both now white with a matching `1.5px` border, a `--radius-md` corner, and the same blue focus ring as other form fields, so every input in the sheet reads consistently. Applies to both the onboarding sheet and the shared Notes editor.

### [6.67] - 2026-08-23

- **Fix (iOS):** Modal sheets no longer crowd the Dynamic Island. `.modal-sheet` and `.h-modal-sheet` capped height at `92vh`/`90vh`, so top clearance was a *percentage* of screen height and shrank on smaller devices — measured at 16px on iPhone 16 Pro Max but only 11px on 16 Pro and 9px on 15/14 Pro, against a 59px island inset. Height is now `calc(100dvh - var(--safe-top) - 24px)`, giving a constant 24px clearance on every device regardless of screen size. Most visible on the onboarding sheet, which grew tall enough in 6.66 (inline Notes tag picker) to actually hit the cap.
- **Fix (iOS):** Bottom tab bar drifting/lagging during momentum scroll. Removed the deprecated `-webkit-overflow-scrolling:touch` from the two vertical scroll containers (`.tab-content`, `.ht-body`) — a no-op since iOS 13 that is a known cause of `position:fixed` repaint drift — and promoted `.tab-bar` to its own compositor layer with `translateZ(0)` so its `backdrop-filter` blur stops sampling stale pixels behind the scroll. Visual appearance unchanged.

### [6.66] - 2026-08-23

- **New:** Onboarding Notes. The onboard-a-Wally form now has an inline Notes section — pick predefined tags (the existing 12-tag list) and/or type freeform custom tags, plus optional text, right at onboarding. Saving appends a new timestamped entry to that Wally's note history rather than overwriting it.
- **New:** Duplicate-note detection at onboarding. Typing a Wally number that already has notes on file shows a banner with its most recent tags/text and an entry count ("N prior notes on file"), with a "Use These" shortcut to copy them into the current form. Non-blocking — onboarding proceeds normally either way.
- **New:** Notes Manager now shows an "N entries" badge on Wally IDs with more than one note, and opening a note now shows its full chronological history (timestamped) below the editable current tags.
- **New:** Notes Manager's editor supports custom tags (not just the 12 predefined ones) — add/remove freeform tag chips alongside predefined ones, distinguished with an amber style throughout the app.
- **New:** Active Door detail view has a note-edit shortcut (next to the existing edit/move icons) so tags can be corrected on an already-onboarded, still-active Wally — e.g. if the volume mix turns out different than what was tagged at onboarding. Editing here (and from Notes Manager) updates the *current* note entry in place; it does not rewrite prior history.
- **Data model:** `wallyNotes[id]` changed from a single overwritten `{tags,text,updated}` record to an append-only array of `{tags,text,timestamp}` entries, where each tag is `{value,type:'predefined'|'custom'}`. Legacy single-record and raw-string notes migrate automatically on read.
- **Backend:** `apps-script/Code.gs`'s NOTE webhook handler updated to serialize the new tag object shape (predefined tags unchanged; custom tags suffixed " (custom)") when appending rows to the Notes sheet.

### [6.65] - 2026-06-10

- **Fix:** `SHIFT_END` and `NOTE` webhook payloads now send immediately. `confirmEndShift()` and `sendNoteWebhook()` queued the payload but never called `processWebhookQueue()`, so ending a shift with no open bays (the common case) left the SHIFT_END summary stuck in localStorage with the badge showing "Syncing (1)..." until some unrelated send or a page reload.
- **Fix (Hours):** The first start-time edit after every shift reset was silently swallowed. `htSilentReset()`/`htConfirmReset()` rebuilt `hoursState` without the `pendingCutTimeId` field, and `htApplyCustomTime()`'s `!== null` check treated `undefined` as an active cut-time edit, matching no employee and discarding the input. The field is now included in reset state and the check uses `!= null`.
- **Fix (Hours):** Cancelling a cut-time edit no longer contaminates the next start-time edit (which could apply the new value as a *cut time to the previous employee*). Opening either time modal now clears the other modal's pending id.
- **Fix:** Tapping Revert on a manually-added log entry threw a TypeError (`doors[0]` doesn't exist) — manual entries have no bay to revert to. The Revert button is no longer rendered for manual entries and `revertLog()` guards against missing doors.
- **Fix:** Grace Period no longer silently re-enables on every shift start. `confirmStartShift()` (and the legacy `newShift()`) hard-reset `attributionConfig={enabled:true}`, overriding the user's saved Settings toggle; the saved value is now respected.
- **Fix:** Sync error badge — queuing a new payload during the 5-second error window removed the badge's tap-to-retry `onclick`. The handler now stays installed and the "Tap to retry (N)" count refreshes live.
- **Fix:** Onboarding a duplicate Wally now uses the arrival time typed in the form (previously it always recorded "now") and sets `laborStart` consistently with the normal onboard path.
- **Cleanup:** Corrected a stale comment in `htAssignRoles()` (Robert W auto-receives Belt Tender, not Bulk Sweep).

### [6.64] - 2026-06-10

- **Fix:** Hours Tracker no longer zeroes employee hours after midnight on overnight shifts. Root cause: `htParseHHMM()` always built HH:MM times on *today's* date, so after midnight a start time like "23:50" (or a `htSyncFromWallyShift()` re-sync of the "20:00" shift start) produced a timestamp ~20+ hours in the future, and `htCalcHours()` clamped the result to 0.00 for the rest of the night. `htParseHHMM()` now rolls any time more than 6 hours in the future back one day, mirroring the main tracker's overnight handling in `getShiftTimeWindows()`. Near-future times (under 6h, e.g. a pre-shift custom start time) are intentionally left on today. Fix applies to all Hours Tracker time paths: shift-start sync, employee activation with a custom start, and start/cut time edits.

### [6.63] - 2026-05-15

- **UI:** Active door modal data section wrapped in a glassmorphism card (`linear-gradient` + `glass-border`) matching the visual language of stat-cards and log-cards. Detail value font-size raised to 15px, rows now have horizontal padding (12px 14px) and `align-items:center`. Last row has no bottom border.
- **UI:** Onboard modal "Bay Unavailable" message and "Mark Unavailable" button colors replaced — `#000`/`#8e8e93`/`#e5e5ea` → `var(--text-main)`/`var(--text-sub)`/`var(--border)`.
- **Fix:** Hours tab "Add Employee" — name is now Title-Cased before saving (matching all other add-name flows). `populateUnloaderSelect()` is called after `saveTeam()` so the new employee immediately appears in the unloader dropdowns on the onboard and edit-active modals.

### [6.62] - 2026-05-15

- **UI:** Onboard modal Wally/CPU type selector now has `border:1.5px solid var(--border)` and white background — matches the visible-border style of all form inputs, no longer washes out.
- **UI:** Active door modal CPU replacement section — removed the filled `#f2f2f7` background box and `16px` horizontal padding. Content now aligns flush with the modal's content edge (same as detail rows and buttons). A `border-top` separator replaces the box.
- **UI:** "Skip share sheet" row gets a matching `border-top` separator for consistent vertical rhythm.
- **UI:** Hardcoded `#000` and `#8e8e93` colors in the CPU next section replaced with `var(--text-main)` and `var(--text-sub)`.

### [6.61] - 2026-05-15

- **Fix:** Completion records no longer silently dropped when a `start` payload was in-flight at the time of completion. Root cause: `queuePayload` dedup correctly removed the in-flight `start` from localStorage and added the `end`, but `processWebhookQueue`'s `.then()` handler blindly called `cq.shift()` — which removed the newly-added `end` instead. Each payload now receives a unique `_queueId` on enqueue. The success handler removes the specific sent item by `_queueId`; if not found (item was deduped out), nothing is removed and the replacement `end` payload remains in the queue for the next processing cycle.

### [6.60] - 2026-05-15

- **Fix:** Form input fields (`form-input` class — Wally Number, Unloader select, Start Time, and all other modal inputs) now have a visible `1.5px solid var(--border)` border and white background, making them clearly defined against the modal sheet. Focus state highlights the border blue (`#007aff`) with a soft glow ring.

### [6.59] - 2026-05-15

- **Design:** UI/UX modernization pass across CSS.
  - Bay circles enlarged from 58px to 72px; font-size increased from 16px to 20px, font-weight to 900.
  - Active card left border thickened from 4px to 5px; `position:relative;overflow:hidden` added; `.active-card-progress` CSS rule added (3px tall static bar, ready for JS fill).
  - Modal sheets (`.modal-sheet`) updated to `border-radius: 32px 32px 0 0` and `::before` drag handle pseudo-element added (36×4px, `var(--border)` background).
  - Toggle switches widened from 48px to 52px; checked thumb position updated to `left:26px`.
  - Log card duration numbers increased from 26px to 30px font-size.
  - `.btn-primary` vertical padding increased to 19px (from 15px) for ~56px total height.
  - `.stat-value` font-size increased from 38px to 42px.
  - All `scale(0.96)` active-state transforms changed to `scale(0.97)`.
  - `.wally-id` monospace CSS class added for future use.
  - `transition: background 0.15s` added to `.settings-row`.

### [6.58] - 2026-05-15

- **Fix:** Webhook queue size cap removed. Queue no longer drops payloads under load. Console warning fires if queue exceeds 200 items (informational only).
- **New:** Sync error badge is now tappable. Shows "Tap to retry (N)" in error state. Tapping clears the error class and immediately retries `processWebhookQueue()`. Auto-retry after 5 seconds unchanged.

### [6.57] - 2026-05-15

- **Fix:** Hours Tracker and main shift state now stay in sync across page reloads. `htLoadState()` reconciles `hoursState` against `ps9_shift_state` on every load — if Wally shift is live but `hoursState.shiftStarted` is false, `htSyncFromWallyShift()` is called automatically; if Wally shift is idle but Hours Tracker still thinks it's live, the shift is marked ended.
- **Fix:** `confirmEndShift()` now wraps `htEndShift()` in a `try/finally` block so `htSilentReset()` is guaranteed to run even if `htEndShift()` throws (e.g. no active employees).
- **Fix:** `resetData()` now explicitly calls `localStorage.removeItem('ps9_v4')` so Hours Tracker state is cleared along with everything else on a full data reset.

### [6.56] - 2026-05-15

- **Fix:** Renamed "Attribution Window" to "Grace Period" throughout all UI text. JS variable names (`attributionConfig`, `statOffset`, `initAttributionSettings`, etc.) and the `ps9_attribution_config_v2` localStorage key are unchanged.
- **Fix:** Grace period window simplified to a fixed :00-:10 window each hour. The offset slider has been removed from Settings. The `minutes` field is no longer stored or read from `attributionConfig`.
- **UI:** Settings toggle renamed to "Enable Grace Period" (positive framing — on = enabled). "Simulate Attribution" removed from Settings and added to Demo section as "Simulate Grace Period".
- **UI:** Grace period modal heading changed from "Attribute Completion" to "Grace Period" with subheading "Completed in the first 10 minutes of the hour."

### [6.55] - 2026-05-15

- **Fix:** Wally/Trailer ID field in the Edit Log modal is now editable. The corrected ID is saved to `historyLog`, triggers a webhook resync to Google Sheets via `sendToWebhook(historyLog[i], 'end')`, and any note attached to the old ID is automatically migrated to the new ID (old key deleted).
- **Fix:** ID field in the Edit Active Bay modal is also editable. Both fields enforce uppercase on save via `.toUpperCase()`.

### [6.54] - 2026-05-15

- **Fix:** CPU door completion no longer blocks when no replacement type is selected. The `alert()` and early `return` in `confirmCompleteDoor()` have been removed. Replacement selection (CPU or Wally) is now optional — if neither checkbox is checked, `cpuNext` is `false` and no share sheet fires. Selecting a checkbox still fires the correct share text as before.
- **UI:** CPU replacement section heading changed from "What is replacing this CPU?" to "What's replacing this CPU? (optional)" to communicate the optional nature clearly.

### [6.53] - 2026-05-02

- **Feature:** Dynamic system start times. Default shift start now auto-sets by day of week: Mon/Tue/Fri = 8:00 PM, Wed/Thu = 8:15 PM. The Settings "Shift Start Time" field overrides the default when manually set. Dashboard nameplate now shows the effective start time (e.g. "Start 8:00 PM") in the sub-line below the version.
- **Feature (Hours tab):** Cut Time editing. Employees in the "cut" state now show an editable Cut Time button alongside the existing Start Time button. Tapping it opens the same time-picker modal; changing the cut time immediately recalculates frozen hours as (new cut time − start time).
- **Feature:** "Now" button in Edit Active Bay modal. A "Now" button next to the Labor Start Time field instantly populates it with the current clock time, eliminating manual time entry.
- **Design:** UI/UX modernization — glassmorphism applied across nameplate, stat cards, active cards, log cards, employee rows, hours header, modals, and settings groups. Body background updated to a subtle purple-blue gradient. Shadow tones warmed with a slight indigo hue. Button active states deepened for tactile haptic feedback. All existing functionality unaffected.

### [6.52] - 2026-04-28

- **Fix:** Enhanced Light Mode not visually rendering after v6.51. Two root causes corrected:
  1. Inter font added as CSS `@import` inside `<style>` in addition to the `<link>` tag — PWA WebViews sometimes skip `<link>` preloads but honor `@import`.
  2. Shadow values from v6.51 spec (0.03 opacity) were too close to invisible on white surfaces, making cards look *flatter* than before. Boosted to `sm:0.07/0.04`, `md:0.09/0.05`, `lg:0.12/0.06` — large blur radii preserved for the soft/diffused floating-card effect.

### [6.51] - 2026-04-28

- **Design:** Enhanced Light Mode — premium Soft UI aesthetic applied globally. No layout, DOM, or functional changes.
  - **Typography:** Inter font (Google Fonts, 400–900 weights) replaces SF Pro Display as the primary typeface.
  - **Shadows:** All three shadow variables softened to highly diffused, low-opacity values for a floating card feel.
  - **Tab bar:** Glassmorphism refined — background opacity reduced to 0.85, backdrop-filter increased to blur(24px), border tightened to rgba(255,255,255,0.6).
  - **Micro-interactions:** Stat cards, bay circles, tool cards, and active cards upgraded to `cubic-bezier(0.16,1,0.3,1)` spring transitions (0.2s). `:active` press scales tightened (bay circles 0.9→0.94, stat cards 0.97→0.96) with compressed shadow for tactile feedback.

### [6.50] - 2026-04-28

- **Fix:** Share sheet now fires reliably on every Wally completion. Removed the `config.shareOnComplete` gate — the Settings "Preferences" section that controlled it was removed in v6.47, leaving no way to re-enable it if it had been toggled off. The "Skip share sheet" checkbox on the completion modal is the sole per-completion override.
- Share text: Wally done → `Door X done`. Wally done + CPU checkbox → `Door X done\nDoor X CPU`. Skip checked → no share.

### [6.49] - 2026-04-28

- **Fix:** Google Sheets sync CORS preflight failure — changed fetch `Content-Type` from `application/json` to `text/plain;charset=utf-8`. This converts the POST to a CORS "simple request", bypassing the OPTIONS preflight that Google Apps Script does not handle. Apps Script still receives and parses the JSON body via `e.postData.contents`; `{ok:true}` response check is unaffected.

### [6.48] - 2026-04-28

- **Fix:** Share sheet (iOS) — removed `setTimeout` wrapper from `navigator.share()` inside `finalizeCompletion`. iOS requires Web Share API to be called synchronously within a user gesture; the 100 ms delay was silently blocking it with `NotAllowedError`.
- **New:** Start Shift — if trailers are onboard when "Start Shift" is pressed, a modal asks whether to carry them into the new shift or clear them. "Add to New Shift" preserves active/staged bays and clears history only. "Remove All & Start Fresh" matches prior behavior.
- **Fix:** Google Sheets sync reliability — fetch upgraded from `mode:'no-cors'` (opaque response, always dequeued) to CORS-aware request that reads the Apps Script JSON. Items dequeued only on `{ok:true}`. Apps Script failures now retry from queue. **Requires Apps Script re-deploy** (doPost must return CORS-enabled JSON).

### [6.47] - 2026-04-27
- **Settings UI:** Consolidated "Shift Management" and "Shift Configuration" into a single unified collapsible section. Removed the "Preferences" section entirely.
- **Completion Pop-up:** Added "Skip share sheet" checkbox to the Active Detail modal. When checked, the share sheet is bypassed for that completion only. Checkbox auto-resets on modal open.
- **Shift End — Share Total:** Added "Share total wallies to team" checkbox to the End Shift modal. When checked, fires iOS Share Sheet with `"PS9 - [N] number of wallies"` (N = completed Wallies + 1) after confirmation.
- **Shift End — Staffing Reset:** Hours/Staffing tab is now fully reset on every shift end, clearing all employee clock-in state so the next shift begins clean.
- **Door Timer:** Timer and warn/crit ring animations only activate when a real unloader is assigned. Staged bays and Unassigned bays show no escalation. `laborStart` is withheld until a named unloader is recorded.
- **Labor Alert:** When total Unloader hours cross 16.0h, the Unload KPI card highlights red and a dismissible alert banner fires. Resets automatically if hours drop below threshold.

### [6.46] - 2026-04-26
- **Dashboard:** Removed redundant "Add Unloader" button. Manual button relocated as a compact icon button in the nameplate actions row.
- **End-of-Shift Report:** `htBuildBreakdown()` now uses pure hours-ranked role assignment. Highest-hours = Belt Tender; next 2 = Bulk Sweep; remainder = Unloaders. Minimizes total Unloader group hours. Robert Rule satisfied naturally.
- **Cut Employee:** Cut rows now display an editable time button. `cutTime` stored on cut/frozen employees. Editing start time after cut recalculates `frozenHours` accurately.

### [6.45] - 2026-04-26
- **WCAG 2.1 accessibility pass:** Removed `user-scalable=no`; added `:focus-visible` ring styles; full tab-bar ARIA (`role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`); all modals get `role=dialog + aria-modal + aria-labelledby` with auto-focus on open; icon-only buttons get `aria-label`; stat/tool cards get `role=button + tabindex`; toggle switches get `role=switch + aria-checked`; settings collapse buttons get `aria-expanded`; badge `aria-label` synced dynamically.
- **Color contrast:** `--text-sub` darkened to `#4b5563` (6.6:1 on white, was 4.2:1); `--text-muted` to `#6b7280` (was `#9ca3af` at 2.5:1).
- **Touch targets:** Stepper `+`/`-` buttons enlarged to 44×44px.
- **Layout:** Dashboard nameplate moved above action buttons so shift state is visible before interacting. Settings/Tools tab headers use CSS variables instead of hardcoded colors.
- **Overflow fix:** `.settings-label` now truncates gracefully on narrow screens.

### [6.44] - 2026-04-26
- Hours tab: employee rows upgraded to match Dashboard card design language — shadow deepened to `--shadow-md`, min-height 78px, padding 16px.
- Hours tab: employee name labels restyled to match stat-label treatment (11px uppercase, muted, letter-spaced) matching "WALLIES" style.
- Hours tab: Start/Set Time buttons converted to horizontal row. Start retains black fill (`btn-shift` style); Set Time is now a ghost/outline button. Both consistent at 36px height, 10px radius.

### [6.43] - 2026-04-26
- Hours tab: employee name font reduced (16px→14px), DOP status label reduced (15px→13px), and shift time input reduced (16px→15px) for visual consistency with the rest of the app.
- Dashboard: stat cards enlarged (min-height 62→76px, padding 10→13px, value font 34→38px), bay circles enlarged (52→58px), and nameplate padding increased (10→14px) for a more spacious feel.

### [6.42] - prior
- Dashboard: full single-screen layout for iPhone 16 Pro Max. All content fits without scrolling on a 6.9-inch display.
- App container top padding reduced so Dynamic Island breathing room is handled by the OS safe area inset.
- Nameplate: reduced padding and title size (26→21px).
- Stat cards: height 100→62px, value font 52→34px, gap 12→8px.
