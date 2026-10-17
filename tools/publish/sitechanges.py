"""Put the price changes and bundle deals John confirmed in the sourcing app into the shop folder.

The sourcing app writes %LOCALAPPDATA%\\AtticEmberSourcing\\site_changes.json (it's the only
writer). This module only reads it, and can only ever touch two things in the shop:

  - the `price:` line of _products/<slug>.md, for a pending price change, and only when
    the product exists, isn't sold or a draft, and its price is still the one the app
    saw (`was`). If the price was changed some other way since, that's a conflict: it's
    skipped and reported, never overwritten.
  - _data/bundles.yml, rewritten as exactly the pending/live bundles whose pieces all
    exist unsold, priced above zero and below what the pieces cost separately.

Everything the app sends is checked again here. Costs are never in that file, and
nothing from it is written except slugs, ids and prices. No git, no network: publish.py
and autosync.py decide what to do with the files this changes.
"""
import json
import os
import re
from datetime import datetime
from pathlib import Path

CHANGES = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "AtticEmberSourcing" / "site_changes.json"
STATE_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "AtticEmberShop"
RESULT = STATE_DIR / "site_changes_result.json"
SWITCH = STATE_DIR / "autopublish.json"

SLUG = re.compile(r"^[a-z0-9-]{1,80}$")
CHANGE_ID = re.compile(r"^[pb]-[0-9a-f]{4,40}$")
BUNDLES_FILE = "_data/bundles.yml"
HEADER = ("# Written by the sourcing app's Bundle button; edits here are overwritten.\n"
          "# Each bundle is a buy-together discount: every piece stays listed on its own.\n")


def autopublish_on():
    """John's switch for letting the background task publish confirmed changes by itself."""
    try:
        return json.loads(SWITCH.read_text(encoding="utf-8")).get("enabled") is True
    except (OSError, ValueError, AttributeError):
        return False


def load(path=CHANGES):
    """The app's queued changes, or [] if there's no file or it isn't what we expect."""
    try:
        if path.stat().st_size > 1_000_000:
            return []
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if not isinstance(data, dict) or data.get("version") != 1 or not isinstance(data.get("changes"), list):
        return []
    return [c for c in data["changes"] if isinstance(c, dict)]


def queued(changes):
    """Changes still waiting to reach the site (a price not yet applied, a bundle not yet live)."""
    return [c for c in changes if c.get("status") == "pending" and c.get("kind") in ("price", "bundle")]


def _money(x):
    try:
        v = round(float(x), 2)
    except (TypeError, ValueError):
        return None
    return v if 1 <= v <= 10000 else None


def _product(repo, slug):
    """(path, raw text, front matter) for an existing product file with exactly this name, else None."""
    if not isinstance(slug, str) or not SLUG.match(slug):
        return None
    folder = repo / "_products"
    try:
        if slug + ".md" not in os.listdir(folder):
            return None
    except OSError:
        return None
    path = folder / (slug + ".md")
    raw = path.read_bytes().decode("utf-8")
    m = re.match(r"\A﻿?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(\r?\n|\Z)", raw, re.S)
    return (path, raw, m.group(1)) if m else None


def _field(fm, name):
    m = re.search(r"^" + name + r":[ \t]*([^\r\n]*)", fm, re.M)
    return m.group(1).strip().strip("\"'") if m else None


def _for_sale(fm):
    return (_field(fm, "sold") or "").lower() != "true" and (_field(fm, "draft") or "").lower() != "true"


def _price(fm):
    try:
        return round(float(_field(fm, "price")), 2)
    except (TypeError, ValueError):
        return None


