# Share Sheet, Start Shift Logic & Sync Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken share sheet trigger, add conditional bay-carry logic to Start Shift, and implement a more reliable Google Sheets sync by upgrading from `no-cors` opaque fetches to a CORS-aware response cycle.

**Architecture:** All changes are in a single `index.html` file. The share sheet fix is a one-line removal. The Start Shift change adds a new modal and a fork in `openStartShiftConfirm`. The sync fix requires a coordinated change to the client-side fetch logic AND an update to the Google Apps Script (`doPost` must return a JSON success flag with CORS headers so the client can detect real failures and retry).

**Tech Stack:** Vanilla JS, HTML/CSS, Google Apps Script (server-side `doPost`), Web Share API (`navigator.share`), `fetch` with CORS, `localStorage` queue.

---

## Root Cause Analysis (read before implementing)

### Issue 1 — Share Sheet

`finalizeCompletion` (line 1818) calls `navigator.share()` inside a `setTimeout(..., 100)`:

```js
setTimeout(()=>{navigator.share({text:shareText}).catch(...)},100);
```

iOS Safari requires `navigator.share()` to be called **synchronously within a user gesture handler**. `setTimeout`, even at 0 ms, steps outside that gesture context. iOS throws `NotAllowedError`, which is silently swallowed by `.catch(err=>console.log('Share dismissed:',err))` — so it looks like the user dismissed it when in fact it was blocked before showing.

The `closeModal('active-detail-modal')` call that precedes it uses `element.style.display='none'` (confirmed at line 1782). The DOM elements stay in the tree, so `byId('chk-skip-share')` is still readable after the modal closes. There is no animation to "wait for" — the delay serves no purpose and actively breaks iOS.

### Issue 2 — Start Shift

`openStartShiftConfirm()` (line 1597) immediately clears all `doors[]` after the `confirm()` dialog — there is no check for currently onboarded bays. The new requirement: if any doors are `active` or `staged`, pause and present a **custom modal** offering two paths:
- **Add to new shift** — preserve current doors, reset only `historyLog` and attribution state.
- **Remove all** — existing behavior (clear doors + logs).

### Issue 3 — Google Sheets Sync

The fetch at line 1449 uses `mode:'no-cors'`:

```js
fetch(WEBHOOK_URL,{method:'POST',mode:'no-cors',...})
.then(function(){
    cq.shift(); // dequeue — assumes success
    ...
```

With `no-cors`, the browser returns an **opaque response** for any network-reachable request — HTTP 200, 500, or even a Google Apps Script runtime exception all resolve `.then()`. The queue item is removed regardless of whether Apps Script actually wrote to the sheet.

**Why completions stay active in the sheet:** The `status:'completed'` payload fires, the network layer succeeds (Apps Script is reachable), but the script may time out, hit quota, or throw an exception. The client dequeues it as successful. The sheet is never updated.

**Fix:** Upgrade to CORS-aware fetch. Apps Script must:
1. Set the `Access-Control-Allow-Origin: *` header on the `doPost` response.
2. Return `{"ok":true}` on success or `{"ok":false,"error":"..."}` on failure.

The client then:
1. Removes `mode:'no-cors'`.
2. Reads the JSON body.
3. Only dequeues on `ok===true`; retries with back-off on failure.

---

## File Map

All changes are in one file: `index.html`

| Area | Lines (approx) | Change |
|---|---|---|
| HTML modal — start-shift-bays | new, insert near line 844 | New modal for the bay-carry choice |
| `finalizeCompletion` | 1839–1841 | Remove `setTimeout`, call `navigator.share()` directly |
| `openStartShiftConfirm` | 1597–1612 | Add bay-count check + branch to new modal |
| `confirmStartShift(keepBays)` | new, after line 1612 | Handles the modal's two button paths |
| `processWebhookQueue` | 1441–1465 | Replace `no-cors` fetch with CORS-aware fetch + response check |
| Version constant + nameplate sub | lines 552, 866 | Bump `v6.47` → `v6.48` |
| Inline changelog constant | line 872 block | Add `v6.48` entry |
| `CHANGELOG.md` | root file | Add `v6.48` entry |

---

## Task 1 — Fix the Share Sheet

**Files:**
- Modify: `index.html` (line ~1840)

- [ ] **Step 1: Locate the setTimeout call**

Open `index.html` and find this block inside `finalizeCompletion` (around line 1839):

```js
if(shareText){
    setTimeout(()=>{navigator.share({text:shareText}).catch(err=>console.log('Share dismissed:',err));},100);
}
```

- [ ] **Step 2: Replace with a direct synchronous call**

Change the block to:

```js
if(shareText){
    navigator.share({text:shareText}).catch(err=>console.log('Share dismissed:',err));
}
```

