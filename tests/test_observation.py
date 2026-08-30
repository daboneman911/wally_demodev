import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')


def today(pg):
    return pg.evaluate("()=>{const t=obsToday();return t?{name:t.name,status:t.status,auto:!!t.auto,skipped:t.skipped||[]}:null}")


def reset(pg):
    pg.evaluate("()=>{obsState={assignments:{},cycle:1};saveObsState();obsEnsureToday();obsRenderAll();}")


def _chk(ok, checks, val):
    checks.append(bool(val))
    return ok and bool(val)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 393, 'height': 852})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.goto(f'http://localhost:{PORT}/index.html')
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.wait_for_timeout(400)
    ok = True
    checks = []

    # ---- 1. rotation draws from the fixed pool, not the whole roster ----
    pool = pg.evaluate("()=>obsEligible()")
    team = pg.evaluate("()=>teamNames.length")
    expect = ['Robert W', 'Matt R', 'Lorena R', 'Russell H', 'Trevon C', 'David F', 'Arce J', 'Fonseca J', 'Eddie F']
    ok = _chk(ok, checks, pool == expect)
    print(f'1. pool = {len(pool)} of {team} on the team: {pool == expect}')

    # ---- 2. one per day, rotating in order, no repeats within a cycle ----
    reset(pg)
    picks = pg.evaluate("""()=>{const out=[];
        for(let i=0;i<11;i++){
            const d=new Date(); d.setDate(d.getDate()+i);
            const key=dateKeyFromTs(d.getTime());
            const name=obsPickNext();
            obsState.assignments[key]={name,status:'done',cycle:obsState.cycle,auto:false};
            out.push(name);
        }
        return out;}""")
    n = len(expect)
    firstN = picks[:n]
    ok = _chk(ok, checks, len(set(firstN)) == n)
    print(f'2. first {n} days, all distinct: {len(set(firstN)) == n}')
    print(f'   {" -> ".join(firstN)}')
    print(f'   next day (cycle restarts): {picks[n:]}')

    # ---- 3. skip defers rather than completes ----
    reset(pg)
    before = today(pg)['name']
    pg.evaluate("()=>obsSkip()")
    after = today(pg)
    deferred = pg.evaluate("(n)=>obsEligible().includes(n)&&!obsCompletedThisCycle().includes(n)", before)
    ok = _chk(ok, checks, after['name'] != before and before in after['skipped'] and deferred)
    print(f"3. skip: {before} -> {after['name']}; {before} still owed: {deferred}")

    # ---- 4. DOP reassignment when the pick isn't clocked in ----
    reset(pg)
    target = today(pg)['name']
    swapped = pg.evaluate("""(target)=>{
        htSyncFromWallyShift();
        hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null;});
        // staff to DOP (the reassignment only fires once every position is filled),
        // deliberately WITHOUT the observee
        const need=1+2+hoursState.dopConfig;
        const others=hoursState.employees.filter(e=>e.name!==target).slice(0,need);
        others.forEach(e=>{htActivateEmployee(e.id); e.startTime=new Date(Date.now()-3600000);});
        htSaveState();
        return obsValidateAgainstDOP();}""", target)
    pg.wait_for_timeout(400)
    after = today(pg)
    modal = pg.eval_on_selector('#obs-swap-modal', "e=>getComputedStyle(e).display!=='none'")
    active = pg.evaluate("()=>obsActiveNames()")
    reassigned = after['name'] != target
    ok = _chk(ok, checks, reassigned and after['auto'] and after['name'] in active and modal)
    print(f'   (fired automatically on clock-in; explicit re-check returned {swapped})')
    print(f'4. {target} not clocked in -> reassigned to {after["name"]} (auto={after["auto"]})')
    print(f'   new pick is actually on the clock: {after["name"] in active}')
    print(f'   popup shown: {modal}')
    print(f'   message: {pg.eval_on_selector("#obs-swap-text","e=>e.textContent")}')
    pg.screenshot(path=f'{SHOT}/obs_swap.png')
    pg.click("#obs-swap-modal >> text=Got It")
    pg.wait_for_timeout(300)

    # ---- 5. no reassignment when the pick IS clocked in ----
    cur = today(pg)['name']
    again = pg.evaluate("()=>obsValidateAgainstDOP()")
    ok = _chk(ok, checks, (again is False) and today(pg)['name'] == cur)
    print(f'5. pick is on the clock -> left alone: {again is False}')

    # ---- 6. manual override ----
    pg.evaluate("()=>obsSetManual('Jarrett')")
    ok = _chk(ok, checks, today(pg)['name'] == 'Jarrett')
    print(f"6. manual override to someone outside the pool: {today(pg)['name'] == 'Jarrett'}")

    # ---- 7. mark observed, and it shows on the dashboard ----
    pg.evaluate("()=>obsMarkDone()")
    pg.wait_for_timeout(300)
    line = pg.eval_on_selector('#nameplate-obs', 'e=>e.textContent.trim()')
    done_cls = pg.eval_on_selector('#nameplate-obs', "e=>e.classList.contains('done')")
    ok = _chk(ok, checks, today(pg)['status'] == 'done' and 'Jarrett' in line and done_cls)
    print(f'7. marked observed; dashboard reads {line!r}, done styling: {done_cls}')

    # ---- 8. survives reload ----
    pg.reload()
    pg.wait_for_selector('text=Home', timeout=10000)
    pg.wait_for_timeout(400)
    persisted = today(pg)
    ok = _chk(ok, checks, persisted['name'] == 'Jarrett' and persisted['status'] == 'done')
    print(f'8. after reload: {persisted["name"]} / {persisted["status"]}')

    print()
    for i,v in enumerate(checks,1):
        print(f'   check {i}: {"pass" if v else "FAIL"}')
    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
