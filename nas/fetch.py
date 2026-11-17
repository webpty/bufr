"""Fetches the photos waiting at bufr.cc into the NAS, every minute.

Each photo is saved under ROOT at the path Geotag gave it, checked against
its fingerprint, given the photo's own date and the folder owner's ownership,
and only then taken off bufr.cc. Nothing already on the NAS is overwritten,
except Geotag's own earlier copy of the same photo when it says so.
"""

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

URL = os.environ.get("BUFR_URL", "https://bufr.cc").rstrip("/")
KEY = os.environ.get("BUFR_KEY", "").strip()
ROOT = os.path.realpath(os.environ.get("BUFR_ROOT", "/volume1"))
ALLOWED = [os.path.realpath(p) for p in os.environ.get("BUFR_ALLOWED", "/volume1/homes").split(":") if p]
EVERY = int(os.environ.get("BUFR_EVERY", "60"))
ONCE = os.environ.get("BUFR_ONCE") == "1"


def say(text):
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), text, flush=True)


def ask(method, path, timeout=60):
    request = urllib.request.Request(URL + path, method=method, headers={"Authorization": "Bearer " + KEY})
    return urllib.request.urlopen(request, timeout=timeout)


def numbered(name, n):
    stem, dot, ext = name.rpartition(".")
    return f"{stem}_{n}.{ext}" if dot else f"{name}_{n}"


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def owner_of(folder):
    """The owner of the nearest folder that exists, for new folders and files."""
    while not os.path.isdir(folder):
        folder = os.path.dirname(folder)
    st = os.stat(folder)
    return st.st_uid, st.st_gid


def make_folders(folder):
    missing = []
    while not os.path.isdir(folder):
        missing.append(folder)
        folder = os.path.dirname(folder)
    uid, gid = owner_of(folder)
    for f in reversed(missing):
        os.mkdir(f, 0o775)
        try:
            os.chown(f, uid, gid)
        except OSError:
            pass


def place(photo):
    """Fetches one photo; True once it is safely on the NAS (or already was)."""
    target = os.path.realpath(os.path.join(ROOT, photo["path"]))
    if not any(target.startswith(a + os.sep) for a in ALLOWED):
        say(f"refused {photo['path']}: outside the folders allowed")
        return False
    folder, name = os.path.split(target)
    make_folders(folder)

    work = os.path.join(folder, f".{name}.bufr-{photo['id'][:8]}")
    digest = hashlib.sha256()
    try:
        with ask("GET", "/v1/photos/" + photo["id"], timeout=300) as answer, open(work, "wb") as out:
            for chunk in iter(lambda: answer.read(4 << 20), b""):
                out.write(chunk)
                digest.update(chunk)
    except Exception as error:
        if os.path.exists(work):
            os.remove(work)
        say(f"could not fetch {photo['path']}: {error}")
        return False
    if digest.hexdigest() != photo["sha256"]:
        os.remove(work)
        say(f"{photo['path']} arrived different from what was sent; trying again later")
        return False

    # Its name: its own, unless another photo has it.
    n = 1
    final = target
    while os.path.exists(final):
        if os.path.getsize(final) == photo["size"] and file_hash(final) == photo["sha256"]:
            os.remove(work)
            say(f"{photo['path']} was already on the NAS")
            return True
        if photo.get("update") and n == 1:
            break  # Geotag's earlier copy of this photo, replaced
        n += 1
        final = os.path.join(folder, numbered(name, n))

    uid, gid = owner_of(folder)
    try:
        os.chown(work, uid, gid)
    except OSError:
        pass
    os.chmod(work, 0o664)
    if photo.get("modified"):
        try:
            when = datetime.fromisoformat(photo["modified"].replace("Z", "+00:00")).timestamp()
            os.utime(work, (when, when))
        except ValueError:
            pass
    os.replace(work, final)
    say(f"saved {os.path.relpath(final, ROOT)}")
    return True


def round_once():
    try:
        with ask("GET", "/v1/photos") as answer:
            waiting = json.load(answer)["photos"]
    except urllib.error.HTTPError as error:
        say(f"bufr.cc refused: {error.code}" + (" (check the key)" if error.code == 404 else ""))
        return
    except Exception as error:
        say(f"bufr.cc not reachable: {error}")
        return
    if waiting:
        say(f"{len(waiting)} waiting")
    for photo in waiting:
        if place(photo):
            try:
                ask("DELETE", "/v1/photos/" + photo["id"]).close()
            except Exception as error:
                say(f"could not clear {photo['path']} at bufr.cc: {error}")


def main():
    if not KEY:
        say("BUFR_KEY is not set")
        sys.exit(1)
    say(f"fetching from {URL} into {', '.join(ALLOWED)} every {EVERY} s")
    while True:
        round_once()
        if ONCE:
            return
        time.sleep(EVERY)


if __name__ == "__main__":
    main()
