"""Shared pieces for publish.py and autosync.py: where things are, and running git.

Nothing here changes the repo by itself. State (the sync log and the last
download result) lives outside the repo, in %LOCALAPPDATA%\\AtticEmberShop, so
it never shows up as a change to publish.
"""
import json
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BRANCH = "main"
STATE_DIR = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "AtticEmberShop"
SYNC_LOG = STATE_DIR / "sync.log"
SYNC_STATE = STATE_DIR / "last_sync.json"


def find_tool(name, *fallbacks):
    found = shutil.which(name)
    if found:
        return found
    for f in fallbacks:
        if Path(f).exists():
            return str(f)
    return None


GIT = find_tool("git", r"C:\Program Files\Git\cmd\git.exe", r"C:\Program Files\Git\mingw64\bin\git.exe")
FFMPEG = find_tool("ffmpeg", Path.home() / r"AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe")
FFPROBE = find_tool("ffprobe", Path.home() / r"AppData\Local\Microsoft\WinGet\Links\ffprobe.exe")
RUBY_BIN = Path(r"C:\Ruby33-x64\bin")


class GitError(Exception):
    pass


def git(*args, check=True, timeout=120):
    """Run git in the shop folder and return its output (stripped)."""
    if not GIT:
        raise GitError("Git isn't installed where expected.")
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", LC_ALL="C")
    r = subprocess.run([GIT, *args], cwd=REPO, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=timeout, env=env,
                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if check and r.returncode != 0:
        raise GitError((r.stderr or r.stdout).strip() or f"git {args[0]} failed")
    return r.stdout.strip() if check else r


def busy():
    """A merge or rebase left half-done in the folder; nothing should touch it."""
    g = REPO / ".git"
    return any((g / n).exists() for n in ("MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD"))


def current_branch():
    return git("rev-parse", "--abbrev-ref", "HEAD")


def ahead_behind():
    """(commits only here, commits only on GitHub), after a fetch."""
    out = git("rev-list", "--left-right", "--count", f"{BRANCH}...origin/{BRANCH}")
    a, b = out.split()
    return int(a), int(b)


def tracked_changes():
    """Edited or deleted files git already knows about (new, untracked files not counted)."""
    return [l for l in git("status", "--porcelain", "--untracked-files=no").splitlines() if l.strip()]


def on_github(path):
    """A file's text as it is on GitHub (origin/main, as of the last fetch), or None."""
    r = git("show", f"origin/{BRANCH}:{path}", check=False)
    return r.stdout if r.returncode == 0 else None


def log(line):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(SYNC_LOG, "a", encoding="utf-8") as f:
        f.write(f"{datetime.now():%Y-%m-%d %H:%M:%S}  {line}\n")


def save_state(result, message):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    SYNC_STATE.write_text(json.dumps({"when": datetime.now().isoformat(timespec="seconds"),
                                      "result": result, "message": message}), encoding="utf-8")


def load_state():
    try:
        return json.loads(SYNC_STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