def apply(repo, changes):
    """Make the shop folder match the queued changes. Returns what happened:
    {files: [relative paths changed], applied: [ids now on the site or already there],
     conflicts: [{id, why}], skipped: [{id, why}], messages: {id: sentence}}"""
    repo = Path(repo)
    out = {"files": [], "applied": [], "conflicts": [], "skipped": [], "messages": {}}

    # Prices: only the newest pending change per product counts.
    newest = {}
    for c in changes:
        if c.get("kind") == "price" and c.get("status") == "pending":
            key = c.get("slug")
            if key not in newest or str(c.get("requested_at", "")) >= str(newest[key].get("requested_at", "")):
                newest[key] = c
    for c in sorted(newest.values(), key=lambda c: str(c.get("id"))):
        cid = str(c.get("id"))
        if not CHANGE_ID.match(cid):
            out["skipped"].append({"id": cid, "why": "unrecognised change id"})
            continue
        price, was = _money(c.get("price")), _money(c.get("was"))
        found = _product(repo, c.get("slug"))
        if price is None or was is None:
            out["skipped"].append({"id": cid, "why": "price must be between $1 and $10,000"})
            continue
        if not found:
            out["skipped"].append({"id": cid, "why": f"no product page called {c.get('slug')!r}"})
            continue
        path, raw, fm = found
        title = _field(fm, "title") or c["slug"]
        if not _for_sale(fm):
            out["skipped"].append({"id": cid, "why": f"{title} is sold (or a draft)"})
            continue
        now = _price(fm)
        if now is not None and abs(now - price) < 0.005:
            out["applied"].append(cid)            # already says that
            continue
        if now is None or abs(now - was) >= 0.005:
            shown = f"${now:.2f}" if now is not None else "an unreadable price"
            out["conflicts"].append({"id": cid, "why": f"{title} is {shown} on the site now, not ${was:.2f}: changed elsewhere, so left alone"})
            continue
        line = re.search(r"^price:[ \t]*[^\r\n]*", fm, re.M)
        new_fm = fm[:line.start()] + f"price: {price:.2f}" + fm[line.end():]
        path.write_bytes(raw.replace(fm, new_fm, 1).encode("utf-8"))
        out["files"].append(f"_products/{c['slug']}.md")
        out["applied"].append(cid)
        out["messages"][cid] = f"{title} is now ${price:.2f} on the site (was ${was:.2f})"

    # Bundles: the file holds exactly the valid pending/live ones (prices as they are after the above).
    wanted = []
    for c in sorted((c for c in changes if c.get("kind") == "bundle"), key=lambda c: str(c.get("id"))):
        if c.get("status") not in ("pending", "live"):
            continue
        cid = str(c.get("id"))
        slugs = c.get("slugs")
        price = _money(c.get("price"))
        why = None
        if not CHANGE_ID.match(cid):
            why = "unrecognised change id"
        elif not isinstance(slugs, list) or not 2 <= len(slugs) <= 4 or len(set(map(str, slugs))) != len(slugs):
            why = "a bundle needs 2 to 4 different pieces"
        elif price is None:
            why = "price must be between $1 and $10,000"
        if not why:
            pieces = [_product(repo, s) for s in slugs]
            if not all(pieces):
                why = "one of its pieces has no product page"
            elif not all(_for_sale(p[2]) for p in pieces):
                why = "one of its pieces has sold"
            else:
                total = sum(_price(p[2]) or 0 for p in pieces)
                if not price < total:
                    why = f"its price (${price:.2f}) isn't below the pieces' total (${total:.2f})"
        if why:
            out["skipped"].append({"id": cid, "why": why})
            continue
        wanted.append({"id": cid, "items": list(slugs), "price": price})
        if c.get("status") == "pending":
            out["applied"].append(cid)
            names = [(_field(_product(repo, s)[2], "title") or s) for s in slugs]
            out["messages"][cid] = f"Bundle deal live: {' + '.join(names)} for ${price:.2f}"

    target = repo / BUNDLES_FILE
    current = target.read_bytes().decode("utf-8") if target.exists() else None
    text = HEADER + ("".join(f"- id: \"{b['id']}\"\n  items: [{', '.join(b['items'])}]\n  price: {b['price']:.2f}\n"
                             for b in wanted) if wanted else "[]\n")
    if current is None and not wanted:
        pass                                       # nothing to say and no file: don't create one
    elif current is None or current.replace("\r\n", "\n") != text:
        target.parent.mkdir(exist_ok=True)
        target.write_bytes(text.encode("utf-8"))
        out["files"].append(BUNDLES_FILE)
    return out


def write_result(result, message, outcome=None, deploy=None):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    outcome = outcome or {}
    data = {"at": datetime.now().astimezone().isoformat(timespec="seconds"), "result": result, "message": message,
            "applied": outcome.get("applied", []), "conflicts": [c["id"] for c in outcome.get("conflicts", [])],
            "conflict_reasons": {c["id"]: c["why"] for c in outcome.get("conflicts", [])},
            "skipped": {s["id"]: s["why"] for s in outcome.get("skipped", [])},
            "message_per_id": outcome.get("messages", {}), "deploy": deploy}
    tmp = RESULT.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1), encoding="utf-8")
    os.replace(tmp, RESULT)