No `setTimeout`. No delay. The `closeModal` call that ran just before this already set `display:none` synchronously, so the modal is gone before the share sheet appears.

- [ ] **Step 3: Verify the share sheet guard conditions are intact**

The surrounding `if` at line 1829 must still read:

```js
if(navigator.share&&!demoActive&&config.shareOnComplete&&!skipShare){
```

Confirm this is untouched — `!demoActive` prevents the share from firing in demo/auto-complete paths.

- [ ] **Step 4: Manual test on device**

Open the app on iPhone/Safari. Onboard a bay, assign an unloader, tap the bay circle → "Complete Unload". Confirm that the native iOS share sheet appears immediately. Also confirm that checking "Skip share sheet" suppresses it correctly.

---

## Task 2 — Start Shift: Bay-Carry Modal

**Files:**
- Modify: `index.html` — HTML section (new modal near line 844), JS section (functions `openStartShiftConfirm` and new `confirmStartShift`)

- [ ] **Step 1: Add the new modal HTML**

Find the existing `unloader-required-modal` div (around line 845). Insert the new modal **before** it:

```html
<div class="modal-overlay z-high" id="start-shift-bays-modal"><div class="modal-sheet">
  <h2 style="margin:0 0 10px;font-size:24px;text-align:center;">Trailers Still Onboard</h2>
  <p style="text-align:center;color:#757575;margin-bottom:6px;font-size:15px;">
    There are <strong id="start-shift-bay-count"></strong> trailer(s) currently active.
    What should happen to them?
  </p>
  <button class="btn-primary" style="margin-bottom:12px;" onclick="confirmStartShift(true)">
    Add to New Shift
  </button>
  <button class="btn-primary btn-danger" style="margin-bottom:12px;" onclick="confirmStartShift(false)">
    Remove All &amp; Start Fresh
  </button>
  <button class="btn-cancel" onclick="closeModal('start-shift-bays-modal')">Cancel</button>
</div></div>
```

- [ ] **Step 2: Verify `btn-danger` CSS exists**

Check that `.btn-primary.btn-danger` is styled (red background) — it is used by the existing "Complete Unload" button on the active-detail-modal and is already defined. Confirm in the `<style>` block.

- [ ] **Step 3: Rewrite `openStartShiftConfirm`**

Current code (lines 1597–1612):

```js
function openStartShiftConfirm(){
    if(demoActive){startDemoShift();return}
    if(!confirm('Start a new shift? This will clear all active trailers and logs, but keep your notes and team names.'))return;
    for(let i=DOORS_START;i<=DOORS_END;i++)doors[i]={status:'empty',start:0,laborStart:null,id:'',type:'',unloader:'',unavailable:false,lastCompletionTime:null,assignments:[]};
    historyLog=[];attributionConfig={minutes:0,enabled:true};updateAttributionUI();
    lastSortStartTime=null;isFirstOnboard=false;
    saveDoors();saveHistory();saveData();
    shiftState='live';saveShiftState();
    shiftEndTime=null;
    localStorage.removeItem('ps9_shift_end_time');
    startDashboardRefresh();
    updateNameplate();renderDashboard();renderActiveTab();updateTabBadges();
    attemptWebhook({dataType:'NEW_SHIFT',dateKey:dateKeyFromTs(Date.now()),shiftStart:getShiftStartTime()});
    showToast('Shift started');htSyncFromWallyShift();}
```

Replace with:

```js
function openStartShiftConfirm(){
    if(demoActive){startDemoShift();return}
    let activeBayCount=0;
    for(let i=DOORS_START;i<=DOORS_END;i++){
        if(doors[i].status==='active'||doors[i].status==='staged')activeBayCount++;
    }
    if(activeBayCount>0){
        byId('start-shift-bay-count').textContent=activeBayCount;
        byId('start-shift-bays-modal').style.display='flex';
        return;
    }
    // No active bays — confirm and proceed directly
    if(!confirm('Start a new shift? This will clear all logs, but keep your notes and team names.'))return;
    confirmStartShift(false);
}
```

- [ ] **Step 4: Add `confirmStartShift(keepBays)` immediately after `openStartShiftConfirm`**

Insert this new function right after the closing `}` of `openStartShiftConfirm`:

```js
function confirmStartShift(keepBays){
    closeModal('start-shift-bays-modal');
    if(!keepBays){
        for(let i=DOORS_START;i<=DOORS_END;i++)doors[i]={status:'empty',start:0,laborStart:null,id:'',type:'',unloader:'',unavailable:false,lastCompletionTime:null,assignments:[]};
    }
    historyLog=[];attributionConfig={minutes:0,enabled:true};updateAttributionUI();
    lastSortStartTime=null;isFirstOnboard=false;
    saveDoors();saveHistory();saveData();
    shiftState='live';saveShiftState();
    shiftEndTime=null;
    localStorage.removeItem('ps9_shift_end_time');
    startDashboardRefresh();
    updateNameplate();renderDashboard();renderActiveTab();updateTabBadges();
    attemptWebhook({dataType:'NEW_SHIFT',dateKey:dateKeyFromTs(Date.now()),shiftStart:getShiftStartTime()});
    showToast(keepBays?'New shift started — bays carried over':'Shift started');
    htSyncFromWallyShift();
}
```

