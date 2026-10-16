"""Publish the shop: put the changes made in this folder live on atticandember.com.

    Double-click "Publish Shop" on the desktop (runs: python tools\\publish\\publish.py)

Step by step, stopping to explain whenever something isn't right:
 1. Bring this folder up to date with GitHub (fast-forward only, never a merge).
 2. List what changed here.
 3. Fix the usual upload problems: shrink big photos, turn .MOV video into .mp4
    (and point the product at it), add a missing .md, fix titles whose quotes
    would break the page or the order email.
 4. Refuse anything that must never be public: spreadsheets, databases, keys,
    files over 25 MB, files outside the website's folders, the sourcing app's data.
 5. Check that every photo/video a product lists really exists (exact spelling).
 6. Build the site once, here, the way Cloudflare will.
 7. Show a plain summary and ask before publishing. Only "y" publishes.
 8. Commit, push, and wait for Cloudflare to say the new version is live.

Options (for testing): --check  do everything except commit and push.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shopgit import (BRANCH, FFMPEG, FFPROBE, REPO, RUBY_BIN, GitError, ahead_behind, busy,  # noqa: E402
                     current_branch, git, load_state, log)

PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXT = {".mp4", ".webm"}
CONVERT_VIDEO_EXT = {".mov", ".m4v"}
PHOTO_MAX_SIDE = 1600
PHOTO_MAX_BYTES = 1_000_000
VIDEO_REENCODE_BYTES = 15_000_000
HARD_MAX_BYTES = 25_000_000

# What belongs to the website. Anything else stays off GitHub until someone looks at it.
SITE_DIRS = {"_products", "assets", "_layouts", "_includes", "_plugins", "_data", "tools"}
SITE_FILES = {"_config.yml", "_headers", "_redirects", ".gitignore", "Gemfile", "README.md", "PRODUCTS.md",
              "robots.txt", "favicon.ico", "BingSiteAuth.xml"}
NEVER = re.compile(r"(^|/)(\.env[^/]*|[^/]*\.(db|sqlite3?|csv|tsv|xlsx?|xlsm|numbers|pem|key|p12|pfx|kdbx)"
                   r"|id_rsa[^/]*|\.cf-[a-z]+|[^/]*(secret|password|credential|token)[^/]*)$", re.I)
SOURCING = re.compile(r"atticembersourcing|attic&ember-sourcing|sourcing\.db", re.I)

PHOTO_ARGS = ["-vf", f"scale={PHOTO_MAX_SIDE}:{PHOTO_MAX_SIDE}:force_original_aspect_ratio=decrease", "-q:v", "4"]
VIDEO_ARGS = ["-vf", "scale=1080:1080:force_original_aspect_ratio=decrease:force_divisible_by=2",
              "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "medium",
              "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"]


class Stop(Exception):
    """Something needs a person: say it plainly and stop without publishing."""


def say(text=""):
    print(text, flush=True)


def ask(question):
    try:
        return input(question + " (y/n) ").strip().lower() in ("y", "yes")
    except EOFError:
        return False


def size_text(n):
    return f"{n / 1_000_000:.1f} MB" if n >= 1_000_000 else f"{max(1, round(n / 1000))} KB"


def run(cmd, timeout=600):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                          timeout=timeout, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))


# ------------------------------------------------------------------ 1. up to date
def bring_up_to_date():
    if busy():
        raise Stop("Git is in the middle of a merge or rebase in the shop folder. Ask A&E to finish it.")
    if current_branch() != BRANCH:
        raise Stop(f"The shop folder is on a branch other than {BRANCH}. Ask A&E.")
    say("Checking GitHub for changes made there…")
    try:
        git("fetch", "--quiet", "origin", BRANCH, timeout=90)
    except GitError as e:
        raise Stop("Couldn't reach GitHub (" + str(e).splitlines()[0] + "). Check the internet connection.")
    ahead, behind = ahead_behind()
    if behind and ahead:
        raise Stop(f"This folder and GitHub have each changed in different ways ({ahead} here, {behind} there). "
                   "Nothing was published. Ask A&E to combine them.")
    if behind:
        r = git("merge", "--ff-only", f"origin/{BRANCH}", check=False)
        if r.returncode != 0:
            raise Stop("GitHub has newer versions of files that are also being edited here, so they can't be "
                       "brought in automatically. Nothing was published. Ask A&E.")
        say(f"  Brought in {behind} change(s) from GitHub.")
    return ahead


# ------------------------------------------------------------------ 2. what changed
def changes():
    """[(status, path)] for every changed, new or deleted file, paths with forward slashes."""
    # Raw output: each entry starts with a two-letter code that may begin with a space.
    out = git("status", "--porcelain=v1", "-z", "--untracked-files=all", check=False).stdout
    items, parts, i = [], out.split("\0"), 0
    while i < len(parts):
        entry = parts[i]
        i += 1
        if not entry:
            continue
        code, path = entry[:2], entry[3:]
        if code[0] in "RC":  # a rename carries its old path as the next field
            i += 1
        status = "deleted" if "D" in code else ("new" if code == "??" or "A" in code else "changed")
        items.append((status, path.replace("\\", "/")))
    return items


# ------------------------------------------------------------------ 3. fixes
def probe(path):
    if not FFPROBE:
        return None
    r = run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
             "-of", "csv=p=0", str(path)], timeout=60)
    try:
        w, h = r.stdout.strip().split(",")[:2]
        return int(w), int(h)
    except ValueError:
        return None


def shrink_photo(rel, notes):
    p = REPO / rel
    size, dims = p.stat().st_size, probe(p)
    if not dims:
        return
    if max(dims) <= PHOTO_MAX_SIDE and size <= PHOTO_MAX_BYTES:
        return
    if not FFMPEG:
        raise Stop(f"{rel} is a full-size photo ({size_text(size)}) and ffmpeg, which shrinks it, is missing.")
    tmp = p.with_name(p.stem + ".publish-tmp" + p.suffix)
    r = run([FFMPEG, "-y", "-v", "error", "-i", str(p), *PHOTO_ARGS, str(tmp)])
    if r.returncode != 0 or not tmp.exists() or tmp.stat().st_size < 1000:
        tmp.unlink(missing_ok=True)
        raise Stop(f"Couldn't shrink {rel}: {r.stderr.strip()[:200]}")
    os.replace(tmp, p)
    notes.append(f"shrank {rel} ({dims[0]}×{dims[1]}, {size_text(size)} → {size_text(p.stat().st_size)})")


def convert_video(rel, notes, renamed):
    """.MOV → .mp4 beside it; returns the new relative path."""
    p = REPO / rel
    out = p.with_suffix(".mp4")
    if out.exists():
        raise Stop(f"Both {rel} and {out.relative_to(REPO).as_posix()} exist. Remove one, then publish again.")
    if not FFMPEG:
        raise Stop(f"{rel} needs turning into .mp4 (iPhone video won't play everywhere), and ffmpeg is missing.")
    say(f"  Converting {rel} to .mp4 (this can take a minute)…")
    r = run([FFMPEG, "-y", "-v", "error", "-i", str(p), *VIDEO_ARGS, str(out)], timeout=1800)
    if r.returncode != 0 or not out.exists() or out.stat().st_size < 10_000:
        out.unlink(missing_ok=True)
        raise Stop(f"Couldn't convert {rel}: {r.stderr.strip()[:200]}")
    new_rel = out.relative_to(REPO).as_posix()
    renamed["/" + rel] = "/" + new_rel
    p.unlink()
    notes.append(f"converted {rel} → {Path(new_rel).name} ({size_text(out.stat().st_size)})")
    return new_rel


def reencode_big_video(rel, notes):
    p = REPO / rel
    size = p.stat().st_size
    if size <= VIDEO_REENCODE_BYTES or not FFMPEG:
        return
    tmp = p.with_name(p.stem + ".publish-tmp.mp4")
    say(f"  Shrinking {rel} ({size_text(size)})…")
    r = run([FFMPEG, "-y", "-v", "error", "-i", str(p), *VIDEO_ARGS, str(tmp)], timeout=1800)
    if r.returncode == 0 and tmp.exists() and 10_000 < tmp.stat().st_size < size:
        os.replace(tmp, p)
        notes.append(f"shrank {rel} ({size_text(size)} → {size_text(p.stat().st_size)})")
    else:
        tmp.unlink(missing_ok=True)


def read_raw(p):
    """The file's text exactly as stored, line endings included, so a fix changes only what it means to."""
    return p.read_bytes().decode("utf-8")


