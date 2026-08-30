import os
PORT = os.environ.get('WALLY_TEST_PORT', '8899')
from playwright.sync_api import sync_playwright

def boot(p, w=393, h=852):
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": w, "height": h})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.goto(f"http://localhost:{PORT}/index.html")
    pg.wait_for_selector("text=Home", timeout=10000)
    pg.evaluate("()=>{window.obsValidateAgainstDOP=()=>false;}")
    pg.wait_for_timeout(300)
    return b, pg, errs

