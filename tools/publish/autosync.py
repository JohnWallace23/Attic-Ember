"""Bring changes made on GitHub (e.g. products added in the web UI) down to this folder.

    pythonw tools\\publish\\autosync.py        (what the scheduled task runs)

Download only, and only when it's safe: it fast-forwards when this folder has no
edits of its own. If files here are being edited, or this folder has commits
GitHub doesn't (the two have gone different ways), it changes nothing and leaves
a note that the Publish tool shows. It never merges, rebases, resets or stashes.
"""
import subprocess
import sys
import time

from shopgit import (BRANCH, GitError, ahead_behind, busy, current_branch, git, log, save_state,
                     tracked_changes)


def main():
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


if __name__ == "__main__":
    try:
        result, message = main()
    except (GitError, OSError) as e:
        result, message = "error", str(e).splitlines()[0][:300]
    except Exception as e:  # never leave a scheduled task crashing silently
        result, message = "error", f"{type(e).__name__}: {e}"[:300]
    log(f"{result}: {message}")
    save_state(result, message)
    sys.exit(0 if result in ("ok", "waiting", "offline") else 1)
