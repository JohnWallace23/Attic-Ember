"""Check the site the way most shoppers see it: as an iPhone, in WebKit (Safari's engine).

    python tools/mobile-check/mobile_test.py                      # the live site
    python tools/mobile-check/mobile_test.py http://127.0.0.1:4000  # a local preview

Needs Playwright with WebKit, once:  pip install playwright && python -m playwright install webkit

Walks the cat through the moon and back, taps it, checks nothing pushes any page
sideways, taps the shop filters, a product's photos and video, and the cart and
checkout (pickup included), and flags iPhone-specific trouble: text boxes under
16px (Safari zooms in on them) and buttons under 40px tall. Screenshots land in
tools/mobile-check/out/ (not committed). Places no orders.

Not part of the website: tools/ is excluded from the Jekyll build.
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://atticandember.com").rstrip("/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
os.makedirs(OUT, exist_ok=True)
report = []


def note(area, ok, detail):
    report.append((area, ok, detail))
    print(f"  {'OK ' if ok else 'BAD'} {area:28} {detail}")


def overflow(page):
    return page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")


def cat_state(page):
    return page.evaluate("""() => {
      const c = document.querySelector('.page-cat');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { parent: c.parentElement.className || c.parentElement.tagName, seated: c.classList.contains('seated'),
               walking: c.classList.contains('walking'), pos: getComputedStyle(c).position,
               left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom),
               vw: innerWidth, vh: innerHeight };
    }""")


with sync_playwright() as p:
    device = p.devices["iPhone 13"]
    browser = p.webkit.launch()
    ctx = browser.new_context(**device)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # "[Report Only]" lines come from Cloudflare's Script Monitor, which on a
    # sample of page loads asks the browser to report every script it loads.
    # It never blocks anything, so it isn't an error here.
    page.on("console", lambda m: errors.append(m.text)
            if m.type == "error" and not m.text.startswith("[Report Only]") else None)

    # ---------------- homepage + cat ----------------
    print("HOMEPAGE (iPhone 13, WebKit)")
    page.goto(BASE + "/?v=" + str(int(time.time())), wait_until="networkidle")
    page.wait_for_timeout(1500)
    note("page width", overflow(page) <= 0, f"sideways overflow {overflow(page)}px")
    g = page.evaluate("() => { const s = document.querySelector('.garland svg'); return s ? s.getBoundingClientRect().width : null }")
    note("garland", g is not None and g <= device["viewport"]["width"] + 1, f"width {g} of {device['viewport']['width']}")
    page.screenshot(path=os.path.join(OUT, "m-home-top.png"))
    s0 = cat_state(page)
    note("cat at load", s0 is not None, json.dumps(s0))

    # bring the moon fully into view: cat should hop into it
    page.evaluate("() => document.querySelector('.hero-art').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(2500)
    s1 = cat_state(page)
    note("cat with moon in view", bool(s1 and s1["seated"]), json.dumps(s1))
    page.screenshot(path=os.path.join(OUT, "m-home-moon.png"))

    # tap the seated cat: a speech bubble should appear, inside the screen
    page.tap(".page-cat")
    page.wait_for_timeout(400)
    b = page.evaluate("""() => { const b = document.querySelector('.cat-bubble');
       const r = b.getBoundingClientRect();
       return { shown: b.classList.contains('show'), text: b.textContent, left: Math.round(r.left), right: Math.round(r.right) } }""")
    note("tap seated cat", b["shown"] and b["left"] >= 0 and b["right"] <= device["viewport"]["width"], json.dumps(b))

    # scroll well past the moon: cat should leap down and walk the bottom
    page.evaluate("() => window.scrollTo(0, document.body.scrollHeight * 0.5)")
    page.wait_for_timeout(3500)
    s2 = cat_state(page)
    on_screen = s2 and s2["left"] >= 0 and s2["right"] <= s2["vw"] and s2["bottom"] <= s2["vh"] and s2["top"] >= 0
    note("cat after scrolling down", bool(s2 and not s2["seated"] and s2["pos"] == "fixed" and on_screen), json.dumps(s2))
    page.tap(".page-cat")
    page.wait_for_timeout(400)
    b2 = page.evaluate("""() => { const b = document.querySelector('.cat-bubble'); const r = b.getBoundingClientRect();
       return { shown: b.classList.contains('show'), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) } }""")
    note("tap walking cat", b2["shown"] and b2["left"] >= 0 and b2["right"] <= device["viewport"]["width"], json.dumps(b2))
    page.screenshot(path=os.path.join(OUT, "m-home-ground.png"))
    # what does the walking cat sit on top of? (it can block taps on whatever is underneath)
    under = page.evaluate("""() => { const c = document.querySelector('.page-cat'); const r = c.getBoundingClientRect();
       c.style.visibility = 'hidden';
       const hits = [[r.left + r.width/2, r.top + r.height/2], [r.left + 8, r.bottom - 8], [r.right - 8, r.bottom - 8]]
         .map(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('a,button,input,label,select') ? e.closest('a,button,input,label,select').outerHTML.slice(0, 80) : null) : null });
       c.style.visibility = ''; return hits.filter(Boolean) }""")
    # Known and accepted (John, 2026-10-14): the walking cat can sit over a link
    # and take the tap. Reported, not counted as a failure.
    print(f"  --  cat covering a control       {json.dumps(under) if under else 'nothing tappable underneath'} (accepted)")

    # back up: cat should return to the moon
    page.evaluate("() => document.querySelector('.hero-art').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(2500)
    s3 = cat_state(page)
    note("cat returns to moon", bool(s3 and s3["seated"]), json.dumps(s3))

    # ---------------- shop ----------------
    print("SHOP")
    page.goto(BASE + "/shop/", wait_until="networkidle")
    page.wait_for_timeout(800)
    note("shop width", overflow(page) <= 0, f"sideways overflow {overflow(page)}px")
    total = page.evaluate("() => [...document.querySelectorAll('.grid .card')].filter(c => c.offsetParent).length")
    page.tap('button[data-kind="Costumes"]')
    page.wait_for_timeout(300)
    shown = page.evaluate("() => [...document.querySelectorAll('.grid .card')].filter(c => c.offsetParent).length")
    note("tap 'Costumes' filter", 0 < shown < total, f"{total} cards -> {shown}")
    page.tap('button[data-kind="all"]')
    small = page.evaluate("""() => [...document.querySelectorAll('.filter-chip, .add-btn, .cart-stamp, .sound-toggle')]
       .filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0,18), Math.round(r.width), Math.round(r.height)] })
       .filter(([t, w, h]) => h < 40)""")
    note("tap targets under 40px tall", len(small) == 0, f"{len(small)} small: " + json.dumps(small[:6]))
    page.screenshot(path=os.path.join(OUT, "m-shop.png"))

    # ---------------- product page ----------------
    print("PRODUCT PAGE")
    page.goto(BASE + "/shop/sonic-flying-vampire/", wait_until="networkidle")
    page.wait_for_timeout(800)
    note("product width", overflow(page) <= 0, f"sideways overflow {overflow(page)}px")
    first = page.evaluate("() => document.getElementById('main-photo').src")
    thumbs = page.locator(".thumb[data-type='image']")
    if thumbs.count() > 1:
        thumbs.nth(1).tap(); page.wait_for_timeout(400)
    second = page.evaluate("() => document.getElementById('main-photo').src")
    note("tap a photo thumbnail", first != second, f"{first.split('/')[-1]} -> {second.split('/')[-1]}")
    vt = page.locator(".thumb--video")
    if vt.count():
        vt.first.tap(); page.wait_for_timeout(800)
        v = page.evaluate("""() => { const v = document.getElementById('main-video');
           return { visible: !v.hidden, playsinline: v.playsInline, src: (v.currentSrc || v.src).split('/').pop(), ready: v.readyState } }""")
        note("tap the video thumbnail", v["visible"] and v["playsinline"], json.dumps(v))

    # ---------------- cart + checkout ----------------
    print("CART + CHECKOUT")
    page.tap(".product-info .add-to-cart")
    page.wait_for_timeout(500)
    note("add to cart opens drawer", page.evaluate("() => !document.querySelector('.cart-drawer').hidden"), "")
    page.screenshot(path=os.path.join(OUT, "m-cart.png"))
    page.tap(".cart-checkout"); page.wait_for_timeout(400)
    zoomy = page.evaluate("""() => [...document.querySelectorAll('.order-form input:not([type=radio]):not([type=checkbox]), .order-form textarea')]
       .filter(e => e.offsetParent).map(e => [e.name, parseFloat(getComputedStyle(e).fontSize)]).filter(([n, s]) => s < 16)""")
    note("text boxes 16px+ (no iOS zoom)", len(zoomy) == 0, json.dumps(zoomy) if zoomy else "all 16px or larger")
    page.tap('label.ship-choice:has(input[value="pickup"])'); page.wait_for_timeout(300)
    pk = page.evaluate("""() => ({ total: document.querySelector('.co-total').textContent.replace(/\\s+/g,' ').trim(),
        addressHidden: document.querySelector('.ship-fields').hidden })""")
    note("tap 'Pick up in Chicago'", pk["addressHidden"], json.dumps(pk))
    page.screenshot(path=os.path.join(OUT, "m-checkout.png"), full_page=False)
    note("checkout width", overflow(page) <= 0, f"sideways overflow {overflow(page)}px")

    note("script errors", len(errors) == 0, json.dumps(errors[:5]) if errors else "none")
    browser.close()

bad = [r for r in report if not r[1]]
print(f"\n{len(report) - len(bad)}/{len(report)} passed")
