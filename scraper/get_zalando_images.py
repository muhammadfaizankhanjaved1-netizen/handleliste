"""Prover aa hente Zalando-bilder via Playwright med kortere timeout."""
import sys, re, json
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

ITEMS = {
    "Jack & Jones Premium Imitert Skinnjakke": {
        "urls": [
            "https://www.zalando.no/jack-and-jones-premium-imitert-skinnjakke-black-jam22t0ck-q11.html",
            "https://www.zalando.se/jack-and-jones-premium-imitert-skinnjakke-black-jam22t0ck-q11.html",
        ]
    },
    "Moschino Lommebok": {
        "urls": [
            "https://www.zalando.no/moschino-portafogli-lommebok-nero-6mo52f008-q11.html",
        ]
    },
}

def try_get_image(page, url: str) -> str | None:
    try:
        resp = page.goto(url, wait_until="domcontentloaded", timeout=30000)
        if resp and resp.status >= 400:
            print(f"  HTTP {resp.status}")
            return None
        page.wait_for_timeout(5000)
        html = page.content()
        soup = BeautifulSoup(html, "lxml")

        # Check for bot page
        title = page.title()
        print(f"  Tittel: {title[:60]}")
        if any(b in title.lower() for b in ["robot", "captcha", "blocked", "access"]):
            return None

        # og:image
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            img = og["content"]
            if "img" in img and not any(b in img.lower() for b in ["logo", "icon"]):
                return img

        # img01.ztat.net
        for m in re.finditer(r'https://img\d+\.ztat\.net[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)', html):
            return m.group(0)

        # Any product img
        for el in page.query_selector_all("img[src*='ztat.net'], img[src*='zalando']"):
            try:
                src = el.get_attribute("src") or ""
                if src and "ztat.net" in src:
                    return src
            except Exception:
                pass

        return None
    except Exception as e:
        print(f"  Feil: {e}")
        return None

data = client.read()
changed = False

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        viewport={"width": 1280, "height": 800},
        extra_http_headers={"Accept-Language": "no-NO,no;q=0.9"},
    )
    page = context.new_page()

    for name_frag, cfg in ITEMS.items():
        matched = [i for i in data["items"] if name_frag.lower() in i.get("name","").lower()]
        if not matched:
            print(f"Ikke funnet i data: {name_frag}")
            continue
        item = matched[0]
        print(f"\nProver: {item['name'][:50]}")

        img = None
        for url in cfg["urls"]:
            print(f"  URL: {url[:60]}")
            img = try_get_image(page, url)
            if img:
                break

        if img:
            item["image"] = img
            print(f"  Bilde: {img[:90]}")
            changed = True
            client.write(data)
            print("  (lagret)")
        else:
            print("  Ingen bilde funnet")

    browser.close()

print("\nFerdig.")
