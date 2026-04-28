// ============================================================
// WALLY DASHBOARD — APPS SCRIPT v6.18
// ============================================================
// CHANGES IN THIS VERSION (v6.18):
//
// [FIX] doPost now returns {ok:true} on success and {ok:false,error:"..."} on
//   failure instead of {status:"success"}/{status:"error"}. This makes the
//   response format compatible with the v6.48 client-side CORS-aware fetch,
//   which reads the response body and only dequeues queue items when ok===true.
//   Three return statements changed — no processing logic touched.
//
// INHERITED FROM v6.17:
//
// [FIX] Stage Time section no longer shows completed doors as if they're currently staged.
//   Root cause: dwell time from completed rows was labeled "Xm staged" which looked
//   identical to a live stuck door. Relabeled to "Xm dwell (completed)" so it's clear
//   the entry is historical -- the door completed fine, it just waited 61m for labor.
//
// [FIX] Stale staged row guard added. If the sheet contains a staged row for a door
//   that already has a completed row (can happen when the logId upsert misses due to
//   timing), the staged row is now ignored. previousl the loop would process the staged
//   row last and overwrite the completed state, making the door appear stuck in Stage Time.
//   completedDoors{} set tracks which doors have completed this shift.
//
// INHERITED FROM v6.16:
//
// [FIX] Live View Currently Active now shows labor start time for doors that
//   transitioned from staged to active. Previously it always showed arrival time.
//   Logic: if rLaborStart (col 17) is set and differs from rStart (col 6),
//   the door was staged first and displayStart = laborStart.
//   Doors onboarded directly as active (laborStart == arrivalStart) are unchanged.
//
// INHERITED FROM v6.15:
//
// [FIX] Stage Time section in Live View now shows doors that were JUST staged (0m).
//   Previously the guard (liveStageMins2 > 0) excluded any door staged within the
//   last minute. Changed to >= 0 so all staged doors appear immediately.
//   0-minute entries show "Just staged (awaiting labor)" as the duration label.
//
// [FIX] Share sheet fix (app v6.26): Wally + CPU checkbox now sends a single
//   share with both lines ("Door X done\nDoor X CPU") instead of two sequential
//   shares. This is an app-side fix but documented here for version sync.
//
// INHERITED FROM v6.14:
//
// [FIX] Dual tottle system replaces single 30s throttle.
//   SHIFT_END / NEW_SHIFT / PPH_UPLOAD: always immediate (user-initiated actions).
//   TRAILER completion (stage=end): 15s throttle. Stats, leaderboard, timeline update.
//   TRAILER arrival/update (stage=start/update): 10s throttle. Currently Active only.
//   Two separate PropertiesService keys so arrival updates never block completion
//   refreshes. Door 14 staged will now appear in Live View within 10s max.
//
// [FIX] trailerStage variable reads payload.stage in the TRAILER branch so the
//   script can distinguish completions from arrivals for the first time.
//
// INHERITED FROM v6.13:
//
// [NEW] Idle and Stage time are now tracked and displayed separately in Live View.
//   IDLE  = time from previous completion to new trailer arrival (bay sitting empty)
//   STAGE = time from trailer arrival to labor start (trailer waiting for unloader)
//   Both now have dedicated sections in Live View (col 10-12, stacked vertically).
//   Both pull from stored sheet values (DwellMins col 18, Idle Time col 19) so
//   calculations are exact and match what the app measured at completion time.
//   Live idle (empty bays right now) and live stage (staged doors right now)
//   are also surfaced in real time with "(Live)" labels.
//
// [FIX] Share sheet text corrected: "CPU Door X" -> "Door X CPU" throughout.
//   This is an app-side fix (v6.24) but documented here for version sync.
//
// INHERITED FIXES FROM v6.12 (preserved):

