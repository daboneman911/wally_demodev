"""Team Management editing: names holding an apostrophe, renaming onto an existing
name, and the backup format gate. All three are regressions found in the v7.08
review -- each failed silently, so every check below asserts the visible symptom
rather than the shape of the fix.

prompt/confirm/alert are stubbed in the page rather than driven through Playwright's
dialog events. editTeamMember() raises a prompt and then a confirm, and a restore
raises its own confirm; an unhandled dialog is auto-dismissed, which silently turns
"the guard refused it" and "nothing got that far" into the same result.
"""
import json, os, tempfile
from _boot import boot
from playwright.sync_api import sync_playwright

QUOTED = "O'Brien"

# answer: what prompt() returns. confirm() always says yes, alerts are collected.
STUB = """(answer)=>{window.__alerts=[];
  window.prompt=()=>answer; window.confirm=()=>true;
  window.alert=(m)=>{window.__alerts.push(String(m))};}"""


def open_team(pg):
    pg.click('#tab-btn-settings'); pg.wait_for_timeout(250)
    if not pg.eval_on_selector('#team-management-list', 'e=>e.children.length'):
        pg.click('text=Team Management')
    pg.wait_for_timeout(400)


def row_for(pg, name):
    return pg.evaluate("""(n)=>[...document.querySelectorAll('#team-management-list .settings-row')]
        .findIndex(r=>r.querySelector('.settings-label').firstChild.textContent.trim()===n)""", name)


def click_icon(pg, idx, sel):
    pg.eval_on_selector_all('#team-management-list .settings-row',
                            '(els,a)=>els[a.i].querySelector(a.sel).click()', {'i': idx, 'sel': sel})
    pg.wait_for_timeout(500)


with sync_playwright() as p:
    b, pg, errs = boot(p)
    ok = True

    # ---- 1. a name with an apostrophe renders, and its buttons still work ----
    pg.evaluate("""(n)=>{if(!teamNames.includes(n))teamNames.push(n);
        refreshTeamNamesSorted();saveTeam();renderTeamManagement();}""", QUOTED)
    open_team(pg)

    idx = row_for(pg, QUOTED)
    ok &= idx > -1
    label = pg.evaluate("""(i)=>i<0?null:document.querySelectorAll('#team-management-list .settings-row')[i]
        .querySelector('.settings-label').firstChild.textContent""", idx)
    ok &= label == QUOTED
    print(f"1. {QUOTED} renders as one intact text node: {label == QUOTED}  (got {label!r})")

    # the regression: the click used to throw a SyntaxError and do nothing at all
    pg.evaluate(STUB, 'Obrien Q')
    click_icon(pg, idx, '.ph-pencil-simple')
    renamed = pg.evaluate("()=>teamNames.includes('Obrien Q')&&!teamNames.includes(\"O'Brien\")")
    ok &= renamed
    print(f"   edit button fires (renamed away): {renamed}")

    pg.evaluate("""(n)=>{teamNames=teamNames.filter(x=>x!=='Obrien Q');
        if(!teamNames.includes(n))teamNames.push(n);
        refreshTeamNamesSorted();saveTeam();renderTeamManagement();}""", QUOTED)
    pg.wait_for_timeout(300)
    click_icon(pg, row_for(pg, QUOTED), '.delete-acct-btn')
    deleted = pg.evaluate("(n)=>!teamNames.includes(n)", QUOTED)
    ok &= deleted
    print(f"   delete button fires: {deleted}")
    print(f"   no console errors from either click: {not errs}  {errs if errs else ''}")
    ok &= not errs

    # ---- 2. renaming onto a name already on the list is refused ----
    pg.evaluate("""()=>{['Alpha One','Beta Two'].forEach(n=>{if(!teamNames.includes(n))teamNames.push(n)});
        refreshTeamNamesSorted();saveTeam();renderTeamManagement();}""")
    pg.evaluate(STUB, 'Beta Two')          # rename Alpha One -> Beta Two
    pg.evaluate("()=>editTeamMember('Alpha One')")
    pg.wait_for_timeout(500)

    c = pg.evaluate("""()=>({beta:teamNames.filter(n=>n==='Beta Two').length,
        alphaKept:teamNames.includes('Alpha One'),
        warned:(window.__alerts||[]).some(m=>/already on the team list/.test(m))})""")
    merge_ok = c['beta'] == 1 and c['alphaKept'] and c['warned']
    ok &= merge_ok
    print(f"\n2. rename onto an existing name refused: {merge_ok}")
    print(f"   'Beta Two' appears {c['beta']}x (1 = no duplicate), "
          f"'Alpha One' untouched: {c['alphaKept']}, warned: {c['warned']}")

    # the duplicate's real cost: two DOP rows mapped to one shared employee object
    dop = pg.evaluate("""()=>{htReconcileRoster();
        const es=hoursState.employees, ids=es.map(e=>e.id);
        return {rows:es.length, uniqueIds:new Set(ids).size,
                uniqueNames:new Set(es.map(e=>e.name)).size,
                sharedObjects:es.length-new Set(es).size};}""")
    dop_ok = (dop['rows'] == dop['uniqueIds'] == dop['uniqueNames']
              and dop['sharedObjects'] == 0)
    ok &= dop_ok
    print(f"   DOP roster has no duplicate or shared rows: {dop_ok}  ({dop})")

    pg.evaluate(STUB, 'Alpha Three')       # a genuine rename must still go through
    pg.evaluate("()=>editTeamMember('Alpha One')")
    pg.wait_for_timeout(500)
    real = pg.evaluate("()=>teamNames.includes('Alpha Three')&&!teamNames.includes('Alpha One')")
    ok &= real
    print(f"   a genuine rename is still allowed: {real}")

    # ---- 3. a backup with no usable format field is refused ----
    # confirm() is stubbed to true above, so anything that clears the version gate
    # WILL overwrite the device -- which is what makes this check meaningful.
    out = tempfile.mkdtemp()
    for name, body in [('no format', {'app': 'wally-dashboard', 'data': {'ps9_team': '["Wiped"]'}}),
                       ('format as text', {'app': 'wally-dashboard', 'format': '1',
                                           'data': {'ps9_team': '["Wiped"]'}})]:
        pg.evaluate(STUB, '')
        f = os.path.join(out, 'b.json'); open(f, 'w').write(json.dumps(body))
        pg.set_input_files('#restore-file-input', f)
        pg.wait_for_timeout(800)
        survived = pg.evaluate("()=>teamNames.includes('Alpha Three')&&!teamNames.includes('Wiped')")
        said_so = pg.evaluate("()=>(window.__alerts||[]).some(m=>/format version/.test(m))")
        ok &= survived and said_so
        print(f"\n3. refused {name:<16} device untouched: {survived}, told the user why: {said_so}")

    good = json.loads(pg.evaluate("()=>JSON.stringify(buildBackup())"))
    num = isinstance(good.get('format'), int)
    ok &= num
    print(f"   a backup this build writes still carries a numeric format: {num} "
          f"(format={good.get('format')!r})")

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
