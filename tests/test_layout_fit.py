"""Dashboard must fit without scrolling, and bays must clear the tab bar.

Headless Chromium reports env(safe-area-inset-*) as 0, so the real iPhone insets
are injected -- otherwise this passes locally and fails on the device.
"""
import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

INJECT = ":root{--safe-top:59px!important;--safe-bottom:34px!important}"
DEVICES = [('16 Pro Max', 440, 932), ('16 Pro', 402, 874),
           ('15/14 Pro', 393, 852), ('13 mini', 375, 812)]

with sync_playwright() as p:
    b = p.chromium.launch()
    ok = True
    for name, w, h in DEVICES:
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.goto(f'http://localhost:{PORT}/index.html')
        pg.wait_for_selector('text=Home', timeout=10000)
        pg.add_style_tag(content=INJECT)
        pg.wait_for_timeout(350)
        m = pg.evaluate("""()=>{const el=document.getElementById('tab-dashboard');
            const bays=document.getElementById('open-bays-grid').getBoundingClientRect();
            const bar=document.querySelector('.tab-bar').getBoundingClientRect();
            return {over: el.scrollHeight-el.clientHeight,
                    baysBottom:Math.round(bays.bottom), barTop:Math.round(bar.top)};}""")
        clear = m['barTop'] - m['baysBottom']
        scrolls = m['over'] > 0
        hidden = clear < 0
        ok &= not scrolls and not hidden
        state = ('SCROLLS +%dpx' % m['over']) if scrolls else 'fits'
        bays = ('BEHIND BAR %dpx' % -clear) if hidden else ('%dpx clear' % clear)
        print(f'{name:12s} {w}x{h}  {state:16s}  bays {bays}')
        pg.close()
    b.close()
    print('\nALL PASS' if ok else '\nFAILURES')