// FIXES IN THIS VERSION:
//
// [CRITICAL] Fix: NEW_SHIFT anchor row caused logicalDate rollback.
//   When the anchor row is a NEW_SHIFT separator (fired before shift
//   officially starts), getLogicalShiftDate() was rolling its date back
//   one day. All completions then failed isCurrentShift and Live View
//   showed nothing. Fix: NEW_SHIFT anchor rows use dateKey directly.
//
// [CRITICAL] Fix: liveSheet.clearContents() left stale row backgrounds.
//   Replaced with liveSheet.clear() so both values and formatting are
//   wiped on every refresh. Phantom colored rows no longer persist.
//
// [SIGNIFICANT] Fix: SHIFT_END now always bypasses the 30s throttle.
//   End Shift fired within 30s of the last completion was silently
//   swallowed by the throttle. Final shift state now always writes.
//
// [SIGNIFICANT] Fix: NEW_SHIFT separator row End Time set to "".
//   Storing the server clock time in End Time fed a bad value into
//   getLogicalShiftDate() which caused the date rollback above.
//
// [MINOR] Fix: PPH sheet header guard used insertRowBefore on empty
//   sheet. Separated into two conditions matching the TRAILER fix.
//
// [MINOR] Fix: Door idle summary loop now starts at door 9, not 8.
//   Door 8 does not exist in the PS9 config (doors 9-16 only).
//
// INHERITED FIXES FROM v6.11 (already present, preserved):
//   - Robust header guard in TRAILER branch (no spurious insertRowBefore)
//   - logId scan starts at row 2, not row 1 (skips header)
//   - 30s throttle on updateDashboards to prevent concurrent calls
//   - NEW_SHIFT writes a visible separator row to Wally Tracker
//   - NOTE and SHIFT_END handlers
// ============================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    // CHANGED v6.18: return {ok:false} instead of {status:"error"} for client compat
    return ContentService.createTextOutput(JSON.stringify({"ok": false, "error": "Server busy. Try again."}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss;
  var route = "TRAILER";

  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);
    if (payload.dataType) route = payload.dataType;

    // ==========================================
    // PPH UPLOADS
    // ==========================================
    if (route === "PPH_UPLOAD") {
      var pphSheet = ss.getSheetByName("PPH Submissions");
      if (!pphSheet) {
        pphSheet = ss.insertSheet("PPH Submissions");
        pphSheet.appendRow(["Date", "Volume", "Hours", "PPH", "+/-"]);
        pphSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#e2d5f8");
      } else {
        // FIX: Separate empty vs corrupt-header cases
        if (pphSheet.getLastRow() === 0) {
          pphSheet.appendRow(["Date", "Volume", "Hours", "PPH", "+/-"]);
          pphSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#e2d5f8");
        } else if (pphSheet.getRange("A1").getValue() !== "Date") {
          pphSheet.insertRowBefore(1);
          pphSheet.getRange("A1:E1").setValues([["Date", "Volume", "Hours", "PPH", "+/-"]])
            .setFontWeight("bold").setBackground("#e2d5f8");
        }
      }
      var timeOnly = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm");
      var logicalDate = getLogicalShiftDate(payload.dateKey, timeOnly, payload.shiftStart);
      var diffStr = parseFloat(payload.diffHours) > 0 ? "+" + payload.diffHours : payload.diffHours;
      pphSheet.appendRow([logicalDate, payload.volume, payload.hours, payload.pph, diffStr]);
    }

    // ==========================================
    // NEW SHIFT — writes a visual separator row
    // ==========================================
    else if (route === "NEW_SHIFT") {
      var sheet = ss.getSheetByName("Wally Tracker");
      if (!sheet) sheet = ss.insertSheet("Wally Tracker");

      var headers = ["Date","Door","Type","ID","Account","Unloader","Start Time","End Time",
                     "Duration (Mins)","Completion Hour","CPU Options","Duplicate","Manual",
                     "Status","Move Dest","Shift Start","Log ID","Labor Start","DwellMins",
                     "Idle Time","Unload Duration"];
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
        sheet.getRange("A1:U1").setFontWeight("bold").setBackground("#d9ead3");
      } else if (sheet.getRange("A1").getValue() !== "Date") {
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange("A1:U1").setFontWeight("bold").setBackground("#d9ead3");
      }

      var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm");
      // FIX: End Time stored as "" so getLogicalShiftDate never mis-rolls the anchor date.
      // Start Time is stored for reference only; it is not used in anchor calculations.
      var rowData = [
        payload.dateKey || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
        "—", "NEW SHIFT", "—", "—", "—",
        ts, "", "", "", "",
        "No", "No", "new_shift", "", payload.shiftStart || "20:00",
        "SYS-" + new Date().getTime(),
        "", "", "", ""
      ];

      sheet.appendRow(rowData);
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 1, 1, 21)
        .setBackground("#434343")
        .setFontColor("#ffffff")
        .setFontWeight("bold")
        .setHorizontalAlignment("center");
    }

    // ==========================================
    // NOTE SAVES / DELETES
    // ==========================================
    else if (route === "NOTE") {
      var noteSheet = ss.getSheetByName("Notes");
      if (!noteSheet) {
        noteSheet = ss.insertSheet("Notes");
        noteSheet.appendRow(["Timestamp", "WallyID", "Action", "Tags", "Text", "Date"]);
        noteSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#fce5cd");
      }
      var noteTime = Utilities.formatDate(
        new Date(payload.timestamp || Date.now()),
        Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"
      );
      noteSheet.appendRow([
        noteTime,
        payload.wallyId,
        payload.action || "upsert",
        Array.isArray(payload.tags) ? payload.tags.join(", ") : "",
        payload.text || "",
        payload.dateKey || ""
      ]);
    }

    // ==========================================
    // SHIFT END SUMMARY
    // ==========================================
    else if (route === "SHIFT_END") {
      var shiftLogSheet = ss.getSheetByName("Shift Log");
      if (!shiftLogSheet) {
        shiftLogSheet = ss.insertSheet("Shift Log");
        shiftLogSheet.appendRow([
          "Date", "Shift Start", "End Time",
          "Wallies", "CPUs", "Incomplete",
          "Bays Closed Now", "Keep Bays Open", "Is Demo"
        ]);
        shiftLogSheet.getRange("A1:I1").setFontWeight("bold").setBackground("#d9ead3");
      }
      var endTimeStr = payload.endTime
        ? Utilities.formatDate(new Date(payload.endTime), Session.getScriptTimeZone(), "HH:mm")
        : "";
      shiftLogSheet.appendRow([
        payload.shiftDate || "",
        payload.shiftStart || "",
        endTimeStr,
        payload.totalWallies  || 0,
        payload.totalCPUs     || 0,
        payload.totalIncomplete || 0,
        payload.baysClosedNow || 0,
        payload.keepBays ? "Yes" : "No",
        payload.isDemo   ? "Yes" : "No"
      ]);
    }

    // ==========================================
    // NORMAL TRAILER UPLOADS
    // ==========================================
    else {
      // Read the stage field to distinguish arrivals/updates from completions
      // stage='start'|'update' = arrival or edit (affects Currently Active only)
      // stage='end'            = completion (affects all stats, leaderboards, timeline)
      var trailerStage = payload.stage || "end";
      var sheet = ss.getSheetByName("Wally Tracker");
      if (!sheet) sheet = ss.insertSheet("Wally Tracker");

      var headers = ["Date","Door","Type","ID","Account","Unloader","Start Time","End Time",
                     "Duration (Mins)","Completion Hour","CPU Options","Duplicate","Manual",
                     "Status","Move Dest","Shift Start","Log ID","Labor Start","DwellMins",
                     "Idle Time","Unload Duration"];
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
        sheet.getRange("A1:U1").setFontWeight("bold").setBackground("#d9ead3");
      } else if (sheet.getRange("A1").getValue() !== "Date") {
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange("A1:U1").setFontWeight("bold").setBackground("#d9ead3");
      }

      var logId = payload.logId;
      var rowData = new Array(21).fill("");
      rowData[0]  = payload.dateKey || "";
      rowData[1]  = payload.door || "";
      rowData[2]  = payload.type || "";
      rowData[3]  = payload.id || "";
      rowData[4]  = payload.account || "";
      rowData[5]  = payload.unloader || "";
      rowData[6]  = payload.start
                    ? Utilities.formatDate(new Date(payload.start), Session.getScriptTimeZone(), "HH:mm") : "";
      rowData[7]  = payload.end
                    ? Utilities.formatDate(new Date(payload.end),   Session.getScriptTimeZone(), "HH:mm") : "";
      rowData[8]  = (payload.durationMinutes !== null && payload.durationMinutes !== undefined)
                    ? payload.durationMinutes : "";
      rowData[9]  = payload.completionHour || "";
      rowData[10] = (payload.cpuOptions && payload.cpuOptions.length > 0)
                    ? payload.cpuOptions.join(", ") : "";
      rowData[11] = payload.duplicate ? "Yes" : "No";
      rowData[12] = payload.manual    ? "Yes" : "No";
      rowData[13] = payload.status || "";
      rowData[14] = payload.moveDest || "";
      rowData[15] = payload.shiftStart || "";
      rowData[16] = logId;
      rowData[17] = payload.laborStart
                    ? Utilities.formatDate(new Date(payload.laborStart), Session.getScriptTimeZone(), "HH:mm") : "";
      rowData[18] = (payload.dwellMinutes        !== undefined && payload.dwellMinutes        !== null)
                    ? payload.dwellMinutes : "";
      rowData[19] = (payload.idleBeforeMinutes   !== undefined && payload.idleBeforeMinutes   !== null)
                    ? payload.idleBeforeMinutes : "";
      rowData[20] = (payload.unloadDurationMinutes !== undefined && payload.unloadDurationMinutes !== null)
                    ? payload.unloadDurationMinutes
                    : ((payload.durationMinutes !== null && payload.durationMinutes !== undefined)
                       ? payload.durationMinutes : "");

      // Safe logId scan — skips header row
      var lastRow = sheet.getLastRow();
      var rowIndex = -1;
      if (lastRow >= 2) {
        var logIds = sheet.getRange(2, 17, lastRow - 1, 1).getValues();
        for (var i = logIds.length - 1; i >= 0; i--) {
          if (logIds[i][0] === logId) { rowIndex = i + 2; break; }
        }
      }

      if (rowIndex > -1) {
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
        sheet.getRange(rowIndex, 1, 1, 21)
          .setBackground(null).setFontColor("#000000")
          .setFontWeight("normal").setHorizontalAlignment("left");
      } else {
        sheet.appendRow(rowData);
        var lr = sheet.getLastRow();
        sheet.getRange(lr, 1, 1, 21)
          .setBackground(null).setFontColor("#000000")
          .setFontWeight("normal").setHorizontalAlignment("left");
      }
    }

  } catch (error) {
    try { lock.releaseLock(); } catch(e) {}
    // CHANGED v6.18: return {ok:false} instead of {status:"error"} for client compat
    return ContentService.createTextOutput(
      JSON.stringify({"ok": false, "error": error.message})
    ).setMimeType(ContentService.MimeType.JSON);
  }

  lock.releaseLock();

  // ──────────────────────────────────────────────────────────
  // DASHBOARD REFRESH — Dual throttle system
  //
  // SHIFT_END:   always immediate — final shift state must be captured
  // NEW_SHIFT:   always immediate — resets Live View to new shift context
  // PPH_UPLOAD:  always immediate — PPH data is user-initiated, should show fast
  // TRAILER end: 15s throttle — completions update stats, leaderboard, timeline
  // TRAILER start/update: 10s throttle — only affects Currently Active section
  //
  // Two separate throttle keys so active-door updates don't block completion
  // refreshes and vice versa.
  // ──────────────────────────────────────────────────────────
  if (ss) {
    var props  = PropertiesService.getScriptProperties();
    var nowMs  = new Date().getTime();

    if (route === "SHIFT_END" || route === "NEW_SHIFT" || route === "PPH_UPLOAD") {
      // Always refresh immediately — these are intentional user actions
      props.setProperty("lastDashUpdate", String(nowMs));
      try { updateDashboards(ss); } catch(e) { Logger.log("Dashboard error (" + route + "): " + e.message); }

    } else if (route === "TRAILER") {
      var isCompletion = (trailerStage === "end");

      if (isCompletion) {
        // Completion: 15s throttle — stats/leaderboard change
        var lastCompletion = parseInt(props.getProperty("lastDashUpdate") || "0", 10);
        if (nowMs - lastCompletion > 15000) {
          props.setProperty("lastDashUpdate", String(nowMs));
          try { updateDashboards(ss); } catch(e) { Logger.log("Dashboard error (completion): " + e.message); }
        }
      } else {
        // Arrival/update: 10s throttle — only Currently Active changes
        var lastActive = parseInt(props.getProperty("lastActiveDashUpdate") || "0", 10);
        if (nowMs - lastActive > 10000) {
          props.setProperty("lastActiveDashUpdate", String(nowMs));
          try { updateDashboards(ss); } catch(e) { Logger.log("Dashboard error (active): " + e.message); }
        }
      }
    }
  }

  // CHANGED v6.18: return {ok:true} instead of {status:"success"} for client compat
  return ContentService.createTextOutput(
    JSON.stringify({"ok": true})
  ).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// MANUAL TRIGGER — run from Apps Script editor to force refresh
