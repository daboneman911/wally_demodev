// Wally Dashboard -- In-app changelog text shown from Settings.
// Loaded as a classic script from index.html; all files share one global scope.

    const CHANGELOG=`
v7.31:
- Behind the scenes: the app is now split into separate files instead of
  one large one. Nothing you see or use has changed, and it still works
  offline. Open it once with a signal to pick up the update.

v7.30:
- New: on the DOP tab, tap a name to put someone on the board; tap again to
  take them off (it asks first if they have hours). Cut, moved and locked
  people don't change on a tap -- the row shakes and says to use the
  options.
- New: a ... button on every DOP row with that person's options: role,
  start time (or back to the shift start), cut / put back on the clock,
  move to another line, return to PS9, lock / unlock, remove from shift,
  and delete for people added tonight. The role picker moved here.
- New: move someone to another line (PS1-PS12). Their PS9 clock stops and
  keeps their hours, and they don't count toward the DOP until they come
  back. Time away isn't counted.
- New: someone given a later start time shows "Starts 21:30". They count
  toward the DOP straight away and earn hours from their start time.

v7.29:
- Change: the roster is the final list. PS9 Twilight: Robert, Matt, Lorena,
  Russell, Tre, David, Eddie, Luis, Elliot. Doubles: Solis, Damian, Johnny,
  Jeremiah.
- Last initials are dropped (Trevon C is now Tre). Each person keeps their
  DOP hours, roles, observation history and tonight's trailers and logs.
- Arce J and Evan are off the roster. Jeremiah is added as a Double.
- Doubles stay on the roster every shift but are not PS9 staff: no PS9 tag
  and not in the observation rotation. A full observation cycle is now 9
  shift days.
- Rows already in the Google Sheet keep the old names.

v7.28:
- New: the DOP tab offers every plan from 5/2 to 9/2 (it had only 6/2 and
  5/2). The DOP bar, staffing count and observation check follow whichever
  plan is picked.

v7.27:
- Change: shifts always end automatically at 3:00 AM. The per-day end
  times are gone; the schedule shows start times only again.

v7.26:
- New: Auto Start & End Shift (Settings > Shift, on by default). The shift
  starts by itself at tonight's start time, keeping any bays already
  onboarded, and ends by itself at the end time, closing any bays still
  open as incomplete. If the app was closed, it catches up the next time
  you open it. Ending a shift early by hand does not restart it that night.
- New: each day in the weekly schedule has an end time next to its start
  time. All days default to 03:00 -- set yours.

v7.25:
- Change: idle timers on empty doors are bigger and easier to read. Idle
  runs from a door's completion until it is onboarded again, on every door
  9-16.
- New: while the shift is running, a door idle for more than 10 minutes
  turns its timer red and gets a pulsing red ring.
- New: average idle time in minutes next to "Open Bays" on the Dashboard.
  It turns red when the average is over 10 minutes.
- Change: idle and dwell times on the Logs tab show plain minutes (75m
  instead of 1h 15m).

v7.24:
- New: Dwell Time section on the Logs tab, under Idle Time. Dwell is how
  long a trailer sat staged before an unloader started on it. It shows how
  many trailers waited, the average and longest wait (and which door), then
  each door, worst first.
- Fix: assigning an unloader to a staged bay through Edit recorded 0 dwell,
  because labor was taken to start at arrival. Labor now starts when the
  unloader is assigned, unless you type a Labor Start time yourself.
- Fix: saving Edit on a bay that stays staged no longer sets a labor start.
- Fix: a 0 dwell is sent to the sheet as 0 instead of blank.
- Fix: editing a bay no longer loses the unavailable time left out of idle.

v7.23:
- New: Idle Time section on the Logs tab, under Hourly Breakdown. It shows
  tonight's total idle, average gap and longest gap (and which door), then
  each door's gaps, average, longest and total, worst door first. Unavailable
  time is not counted, and it resets at Start Shift.

v7.22:
- Change: idle time leaves out any time a door was marked unavailable.
  Done at 22:00, unavailable 22:10-22:30, onboarded 22:40 = 20 min idle.
- Change: idle time restarts at Start Shift, so nothing from the previous
  shift is ever counted, even for bays kept open.

v7.21:
- Fix: idle time between trailers on a door is recorded again. A door that
  finished at 22:00 and was onboarded at 22:30 now logs "Idle: 30m" on the
  next completion and fills the Idle Time column in the sheet. It was
  always blank for real trailers. The first trailer on each door per shift
  has no idle time.

v7.20:
- Fix: renaming someone from the regular crew (e.g. Robert W) kept the
  new name only until End Shift, when it was removed as a temporary hire.
  A rename now keeps their PS9 and permanent status.
- Fix: capitalization edits stick. McDonald and O'Brien are kept as typed
  instead of being changed back to Mcdonald / O'brien.
- Fix: a renamed person keeps their observation history.
- Fix: editing a past log whose unloader is not on the team list no longer
  blanks the name.
- Change: "Matt r" and "Matt R" count as the same name, so a duplicate is
  refused whatever the capitals.

v7.19:
- Fix: Start Shift now uses tonight's scheduled start time even if the app
  was left open since the previous shift. It could start Friday at 20:00
  instead of 19:30 (or Monday at 19:30) until the app was reloaded.
- Fix: the Shift Log sheet dates a shift by the evening it started. A shift
  ended after midnight was filed under the next day.
- Fix: sharing the wally total at End Shift sent one more than the actual
  count.

v7.18:
- Change: Wednesday and Thursday now start at 20:00, the same as Monday
  and Tuesday. Friday stays at 19:30. If you had set a different time for
  either day yourself, it is left as you set it.

v7.17:
- Change: Pablo, Gilbert and Fonseca J are off the roster. They no longer
  appear in Team Management, the unloader list or the observation
  rotation, which is now ten shift days rather than thirteen.

v7.16:
- New: You can now set who is PS9 Twilight and who is permanent, from the
  app. Team Management rows have a sliders button that opens a sheet with
  two switches, and the sheet spells out what each one means.
- PS9 Twilight gives the PS9 chip and puts someone in the observation
  rotation. Permanent means they stay on the roster when the shift ends.
  Turning PS9 Twilight on makes someone permanent automatically, and
  turning Permanent off takes PS9 Twilight off with it.
- Adding a new person no longer needs an app update. Add them in Team
  Management, flip the switches, done.
- Nothing changed for the current crew -- everyone keeps the role they had.

v7.15:
- New: Elliot is on the roster as PS9 Twilight -- PS9 chip, permanent, and
  in the observation rotation. A full cycle is now thirteen shift days
  rather than twelve.

v7.14:
- New: Pablo is on the roster as PS9 Twilight, so he carries the PS9 chip,
  is permanent, and joins the observation rotation. A full cycle is now
  twelve shift days rather than eleven.
- Change: The blue vest designation is gone. Luis and Gilbert keep their
  PS9 chip and lose the BV one; nobody is marked probationary any more.

v7.13:
- Fix: The dashboard counts tonight only. Until now the Wally and CPU
  totals, the per-unloader breakdown and the End Shift summary all kept
  counting last night's trailers for up to a day after the shift ended, so
  the numbers ran high on any night you didn't press Reset.
- Fix: The hourly breakdown no longer shows nonsense rows like "-20th
  hour". Each trailer now reports the hour it was actually credited to,
  grace window included.
- Fix: Opening the app before the shift starts no longer files anything as
  hour 24. It treats the shift as not started yet rather than as one that
  began the previous evening.
- Past shifts are still in the Logs tab. Nothing was removed -- the stats
  just stopped mixing the two together.

v7.12:
- Fix: One record the sheet wouldn't accept used to stop everything behind
  it from syncing, for the rest of the night. The badge said "Tap to retry"
  but retrying could never work. The rest of the night's records now go
  through, and the one that failed is set aside rather than holding the
  queue up.
- Nothing is thrown away. Set-aside records stay on the phone; the badge
  shows how many, and tapping it tries them again once whatever was wrong
  has been sorted out.
- Being out of signal is treated differently from the sheet refusing a
  record. Losing signal no longer counts against anything -- the queue just
  waits, and backs off instead of retrying every five seconds.

v7.11:
- Fix: The app can no longer be left in a state where it won't open. If any
  of its saved data becomes unreadable, it now starts with defaults for just
  that part instead of showing a blank screen with no way in.
- Nothing damaged is ever deleted. It is set aside, and the app tells you
  what it could not read and points you at Restore From Backup.
- New: If the app ever fails to start for any other reason, you now get a
  screen with Try Again, Restore From Backup, and Clear the damaged data --
  rather than a white page and no way to reach Settings.
- This mattered more after v7.09: the app now saves itself to the phone, so
  a bad state would have stuck around longer than it used to.

v7.10:
- Fix: The icons and the PDF library are now saved on the first launch too.
  In v7.09 only the app itself was saved on the first run, so a very first
  visit to a dead zone could open with the icons missing. One extra load
  with a signal fixed it on its own; now it doesn't need one.
- Note: the icon font itself still arrives on the second launch, so give
  the app one more open with a signal for it to look completely right
  offline. The app opening at all was never affected.

v7.09:
- Fix: The app no longer goes to a white screen when you open it somewhere
  with weak service. It now saves itself to the phone and opens from there,
  so starting it never waits on a signal.
- The cause: GitHub only lets the app stay "fresh" for ten minutes. Past
  that, opening it had to reach the network first, and on a bad signal that
  request doesn't fail -- it hangs, with nothing on screen while it waits.
- The icons and the PDF library are saved too, so the app looks right in a
  dead zone, not just loads.
- Note: it has to be opened once with a signal before this takes effect.
  After that, every launch is instant, signal or no signal.
- New: Settings > Shift Management shows whether the app is saved for
  offline use, and can turn it off if it ever misbehaves.
- Note: updates now arrive on the NEXT launch rather than mid-use, so the
  app will never swap itself out from under you during a shift.

v7.08:
- New: Luis and Gilbert are on the roster. Both are PS9 Twilight, so they
  carry the PS9 chip and join the observation rotation -- a full cycle is
  now eleven shift days rather than nine.
- New: Both are also marked "BV" on a small blue chip, in Team Management
  and on DOP rows. Blue vest means probationary; it sits next to the PS9
  chip rather than replacing it.
- Both are permanent, so they survive a reset and are not cleared when the
  shift ends.
- Fix: A roster change could only ever reach a device once. The list was
  brought up to date behind a single flag, so any change made after that
  first update was silently skipped on every phone already running the app.
  Each change now carries its own flag.
- Fix: A name with an apostrophe in it -- O'Brien -- had a dead row in Team
  Management. Its edit and delete buttons did nothing at all, with no error
  to say why. Both work now, and names print correctly everywhere.
- Fix: Renaming someone to a name already on the list quietly created a
  second copy of that person -- twice in Team Management, twice in every
  unloader dropdown, and two DOP rows splitting one night's hours. It is
  now refused, the same as trying to add a name twice.
- Fix: A backup file with no version stamp is refused rather than restored
  on the assumption it was current.

v7.07:
- Fix: Reset All Data was quietly deleting far more than it said. It wiped
  your team list, the whole observation rotation including which cycle you
  were on, the checklist and the volume counts -- while the prompt only
  mentioned trailers and logs. Reset now clears the night's work and keeps
  the setup around it, and the prompt says exactly what goes.
- New: Back Up Everything, in Settings under Shift Management. Saves one file
  with the lot -- trailers, logs, team, notes, observation rotation, hours,
  schedule and settings.
- New: Restore From Backup, beside it. It tells you when the backup was made
  before replacing anything, and refuses a file that isn't a Wally backup or
  that is damaged.
- Fix: A Restore control had been sitting in the app wired to nothing.

v7.06:
- Change: The checklist share report is now a single line -- "DECR/OBS - W"
  -- using the last name of whoever was observed. The date is gone.
- Heads up: most of the crew are stored as a first name and a last initial,
  so several share a last name. R is Matt or Lorena, F is David or Eddie,
  J is Arce or Fonseca.

v7.05:
- Change: One colour palette across every tab. The app had been mixing two
  sets of the same colours -- an iOS blue/green/red/orange alongside the
  app's own -- so the same thing could look slightly different depending on
  which screen you were on. They are now one set everywhere.
- Change: Belt Tender amber is now a proper colour like Bulk's blue. It had
  been five slightly different yellows; the belt row, tag, rank and hours now
  match each other and sit alongside Bulk the same way.
- Bay door colours are untouched. Those code the volume type and were left
  exactly as they were.

v7.04:
- New: Nightly Checklist under Tools. Pre-sort DECR, Post-sort DECR,
  Observation, Validate staffing, Check slide, Walk belt, Gratings clear.
  The tile shows how many are done at a glance.
- The Observation row is the Observation Tracker. Ticking it marks the night
  observed and vice versa, so the two can never disagree, and the row shows
  who tonight's observee is.
- Once all seven are ticked the share sheet opens on its own, and a Share
  button stays available to send it again. The report is the DECR lines and
  the observation with the employee's name.
- The checklist clears when you end the shift.

v7.03:
- New: Tap any day in the Observation Tracker's Recent list to edit it. You
  can flip it between Pending and Observed, put a different employee on it,
  or delete the record.
- Note: Marking a past day Observed retires that person from the rotation
  until the cycle comes round again; setting it back to Pending returns them
  to the pool. The sheet spells out which way it is currently counted.

v7.02:
- Change: The PS9 Twilight tag in Settings now looks exactly like the one on
  the DOP rows -- the same small "PS9" chip. Hover it for the full name.

v7.01:
- New: The PS9 Twilight tag now shows on DOP rows too, so you can tell the
  core crew from a temporary add without leaving the tab.
- Fix: Names no longer truncate on active DOP rows. The start-time button
  uses the same short format the cut rows already used, which frees up the
  width the name column was short of.

v7.00:
- New: The nine core employees are tagged "PS9 Twilight" in Team
  Management. These are the same nine the observation rotation uses.
- Change: The roster is now Robert W, Matt R, Lorena R, Russell H,
  Trevon C, David F, Arce J, Fonseca J, Eddie F, plus Solis, Damian,
  Johnny and Evan. Johnny and Evan were added; Juan F, Jeff, Anthony, Josh
  and Jarrett were removed.
- New: Those thirteen are permanent -- they survive a reset. Anyone else
  added to the roster is treated as temporary and is cleared when the
  shift ends, so one-off names don't pile up.
- Removing the five is one-time only: if you deliberately re-add any of
  them later they stay, though as non-permanent names they will drop off
  at the next shift end.
v6.99:
- Fix: The observation reassignment fired as soon as the first employee
  clocked in, which was far too early -- most of the crew hadn't arrived,
  so the day's employee looked absent when they simply weren't on yet. It
  now waits until DOP is met (every position filled) before checking, and
  still fires if the crew is over DOP.
v6.98:
- New: A cut employee's start and end times are now edited together in one
  sheet, with the resulting hours shown live as you type. The row button
  reads the span (e.g. "8:13 - 9:45") instead of two unlabelled times where
  you couldn't tell which was which.
- An end time earlier than the start is treated as running past midnight,
  and any time banked off the clock is still excluded.
- UI: Custom note tags now look exactly like the predefined ones -- same
  fill, border, size and shape, in the editor and on note cards.
v6.97:
- Change: Eddie F added to the observation rotation, making it nine
  employees. A full cycle is now nine shift days.
- Fix: The rotation list was being saved to the device, so changing it in
  the app would not have reached anyone already using it. It is now read
  from the app itself, so future changes take effect straight away.
v6.96:
- UI: Removed the eligible-pool editor from the Observation Tracker. The
  rotation still runs through the same eight employees; the list is just no
  longer shown or editable on screen. The sheet is now today's employee,
  Mark Observed / Skip, the manual override, and recent history.
v6.95:
- New: Observation Tracker, under Tools > Methods. Picks one employee per
  shift day from a fixed pool -- Robert W, Matt R, Lorena R, Russell H,
  Trevon C, David F, Arce J, Fonseca J -- rotating in order until everyone
  has been observed, then starting over. The pool is editable.
- New: If the chosen employee isn't clocked in on DOP, the observation is
  handed to the next eligible person who is, and a popup says who and why.
- Skipping someone who isn't at work defers them rather than clearing them
  -- they come back round later in the same cycle. You can also pick
  anyone manually, including outside the pool.
- The day's employee shows on the dashboard beneath the subtitle, and turns
  green once marked observed. Tap it to open the tracker.
v6.94:
- Removed: The 16-hour unloader labour threshold. The UNLOAD tile no longer
  turns red, no "16h+" badge appears, and the warning banner is gone. The
  tile just reports the hours.
v6.93:
- Fix: Reinstating a cut employee credited them for the time they were off
  the clock. Someone who worked 3 hrs, sat cut for 2, then came back showed
  5 hrs. They now resume from the 3 hrs they had actually accumulated and
  build from there.
- The stretch spent cut is banked and excluded rather than the clock-in
  time being moved, so the roster still shows when they really started.
  Cutting and reinstating repeatedly stays correct.
v6.92:
- Fix: A cut employee's row was dimmed to 60%, which faded its controls
  along with everything else and made the row look disabled. Undo and both
  time edits worked the whole time -- they just didn't look tappable.
- Cut rows now render at full strength on a neutral grey surface with a red
  CUT badge, so they still read as off the clock while the reinstate and
  edit controls stay clearly usable.
v6.91:
- Fix: Labor hours were reading slightly high against the TMS. Start times
  are stored on the exact minute, but the running clock counted seconds
  too, so a span read up to a full minute over -- always over, never
  under. Hours are now counted in whole minutes at both ends, matching a
  TMS that drops seconds.
- Fix: The same window could produce two different totals depending on how
  it was recorded. A cut edited to 22:00 computed 2.00 hrs, while a cut
  taken live at 22:00 carried the seconds. Both now agree.
- Hours therefore advance once a minute rather than continuously. Overnight
  spans and 24-hour times were checked and were already correct.
v6.90:
- UI: The dashboard pill now reads as two labelled rows -- "Hours - 6.00"
  on top and "PPH - 1000" beneath in smaller type, with the values aligned
  so the digits stay in a column as they change.
- New: PPH is green at 500 or above and red below it, and the ring around
  the pill matches, so you can read the shift at a glance without focusing
  on the number. Demo mode keeps its orange ring.
- A count older than ~75 minutes now dims the PPH row instead of recolouring
  it, so the red/green reading is never masked by a staleness warning.
v6.89:
- New: Live PPH tracker. The dashboard pill now leads with PPH and shows
  live unload hours underneath. Only unload-role hours count, matching the
  DOP tab's UNLOAD tile.
- New: Tap the pill > Update Volume to enter the running package count.
  It previews the PPH before you save, keeps a timestamped history of every
  count, and shows the rate for each interval between counts.
- PPH is measured against the unload hours at the moment you enter a count,
  so it holds steady between counts instead of sagging as hours build and
  snapping back on the next entry. The figure turns amber once a count is
  over ~75 minutes old. The volume log clears when a new shift starts.
v6.88:
- Fix: Tapping "Push to Sheets" twice in a row left the button permanently
  reading "Pushed!". It restored whatever text the button happened to show
  at the time, so a second tap saved "Pushed!" as the text to restore.
- UI: PPH Calculator now has the same close (X) control as the other
  sheets, and its result panel, differential pill and push button use the
  app's standard colours instead of leftover hardcoded ones.
v6.87:
- Change: The PPH Calculator now measures against 500 PPH instead of 600.
  The target hours, the +/- differential, its green/red colouring and the
  figure pushed to Sheets all use the new target, and the on-screen label
  reads "vs 500 PPH".
- The target now lives in one constant (PPH_TARGET), so it can't drift out
  of sync with the label again.
v6.86:
- New: Added a Methods tool to the Tools tab as a placeholder. It opens a
  "coming soon" sheet for now -- nothing is wired up behind it yet.
v6.85:
- New: Onboarding a trailer while the shift hasn't been started now prompts
  you to start it, since timers and stats only run once the shift is live.
  "Start Shift Now" starts it and keeps the trailers you already onboarded;
  "Not Yet" leaves everything as it is.
- The prompt appears once per idle period, not on every trailer, so setting
  up several bays before the shift doesn't nag. It can appear again after a
  shift ends.
v6.84:
- UI: The live hours counter now uses the same pill shape as the Start
  Shift button instead of a circle -- same corner radius, same height,
  same spot -- so the control looks like it genuinely changes rather than
  swapping into a different shape. The green ring and glow are unchanged.
v6.83:
- UI: Removed the Ready / Shift Live / Demo Mode label from the corner of
  the dashboard card. The ring around the hours counter already says it --
  green when the shift is live, orange in demo, and no counter at all when
  you are idle.
- UI: The ring now gently pulses while the shift runs, so it reads as live
  at a glance.
v6.82:
- UI: The dashboard now has one centred control. Start Shift sits in the
  middle of the nameplate, and once the shift is running it becomes the
  live unload-hours counter inside a green ring (orange in demo mode).
- New: Tapping the running counter opens Shift Options -- View Breakdown
  jumps to the DOP tab, or End Shift goes straight to the usual end-shift
  confirmation. Ending the shift turns the counter back into the Start
  Shift button.
v6.81:
- UI: Dashboard nameplate reworked. The Ready/Live pill was restating what
  the button already says (Ready + "Start Shift", Shift Live + "End
  Shift") while taking a third of the row, so it moved to a quiet status
  label in the top corner of the card.
- UI: The Unload hours tile and the shift button now split the row evenly
  as two equal blocks, same height and same corner radius as the stat
  cards below, so the button no longer looks like an odd small chip.
  Unload hours are centred in the block.
v6.80:
- Change: Being cut no longer locks in the position someone held. A cut
  employee stays in the ranking with their frozen hours, so they keep a
  position only while their time still leads. As people still on the clock
  work past them they are overtaken and drop down automatically.
- Their hours are never lost -- they simply count wherever their total
  ranks them. Positions stay purely time-driven: most hours is Belt
  Tender, the next two are Bulk, everyone else unloads.
v6.79:
- Fix: DOP roles are now genuinely dynamic. The employee with the most
  hours is Belt Tender, the next two are Bulk, everyone else unloads --
  and roles re-rank as hours change. Previously one employee (Robert W)
  was hardcoded as the default Belt Tender and took the role no matter
  how few hours he had, which also produced TWO Belt Tenders at once.
- Fix: Manually pinning someone to a role no longer creates a second Belt
  Tender. Pins now claim their slot before the hours ranking is applied.
- The "Default Belt" badge is gone, since there is no longer a preferred
  employee for the role.
v6.78:
- Fix: Cutting someone no longer moves their hours. A cut only stops the
  clock -- the hours they already worked stay counted under the role they
  actually worked. Previously cutting cleared their role pin, letting
  auto-assignment move them to another role, so their hours jumped from
  one total to another (an unloader cut at 1.00 hrs could drop the Unload
  total by a full hour and add it to Belt instead).
- Their role slot still frees up for whoever is still on the clock, so
  cutting the Belt Tender still hands Belt to someone active.
v6.77:
- New: The dashboard nameplate now shows live Unload hours between the
  shift pill and the Start/End Shift button, mirroring the DOP tab's
  UNLOAD tile exactly. It turns green once hours are on the board and
  updates as DOP changes.
- Change: Manual Add moved off the dashboard nameplate into the Tools tab,
  alongside Notes Manager and PPH Calculator.
v6.76:
- New: A cut can now be undone. Cut rows on the DOP tab have a green undo
  button that puts the employee back to work. Hours resume from their
  original start time (they never actually left), their role comes back,
  and if cutting them had ended the shift, the shift goes live again.
- UI: Cut rows were too crowded for a third control, so the two time
  buttons now show a compact time (8:13 / 9:13). The full time is still
  shown when you tap to edit. Names stay readable.
v6.75:
- UI: Every tab now has the same header. Tools and Settings dropped their
  white banner strip and DOP dropped its tinted panel, so all five titles
  sit in the same place at the same size as Logs and Active.
- UI: DOP modernized to match the rest of the app -- KPI tiles are now
  glass cards like the dashboard stats, employee rows match the Active
  cards, and section headings match the dashboard labels.
- Fix: Employee names on the DOP roster were cut to "RO..." / "LOR...".
  The name is now the most prominent thing on the row and every name on
  the default roster fits in full, down to a 5.4-inch iPhone.
- UI: Tools cards were the only flat cards left in the app; they now use
  the same glass treatment as every other card.
v6.74:
- Change: DOP no longer keeps its own employee list. The Settings team
  list is now the single master list, and the DOP roster is built from
  it -- same people, same order. The two can no longer drift apart.
- Adding an employee from the DOP tab adds them to the master list (and
  the unloader dropdowns) automatically; removing or renaming someone in
  Settings updates DOP straight away. Hours, role and clock-in status are
  carried over, including across a rename.
v6.73:
- Change: The Hours tab is now called DOP (header reads "DOP Tracker").
- Fix: The DOP roster and the Team Management list are now one list, kept
  in sync both ways. Previously an employee added in Settings only reached
  the DOP tab after a reload, deleting someone in Settings left them on
  the DOP roster forever, and renaming someone produced a duplicate row.
- Fix: Adding a name in the DOP tab that already exists no longer creates
  a duplicate roster row -- it tells you the name is already on the list.
  Adding there also refreshes the Team Management list right away.
- Note: Removing a team member now warns when that person has DOP hours
  recorded, since removing them discards those hours.
v6.72:
- UI: Grace Period prompt reworded to state the action plainly --
  "Door 9 completed at 08:23 PM. Assign completion to previous hour or
  current hour." Shows the clock time instead of just the minute, and
  drops the grace-window description from the prompt (Settings still
  describes the window).
v6.71:
- UI: The Grace Period prompt now names the bay, so it is clear which
  trailer is being attributed when two bays finish close together --
  "Door 9 completed at :19, inside the :19-:29 grace window." Wording
  is otherwise unchanged.
v6.70:
- Fix: Grace Period now works on every start time. The window is anchored
  to the shift start MINUTE instead of being hardcoded to :00-:10, so an
  8:00 PM start gives :00-:10, 8:15 PM gives :15-:25 and 7:30 PM gives
  :30-:40. Since v6.56 it was pinned to :00-:10, so on Wed/Thu (8:15) and
  Fri (7:30) it never fired during the real window and could fire during
  the wrong ten minutes instead.
- Fix: Choosing "Previous Hour" now rewinds past the shift-anchored hour
  boundary rather than past :00.
- UI: The Grace Period prompt and the Settings description now show the
  actual window for tonight (e.g. ":15-:25") instead of always claiming
  the first ten minutes of the hour.
v6.69:
- Fix: Dashboard no longer scrolls in its default view -- all stats and
  every bay door are visible at once, down to a 5.4-inch iPhone. The
  bottom padding reserved 160px for a tab bar that only needs ~100px,
  and the bottom row of bays was actually sitting behind the tab bar on
  smaller phones. Stats are now two rows (Wallies/CPUs, then This Hour /
  Last Hour / Overall Total) instead of three.
- New: Shift start times are now scheduled per weekday and applied
  automatically when the app opens -- Mon/Tue 8:00 PM, Wed/Thu 8:15 PM,
  Fri 7:30 PM. Because shifts run past midnight, the time is chosen from
  the day the shift STARTED, so opening the app at 2 AM Tuesday still
  shows Monday's 8:00 PM.
- New: Settings > Shift Management lists all seven days with editable
  start times, marking tonight's. A running shift keeps the time it
  started with, so edits never move a live shift's stats.
v6.68:
- New: Onboarding sheet now has a close (X) button at the top right,
  aligned with the title, so you can back out without scrolling to the
  Cancel button at the bottom.
- UI: Note tags were nearly invisible -- they used a transparent border on
  a faint gray fill. Tags now use a white fill with a 1.5px border,
  matching the form fields in the same sheet. Selected tags stay solid
  black; custom tags keep their amber accent.
- UI: The custom-tag field and the free-text notes box also switched from
  borderless gray to white with a matching border and blue focus ring, so
  every input in the sheet reads the same way.
v6.67:
- Fix (iOS): Modal sheets no longer crowd the Dynamic Island. The old
  92vh/90vh height cap made top clearance a percentage of screen height,
  so it shrank on smaller phones (16px on 16 Pro Max, 9px on 15/14 Pro).
  Sheets now leave a constant 24px gap below the island on every device.
- Fix (iOS): Bottom tab bar no longer drifts or lags during momentum
  scrolling. Removed the deprecated -webkit-overflow-scrolling:touch from
  the scroll containers and gave the tab bar its own compositor layer so
  its blur stops trailing the scroll. Look is unchanged.
v6.66:
- New: Onboarding form has an inline Notes section -- pick predefined tags
  and/or type custom tags plus optional text right at onboarding. Saving
  appends a new timestamped entry to that Wally's note history instead of
  overwriting it.
- New: Typing a Wally number with existing notes shows a banner with its
  latest tags and entry count, with a "Use These" shortcut to copy them in.
- New: Notes Manager shows an entry-count badge and full timestamped
  history per Wally; the editor supports custom tags alongside the 12
  predefined ones.
- New: Active Door detail view has a note-edit shortcut so tags can be
  corrected on a still-active Wally (e.g. if the volume mix changes) --
  edits update the current entry in place without rewriting history.
v6.65:
- Fix: SHIFT_END and note webhooks now send immediately instead of sitting in
  the queue (badge stuck on "Syncing...") until the next unrelated send or reload.
- Fix: first start-time edit after a shift reset was silently swallowed --
  reset state was missing the pendingCutTimeId field, routing the edit into
  the cut-time branch where it matched no employee.
- Fix: cancelling a cut-time edit no longer causes the next start-time edit
  to be applied as a cut time to the wrong employee (stale pending ids are
  cleared whenever either time modal opens).
- Fix: tapping Revert on a manually-added log entry crashed (no door 0).
  Revert button hidden for manual entries and guarded in revertLog().
- Fix: Grace Period setting no longer silently re-enables on every shift
  start; the saved Settings value is respected.
- Fix: sync error badge kept its tap-to-retry handler when new payloads are
  queued during the error window; pending count now refreshes live.
- Fix: onboarding a duplicate Wally now uses the arrival time typed in the
  form (was always "now") and records laborStart consistently.
v6.64:
- Fix: Hours Tracker no longer zeroes employee hours after midnight. htParseHHMM
  built every HH:MM time on today's date, so after midnight a start time like
  "23:50" or a shift-start re-sync of "20:00" landed in the future and hours
  read 0.00 for the rest of the night. Times more than 6 hours in the future
  now roll back to yesterday, matching the main tracker's overnight handling.
v6.63:
- UI: Active door modal detail section wrapped in glassmorphism card matching
  stat-cards and log-cards. detail-value font-size 14px->15px, padding added.
- UI: Onboard modal Bay Unavailable colors and Mark Unavailable button use
  CSS variables instead of hardcoded var(--text-main)/var(--text-muted)/var(--border).
- Fix: Hours tab Add Employee now Title-Cases the name and calls
  populateUnloaderSelect() so new employees appear in all unloader dropdowns.
v6.62:
- UI: Onboard modal type selector (Wally/CPU) now has a visible border and white
  background to match form inputs -- no longer washes out against the modal sheet.
- UI: Active door modal CPU section removed background box and horizontal padding
  so checkboxes align flush with modal content edge. Border-top separator added.
- UI: Skip share sheet row gets a border-top separator for consistent visual rhythm.
- UI: Hardcoded var(--text-main) and var(--text-muted) colors in CPU section replaced with CSS variables.
v6.61:
- Fix: Completion payloads no longer silently dropped when a start payload was
  in-flight during completion. Each queued payload now gets a unique _queueId.
  The success handler removes by _queueId instead of cq.shift(), so a deduped
  start no longer accidentally removes the end payload that replaced it.
v6.60:
- Fix: Form input fields (Wally Number, Unloader, Start Time, etc.) now have a
  visible 1.5px border and white background so they are clearly defined against
  the modal background. Focus state adds a blue border + subtle glow ring.
v6.59:
- Design: UI/UX modernization pass. Bay circles enlarged to 72px. Active card
  left border thickened to 5px. Modal sheets get 32px top radius + drag handle.
  Toggle switches widened to 52px. Duration numbers in log cards made bolder.
  All active-state scale transforms changed from 0.96 to 0.97.
  Monospace .wally-id CSS class added for future use.
v6.58:
- Fix: Webhook queue size cap removed. Queue no longer drops payloads under
  load. Console warning fires if queue exceeds 200 items (informational only).
- New: Sync error badge is now tappable. Shows "Tap to retry (N)" in error
  state. Tapping clears error class and immediately retries processWebhookQueue().
v6.57:
- Fix: Hours Tracker and main shift state now stay in sync across page reloads.
  htLoadState() reconciles hoursState against ps9_shift_state on every load.
- Fix: confirmEndShift() guards ensure htSilentReset() always runs on shift end.
- Fix: resetData() now removes ps9_v4 so Hours Tracker resets with everything else.
v6.56:
- Fix: Renamed "Attribution Window" to "Grace Period" throughout all UI text.
  JS variable names and localStorage key (ps9_attribution_config_v2) unchanged.
- Fix: Grace period window simplified to always :00-:10 of each hour. Slider
  removed from Settings. Settings toggle now reads "Enable Grace Period".
- UI: Grace period modal heading updated. Simulate Grace Period in Demo section.
v6.55:
- Fix: Wally/Trailer ID field in Edit Log modal is now editable. Corrected ID is
  saved to historyLog, triggers a webhook resync to Google Sheets, and migrates
  any attached note from the old ID to the new ID.
- Fix: ID field in Edit Active Bay modal is also editable. IDs saved as uppercase.
v6.54:
- Fix: CPU door completion no longer requires selecting a replacement type. Alert and
  early return removed from confirmCompleteDoor(). Replacement is now optional -- if
  neither checkbox is checked, cpuNext=false and no share sheet fires (existing behavior).
  If CPU or Wally is checked, share sheet fires as before.
- UI: Heading on CPU replacement section changed from "What is replacing this CPU?" to
  "What's replacing this CPU? (optional)" to reflect the optional nature.
v6.48:
- Fix: Share sheet now fires reliably on iOS. Root cause was a setTimeout(100) wrapper
  around navigator.share() that broke iOS user-gesture requirement. Removed the delay;
  share sheet now triggers synchronously within the completion gesture context.
- New: Start Shift now checks for active/staged trailers before clearing. If any exist,
  a modal appears: "Add to New Shift" (preserves bays, clears logs only) or "Remove All
  & Start Fresh" (existing clear-all behavior).
- Fix: Google Sheets sync upgraded from no-cors (opaque) to CORS-aware fetch. Client now
  reads the Apps Script response and only dequeues items confirmed as ok:true. Apps Script
  failures previously caused silent data loss; they now retry from the local queue.
  NOTE: Requires Apps Script re-deploy — doPost must return {ok:true/false} JSON with CORS.
v6.47:
- Settings: Merged "Shift Management" and "Shift Configuration" into a single
  unified "Shift Management" collapsible section. Removed the standalone
  "Preferences" section entirely.
- Completion Pop-up: Added "Skip share sheet" checkbox to the Active Detail
  modal (above the Complete Unload button). When checked, the native share
  sheet is bypassed for that single completion regardless of global preference.
  Checkbox auto-resets each time the modal opens.
- Shift End: Added "Share total wallies to team" checkbox to the End Shift
  modal. When checked, fires a share sheet immediately after shift confirmation
  with the text: "PS9 - [N] number of wallies" where N = completed Wallies + 1.
- Shift End: Staffing (Hours) tab is now fully reset after every shift end,
  clearing all employee clock-in state so the next shift starts clean.
- Door Timer: Timer and warn/crit ring animations now only activate when an
  unloader is actively assigned. Staged bays and bays with Unassigned status
  show no escalation rings. laborStart is not set until a real unloader is
  recorded, preventing phantom timer runaway before assignment.
- Labor Alert: New threshold monitor on the Hours tab. When total Unloader
  role hours cross 16.0h, the Unload KPI card highlights in red and a
  dismissible alert banner appears. Alert auto-resets if hours drop below
  threshold.

v6.46:
- Dashboard UI: Removed redundant "Add Unloader" button. The Manual button
  is now a compact icon button (pencil) in the nameplate actions row,
  between the shift-state pill and Start Shift button.
- End-of-Shift Report: Replaced role assignment in htBuildBreakdown() with
  a pure hours-ranked algorithm. Highest-hours employee = Belt Tender,
  next 2 = Bulk Sweep, remainder = Unloader. Robert Rule satisfied naturally:
  Robert only holds Belt Tender if he actually has the most hours. Minimizes
  total Unloader group hours regardless of staffing configuration.
- Cut Employee: Cut employees now show a time-edit button (ghost style,
  frozen start time + ✎) so their hours remain adjustable after cut.
  htCutEmployee() and htEndShift() now store cutTime on the employee object.
  htApplyCustomTime() recalculates frozenHours = (cutTime - newStartTime)
  when editing a cut employee's start time, keeping displayed hours accurate.

v6.45:
- UX/Accessibility audit: 16-point improvement pass.
- A11Y: Removed user-scalable=no; users can now pinch-to-zoom (WCAG 1.4.4).
- A11Y: Added :focus-visible ring styles for all interactive elements (WCAG 2.4.7).
- A11Y: Tab bar now uses role=tablist/tab/tabpanel with aria-selected, aria-controls,
  aria-labelledby; synced dynamically in switchTab().
- A11Y: All modal sheets now have role=dialog, aria-modal=true, aria-labelledby.
  Auto-focuses first focusable element on open via MutationObserver.
- A11Y: Filter and Export icon buttons have aria-label.
- A11Y: All stat cards and tool cards have role=button, tabindex=0, Enter/Space handler.
- A11Y: All toggle switches have role=switch, aria-checked, aria-label, tabindex=0;
  aria-checked synced in toggleSwitch().
- A11Y: Settings collapse buttons have aria-expanded=false; synced in toggleSection().
- A11Y: Active-trailers badge has aria-label synced in updateTabBadges().
- Contrast: --text-sub darkened to var(--text-sub) (6.6:1, was 4.2:1). --text-muted
  to var(--text-muted) (improved from var(--text-muted) 2.5:1).
- Stepper +/- buttons enlarged to 44x44px (WCAG minimum touch target).
- Settings labels get flex:1 + text-overflow:ellipsis (prevents overflow on narrow screens).
- Visual hierarchy: Dashboard nameplate now appears before action buttons so
  shift context is established first.
- Hardcoded var(--border) / white in Tools+Settings tab headers replaced with CSS variables.
- Added .modal-field-label, .modal-info-box, .modal-warning-box, .modal-neutral-box
  CSS utility classes for future modal refactoring.

v6.44:
- Hours tab: employee rows now match Dashboard card design language.
  Shadow upgraded to --shadow-md, min-height 78px, padding 16px for
  more breathability.
- Hours tab: employee name labels restyled to match stat-label (11px
  uppercase, muted, letter-spaced) matching "WALLIES" treatment.
- Hours tab: Start/Set Time buttons converted to horizontal row layout.
  Start button retains black fill matching btn-shift; Set Time is now
  a ghost/outline button. Both sized consistently at 36px height,
  10px radius, 11px font.

v6.43:
- Hours tab: employee name font reduced (16px→14px), DOP status label
  reduced (15px→13px), and shift time input reduced (16px→15px) for
  visual consistency with the rest of the app.
- Dashboard: stat cards enlarged (min-height 62→76px, padding 10→13px,
  value font 34→38px), bay circles enlarged (52→58px), and nameplate
  padding increased (10→14px) for a more spacious feel.

v6.42:
- Dashboard: full single-screen layout for iPhone 16 Pro Max. All content
  (nameplate, 5 stat cards, active bays, open bays) now fits without
  scrolling on a 6.9-inch display. Content no longer renders behind or
  below the tab bar.
- App container top padding reduced (44px → 8px above safe area) so
  Dynamic Island breathing room is handled by the OS safe area inset.
- Nameplate: reduced padding and title size (26→21px) to reclaim ~40px.
- Stat cards: height 100→62px, value font 52→34px, gap 12→8px. Saves
  ~120px of vertical space while keeping numbers clearly readable.
- Section labels: tighter margins (margin-bottom 10→5px).
- Bay circles: 62→52px diameter, gap 12→8px, margins 28→8px. All 8
  open bays now fit in a single compact row without overflow.
- Removed 120px dead-space div at the bottom of the dashboard.
- Notes contents chips updated: added "BARN DOORS" and "CPU"; full list
  alphabetized: Barn Doors, CPU, Gaylords, Heavy Bulk, Heavy Flats,
  HOTT, Mixed, Overflow, Smalls, Sortable, Tires, Wooden Crates.
- Removed "Wooden Boxes" quick-pick button from Additional Notes.
- App-wide button standardization: btn-primary → 15px font / 700 weight
  / 14px radius. btn-cancel → 15px / 600 weight. Consistent across all
  modals and flows.
- Segmented controls (Wally/CPU, type selectors): unified padding (10px),
  radius (9px inner / 12px outer), weight (600). Matches across all views.
- Typography: global CSS rule enforces 22px / weight 800 on all modal h2
  headers. Section sub-headers unified at 11px / 700 / uppercase / gray.
  header-bar h1 (Logs, Active tabs) unified at 22px / 800.

v6.41:
- Hours tab: fixed scroll architecture. Tab container no longer scrolls;
  only the employee list body scrolls independently. Header (title + DOP +
  status bar) stays pinned at the top at all times.
- Hours header redesigned: "Hours Tracker" title is perfectly centered.
  LIVE pill anchored to the right edge. DOP toggle (6/2 / 5/2) centered
  directly underneath the title in its own row. Follows Apple HIG spacing.
- Bottom padding increased on the Hours scroll body to prevent last employee
  row from being obscured behind the tab bar on iPhone 16 Pro Max.
- Notes: added "Wooden Boxes" quick-pick button above the free-text field.
  Tapping it appends the text automatically -- no typing required.
- iPhone 16 Pro Max: safe-top fallback updated to 59px for Dynamic Island.
  HT employee action buttons enlarged to meet 44pt minimum touch target.
  Role icon tap targets increased. DOP toggle buttons enlarged for easier
  tapping on the 6.9-inch display.

v6.40:
- Hours tab: employees can now be added to the active roster before the shift
  starts. Their hours clock begins when the global shift is triggered from the
  Dashboard. Employees added pre-shift with a custom time will use that time
  as their clock-in when the shift begins.
- Hours tab: Robert W is no longer auto-selected when the shift starts. He is
  started manually like any other employee but auto-receives Belt Tender once
  activated (same as before).
- Hours tab: active employee start times are now clearly editable -- the time
  button shows a pencil indicator and opens the time picker for adjustment.
- Hours tab: heading "Hours Tracker" stays centered at all times using a grid
  layout; the LIVE pill and DOP toggle no longer push it off-center.
- Notes: notes are now preserved when resetting shift data (Reset All Data no
  longer wipes notes). Notes have always persisted in local storage across
  reboots and app reloads; they are only cleared if website data is manually
  deleted.
- Notes: onboard note preview now shows with an amber highlight so existing
  notes for a Wally are immediately visible when onboarding.
- Sync: completions now cancel any pending arrival/update webhook for the same
  door session before sending, preventing Sheets from ever seeing an active
  record after the app has completed it.
- Sync: queue breathe gap reduced from 600ms to 200ms for faster drain.

v6.39:
- Hours tab: shift start/begin buttons removed. Global "Start Shift" on Dashboard
  is now the sole shift trigger for the Hours tracker. Hours tab auto-syncs when
  the global shift goes live.
- Hours tab: Robert W now auto-assigns as Belt Tender when on shift. If Robert is
  not present, the employee with the most hours is assigned Belt Tender.
- Role order: most hours = Belt Tender, next 2 = Bulk Sweep, rest = Unloaders.
  All roles remain manually overridable via the role assignment modal.
- KPI strip: hours now calculated as sum of each employee's individual hours
  (based on their specific start time) rather than count x elapsed. Employees
  with custom start times are reflected correctly in role totals.
- DOP toggle: labels simplified to "6/2" and "5/2" (was "6U/2B" / "5U/2B").
  DOP bar and toast messaging updated to match.
- DOP bar: emoji icon removed, count chips use plain text labels.
- Employee activation: if Hours tab has not yet synced and global shift is live,
  tapping Start on an employee now auto-syncs instead of prompting a confirm dialog.

v6.38gem:
- Fix (Issue #1): Corrected fatal SyntaxError in encoding guard <head> script.
  var SENTINEL = ''' contained three consecutive single quotes -- the parser
  read an empty string '' then a dangling unmatched quote, throwing an
  Uncaught SyntaxError that halts ALL script execution on iOS Safari.
  Preview environments catch <head> errors silently; native Safari does not.
  Fix: var SENTINEL = "'" wraps the apostrophe in double quotes -- valid,
  unambiguous, passes node --check in all environments.

v6.37:
- Fix: App non-functional in Chrome (tabs unresponsive, bays invisible, Hours blank).
  Root cause: THREE compounding issues in script loading order:

  (1) CDN scripts (Phosphor, jsPDF, autotable) were synchronous blocking <script src>
  tags inserted mid-body. Chrome must download and execute all three before parsing
  any HTML that follows. A slow or failed CDN request meant init() never ran -- the
  app rendered as static dead HTML with no interactivity. Fixed by adding defer to
  all three CDN scripts. defer scripts load in parallel without blocking rendering
  and execute in order just before DOMContentLoaded fires.

  (2) init() was called as a bare statement inside the script block, relying on the
  browser having already parsed the HTML above the script tag. This is fragile --
  it breaks when CDN scripts introduce timing uncertainty. Fixed by wrapping init(),
  htLoadState(), and htSyncDOPButtons() inside a DOMContentLoaded listener.
  DOMContentLoaded fires only after the FULL DOM is parsed, regardless of script
  placement, CDN timing, or network conditions. This guarantees consistent behavior
  in Chrome, Safari, iOS PWA mode, and Claude preview.

  (3) htLoadState() and htSyncDOPButtons() were called as bare statements at the
  bottom of the script block before DOMContentLoaded. With the new wrapper, those
  calls moved inside DOMContentLoaded. The duplicate bare calls were removed to
  prevent double-initialization.

  Why it worked in Claude preview: preview iframes use a document.write or srcdoc
  approach where the entire HTML is available before any script runs, making script
  placement order irrelevant. Standard browsers do not have this guarantee.

- Retained all v6.36 structural fixes (tab-hours correct nesting, min-height:0,
  flex layout, pointer-events, body overflow fix, Phosphor URL).

v6.36:
- ROOT CAUSE FIX: Hours tab was rendered inside tab-settings, not as a
  sibling tab. This made it permanently invisible when Settings was hidden,
  and showed it incorrectly stacked inside Settings when that tab was active.

  Diagnostic trace:
  v6.33 moved tab-hours from outside app-container (wrong) to inside it (right idea)
  but the insertion targeted the wrong closing div -- tab-hours landed inside
  tab-settings (depth 3 instead of depth 1). Subsequent v6.34/6.35 CSS fixes
  (min-height, flex layout, pointer-events, overflow) could not resolve a
  fundamental HTML nesting error. No CSS fix can make a div visible when its
  parent container is display:none.

  Fix: tab-hours extracted cleanly and reinserted as a direct child (depth 1)
  of app-container, immediately before its closing tag. All 6 tabs now sit as
  proper siblings: dashboard, active, logs, tools, settings, hours.

  Confirmed by: div depth check (depth=1 at tab-hours entry), isolation test
  confirming tab-hours is not inside tab-tools or tab-settings, and full
  HT function test suite (htLoadState, htAssignRoles, htCalcDOP,
  htRenderKPI, htRenderDOPBar, htRenderAll, htTick all pass).

- All v6.33-v6.35 CSS fixes retained (min-height:0, flex layout, pointer-events).
- No other functionality affected. All existing Wally features unchanged.

v6.35:
- Fix: Tab bar buttons now respond to touch correctly.
  root causes addressed:
  (a) .tab-btn had fixed width:58px -- with 6 tabs in ~358px bar this left near-zero
  tap gaps. Changed to flex:1 so each button gets equal space (~60px) with proper
  padding. Added touch-action:manipulation to eliminate iOS 300ms tap delay and
  -webkit-tap-highlight-color:transparent for clean feedback.
  (b) .ht-fab (Reset button) was position:fixed display:flex on ALL tabs even though
  it only belongs on the Hours tab. It now starts as display:none and gains class
  .visible only when the Hours tab is active via switchTab(). This eliminates any
  possibility of the FAB intercepting touches on other tabs.
  (c) Added html{height:100%} to ensure body height:100dvh resolves correctly
  in all iOS Safari versions.

v6.34:
- Fix: Hours tab now renders correctly on iOS Safari. Root cause was two bugs:
  (1) .tab-content was missing min-height:0 which is required for flex children
  in iOS Safari -- without it, flex:1 doesn't constrain the height and the tab
  expands to its full content height instead of fitting the viewport.
  (2) position:sticky on the inner ht-header didn't work because the scroll
  context wasn't correctly established. Fix: tab-hours now uses display:flex
  flex-direction:column when active, with ht-header as a flex-shrink:0 top element
  and ht-body as flex:1 min-height:0 overflow-y:auto scrollable region.
- Fix: Tools tab icons (and all Phosphor icons) now display correctly.
  The CDN URL was pointing to dist/index.umd.js which doesn't exist in this
  package version. Changed to the bare package URL which unpkg auto-resolves
  to the correct entry point via package.json main field.
- Fix (prev): tab-hours was placed outside app-container -- fixed in v6.33.

v6.33:
- REQ1: Shift start is now fully synchronized. The Hours tab Begin button delegates
  to openStartShiftConfirm() -- single code path for all shift starts. openStartShiftConfirm()
  and startDemoShift() both call htSyncFromWallyShift() which reads ps9_shift_start
  and activates the hours system in one step including Robert W auto-activation.
- REQ2: Shift end is fully synchronized. confirmEndShift() calls htEndShift() which
  cuts all active employees and locks their hours. End Shift modal summary now includes
  a full employee hours breakdown by role (Belt Tender, Bulk Sweep, Unloader).
- REQ3: Unified employee list. DEFAULT_TEAM is the single master roster including Jeff,
  Solis, Anthony, Josh, Damian, Jarrett, Arce J, Eddie F and all others. HT_PRESET_NAMES
  removed. htInitEmployees() pulls from live teamNames (falls back to DEFAULT_TEAM).
  Adding an employee in Hours tab also adds them to Wally's teamNames.
- REQ4: KPI cards are now tappable. Tapping Belt Tender, Bulk Sweep, or Unloader hours
  opens a detailed breakdown modal showing each employee in that role, their individual
  hours, start time, and pin status.
- REQ5: Hours Tracker moved from Tools overlay panel to a dedicated Hours tab between
  Logs and Tools. Tab bar now has 6 tabs. Fixed-panel CSS removed; replaced with
  standard tab-content layout with sticky header and fixed-position FAB above tab bar.
- REQ6: localStorage backward compat. htLoadState() migrates saved ps9_v4 data forward
  by appending any teamNames members not present in the saved employee list. No data loss.
- REQ7: All timing now uses a single source: ps9_shift_start via getShiftStartTime().
  HT never sets an independent start time. KPI uses count x elapsed from the shared
  shift start, updated every second via htTick() when Hours tab is active.

v6.32:
- Fix (REQ 1): Robert W is now automatically pre-assigned as Belt Tender on activation.
  He gets belt unless another employee has manually pinned belt, in which case the
  system respects that manual override and assigns Robert W by rank.
- Fix (REQ 2/3): Manual role overrides now enforce all constraints before applying.
  Cannot assign belt if another employee already holds it. Cannot assign bulk if
  2 bulk slots are filled. Modal blocks invalid selections with a lock icon.
- Fix (REQ 3): Role engine validates and strips illegal manual pins on every render
  (e.g., if two employees somehow both have manualRole=belt, the lower-ranked one
  is cleared automatically).
- Fix (REQ 4): Hours Tracker start time now syncs bidirectionally with Wally's
  shift start time. Opening the tool reads from ps9_shift_start. Starting a shift
  from the tool writes back to ps9_shift_start and updates the Settings input.
  Wally's openStartShiftConfirm is wrapped to keep HT time in sync.
- Fix (REQ 5): Employee list now sorted: Belt Tender always first, then Bulk by hours,
  then Unloaders by hours. Previously sorted only by hours which meant the belt
  tender could appear anywhere in the list.
- Fix (REQ 6): KPI hours now calculated as (count in role) x (elapsed shift time),
  not as sum of individual employee hours. This matches the spec:
  2 Bulk x 1.5h shift = 3.0 bulk hours regardless of individual start times.
- Fix (REQ 7): Clicking anywhere on an employee row opens the role modal (not just
  the role icon). Buttons use event.stopPropagation() so Cut/Start/Set Time still
  work independently. Disabled role options show a lock icon.
- Fix (REQ 8): Role engine caps bulk at 2 and unload at dopConfig (5 or 6). Excess
  employees still show as unload but DOP bar reflects the over-staffed state.
- Fix (REQ 9): Role assignment priority order enforced: (1) hard constraints strip
  invalid pins, (2) Robert W auto-belt, (3) manual pins, (4) auto rank-fill.

v6.31:
- New: Hours Tracker tool integrated under Tools tab.
  Full-screen panel with employee roster, role assignment engine, DOP status,
  KPI strip (belt/bulk/unload hours), shift begin/end state machine, and 1s live tick.
  All state persisted to localStorage (ps9_v4 key, separate from Wally's keys).
  Employees: preset PS9 roster with ability to add custom names.
  Role logic: highest hours = Belt (1), then Bulk (2), then Unload (rest).
  DOP config: 6U/2B or 5U/2B toggle with over-DOP toast alert.
  Custom clock-in times, manual role pin overrides, Cut to freeze hours.
- Integration notes: all CSS scoped under .ht- prefix, all JS functions prefixed htXxx,
  modal system uses .h-modal-* classes (separate from Wally's .modal-* system),
  zero conflicts with existing Wally globals or event listeners.

v6.30:
- Fix: Idle timer (open bay minutes) no longer runs after shift ends.
  Root cause: shiftEndTime was a volatile JS variable that was lost on page reload.
  After reload, shiftState loaded as 'idle' from localStorage but shiftEndTime was null,
  so nowOrFrozen() fell through to Date.now() and timers kept counting indefinitely.
  Fix: shiftEndTime is now persisted to localStorage (ps9_shift_end_time) on shift end
  and restored in loadShiftState on every page load.
- Fix: Open bay idle timers are now hidden entirely when shiftState is idle (no active shift).
  Showing a 967m idle timer after shift end is meaningless and confusing. The timer only
  renders during live or demo shifts.
- Fix: shiftEndTime localStorage key is cleared when a new shift starts so timers resume
  cleanly from zero.

v6.29:
- Fix: Settings "Start New Shift" now routes through handleShiftAction() -- the same function as the dashboard nameplate button. Both buttons share identical behavior: respects demo mode, sets shift state, fires NEW_SHIFT webhook. Previously the settings button called the old newShift() which bypassed the state machine and left the nameplate stuck on "Ready".
- New: Bay timers freeze when a shift ends. The elapsed-time calc in both the dashboard bay circles and the Active tab now uses nowOrFrozen() which returns Date.now() during a live shift and the exact shift end timestamp when idle. Ring animations (warn/crit) also stop ticking. Timers unfreeze automatically when the next shift starts.
- New: Dashboard auto-refresh interval stops when shift ends (no point refreshing frozen data). Restarts cleanly on next shift start.
- Update: Note contents tags updated to match PS9 trailer contents:
  SORTABLE, MIXED, HEAVY BULK, HEAVY FLATS, WOODEN CRATES, GAYLORDS, SMALLS, TIRES, HOTT, OVERFLOW
  Old tags (BULK, FURNITURE, FRAGILE, RETURNS) removed. Existing notes with old tags are preserved -- migrateNote() keeps them as freetext.

v6.28:
- New: CPU completion now requires selecting a replacement type before completing.
  Two checkboxes appear (mutually exclusive, radio-style):
    [ ] CPU -- another CPU is coming to this door
    [ ] Wally -- a Wally is rolling to this door
  Tapping Complete without selecting either shows an alert. Selection is required.
- Share text for CPU completions:
    CPU + CPU selected:   "Door X CPU"
    CPU + Wally selected: "Door X Wally"
- Wally completion checkbox behavior unchanged:
    Wally + unchecked: "Door X done"
    Wally + checked:   "Door X done\nDoor X CPU"
- Fix: resolveAttribution now correctly passes string cpuNext values ('CPU'/'Wally')
  through the attribution modal flow without coercing them to booleans.

v6.27:
- Fix: Active card in Active tab now shows both arrival time AND labor start time for doors that were staged before labor began. Format: "Arrived: HH:MM * Labor: HH:MM". Doors onboarded directly as active show only "Arrived: HH:MM" (unchanged).
- Fix: CPU door completion checkbox now says "Wally replacing this CPU" instead of "CPU replacing this CPU". Share text when checked: "Door X Wally" so team knows a Wally is rolling to that door.
- Fix: Checkbox description text now reads dynamically based on door type ("getting a CPU next" vs "getting a Wally next").
- Share matrix (final):
  Wally + box unchecked:  "Door X done"
  Wally + box checked:    "Door X done\nDoor X CPU"
  CPU   + box checked:    "Door X Wally"
  CPU   + box unchecked:  no share

v6.26:
- Fix: Share sheet now sends a single message with both lines when the CPU checkbox is checked on a Wally completion.
  Previously it sent two sequential share sheets which was unreliable on iOS.
  Wally + box unchecked:  "Door X done"
  Wally + box checked:    "Door X done\nDoor X CPU"  (one share, both lines)
  CPU   + box checked:    "Door X CPU"
  CPU   + box unchecked:  no share

v6.25:
- Fix: Webhook queue breathe gap reduced from 1500ms to 600ms. An 8-door burst now drains in ~11s instead of ~28s.
- Fix: Retry backoff on network failure reduced from 5000ms to 3000ms.
- Fix: Queue overflow now drops oldest start/update payload first (not oldest overall), protecting completions from being lost when queue is full under heavy load.
- New: Completion payloads (stage=end, SHIFT_END, NEW_SHIFT) are sorted to the front of the queue. Arrival/update payloads yield to completions. Stats and leaderboards always have the most recent data first.

v6.24:
- Fix: Share sheet text corrected. Was "CPU Door X", now "Door X CPU" to match how team reads it on the floor.
  Wally + box unchecked: "Door X done" (unchanged)
  Wally + box checked: "Door X done" then "Door X CPU"
  CPU + box checked: "Door X CPU" only
  CPU + box unchecked: no share (unchanged)

v6.23:
- Fix: Icons restored. Removed duplicate/conflicting Phosphor CSS link tags and wrong bare-package script URL from <head>. Only the correct src/index.js script at body end remains.
- Fix: CSS class mismatches resolved (btn-start-shift -> btn-shift, section-title -> section-label, stat-card-accent -> stat-card-bar).
- Redesign: Full CSS overhaul -- CSS variables for all colors/radii/shadows, cleaner stat cards with top color bar, gradient bay circles, improved tab bar with blur backdrop, tighter spacing throughout.

v6.22:
- Fix: Phosphor icon JS script tag restored (icons were missing in v6.21 preview).
- Fix: Nameplate header now centers the title and subtitle. State pill and Start/End Shift button sit below in a full-width actions row.

v6.21:
- New: Nameplate header replaces shift summary bar. Shows app title, "by Fitz Joseph", version, shift state pill, and shift action button.
- New: Shift state machine -- idle / live / demo. Nameplate pill shows current state with animated dot indicator.
- New: Start Shift button. In live mode, clears bays/logs and fires NEW_SHIFT webhook (same as before). In demo mode, starts demo instead -- all demo rules apply, no data clear.
- New: End Shift button (replaces Start Shift once shift is live or demo). Opens confirmation sheet with bay summary.
- New: End & Close Bays -- marks all remaining active/staged bays as incomplete, fires individual COMPLETION webhooks + final SHIFT_END summary webhook.
- New: End & Keep Bays Open -- fires SHIFT_END summary webhook only, bays stay active.
- New: SHIFT_END webhook payload: { dataType, totalWallies, totalCPUs, totalIncomplete, shiftDate, endTime, shiftStart, isDemo }.
- Fix: Shift state persists across page reloads via localStorage (ps9_shift_state).
- Fix: Demo mode respects shift state -- toggling demo mode off while in demo state returns to idle.

v6.20:
- New: Shift Summary Bar on dashboard -- live shift clock, current hour indicator, live PPH all visible at a glance.
- New: Glassmorphism stat cards with color accent lines per metric (Wallies=black, CPUs=blue, This Hour=green, Last Hour=orange, Overall=purple). Stat numbers enlarged to 46px.
- New: Active cards redesigned -- colored left border by type (Wally=black, CPU=blue) and by urgency (warn=orange, crit=red). Cleaner card elevation with shadow instead of outline border.
- New: Bay circles now pulse-animate when in warn (45m) or crit (60m) status -- orange glow ring and red glow ring respectively.
- New: Bay circles show a small black dot indicator when the Wally in that bay has a note.
- New: Notes are now structured -- tag chips (BULK, SMALLS, MIXED, FURNITURE, FRAGILE, RETURNS, HOTT, OVERFLOW) + optional short freetext. Backward compatible: old string notes auto-migrate to { tags:[], text: original }.
- New: Onboard note preview card -- when typing a Wally ID, any existing note slides in below showing tags and freetext with an Edit button. If no note, a ghost "Add note" tap target appears.
- New: Note editor redesigned as a bottom sheet with tag chips and a minimal textarea.
- New: Notes Manager redesigned -- tag filter chips, grouped note cards with last-seen date, inline "New Note" button.
- New: Note sync to webhook -- note saves and deletes send dataType=NOTE payloads. Completion records embed noteSnapshot.
- New: Section title labels on dashboard styled as uppercase subheaders. Background changed to var(--bg) for depth.

v6.19:
- Change: Settings page sections are now collapsible (tap heading to expand/collapse).
- Remove: Data Management section (backup/restore) removed entirely.
- Remove: Saved Accounts section and all related code removed.
- Fix: Attribution slider now correctly snaps to 0, 5, or 10 minutes (previously 0-5 represented 0-10, causing confusion). Display shows actual minute value.
- Fix: Attribution window logic now anchored to shift start minute. E.g. shift 8:05, slider=0 means window fires at :05-:15 each hour; slider=5 means :10-:20.
- Fix: Attribution modal -- "Current Hour" button is now primary (top), "Previous Hour" is secondary (bottom).
- New: Team Management section has inline "Add Team Member" row -- no separate modal needed.
- Change: Demo mode "Mix Trailer Types" is now the default and always-on. Option removed from UI.
- Change: Auto-Onboard button styled to match app aesthetic (black settings row with play icon). No more browser alert on start.
- Fix: "Overall Total" stat card no longer shows the word "trailers".

v6.18:
- Fix: Phosphor icons now load via both CSS and JS paths (versioned @2.1.1) to prevent missing icons on GitHub Pages hosting.
- New: Tab bar icons refreshed -- Home: grid, Active: garage, Logs: clipboard, Tools: wrench, Settings: sliders. Tool cards: Notes = notepad, PPH = bar chart.
- Fix: Door 8 confirmed removed. Doors 9-16 only.
- Change: "CPU replacing" checkbox now appears on ALL active door completions (both Wally and CPU types), not just Wally. Label updates dynamically.
- Change: CPU completion with box checked sends only "CPU Door X" share (no "Door X done" first -- team only needs to know it's going CPU). Wally + checked still sends two sequential sheets.
- Change: Avg Bay Idle Time stat card removed from dashboard.
- New: "Overall Total" stat card (Wallies + CPUs combined) replaces idle time card.

v6.17:
- Fix: Added inline smart-quote sanitizer as the very first script in the document. Runs before any other JS parses -- detects and replaces curly quotes (\u2018\u2019\u201c\u201d), em/en dashes, non-breaking spaces, and other non-ASCII punctuation that gets introduced when copying through GitHub web editor, Mail, or Messages. Prevents the fatal SyntaxError that causes bays to disappear and buttons to go unresponsive.

v6.16:
- New: "Disable Webhook Firing" toggle in Demo settings. When on, all webhook payloads are silently suppressed (logged to console only) -- arrivals, completions, edits, PPH, new shift pings, everything. Lets you test features freely without touching live Sheets data. Toggle resets to off on page reload.

v6.15:
- New: "CPU replacing this Wally" checkbox on the Active Detail modal (Wally doors only, always unchecked by default). When checked at completion, two sequential share sheets fire -- first "Door X done", then after dismissing, "CPU Door X" -- so the team knows not to roll another Wally to that door.
- No new log entry, no webhook change, no stat impact. Purely a share alert.

v6.14:
- Fix: Demo auto-complete now fires after 15s + a random 3-10s delay per door. Each door runs its own independent random timer so completions naturally desync -- only one door completes at a time, preventing webhook flooding.
- Fix: Auto-replenish re-onboard delay also randomized (2-4s) so new arrivals don't bunch up immediately after completions.

v6.13:
- Fix: Demo Mode and Sync badges moved from top of screen (hidden behind iPhone status bar) to just above the tab bar at the bottom -- clearly visible at all times.
- Fix: Demo auto-complete now staggers completions 4 seconds apart per door -- Door 9 completes at 15s, Door 10 at 19s, Door 11 at 23s, etc. Doors no longer all fire simultaneously.
- Fix: All non-ASCII characters purged from script block to prevent Safari SyntaxError on load.

v6.12:
- New: Demo Mode now shows a flashing orange "DEMO MODE" banner on the dashboard so it's always clear when you're in demo vs live.
- New: "Auto-Complete (15s)" toggle in Demo settings -- when enabled alongside Auto-Replenish, each auto-onboarded trailer will automatically complete after 15 seconds, then re-onboard 3 seconds later, creating a fully hands-free demo loop.
- Fix: Demo mode CPU accounts (e.g. DEMO42) no longer save to your Saved Accounts list in Settings. Accounts only save during live operations.
- Note: Auto-Complete only activates during Demo Mode -- it has no effect during live shifts.

v6.11:
- New: "Start New Shift" now pings Google Sheets with a NEW_SHIFT marker so the Live View TV dashboard resets to zero immediately -- no longer frozen on old stats until the first trailer of the night.
- New: "Reset All Data" also fires the same NEW_SHIFT ping before reloading, keeping Sheets in sync.

v6.10:
- New: Strict Sequential Webhook Queue -- all Google Sheets syncs now queue in memory and fire one at a time. Rapid-fire completions can never collide or drop data.
- New: 1.5s breathe gap between each send (measured from response received), plus 5s retry backoff on network failure.
- New: Sync Badge -- a live "Syncing (N)..." indicator appears at the top-right whenever items are pending. Turns red on network error. Disappears when queue is empty.
- Fix: Queue size capped at 500 items with overflow protection and safe try/catch on localStorage write.
- Fix: Dead 30-second queue polling interval removed from init. Queue now drains immediately on load and on coming back online.
- Fix: Apps Script -- header detection now verifies cell A1 content, not just row count, preventing silent column misalignment.
- Fix: Apps Script -- logId scan window is now dynamic (all rows), eliminating the rare 500-row missed-upsert edge case.
- Fix: Apps Script -- autoResizeColumns moved to sheet creation only, not every webhook call (significant performance gain).
- Fix: Apps Script -- leaderboard Avg Time now correctly uses UnloadDuration column, not Door Time duration.
- Fix: Apps Script -- double lock.releaseLock() race in KPI throttle branch resolved.
- Fix: Apps Script -- per-door idle averages added to KPI Dashboard alongside global average.

v6.00:
- New: "Staged" status -- onboard a door without an unloader and the bay turns Blue. Door Time clock starts; Unload Time clock is held.
- New: Door Time vs Unload Time split. Door Time = trailer arrival to completion. Unload Time = labor start to completion. Dwell = gap between the two.
- New: Edit Active Bay now shows two separate time fields: "Trailer Arrival Time" and "Labor Start Time" -- fully independent.
- New: Bay Idle Time tracking. Every log card in the Logs tab now shows "Idle Before: Xm" -- the gap since the last completion on that door.
- New: Dashboard stat card "Avg Bay Idle" shows the average idle time between completions across all doors this shift.
- New: All new fields (dwellMinutes, unloadDuration, idleBeforeMinutes) sent to Google Sheet (new columns R-T).
- Backend: KPI Dashboard now shows "Average Bay Idle Time" at the top of the dashboard tab.
- Backend: Apps Script now auto-draws a Bar Chart (Unloader Leaderboard) and Line Chart (Shift Flow) in the KPI Dashboard.

v5.08:
- Bug Fix (Critical): "Add Unloader" button now works -- was missing its handler function.
- Bug Fix: confirmAddUnloader now properly saves new name to team list.
- Bug Fix: Removed duplicate "Simulate Attribution" toggle ID in Demo section.
- Bug Fix: Completion Hour could be 0 or negative when attribution offset pushed time before shift start. Now clamped to minimum 1.
- Bug Fix (Backend): KPI Dashboard used last sheet row (often active) for shift detection. Now scans for latest completed row.
- Bug Fix (Backend): "Hour 0" phantom bucket in KPI hourly flow -- server now skips hour <= 0.
- Bug Fix (Backend): completionHour of 0 was silently converted to empty string due to falsy JS check.
- Fix: Dashboard auto-refreshes every 30s so bay timers, status rings, and stats stay current.
- Fix: Move/Incomplete log entries now include the assistants field for webhook data.
- New: "Share on Completion" toggle in Settings > Preferences to control the native share sheet.
- Backend: KPI Dashboard update throttled (30s cooldown) to prevent lock timeouts under heavy use.
- Backend: Wally Tracker sheet auto-creates headers if missing.
- Backend: logId search now scans only last 500 rows for faster lookups.

v5.07:
- Bug Fix (Critical): Fixed massive duration errors when editing start times that cross midnight.
- Bug Fix (Backend): Reworked Apps Script to prevent bottlenecks during heavy usage.

v5.06:
- Added "Team Management" section to Settings.
- Added retroactive updating: editing a name updates active trailers and past logs.
    `;
