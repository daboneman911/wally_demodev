# Changelog

### [6.67] - 2026-08-23

- **Design:** App-wide UI redesign toward a sharper, sleeker, Nike.com-inspired look.
  - **Flat surfaces:** removed glassmorphism (translucent gradients + `backdrop-filter` blur) from every card, modal, and panel across all six tabs (Dashboard, Active, Logs, Hours, Tools, Settings) in favor of solid opaque surfaces with crisp 1px hairline borders for separation.
  - **Sharp corners:** collapsed the four-value radius scale (`--radius-sm/md/lg/xl`, 10-28px) into a single `--radius:4px` token used on cards, buttons, inputs, and modals. Bay circles stay circular (a meaningful shape, not decoration); tags/badges/pills keep their rounded shape.
  - **Bottom nav:** converted from a floating inset glass pill to a full-width flat bar with a top hairline border.
  - **Bay circles:** dropped the arbitrary per-bay decorative gradient fill (bay 9 green, 10/12 purple, 11/13-16 orange) for one consistent solid fill; status is still communicated the same way it already was, via the colored border ring.
  - **Color consolidation:** unified two parallel color systems (tokenized `--accent-*` set vs. hardcoded "iOS system colors" like `#007aff`/`#34c759`/`#ff3b30`/`#ff9500`, plus an untracked amber family and assorted pre-token legacy grays) into one token set referenced everywhere, including inline styles built by JS at render time.
  - **Typography:** unified two competing header styles (small eyebrow labels vs. large centered titles) into one consistent pattern -- big bold uppercase page titles with a bottom hairline, paired with small wide-tracked uppercase section labels. Primary buttons (Start Shift, Save, Complete Unload, etc.) now use uppercase tracked text for a stronger CTA presence. Removed a duplicate font load (`<link>` + `@import` both loading Inter) and a stale duplicate `.header-bar h1` rule.
  - **Hours tab parity:** brought the previously-separate `.ht-*` design system (KPI tiles, employee rows, role pickers, toasts) onto the same flat/sharp/tokenized treatment as the rest of the app.
  - No behavior/logic changes -- CSS and a handful of inline-style color literals only.

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