// ============================================================
function refreshKPIDashboard() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Wally Tracker");
  if (!sheet || sheet.getLastRow() < 2) {
    ss.toast("No data found to build dashboards.", "Nothing to do", 3);
    return;
  }
  updateDashboards(ss);
  ss.toast("Dashboards updated successfully!", "Done", 3);
}

// ============================================================
// DASHBOARD ENGINE
// ============================================================
function updateDashboards(ss) {
  var sourceSheet = ss.getSheetByName("Wally Tracker");
  if (!sourceSheet) return;

  var isNewKpiSheet  = false;
  var kpiSheet  = ss.getSheetByName("KPI Dashboard");
  if (!kpiSheet)  { kpiSheet  = ss.insertSheet("KPI Dashboard");  isNewKpiSheet  = true; }

  var isNewLiveSheet = false;
  var liveSheet = ss.getSheetByName("Live View");
  if (!liveSheet) { liveSheet = ss.insertSheet("Live View"); isNewLiveSheet = true; }

  var pphSheet = ss.getSheetByName("PPH Submissions");

  var data = sourceSheet.getDataRange().getValues();
  if (data.length < 2) return;

  // ── Find anchor row and new-shift cutoff ──────────────────
  var latestCompletedRow    = null;
  var latestCompletedRowIdx = -1;
  var latestNewShiftRow     = null;
  var latestNewShiftRowIdx  = -1;

  for (var lr = data.length - 1; lr >= 1; lr--) {
    var rowStatus = data[lr][13];
    if (latestCompletedRow === null && (rowStatus === "completed" || rowStatus === "incomplete")) {
      latestCompletedRow    = data[lr];
      latestCompletedRowIdx = lr;
    }
    if (latestNewShiftRow === null && rowStatus === "new_shift") {
      latestNewShiftRow    = data[lr];
      latestNewShiftRowIdx = lr;
    }
    if (latestCompletedRow && latestNewShiftRow) break;
  }

  var anchorRow         = latestCompletedRow;
  var newShiftCutoffIdx = -1;

  if (latestNewShiftRow) {
    if (latestCompletedRow === null || latestNewShiftRowIdx > latestCompletedRowIdx) {
      anchorRow         = latestNewShiftRow;
      newShiftCutoffIdx = latestNewShiftRowIdx;
    }
  }

  if (!anchorRow) return;

  // ── Derive latestLogicalShift from anchor ─────────────────
  // FIX: NEW_SHIFT rows store End Time as "" to avoid date rollback.
  // When the anchor IS a NEW_SHIFT row, use the dateKey directly.
  // When the anchor is a real completion, use getLogicalShiftDate normally.
  var rDateStr  = toDateString(anchorRow[0]);
  var rShiftStr = toTimeString(anchorRow[15]);
  var latestLogicalShift;

  if (anchorRow === latestNewShiftRow) {
    // Trust the dateKey as-is — shift hasn't started or just started
    latestLogicalShift = rDateStr;
  } else {
    var rEndStr = toTimeString(anchorRow[7]);
    latestLogicalShift = getLogicalShiftDate(rDateStr, rEndStr, rShiftStr);
  }

  if (!latestLogicalShift) return;

  var latestMonth         = latestLogicalShift.substring(0, 7);
  var latestShiftStartTime = rShiftStr;
  var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm");

  // ── Accumulators ──────────────────────────────────────────
  var shiftStats   = {};
  var monthStats   = {};
  var allTimeStats = {};
  var hourlyStats  = {};
  var shiftTimeline = [];
  var idleLog       = [];
  var activeDoorsMap = {};
  var doorHistory    = {};
  var dowStats       = {};
  var daysOfWeek = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  var totalIdleMins = 0;
  var idleCount     = 0;
  var doorIdleTracker = {};

  // Guard against stale staged rows processed after a completed row for same door.
  // If a door has a completed row, any subsequent staged row for it is orphaned and ignored.
  var completedDoors = {};

  // Separate stage (dwell) tracking — time from trailer arrival to labor start
  var stageLog = [];
  var totalStageMins = 0;
  var stageCount = 0;
  var doorStageTracker = {};

  // ── Main data loop ────────────────────────────────────────
  for (var i = 1; i < data.length; i++) {
    if (newShiftCutoffIdx > -1 && i < newShiftCutoffIdx) continue;

    var row        = data[i];
    var rDate      = toDateString(row[0]);
    var rDoor      = row[1];
    var rType      = row[2];
    var rId        = row[3];
    var rUnloader  = row[5];
    var rStart     = toTimeString(row[6]);
    var rEnd       = toTimeString(row[7]);
    var rDurFall   = row[8];
    var rHour      = row[9];
    var rStatus    = row[13];
    var rShiftStart = toTimeString(row[15]);
    var rLaborStart = toTimeString(row[17]); // Labor Start col — when unloader began
    var rDwellMins  = row[18]; // DwellMins col — time arrival->labor (stage time)
    var rIdleMins   = row[19]; // Idle Time col — time prev completion->this arrival
    var rUnloadDur  = row[20];

    // Skip the separator row itself from stats calculations
    if (rStatus === "new_shift") continue;

    // Use rEnd if available, otherwise rStart, for logical date
    var rEndForLogical = (rEnd !== "") ? rEnd : rStart;
    var logicalDate  = getLogicalShiftDate(rDate, rEndForLogical, rShiftStart);
    var monthDate    = logicalDate ? logicalDate.substring(0, 7) : "";

    var dur = (rUnloadDur !== "" && rUnloadDur !== undefined)
              ? parseFloat(rUnloadDur) : parseFloat(rDurFall);
    dur = dur || 0;

    var isCurrentShift = (logicalDate === latestLogicalShift && rShiftStart === latestShiftStartTime);

    // ── Stats accumulation ───────────────────────────────
    if ((rStatus === "completed" || rStatus === "incomplete") && rUnloader && rUnloader !== "Unassigned") {
      addStat(allTimeStats, rUnloader, rType, dur, rStatus);
      if (monthDate === latestMonth) addStat(monthStats, rUnloader, rType, dur, rStatus);

      if (rStatus === "completed" && rType === "Wally") {
        var parts = logicalDate ? logicalDate.split("-") : [];
        if (parts.length === 3) {
          var dObj = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]), 12, 0, 0);
          var dowName = daysOfWeek[dObj.getDay()];
          if (!dowStats[rUnloader]) {
            dowStats[rUnloader] = {
              "Mon":{w:0,t:0},"Tue":{w:0,t:0},"Wed":{w:0,t:0},
              "Thu":{w:0,t:0},"Fri":{w:0,t:0},"Sat":{w:0,t:0},"Sun":{w:0,t:0}
            };
          }
          dowStats[rUnloader][dowName].w++;
          dowStats[rUnloader][dowName].t += dur;
        }
      }

      if (isCurrentShift) {
        addStat(shiftStats, rUnloader, rType, dur, rStatus);
        if (rStatus === "completed") {
          if (rHour !== "") {
            if (!hourlyStats[rHour]) hourlyStats[rHour] = {total:0, wally:0, cpu:0};
            hourlyStats[rHour].total++;
            if (rType === "Wally") hourlyStats[rHour].wally++;
            if (rType === "CPU")   hourlyStats[rHour].cpu++;
          }
          shiftTimeline.push([
            "🕒 " + rEnd,
            "Door " + rDoor + " • " + rType + " " + rId,
            rUnloader + " (" + dur + "m)"
          ]);
          // Capture stored dwell (stage time) from the sheet for completed rows
          // DwellMins = time between trailer arrival and labor start
          if (rDwellMins !== "" && rDwellMins !== undefined && rDwellMins !== null) {
            var dwellVal = parseFloat(rDwellMins);
            if (!isNaN(dwellVal) && dwellVal > 0) {
              stageLog.push(["Door " + rDoor, rType + " " + rId, dwellVal + "m dwell (completed)"]);
              totalStageMins += dwellVal;
              stageCount++;
              if (!doorStageTracker[rDoor]) doorStageTracker[rDoor] = {m:0, c:0};
              doorStageTracker[rDoor].m += dwellVal;
              doorStageTracker[rDoor].c++;
            }
          }
          // Capture stored idle (from prev completion to this arrival)
          if (rIdleMins !== "" && rIdleMins !== undefined && rIdleMins !== null) {
            var idleVal = parseFloat(rIdleMins);
            if (!isNaN(idleVal) && idleVal >= 0 && idleVal <= 480) {
              idleLog.push(["Door " + rDoor, "Idle: " + idleVal + "m", rStart]);
              totalIdleMins += idleVal;
              idleCount++;
              if (!doorIdleTracker[rDoor]) doorIdleTracker[rDoor] = {m:0, c:0};
              doorIdleTracker[rDoor].m += idleVal;
              doorIdleTracker[rDoor].c++;
            }
          }
        }
      }
    }

    // ── Active doors + live stage tracking ──────────────────
    if (isCurrentShift) {
      // doorHistory used only for live idle estimation on currently-active doors
      if (rStatus === "completed" && rEnd !== "") {
        doorHistory[rDoor] = rEnd;
        completedDoors[rDoor] = true; // guard against stale staged rows later in sheet
      }

      if (rStatus === "active") {
        // For doors that transitioned from staged: show labor start time, not arrival time.
        // If rLaborStart is set and differs from rStart, that's when work actually began.
        var displayStart = (rLaborStart && rLaborStart !== rStart) ? rLaborStart : rStart;
        activeDoorsMap[rDoor] = ["Door " + rDoor, rType + " " + rId, rUnloader, "Started " + displayStart];
      } else if (rStatus === "staged") {
        // Only add to activeDoorsMap if this door has NOT already completed this shift.
        // A stale staged row after a completed row means the upsert missed -- ignore it.
        if (!completedDoors[rDoor]) {
          var stageMins = calcMinutesDiff(rStart, nowStr);
          activeDoorsMap[rDoor] = ["Door " + rDoor, rType + " " + rId, "STAGED", "Staged: " + stageMins + "m"];
        }
      } else {
        delete activeDoorsMap[rDoor];
        completedDoors[rDoor] = true; // also mark on explicit completion status
      }

      if (rStatus === "completed" && rEnd !== "") {
        doorHistory[rDoor] = rEnd;
        completedDoors[rDoor] = true; // guard against stale staged rows later in sheet
      }
    }
  }

  // Live idle for currently-empty doors (estimated from last completion time)
  for (var d in doorHistory) {
    if (doorHistory[d] && !activeDoorsMap[d]) {
      var liveIdle = calcMinutesDiff(doorHistory[d], nowStr);
      if (liveIdle >= 0 && liveIdle <= 480) {
        idleLog.push(["Door " + d, "Empty since " + doorHistory[d], liveIdle + "m (Live)"]);
        if (!doorIdleTracker[d]) doorIdleTracker[d] = {m:0, c:0};
        doorIdleTracker[d].m += liveIdle;
        doorIdleTracker[d].c++;
      }
    }
  }

  // Live stage time for currently-staged doors
  for (var ak in activeDoorsMap) {
    var adRow = activeDoorsMap[ak];
    if (adRow[2] === "STAGED") {
      // adRow[3] contains "Staged: Xm" — extract the live staged minutes
      var liveStageMatch = adRow[3].match(/(\d+)m/);
      if (liveStageMatch) {
        var liveStageMins2 = parseInt(liveStageMatch[1], 10);
        if (liveStageMins2 >= 0) {
          stageLog.push(["Door " + ak, adRow[1], liveStageMins2 === 0 ? "Just staged (awaiting labor)" : liveStageMins2 + "m (Live - awaiting labor)"]);
          totalStageMins += liveStageMins2;
          stageCount++;
          if (!doorStageTracker[ak]) doorStageTracker[ak] = {m:0, c:0};
          doorStageTracker[ak].m += liveStageMins2;
          doorStageTracker[ak].c++;
        }
      }
    }
  }

  // Per-door summary strings — doors 9-16 only
  var doorIdleStrings  = [];
  var doorStageStrings = [];
  for (var dr = 9; dr <= 16; dr++) {
    if (doorIdleTracker[dr] && doorIdleTracker[dr].c > 0) {
      doorIdleStrings.push("D" + dr + ": " + (doorIdleTracker[dr].m / doorIdleTracker[dr].c).toFixed(0) + "m");
    }
    if (doorStageTracker[dr] && doorStageTracker[dr].c > 0) {
      doorStageStrings.push("D" + dr + ": " + (doorStageTracker[dr].m / doorStageTracker[dr].c).toFixed(0) + "m");
    }
  }

  var avgIdle      = idleCount  > 0 ? Math.round(totalIdleMins  / idleCount)  : 0;
  var avgStage     = stageCount > 0 ? Math.round(totalStageMins / stageCount) : 0;
  var idleBannerStr  = doorIdleStrings.length  > 0 ? "Idle  | " + doorIdleStrings.join("  ")  : "No idle data yet.";
  var stageBannerStr = doorStageStrings.length > 0 ? "Stage | " + doorStageStrings.join("  ") : "No stage data yet.";

  // ── Build Live View arrays ────────────────────────────────
  var arrActive = [["🚨 CURRENTLY ACTIVE", "", "", ""], ["Door", "Trailer", "Unloader", "Status"]];
  var activeBGs = [["#f4cccc","#f4cccc","#f4cccc","#f4cccc"], ["#ffffff","#ffffff","#ffffff","#ffffff"]];

  var activeKeys = Object.keys(activeDoorsMap).sort(function(a,b){return parseInt(a)-parseInt(b);});
  for (var a = 0; a < activeKeys.length; a++) {
    var rd    = activeDoorsMap[activeKeys[a]];
    var color = "#ffffff";
    if (rd[1] && rd[1].toString().substring(0,3) === "CPU") {
      var dName = rd[0];
      if      (dName === "Door 9")                                               color = "#d9ead3";
      else if (dName === "Door 10" || dName === "Door 12")                       color = "#d9d2e9";
      else if (dName === "Door 11" || dName === "Door 13" ||
               dName === "Door 14" || dName === "Door 15" || dName === "Door 16") color = "#fce5cd";
    }
    arrActive.push(rd);
    activeBGs.push([color, color, color, color]);
  }
  if (activeKeys.length === 0) {
    arrActive.push(["No doors active.", "", "", ""]);
    activeBGs.push(["#ffffff","#ffffff","#ffffff","#ffffff"]);
  }

  shiftTimeline.reverse();
  var arrTimeline = [["⚡ LIVE TIMELINE", "", ""], ["Time", "Trailer Info", "Unloader (Dur)"]];
  if (shiftTimeline.length === 0) arrTimeline.push(["No completions yet.", "", ""]);
  else arrTimeline = arrTimeline.concat(shiftTimeline);

  idleLog.reverse();
  stageLog.reverse();

  // ── IDLE section: time between completion and next trailer arrival ────
  var arrIdle = [
    ["⏱ IDLE TIME (Completion → Arrival)", "", "Avg: " + avgIdle + "m"],
    [idleBannerStr, "", ""],
    ["Door", "Idle Duration", "Arrival Time"]
  ];
  if (idleLog.length === 0) arrIdle.push(["No idle data yet.", "", ""]);
  else arrIdle = arrIdle.concat(idleLog);

  // ── STAGE section: time between arrival and labor start ──────────────
  var arrStage = [
    ["🔶 STAGE TIME (Arrival → Labor Start)", "", "Avg: " + avgStage + "m"],
    [stageBannerStr, "", ""],
    ["Door", "Trailer", "Stage Duration"]
  ];
  if (stageLog.length === 0) arrStage.push(["No stage data yet.", "", ""]);
  else arrStage = arrStage.concat(stageLog);

  var arrShift = buildLeaderboardArray("🟢 LIVE SHIFT (" + latestLogicalShift + ")", shiftStats);

  var arrHourly = [["⏰ SHIFT FLOW", "", "", "", ""], ["Hour", "Total", "Trend", "Wally", "CPU"]];
  var trendFontColors = [["#000000"], ["#000000"]];
  var sortedHours = Object.keys(hourlyStats).sort(function(a,b){return parseInt(a)-parseInt(b);});
  var sumTotal = 0, sumWally = 0, sumCPU = 0, prevTotal = null;

  for (var k = 0; k < sortedHours.length; k++) {
    var hs    = hourlyStats[sortedHours[k]];
    var trend = "—";
    var tColor = "#000000";
    if (prevTotal !== null && prevTotal > 0) {
      var pct = Math.round(((hs.total - prevTotal) / prevTotal) * 100);
      trend  = (pct > 0 ? "+" : "") + pct + "%";
      tColor = pct > 0 ? "#2e7d32" : (pct < 0 ? "#c62828" : "#000000");
    } else if (prevTotal !== null && prevTotal === 0 && hs.total > 0) {
      trend = "+100%"; tColor = "#2e7d32";
    }
    arrHourly.push(["Hour " + sortedHours[k], hs.total, trend, hs.wally, hs.cpu]);
    trendFontColors.push([tColor]);
    sumTotal += hs.total; sumWally += hs.wally; sumCPU += hs.cpu;
    prevTotal = hs.total;
  }
  if (sortedHours.length === 0) {
    arrHourly.push(["No data", "", "", "", ""]);
    trendFontColors.push(["#000000"]);
  } else {
    arrHourly.push(["TOTAL", sumTotal, "—", sumWally, sumCPU]);
    trendFontColors.push(["#000000"]);
  }

  // ── Write Live View ───────────────────────────────────────
  // FIX: liveSheet.clear() wipes both values AND formatting so stale
  // colored rows from a longer previous active list don't ghost through.
  liveSheet.clearConditionalFormatRules();
  liveSheet.clear();

  liveSheet.getRange(1, 1,  arrActive.length,   4).setValues(arrActive).setBackgrounds(activeBGs);
  liveSheet.getRange(1, 6,  arrTimeline.length,  3).setValues(arrTimeline);
  liveSheet.getRange(1, 10, arrIdle.length,  3).setValues(arrIdle);
  var stageRowStart = arrIdle.length + 2; // 1 blank row gap
  liveSheet.getRange(stageRowStart, 10, arrStage.length, 3).setValues(arrStage);
  liveSheet.getRange(1, 14, arrShift.length,     6).setValues(arrShift);
  liveSheet.getRange(1, 21, arrHourly.length,    5).setValues(arrHourly);

  liveSheet.getRange(1, 23, trendFontColors.length, 1).setFontColors(trendFontColors).setFontWeight("bold");

  // Section header formatting
  liveSheet.getRange(1, 1,  1, 4).setBackground("#f4cccc").setFontColor("#000000").setFontWeight("bold");
  liveSheet.getRange(1, 6,  1, 3).setBackground("#fff2cc").setFontColor("#000000").setFontWeight("bold");
  liveSheet.getRange(1, 10, 1, 3).setBackground("#fce5cd").setFontColor("#000000").setFontWeight("bold");
  // Stage section header — orange/amber to distinguish from idle
  liveSheet.getRange(stageRowStart, 10, 1, 3).setBackground("#ffe0b2").setFontColor("#000000").setFontWeight("bold");
  liveSheet.getRange(stageRowStart + 1, 10, 1, 3).setFontSize(9).setFontColor("#555555").setFontWeight("normal");
  liveSheet.getRange(stageRowStart + 2, 10, 1, 3).setFontWeight("bold");
  liveSheet.getRange(1, 14, 1, 6).setBackground("#d9ead3").setFontColor("#000000").setFontWeight("bold");
  liveSheet.getRange(1, 21, 1, 5).setBackground("#cfe2f3").setFontColor("#000000").setFontWeight("bold");

  // Column sub-headers bold
  liveSheet.getRange(2, 1,  1, 25).setFontWeight("bold");
  // Idle banner rows — smaller, muted
  liveSheet.getRange(2, 10, 1, 3).setBackground("#fdf5eb").setFontSize(9).setFontColor("#555555").setFontWeight("normal");
  liveSheet.getRange(3, 10, 1, 3).setFontWeight("bold"); // Idle column headers

  if (sortedHours.length > 0) {
    liveSheet.getRange(arrHourly.length, 21, 1, 5).setFontWeight("bold");
  }

  // Conditional format: avg time heatmap on Live Shift leaderboard (cols 18-19)
  var liveRules = [];
  if (arrShift.length > 2) {
    var avgWallyRange = liveSheet.getRange(3, 18, arrShift.length - 2, 1);
    var avgCpuRange   = liveSheet.getRange(3, 19, arrShift.length - 2, 1);
    var heatmapRule = SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue("#b7e1cd", SpreadsheetApp.InterpolationType.MIN, "")
      .setGradientMidpointWithValue("#ffffff",  SpreadsheetApp.InterpolationType.PERCENTILE, "50")
      .setGradientMaxpointWithValue("#f4cccc", SpreadsheetApp.InterpolationType.MAX, "")
      .setRanges([avgWallyRange, avgCpuRange])
      .build();
    liveRules.push(heatmapRule);
  }
  if (liveRules.length > 0) liveSheet.setConditionalFormatRules(liveRules);
  if (isNewLiveSheet) liveSheet.autoResizeColumns(1, 25);

  // ── PPH Trends ────────────────────────────────────────────
  var arrPphTrends = [["📈 HISTORICAL PPH AVERAGES", "", "", ""], ["Day of Week", "Avg Volume", "Avg Hours", "Avg PPH"]];
  if (pphSheet) {
    var pphData = pphSheet.getDataRange().getValues();
    var pphDict = {};
    for (var p = 1; p < pphData.length; p++) {
      var rawDate = pphData[p][0];
      var pVol = parseFloat(String(pphData[p][1]).replace(/[^\d.-]/g, ""));
      var pHrs = parseFloat(String(pphData[p][2]).replace(/[^\d.-]/g, ""));
      if (rawDate && !isNaN(pVol) && !isNaN(pHrs)) {
        var dObj = new Date(rawDate);
        if (!isNaN(dObj.getTime())) {
          var dk = Utilities.formatDate(dObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
          pphDict[dk] = {v:pVol, h:pHrs, dateObj:dObj};
        }
      }
    }
    var dowPPH = {"Mon":{v:0,h:0,c:0},"Tue":{v:0,h:0,c:0},"Wed":{v:0,h:0,c:0},
                  "Thu":{v:0,h:0,c:0},"Fri":{v:0,h:0,c:0},"Sat":{v:0,h:0,c:0},"Sun":{v:0,h:0,c:0}};
    var totalV=0, totalH=0, totalC=0;
    for (var dk2 in pphDict) {
      var pd = pphDict[dk2];
      var dow2 = daysOfWeek[pd.dateObj.getDay()];
      dowPPH[dow2].v += pd.v; dowPPH[dow2].h += pd.h; dowPPH[dow2].c++;
      totalV += pd.v; totalH += pd.h; totalC++;
    }
    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(function(day){
      if (dowPPH[day].c > 0) {
        var aV = Math.round(dowPPH[day].v / dowPPH[day].c);
        var aH = (dowPPH[day].h / dowPPH[day].c).toFixed(2);
        arrPphTrends.push([day, aV, aH, Math.round(aV / aH)]);
      } else {
        arrPphTrends.push([day, "-", "-", "-"]);
      }
    });
    if (totalC > 0) {
      var oV = Math.round(totalV / totalC);
      var oH = (totalH / totalC).toFixed(2);
      arrPphTrends.push(["OVERALL", oV, oH, Math.round(oV / oH)]);
    } else {
      arrPphTrends.push(["OVERALL", "-", "-", "-"]);
    }
    pphSheet.getRange(1, 9, Math.max(15, arrPphTrends.length), 4).clear();
    pphSheet.getRange(1, 9, arrPphTrends.length, 4).setValues(arrPphTrends);
    pphSheet.getRange(1, 9, 2, 4).setFontWeight("bold");
    pphSheet.getRange(1, 9, 1, 4).setBackground("#d9ead3");
    if (arrPphTrends.length > 2) pphSheet.getRange(arrPphTrends.length, 9, 1, 4).setFontWeight("bold");
  }

  // ── KPI Dashboard ─────────────────────────────────────────
  var arrMonth = buildLeaderboardArray("📅 THIS MONTH (" + latestMonth + ")", monthStats);
  var arrAll   = buildLeaderboardArray("🏆 ALL TIME", allTimeStats);

  var arrDow = [
    ["📊 UNLOADER WEEKLY TRENDS (Avg Wally Mins)", "", "", "", "", "", "", ""],
    ["Unloader", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  ];
  var dowList = [];
  for (var n in dowStats) {
    var r2 = [n];
    var hasData = false;
    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(function(day){
      if (dowStats[n][day].w > 0) {
        r2.push(Math.round(dowStats[n][day].t / dowStats[n][day].w));
        hasData = true;
      } else {
        r2.push("-");
      }
    });
    if (hasData) dowList.push(r2);
  }
  dowList.sort(function(a,b){ return a[0].localeCompare(b[0]); });
  if (dowList.length === 0) dowList.push(["No data.", "-", "-", "-", "-", "-", "-", "-"]);
  arrDow = arrDow.concat(dowList);

  kpiSheet.clearConditionalFormatRules();
  kpiSheet.clearContents();

  kpiSheet.getRange(1, 1,  arrMonth.length, 6).setValues(arrMonth);
  kpiSheet.getRange(1, 8,  arrAll.length,   6).setValues(arrAll);
  kpiSheet.getRange(1, 15, arrDow.length,   8).setValues(arrDow);

  kpiSheet.getRange(1, 1, 2, 22).setFontWeight("bold");
  kpiSheet.getRange(1, 1,  1, 6).setBackground("#cfe2f3");
  kpiSheet.getRange(1, 8,  1, 6).setBackground("#fff2cc");
  kpiSheet.getRange(1, 15, 1, 8).setBackground("#e2d5f8");

  if (arrDow.length > 2) {
    var dowRule = SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue("#b7e1cd", SpreadsheetApp.InterpolationType.MIN, "")
      .setGradientMidpointWithValue("#ffffff",  SpreadsheetApp.InterpolationType.PERCENTILE, "50")
      .setGradientMaxpointWithValue("#f4cccc", SpreadsheetApp.InterpolationType.MAX, "")
      .setRanges([kpiSheet.getRange(3, 16, arrDow.length - 2, 7)])
      .build();
    kpiSheet.setConditionalFormatRules([dowRule]);
  }
  if (isNewKpiSheet) kpiSheet.autoResizeColumns(1, 22);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function toDateString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var y = val.getFullYear();
    var m = ("0" + (val.getMonth() + 1)).slice(-2);
    var d = ("0" + val.getDate()).slice(-2);
    return y + "-" + m + "-" + d;
  }
  return String(val).split("T")[0];
}

