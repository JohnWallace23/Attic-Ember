"""Build the Listing Desk: eBay and Etsy copy for every unsold piece.

    python tools/listing-desk/build.py

Reads the live listings straight from _products/, so prices, new pieces and
sales are always current. Hand-written titles, tags and item specifics live in
listing_copy.py; a piece with none there yet still appears, with drafted copy and a
flag saying so. Writes tools/listing-desk/out/listing-desk.html (not
committed), which is then published to the same artifact link so the shared
"listed" ticks carry over.

Not part of the website: _config.yml excludes tools/ from the Jekyll build.
"""
import base64, datetime, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from listing_copy import COPY, ETSY_YEAR  # noqa: E402  (the hand-written copy)

FFMPEG = shutil.which("ffmpeg") or r"C:\Users\johnt\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"
SITE = "https://atticandember.com"


def front_matter(path):
    text = open(path, encoding="utf-8").read()
    fm = text.split("---")[1]

    def one(key):
        m = re.search(rf"^{key}:\s*(.+)$", fm, re.M)
        return m.group(1).strip().strip("'\"") if m else ""

    def folded(key):
        m = re.search(rf"^{key}:\s*>-?\s*\n((?:[ \t]+.*\n?)+)", fm, re.M)
        return " ".join(l.strip() for l in m.group(1).splitlines()) if m else one(key)

    return {
        "title": one("title"), "price": one("price"), "era": one("era"), "category": one("category"),
        "sold": one("sold") == "true", "free": one("free_shipping") == "true", "ship": one("shipping"),
        "description": folded("description"), "condition": folded("condition"),
        "images": re.findall(r"^\s+- (/assets/img/\S+)", fm, re.M),
    }


def drafted(p):
    """Serviceable copy for a piece with nothing hand-written in listing_copy.py yet."""
    title = p["title"]
    lead = "" if "vintage" in title.lower() else "Vintage "
    ebay = (lead + title + " Halloween")[:80].rstrip(" ,-")
    etsy = (lead + title + ", " + p["era"] + " Halloween Decor")[:140].rstrip(" ,-")
    era = p["era"].lower()
    tags = ["vintage halloween", "retro halloween", "halloween decor", f"{era} halloween",
            "halloween collector", "spooky decor", "halloween gift", "fall decor", "mantel decor",
            "halloween party", "trick or treat", "autumn decor", "october decor"]
    return ebay, etsy, [t for t in tags if len(t) <= 20][:13], {"Decade": p["era"]}, "Used", [
        "This piece has no hand-written listing copy yet, so these titles and tags were drafted from its "
        "site title. Ask Claude to write proper ones before listing it."]


def thumbnail(src, workdir, slug):
    out = os.path.join(workdir, slug + ".jpg")
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", src, "-vf",
                    "scale=200:200:force_original_aspect_ratio=increase,crop=200:200", "-q:v", "7", out],
                   check=True)
    return "data:image/jpeg;base64," + base64.b64encode(open(out, "rb").read()).decode()


def main():
    products_dir = os.path.join(REPO, "_products")
    pieces, sold, problems = [], [], []
    work = tempfile.mkdtemp()
    for name in sorted(os.listdir(products_dir)):
        if not name.endswith(".md"):
            continue
        slug = name[:-3]
        p = front_matter(os.path.join(products_dir, name))
        if p["sold"]:
            sold.append({"slug": slug, "name": p["title"]})
            continue
        et, yt, tags, spec, cond, flags = COPY.get(slug) or drafted(p)
        for label, text, limit in (("eBay title", et, 80), ("Etsy title", yt, 140)):
            if len(text) > limit:
                problems.append(f"{slug}: {label} is {len(text)}/{limit}")
        if len(tags) != 13 or any(len(t) > 20 for t in tags):
            problems.append(f"{slug}: Etsy needs 13 tags of 20 characters or fewer")

        price = float(p["price"])
        ship = "Free" if p["free"] else (f"${int(float(p['ship']))} flat (oversize box)" if p["ship"] else "$8 flat")
        condition = p["condition"]
        if "Acrylic" in p["title"]:
            # acrylic has no glaze; this line was carried over from a ceramic listing
            condition = condition.replace(" No chips or cracks; glaze bright with no crazing.", " No chips or cracks.")
        desc = (p["description"].strip() + "\n\nCONDITION\n" + condition.strip() + f"\n\nERA\n{p['era']}"
                + "\n\nSHIPPING\nShips within 3 business days. Fragile pieces are double-boxed.")
        thumb = ""
        if p["images"]:
            src = os.path.join(REPO, p["images"][0].lstrip("/").replace("/", os.sep))
            if os.path.exists(src):
                thumb = thumbnail(src, work, slug)

        pieces.append({
            "slug": slug, "name": p["title"], "era": p["era"], "category": p["category"], "price": price,
            "ebayPrice": round(price * 1.15), "etsyPrice": round(price * 1.10), "ship": ship,
            "url": f"{SITE}/shop/{slug}/",
            "ebay": {"title": et, "condition": cond, "specifics": spec, "description": desc},
            "etsy": {"title": yt, "tags": tags, "whenMade": p["era"], "description": desc},
            "flags": [ETSY_YEAR if f == "ETSY_YEAR" else f for f in flags],
            "thumb": thumb,
        })
    shutil.rmtree(work, ignore_errors=True)

    pieces.sort(key=lambda x: -x["price"])
    data = {"updated": datetime.date.today().strftime("%B %-d, %Y") if os.name != "nt"
            else datetime.date.today().strftime("%B %#d, %Y"),
            "pieces": pieces, "sold": sold}
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = open(os.path.join(HERE, "template.html"), encoding="utf-8").read().replace("__DATA__", payload)
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    out = os.path.join(HERE, "out", "listing-desk.html")
    open(out, "w", encoding="utf-8", newline="\n").write(html)

    drafted_slugs = [p["slug"] for p in pieces if p["slug"] not in COPY]
    print(f"{len(pieces)} unsold pieces, {len(sold)} sold, {len(html) // 1024} KB -> {out}")
    print("drafted copy (needs writing):", drafted_slugs or "none")
    print("problems:", problems or "none")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
