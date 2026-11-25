"""Apps Script "Idle Summary" sheet (Code.gs v6.19).

Runs updateIdleSummary() from apps-script/Code.gs in Node against a mocked
spreadsheet, so no Google account or deploy is needed. Checks:

1. Rows are grouped by SHIFT date: a completion at 00:20 belongs to the
   previous evening's shift.
2. Gaps, total, average, longest gap and its door are right per shift.
3. Blank, out-of-range and non-completion rows are ignored.
4. The By Door table covers the recent shifts.
5. A failure in the summary does not stop updateDashboards().
"""
import json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CODE = os.path.join(ROOT, 'apps-script', 'Code.gs')

# Wally Tracker columns: A Date, B Door, G Start, H End, N Status, P Shift Start, T Idle Time
def row(date, door, start, end, status, idle, shift='20:00'):
    r = [''] * 21
    r[0], r[1], r[6], r[7], r[13], r[15], r[19] = date, door, start, end, status, shift, idle
    return r

ROWS = [['Date'] + [''] * 20,
        row('2026-11-24', '—', '19:58', '', 'new_shift', '', '20:00'),
        row('2026-11-24', 9, '21:10', '21:50', 'completed', 10),
        row('2026-11-25', '—', '19:58', '', 'new_shift', '', '20:00'),
        row('2026-11-25', 11, '22:30', '23:15', 'completed', 30),
        row('2026-11-26', 11, '23:55', '00:20', 'completed', 20),   # after midnight -> 11-25
        row('2026-11-25', 12, '21:10', '21:40', 'completed', ''),   # first trailer: no idle
        row('2026-11-25', 13, '21:00', '', 'active', 15),           # not a completion
        row('2026-11-25', 14, '21:00', '22:00', 'completed', 900)]  # garbage, over the cap

JS = r"""
const vm = require('vm'), fs = require('fs');
const [code, rows] = [fs.readFileSync(process.argv[1], 'utf8'), JSON.parse(process.argv[2])];
const sheets = {}, logs = [];
function mkSheet(name, values) {
  const sh = { name, values: values || [], fmt: [],
    getDataRange() { return { getValues: () => sh.values.map(r => r.slice()) }; },
    clear() { sh.values = []; },
    getRange(r, c, nr, nc) { const rg = {
        setValues(v) { v.forEach((line, i) => { sh.values[r - 1 + i] = sh.values[r - 1 + i] || [];
          line.forEach((x, j) => { sh.values[r - 1 + i][c - 1 + j] = x; }); }); return rg; },
        setFontWeight() { return rg; }, setBackground() { return rg; } }; return rg; } };
  return (sheets[name] = sh);
}
mkSheet('Wally Tracker', rows);
const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => mkSheet(n) };
const ctx = { Logger: { log: m => logs.push(String(m)) }, console };
vm.createContext(ctx); vm.runInContext(code, ctx);
ctx.updateIdleSummary(ss, sheets['Wally Tracker']);
const summary = sheets['Idle Summary'].values;
// 5: break the summary and confirm updateDashboards() still gets past it
ctx.updateIdleSummary = () => { throw new Error('boom'); };
let reached = false;
const realGet = ss.getSheetByName;
ss.getSheetByName = n => { if (n === 'KPI Dashboard') { reached = true; throw new Error('stop'); } return realGet(n); };
try { ctx.updateDashboards(ss); } catch (e) {}
console.log(JSON.stringify({ summary, reached, logged: logs.some(l => l.includes('Idle summary error: boom')) }));
"""

out = subprocess.run(['node', '-e', JS, CODE, json.dumps(ROWS)], capture_output=True, text=True)
if out.returncode:
    print(out.stderr); print('\nFAILURES'); raise SystemExit
res = json.loads(out.stdout.strip().splitlines()[-1])
S = res['summary']
find = lambda label: next(i for i, r in enumerate(S) if r and r[0] == label)
ok = True

h = find('Shift Date')
s25, s24 = S[h + 1], S[h + 2]
d11 = S[h].index('Door 11 (m)')
good = s25[0] == '2026-11-25' and s24[0] == '2026-11-24' and (S[h + 3][0] == '' or S[h + 3][0] is None)
ok &= good
print(f'1. two shifts, newest first, 00:20 completion filed under 11-25: {good}  {[s25[0], s24[0]]}')

good = s25[1:6] == [2, 50, 25, 30, 'Door 11'] and s25[d11] == 50 and s24[1:6] == [1, 10, 10, 10, 'Door 9']
ok &= good
print(f'2. 11-25: 2 gaps, 50 total, 25 avg, longest 30 on door 11: {good}  {s25[1:6]}')

good = s25[S[h].index('Door 14 (m)')] == 0 and s25[S[h].index('Door 13 (m)')] == 0 and s25[S[h].index('Door 12 (m)')] == 0
ok &= good
print(f'3. blank, over-cap and active rows ignored: {good}')

dh = find('Door') ; r11 = next(r for r in S[dh:] if r[0] == 'Door 11')
title = S[dh - 1][0]
good = r11[1:6] == [2, 50, 25, 30, 25] and 'last 2 shifts' in title
ok &= good
print(f'4. by door (last 2 shifts): door 11 gaps 2, total 50, avg 25, longest 30, 25/shift: {good}  {r11[1:6]}')

good = res['reached'] and res['logged']
ok &= good
print(f'5. a summary error is logged and the main dashboards still run: {good}')

print('\nALL PASS' if ok else '\nFAILURES')