- [ ] **Step 5: Manual test — no active bays**

With no trailers onboard: press "Start Shift" → the existing `confirm()` dialog should appear → confirm it → shift starts, toast says "Shift started". No modal.

- [ ] **Step 6: Manual test — with active bays**

Onboard 1+ trailers. Press "Start Shift" → the new "Trailers Still Onboard" modal appears showing the correct count. Test both buttons:
- "Add to New Shift" → shift starts, bays remain on the dashboard, logs cleared, toast says "New shift started — bays carried over".
- "Remove All & Start Fresh" → shift starts, dashboard is empty, toast says "Shift started".
- "Cancel" → modal closes, nothing changes.

---

## Task 3 — Google Sheets Sync: CORS-Aware Fetch

This task has two parts: **A (Apps Script change)** and **B (client change)**. Part A must be deployed before Part B takes effect in production.

### Part A: Update Google Apps Script

The Apps Script lives at the URL in line 867 of `index.html`. You must open the Apps Script editor for this project and update `doPost`.

- [ ] **Step A1: Open the Apps Script**

Go to [script.google.com](https://script.google.com), find the script attached to the Wally tracker spreadsheet.

- [ ] **Step A2: Update `doPost` to return a CORS-enabled JSON response**

Find the `doPost(e)` function. Wrap the entire body in a try/catch and return a structured response like this:

```js
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    var payload = JSON.parse(e.postData.contents);
    // --- your existing processing logic here (unchanged) ---
    processPayload(payload); // or whatever your current logic calls
    // --- end existing logic ---
    output.setContent(JSON.stringify({ok: true}));
  } catch(err) {
    output.setContent(JSON.stringify({ok: false, error: err.message}));
  }
  return output;
}
```

Key: `ContentService.createTextOutput()` with `MimeType.JSON` automatically adds `Access-Control-Allow-Origin: *` for web app deployments set to "Anyone". This is what allows the browser to read the response body (no longer opaque).

- [ ] **Step A3: Re-deploy the Apps Script as a new version**

In the Apps Script editor: Deploy → Manage deployments → Create new deployment. Copy the new URL if it changed, or confirm the existing URL is re-deployed with the new code. Update `WEBHOOK_URL` in `index.html` line 867 if the URL changed.

- [ ] **Step A4: Smoke test the Apps Script endpoint**

From a browser console or curl, POST a test payload:

```bash
curl -X POST "WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"dataType":"TEST","dateKey":"2026-04-28"}' \
  -L
```

Expected: `{"ok":true}` in the response body. If you see `{"ok":false,...}` you have a script error to fix before Part B.

### Part B: Update the Client Fetch Logic

- [ ] **Step B1: Locate `processWebhookQueue` in `index.html` (around line 1441)**

Current code:

```js
fetch(WEBHOOK_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
.then(function(){
    let cq=[];
    try{cq=JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]');}catch(e){}
    cq.shift();
    try{localStorage.setItem('ps9_webhook_queue',JSON.stringify(cq));}catch(e){}
    isSyncingWebhook=false;
    updateSyncBadge();
    setTimeout(processWebhookQueue,200);
})
.catch(function(err){
    isSyncingWebhook=false;
    const badge=byId('sync-badge');
    if(badge){badge.classList.add('visible','error');const t=byId('sync-badge-text');if(t)t.textContent='Sync failed';}
    setTimeout(function(){updateSyncBadge();processWebhookQueue();},3000);
});
```

- [ ] **Step B2: Replace the fetch block with a CORS-aware version**

```js
fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
.then(function(resp){return resp.json();})
.then(function(data){
    if(!data.ok){throw new Error(data.error||'Apps Script reported failure');}
    let cq=[];
    try{cq=JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]');}catch(e){}
    cq.shift();
    try{localStorage.setItem('ps9_webhook_queue',JSON.stringify(cq));}catch(e){}
    isSyncingWebhook=false;
    updateSyncBadge();
    setTimeout(processWebhookQueue,200);
})
.catch(function(err){
    console.warn('[Sync failed]',err.message);
    isSyncingWebhook=false;
    const badge=byId('sync-badge');
    if(badge){badge.classList.add('visible','error');const t=byId('sync-badge-text');if(t)t.textContent='Sync failed';}
    setTimeout(function(){updateSyncBadge();processWebhookQueue();},5000);
});
```

Key changes:
- Removed `mode:'no-cors'` — browser can now read the response.
- Chained `.then(resp=>resp.json())` to parse the body.
- Added `if(!data.ok) throw` — Apps Script failures now re-enter the `.catch()` path and the item stays queued.
- Retry delay changed from 3 s → 5 s to avoid hammering a struggling endpoint.

- [ ] **Step B3: Verify fallback behavior when Apps Script is unreachable**

Turn on airplane mode in dev tools (Network tab → Offline). Trigger a bay arrival. Confirm the sync badge shows "Sync failed" and the queue is preserved in `localStorage` (`ps9_webhook_queue`). Go back online — the queue should process automatically.

- [ ] **Step B4: Verify successful completion dequeue**

Complete a bay normally (not in demo mode). Watch the sync badge — it should show "Syncing..." briefly then disappear. Open the Google Sheet and confirm the row now shows `status=completed`.

---

## Task 4 — Version Bump & Changelog

**Files:**
- Modify: `index.html` lines 552, 866, 872 block
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump version in nameplate subtitle (line 552)**

Change:
```html
<div class="nameplate-sub" id="nameplate-sub">by Fitz Joseph &nbsp;&middot;&nbsp; v6.47</div>
```
To:
```html
<div class="nameplate-sub" id="nameplate-sub">by Fitz Joseph &nbsp;&middot;&nbsp; v6.48</div>
```

- [ ] **Step 2: Bump version constant (line 866)**

Change:
```js
const APP_VERSION='6.47',
```
To:
```js
const APP_VERSION='6.48',
```

- [ ] **Step 3: Add inline changelog entry (around line 872)**

Insert a new `v6.48:` block immediately before the existing `v6.47:` block:

```
v6.48:
- Fix: Share sheet now fires reliably on iOS. Root cause was a setTimeout(100) wrapper
  around navigator.share() that broke iOS's user-gesture requirement. Removed the delay;
  share sheet now triggers synchronously within the completion gesture context.
- New: Start Shift now checks for active/staged trailers before clearing. If any exist,
  a choice modal appears: "Add to New Shift" (preserves current bays, clears logs only)
  or "Remove All & Start Fresh" (existing clear-all behavior).
- Fix: Google Sheets sync upgraded from no-cors (opaque) to CORS-aware fetch. The client
  now reads the Apps Script response body and only dequeues items confirmed as ok:true.
  Previously, Apps Script failures silently dequeued items, leaving completions stuck
  as active in the sheet.
```

- [ ] **Step 4: Update `CHANGELOG.md`**

Add at the top of `CHANGELOG.md`:

```markdown
### [6.48] - 2026-04-28

- **Fix:** Share sheet (iOS) — removed `setTimeout` wrapper from `navigator.share()` call inside `finalizeCompletion`. iOS requires the Web Share API to be invoked synchronously within a user gesture; the 100 ms delay was silently blocking it with `NotAllowedError`.
- **New:** Start Shift — if trailers are currently onboard when "Start Shift" is pressed, a modal now asks whether to carry them into the new shift or clear them. Choosing "Add to New Shift" preserves all active/staged bays and clears only the history log. "Remove All & Start Fresh" matches prior behavior.
- **Fix:** Google Sheets sync reliability — fetch upgraded from `mode:'no-cors'` (opaque response, always dequeued) to a CORS-aware request that reads the Apps Script JSON response. Items are only dequeued when the script confirms `{ok:true}`. Apps Script failures now retry from the local queue instead of silently dropping data. Requires Apps Script re-deploy (see plan for `doPost` changes).
```

- [ ] **Step 5: Verify the app loads cleanly**

Open `index.html` in a browser. Confirm:
- Nameplate shows `v6.48`
- No console errors
- Dashboard renders, all tabs work
- Shift start button works in both the empty-bays and active-bays paths

---

## Self-Review

**Spec coverage check:**
- Share sheet trigger on completion ✓ (Task 1)
- Share sheet fires immediately on bay completion ✓ (synchronous call, no delay)
- Start Shift checks for onboarded trailers ✓ (Task 2)
- Modal offers "add to new shift" or "remove" ✓ (Task 2 modal + `confirmStartShift`)
- Sync debug (root cause explanation) ✓ (Root Cause Analysis section)
- More robust sync architecture ✓ (Task 3: CORS-aware fetch + Apps Script response)

**Placeholder scan:** None found — all code blocks are complete and runnable.

**Type/name consistency:**
- `confirmStartShift(keepBays)` — called by modal `onclick` with `true`/`false` literals. ✓
- `start-shift-bays-modal` — HTML id matches `byId('start-shift-bays-modal')` in JS. ✓
- `start-shift-bay-count` — HTML id matches `byId('start-shift-bay-count').textContent` in JS. ✓
- `data.ok` — matches Apps Script `{ok: true}` response shape. ✓
