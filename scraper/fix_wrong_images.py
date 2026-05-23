"""Fikser feil bilde-URLer ved aa bruke Playwright + websok."""
import sys, re, json, requests
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import USER_AGENT

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

def playwright_image(url: str, wait_ms: int = 4000) -> str | None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent=USER_AGENT,
            extra_http_headers={"Accept-Language": "no-NO,no;q=0.9,en;q=0.8"},
        )
        try:
            page.goto(url, wait_until="networkidle", timeout=40000)
            page.wait_for_timeout(wait_ms)
            html = page.content()
            soup = BeautifulSoup(html, "lxml")

            # og:image
            og = soup.find("meta", property="og:image")
            if og and og.get("content"):
                img = og["content"]
                if not any(bad in img.lower() for bad in ["logo", "icon", "placeholder", "sprite"]):
                    return img

            # JSON-LD
            for s in soup.find_all("script", type="application/ld+json"):
                try:
                    d = json.loads(s.string or "")
                    items = d if isinstance(d, list) else [d]
                    for it in items:
                        if it.get("@type") in ("Product", "ProductGroup", "ItemPage"):
                            raw = it.get("image")
                            if isinstance(raw, str): return raw
                            if isinstance(raw, list) and raw:
                                first = raw[0]
                                return first.get("url", first) if isinstance(first, dict) else first
                            if isinstance(raw, dict): return raw.get("url", "")
                except Exception:
                    pass

            # Largest non-logo img
            best = None
            best_score = 0
            for el in page.query_selector_all("img"):
                try:
                    src = el.get_attribute("src") or el.get_attribute("data-src") or ""
                    if not src or src.startswith("data:"):
                        continue
                    if any(bad in src.lower() for bad in ["logo", "icon", "placeholder", "sprite", "svg"]):
                        continue
                    w = el.get_attribute("width") or "0"
                    h = el.get_attribute("height") or "0"
                    try: score = int(str(w)) * int(str(h))
                    except: score = 1
                    if score > best_score:
                        best_score = score
                        best = src
                except Exception:
                    pass
            return best
        except Exception as e:
            print(f"  Playwright feil: {e}")
            return None
        finally:
            browser.close()


# ── Items to fix ──────────────────────────────────────────────────────────────
# force=True: always re-fetch even if image exists
FORCE_ITEMS = [
    "Jack & Jones Premium Imitert Skinnjakke",
    "Moschino Lommebok",
    "Pro BB Hood",
]

data = client.read()
changed = False

for item in data["items"]:
    name = item.get("name", "")
    current = item.get("image", "") or ""
    url = item.get("url", "")

    is_logo = any(bad in current.lower() for bad in ["logo", "icon"]) and current
    is_missing = not current
    is_forced = any(f.lower() in name.lower() for f in FORCE_ITEMS)

    if not (is_logo or is_missing or is_forced):
        continue
    if not url:
        print(f"Ingen URL: {name[:50]}")
        continue

    print(f"Henter: {name[:50]}")
    img = playwright_image(url)
    if img and isinstance(img, str) and img.startswith("http"):
        item["image"] = img
        print(f"  OK: {img[:90]}")
        changed = True
        # Save incrementally in case of crash
        client.write(data)
        print("  (lagret)")
    else:
        print(f"  Ingen bilde funnet (retur: {type(img).__name__})")

print("\nFerdig.")
