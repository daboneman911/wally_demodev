"""Onboarding a trailer while the shift is idle offers to start the shift --
once per idle stretch, not on every onboard.
"""
from _boot import boot
from playwright.sync_api import sync_playwright

SHOWN = "()=>getComputedStyle(byId('onboard-start-shift-modal')).display!=='none'"

with sync_playwright() as p:
    b, pg, errs = boot(p)
    ok = True
    pg.evaluate("()=>{shiftState='idle';startPromptShown=false;updateNameplate();}")

    pg.evaluate("()=>maybePromptStartShift('12345')")
    pg.wait_for_timeout(300)
    shown = pg.evaluate(SHOWN)
    sub = pg.eval_on_selector('#onboard-start-sub', 'e=>e.textContent')
    ok &= shown and '12345' in sub
    print(f'prompt on first onboard: {shown}')
    print(f'   names the wally: {"12345" in sub}')
    print(f'   {sub!r}')

    # "Not Yet" dismisses without starting
    pg.click('text=Not Yet'); pg.wait_for_timeout(300)
    st = pg.evaluate("()=>shiftState")
    ok &= (not pg.evaluate(SHOWN)) and st == 'idle'
    print(f'\n"Not Yet" closes and leaves the shift idle: {st == "idle"}')

    # ...and it does not ask again this idle stretch
    pg.evaluate("()=>maybePromptStartShift('67890')")
    pg.wait_for_timeout(300)
    again = pg.evaluate(SHOWN)
    ok &= not again
    print(f'does not re-prompt on the next onboard: {not again}')

    # a running shift never prompts
    pg.evaluate("()=>{startPromptShown=false;shiftState='live';}")
    pg.evaluate("()=>maybePromptStartShift('11111')")
    pg.wait_for_timeout(250)
    ok &= not pg.evaluate(SHOWN)
    print(f'never prompts while a shift is running: {not pg.evaluate(SHOWN)}')

    # ---- accepting starts the shift and keeps the bays ----
    pg.evaluate("()=>{shiftState='idle';startPromptShown=false;doors[9]={status:'active',start:Date.now(),"
                "laborStart:Date.now(),id:'55555',type:'Wally',unloader:'',unavailable:false,"
                "lastCompletionTime:null,assignments:[]};saveDoors();renderDashboard();}")
    pg.evaluate("()=>maybePromptStartShift('55555')")
    pg.wait_for_timeout(300)
    pg.click('text=Start Shift Now')
    pg.wait_for_timeout(500)
    r = pg.evaluate("()=>({state:shiftState,bay:doors[9].status,id:doors[9].id,open:%s})" % SHOWN.split('=>')[1])
    ok &= r['state'] == 'live' and r['bay'] == 'active' and r['id'] == '55555' and not r['open']
    print(f"\naccepting starts the shift: {r['state']}")
    print(f"   the onboarded bay is kept, not cleared: {r['bay']}/{r['id']}")

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
