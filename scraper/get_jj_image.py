"""Henter J&J PREMIUM skinnjakke-bilde via Playwright."""
import sys, re
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

URLS = [
    "https://www.jackjones.com/en-gb/product/12261196_2161/biker-collar-jacket",
    "https://www.jackjones.com/en-gb/premium/jackets",
    "https://www.jackjones.com/no/no/product/12261196_2161",
]

def get_og_image(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
            extra_http_headers={"Accept-Language": "en-GB,en;q=0.9"}
        )
        try:
            resp = page.goto(url, wait_until="domcontentloaded", timeout=25000)
            if resp and resp.status >= 400:
                return None, f"HTTP {resp.status}"
            page.wait_for_timeout(3000)
            html = page.content()
            soup = BeautifulSoup(html, "lxml")

            og = soup.find("meta", property="og:image")
            if og and og.get("content"):
                img = og["content"]
                if "logo" not in img.lower() and "icon" not in img.lower():
                    return img, None

            # Look for any product image
            for pat in [r'https://[^\s"\'<>]+images\.jackjones[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)',
                        r'https://[^\s"\'<>]+cdn[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)'
                        ]:
                for m in re.finditer(pat, html):
                    candidate = m.group(0)
                    if "black" in candidate.lower() or "2161" in candidate:
                        return candidate, None

            return None, "Ingen bilde funnet"
        except Exception as e:
            return None, str(e)
        finally:
            browser.close()

for url in URLS:
    print(f"Prover: {url[:70]}")
    img, err = get_og_image(url)
    if img:
        print(f"  Bilde: {img[:100]}")
        break
    else:
        print(f"  Feil: {err}")
