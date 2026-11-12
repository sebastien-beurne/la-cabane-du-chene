import ctypes
import os
import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "cabane-du-chene"
_storage_key = None


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    for attempt in (0, 1):
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": init_storage(force=attempt == 1), "Content-Type": content_type},
                            data=data, timeout=120)
        if resp.status_code != 404:
            break
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")



def drop_cache(f) -> None:
    """Evicts a file's pages from the OS page cache: on Kubernetes that cache is billed as pod memory."""
    try:
        os.posix_fadvise(f.fileno(), 0, 0, os.POSIX_FADV_DONTNEED)
    except (AttributeError, OSError, ValueError):
        pass


def release_memory() -> None:
    """Gives freed heap memory back to the OS (glibc keeps it otherwise, e.g. after decoding a big photo)."""
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass


def put_stream(path: str, fileobj, content_type: str) -> dict:
    """Uploads an open file in a streaming way (never loads a whole video/PDF in RAM)."""
    for attempt in (0, 1):
        fileobj.seek(0)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": init_storage(force=attempt == 1), "Content-Type": content_type},
                            data=fileobj, timeout=300)
        if resp.status_code != 404:
            break
    drop_cache(fileobj)
    resp.raise_for_status()
    return resp.json()


def download_to(path: str, dest) -> None:
    """Streams an object to a local file in 1 MB chunks (constant memory, even for large videos)."""
    tmp = dest.with_suffix(".part")
    with requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=120, stream=True) as resp:
        resp.raise_for_status()
        with open(tmp, "wb") as f:
            for i, chunk in enumerate(resp.iter_content(1024 * 1024)):
                f.write(chunk)
                if i % 8 == 7:
                    f.flush()
                    os.fsync(f.fileno())
                    drop_cache(f)
            f.flush()
            os.fsync(f.fileno())
            drop_cache(f)
    tmp.replace(dest)

