"""Siste forsok: Next-bilde via Playwright med stealth-innstillinger."""
from playwright.sync_api import sync_playwright
import re

URLS = [
    "https://www.next.us/en/style/su396805/e66541",
    "https://www.next.no/en/style/su396805/e66541",
    "https://www.nextdirect.com/cn/en/style/su396805/e66541",
]

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
        ]
    )
    for url in URLS:
        print(f"\nProver: {url[:60]}")
        context = browser.new_context(
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
            viewport={"width": 390, "height": 844},
            locale="en-US",
        )
        page = context.new_page()
        try:
            resp = page.goto(url, wait_until="domcontentloaded", timeout=25000)
            print(f"  Status: {resp.status if resp else 'N/A'}")
            page.wait_for_timeout(5000)
            html = page.content()
            title = page.title()
            print(f"  Tittel: {title[:70]}")

            # og:image
            m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html)
            if not m:
                m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html)
            if m:
                print(f"  og:image: {m.group(1)[:100]}")
                break

            # xcdn
            for mu in re.finditer(r'https?://xcdn\.next\.co\.uk[^\s"\'<>]+', html):
                print(f"  xcdn: {mu.group(0)[:100]}")
                break

            # Any img
            imgs = page.query_selector_all("img")
            for img in imgs[:5]:
                try:
                    src = img.get_attribute("src") or ""
                    if src and not src.startswith("data:"):
                        print(f"  img: {src[:100]}")
                except Exception:
                    pass

        except Exception as e:
            print(f"  Feil: {e}")
        finally:
            context.close()

    browser.close()
