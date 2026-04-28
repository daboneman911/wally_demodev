# Changelog

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
