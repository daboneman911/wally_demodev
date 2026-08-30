"""PPH Calculator: rate = volume / hours, measured against a 500 target."""
from _boot import boot
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b, pg, errs = boot(p)
    ok = True

    tgt = pg.evaluate("()=>PPH_TARGET")
    ok &= tgt == 500
    print(f'PPH_TARGET = {tgt}')

    pg.evaluate("()=>openPPHCalculator()")
    pg.wait_for_timeout(300)
    lbl = pg.eval_on_selector('#pph-target-lbl', 'e=>e.textContent')
    ok &= lbl == '500'
    print(f'target shown in the sheet: {lbl}')

    print(f"\n{'volume':>8} {'hours':>6} {'pph':>6} {'diff':>9}  expect")
    for vol, hrs, pph, diff in [(5000, 10, 500, '0.00'), (6000, 10, 600, '-2.00'),
                                (4000, 10, 400, '+2.00'), (1000, 2.5, 400, '+0.50')]:
        pg.fill('#pph-volume', str(vol)); pg.fill('#pph-hours', str(hrs))
        pg.evaluate("()=>calculatePPH()")
        r = pg.evaluate("()=>({p:byId('pph-result').innerText,d:byId('pph-diff').innerText,"
                        "c:byId('pph-diff').className})")
        good = r['p'] == str(pph) and r['d'] == diff + ' hrs'
        # at or under target = you are ahead ('under' = under the hours budget)
        cls_ok = ('under' in r['c']) == (pph >= 500)
        ok &= good and cls_ok
        print(f"{vol:>8} {hrs:>6} {r['p']:>6} {r['d']:>9}  {pph} / {diff}  {'OK' if good and cls_ok else 'FAIL'}")

    # invalid input must not divide by zero
    for vol, hrs in [('', '10'), ('5000', '0'), ('5000', '')]:
        pg.fill('#pph-volume', vol); pg.fill('#pph-hours', hrs)
        pg.evaluate("()=>calculatePPH()")
        r = pg.evaluate("()=>byId('pph-result').innerText")
        ok &= r == '0'
        print(f'volume={vol!r} hours={hrs!r} -> {r!r} (no NaN/Infinity): {r == "0"}')

    print('\nALL PASS' if ok else '\nFAILURES')
    print('errors:', errs if errs else 'none')
    b.close()
