"""DOP port (docs/dop-port/PLAN.md).

Section 1, plan picker (v7.28):
1. Five plan buttons 5/2..9/2 in order, no *peak note.
2. Each sets dopConfig and the active button.
3. DOP is MET at exactly 1 + 2 + N staffed for every plan, DOWN below, OVER above.
4. An unknown saved plan falls back to 6.
5. The picker fits a 375px screen with no sideways scroll.

Section 2, final roster (v7.29):
6. A device on the old roster (every step up to v717 run) holding DOP hours, a role
   flag, an observation, a log and an active trailer under the old names comes through
   the update with all of it under the new names; Arce J and Evan are gone; Jeremiah is
   a Double (permanent, not core); a Double hand-flagged core is reset; the observation
   pool is exactly the 9 core; nothing is re-posted to the sheet.
"""
from _boot import boot
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b, pg, errs = boot(p, 375, 812)
    ok = True
    pg.evaluate("()=>{window.confirm=()=>true;window.alert=()=>{};confirmStartShift(false);switchTab('hours')}")
    pg.wait_for_timeout(300)

    # 1. buttons
    btns = pg.eval_on_selector_all('.ht-dop-toggle .ht-dop-btn', 'bs=>bs.map(b=>[b.id,b.textContent.trim()])')
    want = [[f'ht-dop{n}', f'{n}/2'] for n in range(5, 10)]
    good = btns == want and 'peak' not in pg.inner_text('.ht-dop-toggle').lower()
    ok &= good
    print(f'1. five buttons 5/2..9/2, no *peak: {good}  {[t for _, t in btns]}')

    # 2 + 3. each plan: active button, MET at 1+2+N
    for n in range(5, 10):
        pg.click(f'#ht-dop{n}'); pg.wait_for_timeout(80)
        cfg = pg.evaluate("()=>hoursState.dopConfig")
        active = pg.eval_on_selector_all('.ht-dop-btn.active', 'bs=>bs.map(b=>b.id)')
        states = pg.evaluate("""(need)=>{const res={};
            hoursState.employees.forEach(e=>{e.status='inactive';e.startTime=null});
            const ids=hoursState.employees.map(e=>e.id);
            [need-1,need,need+1].forEach(k=>{
              hoursState.employees.forEach(e=>{e.status='inactive'});
              ids.slice(0,k).forEach(id=>{const e=hoursState.employees.find(x=>x.id===id);e.status='active';e.startTime=new Date()});
              htAssignRoles();res[k]=htCalcDOP().dopState});
            return res}""", 3 + n)
        good = cfg == n and active == [f'ht-dop{n}'] and \
            states == {str(2 + n): 'low', str(3 + n): 'met', str(4 + n): 'over'}
        ok &= good
        print(f'2/3. {n}/2: dopConfig {cfg}, active {active}, low/met/over at {2+n}/{3+n}/{4+n}: {good}')

    # 4. bad saved value -> 6
    pg.evaluate("()=>{const s=JSON.parse(localStorage.getItem('ps9_v4'));s.dopConfig=12;localStorage.setItem('ps9_v4',JSON.stringify(s))}")
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(300)
    cfg = pg.evaluate("()=>hoursState.dopConfig")
    pg.evaluate("()=>htSetDOP(4)")
    still = pg.evaluate("()=>hoursState.dopConfig")
    good = cfg == 6 and still == 6
    ok &= good
    print(f'4. saved plan 12 -> {cfg}; htSetDOP(4) ignored ({still}): {good}')

    # 5. fits 375px
    pg.evaluate("()=>switchTab('hours')"); pg.wait_for_timeout(250)
    m = pg.evaluate("""()=>{const t=document.querySelector('.ht-dop-toggle').getBoundingClientRect();
        return {right:t.right,left:t.left,vw:document.documentElement.clientWidth,
                over:document.documentElement.scrollWidth-document.documentElement.clientWidth}}""")
    good = m['left'] >= 0 and m['right'] <= m['vw'] and m['over'] <= 0
    ok &= good
    print(f"5. picker fits 375px (left {m['left']:.0f}, right {m['right']:.0f}, overflow {m['over']}): {good}")

    # 6. roster migration on an old device
    OLD = ['Robert W','Matt R','Lorena R','Russell H','Trevon C','David F','Arce J','Eddie F',
           'Luis','Elliot','Solis','Damian','Johnny','Evan']
    CORE9 = ['Robert','Matt','Lorena','Russell','Tre','David','Eddie','Luis','Elliot']
    pg.evaluate("""(old)=>{
        localStorage.setItem('ps9_team',JSON.stringify(old));
        ['ps9_roster_v7','ps9_roster_v708','ps9_roster_v714','ps9_roster_v715','ps9_roster_v717'].forEach(k=>localStorage.setItem(k,'1'));
        localStorage.removeItem('ps9_roster_v729');
        localStorage.setItem('ps9_roster_flags',JSON.stringify({'Trevon C':{core:true,permanent:true},'Solis':{core:true,permanent:true}}));
        // DOP hours: Robert W cut with 2.5 h banked, Matt R active
        const s=JSON.parse(localStorage.getItem('ps9_v4'));
        s.employees=old.map((n,i)=>({id:i+1,name:n,status:'inactive',startTime:null,frozenHours:0,pausedMs:0,role:null}));
        Object.assign(s.employees[0],{status:'cut',frozenHours:2.5,cutTime:new Date().toISOString()});
        Object.assign(s.employees[1],{status:'active',startTime:new Date(Date.now()-3600000).toISOString()});
        s.nextId=old.length+1;localStorage.setItem('ps9_v4',JSON.stringify(s));
        const k=obsTodayKey();localStorage.setItem('ps9_observations',JSON.stringify({assignments:{[k]:{name:'Robert W',status:'done',cycle:1,auto:false}},cycle:1}));
        const now=Date.now();
        localStorage.setItem('ps9_history',JSON.stringify([{door:9,id:'MIG1',type:'Wally',unloader:'Robert W',assistants:['Matt R'],
            start:now-600000,laborStart:now-600000,end:now,dateKey:dateKeyFromTs(now),duration:600000,durationMinutes:10,statOffset:0,
            logId:'mig1',completionHour:1,shiftKey:currentShiftKey(),cpuOptions:[],status:'completed'}]));
        const d=JSON.parse(localStorage.getItem('ps9_doors'));
        d[10]={status:'active',start:now,laborStart:now,id:'MIG2',type:'Wally',unloader:'David F',unavailable:false,
               lastCompletionTime:null,assignments:[{name:'David F',start:now,end:null}],logId:'mig2'};
        localStorage.setItem('ps9_doors',JSON.stringify(d));
        localStorage.setItem('ps9_webhook_queue','[]');
    }""", OLD)
    pg.reload(); pg.wait_for_selector('text=Home', timeout=10000); pg.wait_for_timeout(400)
    r = pg.evaluate("""()=>{const emp=n=>hoursState.employees.find(e=>e.name===n);
        return {team:teamNames.slice(),
          robert:emp('Robert')&&{status:emp('Robert').status,h:emp('Robert').frozenHours},
          matt:emp('Matt')&&emp('Matt').status,
          oldInDop:hoursState.employees.filter(e=>/ [A-Z]$/.test(e.name)||e.name==='Arce J'||e.name==='Evan').map(e=>e.name),
          flags:getRosterFlags(),
          tre:{core:isPS9Core('Tre'),perm:isPermanentMember('Tre')},
          jer:{core:isPS9Core('Jeremiah'),perm:isPermanentMember('Jeremiah')},
          obs:obsState.assignments[obsTodayKey()].name,
          log:[historyLog[0].unloader,historyLog[0].assistants[0]],
          door:[doors[10].unloader,doors[10].assignments[0].name],
          pool:obsEligible(),
          queued:JSON.parse(localStorage.getItem('ps9_webhook_queue')||'[]').length,
          step:localStorage.getItem('ps9_roster_v729')}}""")
    team_ok = r['team'] == CORE9[:6] + ['Eddie','Luis','Elliot','Solis','Damian','Johnny','Jeremiah'] or \
        sorted(r['team']) == sorted(CORE9 + ['Solis','Damian','Johnny','Jeremiah'])
    checks = {
        'team is the final 13': team_ok,
        'Robert keeps 2.5 h (cut)': r['robert'] == {'status': 'cut', 'h': 2.5},
        'Matt still active': r['matt'] == 'active',
        'no old names in DOP': r['oldInDop'] == [],
        'Tre carries the core flag': 'Tre' in r['flags'] and 'Trevon C' not in r['flags'] and r['tre'] == {'core': True, 'perm': True},
        'Double flagged core is reset': 'Solis' not in r['flags'],
        'Jeremiah permanent, not core': r['jer'] == {'core': False, 'perm': True},
        'observation follows': r['obs'] == 'Robert',
        'log follows': r['log'] == ['Robert', 'Matt'],
        'active trailer follows': r['door'] == ['David', 'David'],
        'pool is exactly the 9 core': r['pool'] == CORE9,
        'nothing re-posted': r['queued'] == 0,
        'step recorded': r['step'] == '1'}
    for k, v in checks.items():
        ok &= v
    good = all(checks.values())
    print(f"6. roster migration: {good}")
    for k, v in checks.items():
        print(f"   {k}: {v}")
    if not good:
        print('  ', r)

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', [e for e in errs if 'ERR_TUNNEL' not in e] or 'none')
    b.close()