def write_raw(p, text):
    p.write_bytes(text.encode("utf-8"))


def front_matter(text):
    m = re.match(r"\A﻿?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(\r?\n|\Z)", text, re.S)
    return m.group(1) if m else None


def fix_title(rel, notes):
    """A title is double-quoted with no stray quotes inside: an inch mark (24") becomes ″."""
    p = REPO / rel
    text = read_raw(p)
    fm = front_matter(text)
    if fm is None:
        raise Stop(f"{rel} doesn't start with the --- block a product needs. Compare it with another product file.")
    m = re.search(r'^title:[ \t]*([^\r\n]*)', fm, re.M)
    if not m:
        raise Stop(f"{rel} has no title: line.")
    raw = m.group(1).strip()
    value = raw
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
        if raw[0] == "'":
            value = value.replace("''", "'")
    value = value.replace('\\"', '"')
    value = re.sub(r'(\d)\s*"', "\\1″", value)       # 24" → 24″ (a quote mark broke the order email)
    value = re.sub(r'"([^"]*)"', "“\\1”", value)      # a quoted phrase → curly quotes
    value = value.replace('"', "″")
    fixed = '"' + value.replace("\\", "\\\\") + '"'
    if fixed != raw:
        new_fm = fm[:m.start(1)] + fixed + fm[m.end(1):]
        write_raw(p, text.replace(fm, new_fm, 1))
        notes.append(f"fixed the title quoting in {rel}: {fixed}")
    return value