function toTimeString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return ("0" + val.getHours()).slice(-2) + ":" + ("0" + val.getMinutes()).slice(-2);
  }
  var match = String(val).match(/\d{1,2}:\d{2}/);
  return match ? match[0] : String(val);
}

function getLogicalShiftDate(dateStr, endStr, shiftStartStr) {
  if (!dateStr || !endStr || !shiftStartStr) return dateStr;
  var endParts   = endStr.toString().split(":");
  var shiftParts = shiftStartStr.toString().split(":");
  var endMins    = parseInt(endParts[0],   10) * 60 + parseInt(endParts[1],   10);
  var shiftMins  = parseInt(shiftParts[0], 10) * 60 + parseInt(shiftParts[1], 10);
  if (endMins < shiftMins) {
    var parts = dateStr.split("-");
    if (parts.length === 3) {
      var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]), 12, 0, 0);
      d.setDate(d.getDate() - 1);
      return d.getFullYear() + "-" +
             ("0" + (d.getMonth()+1)).slice(-2) + "-" +
             ("0" + d.getDate()).slice(-2);
    }
  }
  return dateStr;
}

function calcMinutesDiff(time1, time2) {
  var p1 = time1.split(":");
  var p2 = time2.split(":");
  var m1 = parseInt(p1[0], 10) * 60 + parseInt(p1[1], 10);
  var m2 = parseInt(p2[0], 10) * 60 + parseInt(p2[1], 10);
  if (m2 < m1) m2 += 1440;
  return m2 - m1;
}

function addStat(obj, name, type, dur, status) {
  if (!obj[name]) obj[name] = {total:0, wally:0, cpu:0, wallyTime:0, cpuTime:0};
  if (status === "completed") {
    obj[name].total++;
    if (type === "Wally") { obj[name].wally++;  obj[name].wallyTime += dur; }
    if (type === "CPU")   { obj[name].cpu++;    obj[name].cpuTime   += dur; }
  }
}

function buildLeaderboardArray(title, obj) {
  var arr  = [[title, "", "", "", "", ""], ["Unloader", "Total", "Wallies", "CPUs", "Avg Wally (m)", "Avg CPU (m)"]];
  var list = [];
  for (var n in obj) {
    list.push([
      n,
      obj[n].total,
      obj[n].wally,
      obj[n].cpu,
      obj[n].wally > 0 ? Math.round(obj[n].wallyTime / obj[n].wally) : "-",
      obj[n].cpu   > 0 ? Math.round(obj[n].cpuTime   / obj[n].cpu)   : "-"
    ]);
  }
  list.sort(function(a,b){ return b[1] - a[1]; });
  if (list.length === 0) list.push(["No data yet.", "", "", "", "", ""]);
  return arr.concat(list);
}
// --- END OF SCRIPT v6.18 ---
