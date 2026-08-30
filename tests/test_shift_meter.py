"""The Start Shift pill transforms into the hours/PPH meter when live, and the
meter opens the mid-shift menu.
"""
from _boot import boot
from playwright.sync_api import sync_playwright

VIS = "(id)=>{const e=byId(id);return e?getComputedStyle(e).display!=='none':null}"

with sync_playwright() as p:
    b, pg, errs = boot(p)
    ok = True

    pg.evaluate("()=>{shiftState='idle';updateNameplate();}")
    pg.wait_for_timeout(250)
    btn = pg.evaluate(VIS, 'btn-shift-action')
    meter = pg.evaluate(VIS, 'nameplate-hours')
    lbl = pg.eval_on_selector('#btn-shift-label', 'e=>e.textContent')
    ok &= btn and not meter and lbl == 'Start Shift'
    print(f'idle: button {lbl!r} visible={btn}, meter hidden={not meter}')

    # ---- go live: the pill becomes the meter ----
    pg.evaluate("()=>{confirmStartShift(false);}")
    pg.wait_for_timeout(500)
    btn = pg.evaluate(VIS, 'btn-shift-action')
    meter = pg.evaluate(VIS, 'nameplate-hours')
    ok &= meter and not btn
    print(f'live: meter visible={meter}, start button hidden={not btn}')

    # green ring while live, and no separate "SHIFT LIVE" chip
    # the green ring is the meter's own border plus the .visible glow animation
    ring = pg.evaluate("""()=>{const m=byId('nameplate-hours'),s=getComputedStyle(m);
        const g=getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim();
        const probe=document.createElement('div');probe.style.color=g;document.body.appendChild(probe);
        const want=getComputedStyle(probe).color;probe.remove();
        return {border:s.borderTopColor, green:want, glow:s.animationName,
                visible:m.classList.contains('visible')};}""")
    green_ring = ring['border'] == ring['green'] and ring['visible'] and ring['glow'] != 'none'
    ok &= green_ring
    print(f"   green ring while live: {green_ring}  ({ring['border']}, glow {ring['glow']})")

    # it keeps the pill shape of the button it replaced
    shape = pg.evaluate("""()=>{const m=byId('nameplate-hours');const s=getComputedStyle(m);
        const r=m.getBoundingClientRect();
        return {radius:s.borderRadius,w:Math.round(r.width),h:Math.round(r.height)};}""")
    ok &= shape['w'] > shape['h']
    print(f"   pill shape kept: {shape['w']}x{shape['h']}, radius {shape['radius']}")

    # both lines present, PPH beneath hours and smaller
    sizes = pg.evaluate("""()=>{const h=byId('nameplate-hours-val'),p=byId('nameplate-pph-val');
        return {h:parseFloat(getComputedStyle(h).fontSize),p:parseFloat(getComputedStyle(p).fontSize),
                hy:h.getBoundingClientRect().top,py:p.getBoundingClientRect().top};}""")
    ok &= sizes['py'] > sizes['hy'] and sizes['p'] <= sizes['h']
    print(f"   PPH sits below hours and is not larger: {sizes['py'] > sizes['hy'] and sizes['p'] <= sizes['h']}")

    # ---- tapping the meter opens the mid-shift menu ----
    pg.click('#nameplate-hours')
    pg.wait_for_timeout(350)
    open_ = pg.evaluate(VIS, 'shift-menu-modal')
    ok &= open_
    print(f'\ntapping the meter opens the shift menu: {open_}')
    txt = pg.eval_on_selector('#shift-menu-modal', 'e=>e.textContent')
    has = 'End Shift' in txt and ('Breakdown' in txt or 'breakdown' in txt)
    ok &= has
    print(f'   menu offers End Shift and a breakdown: {has}')

    # breakdown lands on the DOP tab
    pg.click('text=View Breakdown')
    pg.wait_for_timeout(450)
    tab = pg.evaluate("()=>{const t=document.querySelector('#tab-hours');"
                      "return t?getComputedStyle(t).display!=='none':null}")
    ok &= tab
    print(f'   View Breakdown goes to DOP: {tab}')

    # ---- ending the shift restores the button ----
    pg.evaluate("()=>{confirmEndShift(true);}")
    pg.wait_for_timeout(500)
    back = pg.evaluate(VIS, 'btn-shift-action')
    print(f'\nafter End Shift the start button is back: {back}')
    ok &= back is True

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
