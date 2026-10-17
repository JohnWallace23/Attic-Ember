"""Keep this folder in step with GitHub, and (if switched on) publish what John confirmed in the app.

    pythonw tools\\publish\\autosync.py        (what the scheduled task runs)

1. Download: it fast-forwards when this folder has no edits of its own. If files here
   are being edited, or this folder has commits GitHub doesn't (the two have gone
   different ways), it changes nothing and leaves a note that the Publish tool shows.
   It never merges, rebases, resets or stashes John's work.

2. Price changes and bundle deals confirmed in the sourcing app (tools/publish/
   sitechanges.py): only when John has switched automatic publishing on
   (%LOCALAPPDATA%\\AtticEmberShop\\autopublish.json), and only when nothing else in the
   folder is being edited. Then it applies just those changes, test-builds the site,
   commits and pushes exactly those files, and waits for Cloudflare. If anything fails
   it puts the files back and pushes nothing. With the switch off, the changes wait for
   Publish Shop, which applies them and asks first.
"""
import subprocess
import sys
import time

from shopgit import (BRANCH, REPO, GitError, ahead_behind, busy, current_branch, git, log, save_state,
                     tracked_changes)
import sitechanges


def download():
    if busy():
        return "skipped", "A merge or rebase is half-finished in the shop folder."
    if current_branch() != BRANCH:
        return "skipped", f"The shop folder isn't on the {BRANCH} branch."
    # Right after the PC wakes, the network often isn't up yet: wait and try once more,
    # and if GitHub still can't be reached, that's "offline", not a fault.
    for attempt in (1, 2):
        try:
            git("fetch", "--quiet", "origin", BRANCH, timeout=60)
            break
        except (GitError, subprocess.TimeoutExpired):
            if attempt == 2:
                return "offline", "Couldn't reach GitHub (no internet yet?). Will try again at the next run."
            time.sleep(30)
    ahead, behind = ahead_behind()
    if behind == 0:
        return "ok", "Already up to date."
    if ahead:
        return "diverged", (f"This folder has {ahead} change(s) GitHub doesn't, and GitHub has {behind} "
                            "this folder doesn't. Nothing was downloaded.")
    if tracked_changes():
        return "waiting", (f"GitHub has {behind} new change(s), but files here are being edited, so they "
                           "weren't downloaded yet. Publish will bring them in first.")
    git("merge", "--ff-only", "--quiet", f"origin/{BRANCH}")
    return "ok", f"Downloaded {behind} change(s) from GitHub."


def anything_edited():
    """Edits or new files anywhere in the folder (ignored files like _site don't count)."""
    return bool(git("status", "--porcelain", "--untracked-files=all", check=False).stdout.strip())


def publish_queued(sync_result):
    """Publish the app's confirmed changes, if allowed. Returns a short note for the sync log, or None."""
    changes = sitechanges.load()
    if not sitechanges.queued(changes):
        return None
    if not sitechanges.autopublish_on():
        sitechanges.write_result("waiting", "Waiting for Publish Shop: automatic publishing is switched off.")
        return "app changes wait for Publish Shop (automatic publishing is off)"
    if sync_result not in ("ok",) or busy() or current_branch() != BRANCH:
        sitechanges.write_result("waiting", "The shop folder isn't in step with GitHub right now, so this waits.")
        return "app changes waiting: folder not in step with GitHub"
    if anything_edited():
        sitechanges.write_result("waiting", "Files in the shop folder are being edited, so this waits for Publish Shop.")
        return "app changes wait for Publish Shop (folder has edits)"

    import publish                                  # its build and deploy check, nothing else
    head = git("rev-parse", "HEAD")
    outcome = sitechanges.apply(REPO, changes)
    files = outcome["files"]
    if not files:
        sitechanges.write_result("nothing", "Nothing to change: the site already matches.", outcome)
        return "app changes already on the site"
    try:
        changed = {l[3:].strip().strip('"').replace("\\", "/")
                   for l in git("status", "--porcelain", "--untracked-files=all", check=False).stdout.splitlines() if l.strip()}
        if changed != set(files):
            raise RuntimeError("unexpected files changed: " + ", ".join(sorted(changed - set(files)))[:200])
        publish.build()
        git("add", "--", *files)
        body = "\n".join(outcome["messages"].values()) or "Prices/bundles as confirmed in the sourcing app."
        git("commit", "-q", "-m", "Price/bundle update from the sourcing app", "-m", body, "--", *files)
        r = git("push", "-q", "origin", BRANCH, check=False, timeout=180)
        if r.returncode != 0:
            raise RuntimeError("GitHub didn't accept the push: " + (r.stderr.strip().splitlines() or ["?"])[-1])
    except Exception as e:
        # Put everything back exactly as it was; nothing has reached GitHub.
        git("reset", "-q", "--hard", head, check=False)
        for f in files:
            p = REPO / f
            if p.exists() and git("ls-files", "--error-unmatch", f, check=False).returncode != 0:
                p.unlink()                          # a bundles file this run created
        msg = (str(e).splitlines() or [type(e).__name__])[0][:300]
        sitechanges.write_result("error", "Couldn't publish the app's changes, so nothing was sent: " + msg, outcome)
        return "app changes NOT published: " + msg
    commit = git("rev-parse", "HEAD")
    log(f"published app changes {commit[:7]}")
    live = False
    if "github.com" in git("remote", "get-url", "origin"):
        try:
            live = publish.wait_for_deploy(commit, seconds=420)
        except Exception:
            live = False
    sitechanges.write_result("published", "; ".join(outcome["messages"].values()) or "Published.", outcome,
                             deploy="live" if live else "pending")
    return f"published app changes {commit[:7]}" + ("" if live else " (deploy still running)")


if __name__ == "__main__":
    try:
        result, message = download()
    except (GitError, OSError) as e:
        result, message = "error", str(e).splitlines()[0][:300]
    except Exception as e:  # never leave a scheduled task crashing silently
        result, message = "error", f"{type(e).__name__}: {e}"[:300]
    log(f"{result}: {message}")
    save_state(result, message)
    try:
        note = publish_queued(result)
        if note:
            log(note)
    except Exception as e:
        log(f"error publishing app changes: {type(e).__name__}: {e}"[:300])
        try:
            sitechanges.write_result("error", f"{type(e).__name__}: {e}"[:300])
        except OSError:
            pass
    sys.exit(0 if result in ("ok", "waiting", "offline") else 1)
