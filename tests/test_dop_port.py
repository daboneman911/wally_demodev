"""DOP port (docs/dop-port/PLAN.md).

Section 1, plan picker (v7.28):
1. Five plan buttons 5/2..9/2 in order, no *peak note.
2. Each sets dopConfig and the active button.
3. DOP is MET at exactly 1 + 2 + N staffed for every plan, DOWN below, OVER above.
4. An unknown saved plan falls back to 6.
5. The picker fits a 375px screen with no sideways scroll.
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

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', [e for e in errs if 'ERR_TUNNEL' not in e] or 'none')
    b.close()