def media_paths(fm):
    return re.findall(r'(/assets/[^\s"\'#]+)', fm)


def exists_exactly(rel):
    """True if the file exists with exactly this spelling, capitals included (Cloudflare is strict)."""
    cur = REPO
    for part in rel.split("/"):
        try:
            names = os.listdir(cur)
        except OSError:
            return False
        if part not in names:
            return False
        cur = cur / part
    return cur.is_file()


# ------------------------------------------------------------------ 6. build
def build():
    say("Test-building the site the way Cloudflare will…")
    bundle = RUBY_BIN / "bundle.bat"
    if not bundle.exists():
        say("  (Ruby isn't installed here, so the test build was skipped. Cloudflare will still build it.)")
        return
    out_dir = Path(tempfile.mkdtemp(prefix="shop-build-"))
    env = dict(os.environ, PATH=str(RUBY_BIN) + os.pathsep + os.environ.get("PATH", ""))
    r = subprocess.run([str(bundle), "exec", "jekyll", "build", "-q", "-d", str(out_dir)], cwd=REPO,
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600, env=env,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    shutil.rmtree(out_dir, ignore_errors=True)
    trouble = [l for l in (r.stdout + r.stderr).splitlines()
               if re.search(r"error|exception|invalid", l, re.I) and "deprecat" not in l.lower()]
    if r.returncode != 0 or trouble:
        raise Stop("The site didn't build. Nothing was published. What it said:\n  " +
                   "\n  ".join((trouble or (r.stderr or r.stdout).splitlines())[:8]))
    say("  Built fine.")


# ------------------------------------------------------------------ 8. deploy check
def wait_for_deploy(commit):
    token_f, acct_f = Path.home() / ".cf-token", Path.home() / ".cf-account"
    if not (token_f.exists() and acct_f.exists()):
        say("Pushed. Cloudflare usually has it live within 2–3 minutes.")
        return
    token, acct = token_f.read_text().strip(), acct_f.read_text().strip()
    url = f"https://api.cloudflare.com/client/v4/accounts/{acct}/pages/projects/attic-ember/deployments?per_page=3"
    say("Waiting for Cloudflare to put it live…")
    deadline = time.time() + 600
    last = None
    while time.time() < deadline:
        try:
            req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
            data = json.load(urllib.request.urlopen(req, timeout=30))
            for d in data.get("result", []):
                meta = (d.get("deployment_trigger") or {}).get("metadata") or {}
                if (meta.get("commit_hash") or "").startswith(commit[:7]):
                    stage = d.get("latest_stage") or {}
                    now = f"{stage.get('name')} {stage.get('status')}"
                    if now != last:
                        say(f"  {stage.get('name', '?')}: {stage.get('status', '?')}")
                        last = now
                    if stage.get("name") == "deploy" and stage.get("status") == "success":
                        return True
                    if stage.get("status") == "failure":
                        raise Stop("Cloudflare couldn't build this version, so the live site still shows the "
                                   "previous one. Ask A&E; nothing is broken for shoppers.")
        except Stop:
            raise
        except Exception:
            pass  # a hiccup talking to Cloudflare; keep waiting
        time.sleep(15)
    say("Cloudflare is taking longer than usual. It's pushed; check the site in a few minutes.")
    return False


# ------------------------------------------------------------------ main
def main(check_only):
    say("Attic & Ember: publish the shop")
    say("=" * 34)
    note = load_state()
    if note and note.get("result") == "error":  # (a diverged folder is caught below, in its own words)
        say(f"The last automatic download from GitHub didn't work "
            f"({note.get('when', '')[:16].replace('T', ' ')}): {note.get('message')}")
    unpushed = bring_up_to_date()

    items = changes()
    if not items and not unpushed:
        say("\nNothing has changed here since the last publish. The website is already up to date.")
        return
    say(f"\n{len(items)} file(s) changed here." if items else "")

    notes, blocked, renamed = [], [], {}
    # Product files missing .md are invisible on the site; offer to fix the name.
    for status, rel in list(items):
        if status != "deleted" and rel.startswith("_products/") and not rel.lower().endswith(".md"):
            stem = rel[:-4] if rel.lower().endswith(".txt") else rel
            target = stem + ".md"
            if (REPO / target).exists():
                blocked.append(f"{rel}: a product file without .md, and {target} already exists.")
            elif ask(f"'{rel}' is missing .md at the end, so the site would skip it. Rename it to '{target}'?"):
                (REPO / rel).rename(REPO / target)
                notes.append(f"renamed {rel} → {target}")
            else:
                blocked.append(f"{rel}: product files must end in .md.")
    items = changes()

    for status, rel in items:
        if status == "deleted":
            continue
        top = rel.split("/")[0]
        p = REPO / rel
        if SOURCING.search(rel):
            blocked.append(f"{rel}: this is the sourcing app's private data.")
        elif NEVER.search(rel):
            blocked.append(f"{rel}: spreadsheets, databases and key files never go on the public site.")
        elif top not in SITE_DIRS and rel not in SITE_FILES and not (("/" not in rel) and rel.endswith(".html")):
            blocked.append(f"{rel}: not part of the website's folders.")
        elif p.is_file() and p.stat().st_size > HARD_MAX_BYTES and p.suffix.lower() not in CONVERT_VIDEO_EXT | VIDEO_EXT:
            blocked.append(f"{rel}: {size_text(p.stat().st_size)} is too big for the website.")
        elif p.suffix.lower() in {".heic", ".heif"}:
            blocked.append(f"{rel}: iPhone HEIC photos don't show in most browsers. Save it as a JPG instead.")
        elif p.suffix.lower() in PHOTO_EXT | VIDEO_EXT | CONVERT_VIDEO_EXT and p.stat().st_size < 1024:
            blocked.append(f"{rel}: only {p.stat().st_size} bytes, so it's damaged (renaming photos on GitHub "
                           "does this). Put the original back.")
    if blocked:
        raise Stop("These can't be published:\n  - " + "\n  - ".join(blocked) +
                   "\nMove them out of the shop folder (or fix them), then publish again. Nothing was published.")

    # Media: .MOV → .mp4, then shrink anything too big.
    for status, rel in items:
        if status != "deleted" and Path(rel).suffix.lower() in CONVERT_VIDEO_EXT:
            convert_video(rel, notes, renamed)
    items = changes()
    for status, rel in items:
        if status == "deleted":
            continue
        ext = Path(rel).suffix.lower()
        if rel.startswith("assets/") and ext in PHOTO_EXT:
            shrink_photo(rel, notes)
        elif rel.startswith("assets/") and ext in VIDEO_EXT:
            reencode_big_video(rel, notes)
        p = REPO / rel
        if p.is_file() and p.stat().st_size > HARD_MAX_BYTES:
            raise Stop(f"{rel} is still {size_text(p.stat().st_size)} after shrinking; too big for the website.")

    # Products: titles, converted video names, and every listed file must exist exactly.
    products, missing = {}, []
    for status, rel in changes():
        if not (rel.startswith("_products/") and rel.endswith(".md")):
            continue
        if status == "deleted":
            products[rel] = ("removed", Path(rel).stem)
            continue
        p = REPO / rel
        if renamed:
            text = read_raw(p)
            new = text
            for old, now in renamed.items():
                new = new.replace(old, now)
            if new != text:
                write_raw(p, new)
                notes.append(f"pointed {rel} at the converted video")
        title = fix_title(rel, notes)
        fm = front_matter(read_raw(p)) or ""
        for media in media_paths(fm):
            if not exists_exactly(media.lstrip("/")):
                missing.append(f"{rel} lists {media}, but there's no file with exactly that name")
        products[rel] = (status, title)
    if missing:
        raise Stop("Some photos or videos a product lists aren't there (capitals count):\n  - " +
                   "\n  - ".join(missing) + "\nFix the name in the product file or the file itself. Nothing was published.")

    build()

    # Summary
    items = changes()
    say("\nThese will go live on atticandember.com:")
    for rel, (status, title) in sorted(products.items()):
        say(f"  • {'New product' if status == 'new' else 'Removed product' if status == 'removed' else 'Updated product'}: {title}")
    media = [r for s, r in items if r.startswith("assets/") and s != "deleted"]
    gone = [r for s, r in items if s == "deleted" and not r.startswith("_products/")]
    other = [r for s, r in items if not r.startswith(("assets/", "_products/")) and s != "deleted"]
    if media:
        say(f"  • {len(media)} photo/video file(s)")
    if gone:
        say(f"  • {len(gone)} file(s) removed: " + ", ".join(Path(g).name for g in gone[:6]) + ("…" if len(gone) > 6 else ""))
    if other:
        say("  • Site files: " + ", ".join(other[:8]) + ("…" if len(other) > 8 else ""))
    if unpushed:
        say(f"  • {unpushed} change(s) saved earlier but not yet published")
    if notes:
        say("\nFixed automatically:")
        for n in notes:
            say("  - " + n)
    if len(gone) > 10:
        say(f"\nCareful: {len(gone)} files would be deleted from the website.")

    if check_only:
        say("\n(--check: stopping here; nothing was committed or pushed.)")
        return
    say("")
    if not ask("Publish these to the live website now?"):
        say("Not published. Your changes are still here; run Publish again when ready.")
        return

    if items:
        git("add", "-A")
        parts = [("new " if s == "new" else "remove " if s == "removed" else "update ") + t
                 for _, (s, t) in sorted(products.items())]
        if media and not parts:
            parts.append(f"{len(media)} photo/video file(s)")
        subject = "Publish: " + ("; ".join(parts) if parts else "site updates")
        if len(subject) > 72:
            subject = subject[:69].rstrip() + "…"
        body = "Published from the local folder with tools/publish.\n\n" + "\n".join(
            f"{s}: {r}" for s, r in changes()[:60])
        git("commit", "-q", "-m", subject, "-m", body)
    say("Sending to GitHub…")
    r = git("push", "-q", "origin", BRANCH, check=False, timeout=180)
    if r.returncode != 0:
        raise Stop("GitHub didn't accept it (" + (r.stderr.strip().splitlines() or ["unknown"])[-1] +
                   "). Your changes are saved here; run Publish again, or ask A&E.")
    commit = git("rev-parse", "HEAD")
    log(f"published {commit[:7]}")
    origin = git("remote", "get-url", "origin")
    if "github.com" in origin and wait_for_deploy(commit):
        say("\nLive! It's on atticandember.com now.")
        for rel, (status, _) in sorted(products.items()):
            if status == "new":
                say(f"  https://atticandember.com/shop/{Path(rel).stem}/")


if __name__ == "__main__":
    check = "--check" in sys.argv[1:]
    try:
        main(check)
    except Stop as e:
        say("\nStopped: " + str(e))
    except (GitError, OSError, subprocess.SubprocessError) as e:
        say("\nSomething went wrong: " + str(e).splitlines()[0][:300] + "\nNothing more was done. Ask A&E.")
    if sys.stdin.isatty() and "--no-pause" not in sys.argv[1:]:
        try:
            input("\nPress Enter to close.")
        except EOFError:
            pass
