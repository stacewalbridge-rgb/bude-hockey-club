"""Fetch the club's latest Facebook Page and Instagram posts into public/social-posts.json.

Runs from .github/workflows/social-sync.yml. Credentials come from GitHub Actions
secrets; nothing secret is ever written to the repository.

Facebook/Instagram image links are signed and expire after a few days, so each
post's photo is downloaded into public/social-media/ and served from the site.
"""
import datetime
import hashlib
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlencode

ROOT = pathlib.Path("public")
OUT = ROOT / "social-posts.json"
MEDIA_DIR = ROOT / "social-media"
GRAPH = "https://graph.facebook.com/v24.0/"
MAX_POSTS = 100
MAX_IMAGE_BYTES = 8 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}


def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def classify(s):
    s = s.lower()
    if re.search(r"\b(u8|under 8|u10|under 10|u12|under 12|u14|under 14|junior|juniors|festival)\b", s):
        return "Juniors"
    if re.search(r"ladies.{0,12}(1st|first|m1|1s)", s):
        return "Ladies 1st Team"
    if re.search(r"ladies.{0,15}(dev|development)", s):
        return "Ladies Development"
    if re.search(r"men.{0,12}(2nd|second|m2|2s)", s):
        return "Mens 2nd Team"
    if re.search(r"men.{0,12}(1st|first|m1|1s)", s):
        return "Mens 1st Team"
    if re.search(r"fixture|result|match|goal|league", s):
        return "Match reports"
    return "Club news"


def save_image(remote_url, post_id):
    """Download a post's photo into public/social-media/ and return its site path."""
    if not remote_url:
        return None
    stem = hashlib.sha256(post_id.encode()).hexdigest()[:20]
    for ext in IMAGE_TYPES.values():
        if (MEDIA_DIR / (stem + ext)).exists():
            return "/social-media/" + stem + ext
    try:
        req = urllib.request.Request(remote_url, headers={"User-Agent": "bude-hockey-site-sync"})
        with urllib.request.urlopen(req, timeout=25) as r:
            ctype = r.headers.get_content_type()
            data = r.read(MAX_IMAGE_BYTES + 1)
    except Exception as exc:
        print(f"  could not download image for {post_id}: {exc}")
        return None
    ext = IMAGE_TYPES.get(ctype)
    if not ext or len(data) > MAX_IMAGE_BYTES:
        print(f"  skipped image for {post_id} ({ctype}, {len(data)} bytes)")
        return None
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    (MEDIA_DIR / (stem + ext)).write_bytes(data)
    return "/social-media/" + stem + ext


def to_post(item, source):
    msg = item.get("message") or item.get("caption") or ""
    if item.get("media_type") == "VIDEO":
        media = item.get("thumbnail_url")
    else:
        media = item.get("full_picture") or item.get("media_url") or item.get("thumbnail_url")
    link = item.get("permalink_url") or item.get("permalink") or ""
    if not msg.strip() and not media:
        return None, None
    post = {
        "id": source + ":" + str(item["id"]),
        "source": source,
        "text": msg[:8000],
        "date": item.get("created_time") or item.get("timestamp") or "",
        "category": classify(msg),
        "url": link,
    }
    return post, media


def fetch(label, url, token, source, posts):
    try:
        items = get(url, token).get("data", [])
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:400]
        print(f"::error::{label} request failed ({exc.code}). The access token may be expired "
              f"or missing permissions. {body}")
        return False
    except Exception as exc:
        print(f"::error::{label} request failed: {exc}")
        return False
    added = 0
    for item in items:
        post, media = to_post(item, source)
        if not post:
            continue
        previous = posts.get(post["id"], {})
        kept = previous.get("image") or ""
        post["image"] = kept if kept.startswith("/social-media/") else save_image(media, post["id"])
        if post["id"] not in posts:
            added += 1
        posts[post["id"]] = post
    print(f"{label}: {len(items)} fetched, {added} new")
    return True


def main():
    existing = []
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text()).get("posts", [])
        except Exception:
            pass
    posts = {p["id"]: p for p in existing}

    fb = os.getenv("FACEBOOK_PAGE_TOKEN")
    page = os.getenv("FACEBOOK_PAGE_ID")
    ig = os.getenv("INSTAGRAM_ACCESS_TOKEN") or fb
    igid = os.getenv("INSTAGRAM_USER_ID")

    if not ((fb and page) or (ig and igid)):
        print("::warning::No Meta credentials configured; leaving existing feed unchanged. "
              "Add FACEBOOK_PAGE_TOKEN + FACEBOOK_PAGE_ID and/or INSTAGRAM_USER_ID as repository secrets.")
        return 0

    results = []
    if fb and page:
        u = GRAPH + page + "/posts?" + urlencode(
            {"fields": "id,message,created_time,permalink_url,full_picture", "limit": 30})
        results.append(fetch("Facebook", u, fb, "facebook", posts))
    if ig and igid:
        u = GRAPH + igid + "/media?" + urlencode(
            {"fields": "id,caption,timestamp,permalink,media_url,thumbnail_url,media_type", "limit": 30})
        results.append(fetch("Instagram", u, ig, "instagram", posts))

    ordered = sorted(posts.values(), key=lambda p: p.get("date", ""), reverse=True)[:MAX_POSTS]
    if ordered != existing:
        OUT.write_text(json.dumps({
            "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "posts": ordered,
        }, ensure_ascii=False, indent=2) + "\n")
        print("Saved", len(ordered), "social posts")
    else:
        print("No changes to the feed")

    # Mark the run as failed (red in GitHub) if a configured account could not be read,
    # while still keeping whatever the other account returned.
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
