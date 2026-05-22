"""
Fikser Power.no-prisen og Next.no-prisen med Playwright, og markerer utsolgte Zalando-varer.
"""
import sys, re
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import parse_nok_price, USER_AGENT

SOLD_OUT_ZALANDO = [
    "jam22t0ck",  # Jack & Jones Skinnjakke
    "jam22t0cb",  # Jack & Jones Lett Jakke
    "6mo52f008",  # Moschino Lommebok
    "po222s0hu",  # PRL Vest
]

def pw_scrape_price(url: str, price_sel: str) -> int | None:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            page.wait_for_timeout(3000)
            # JSON-LD
            content = page.content()
            import json
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(content, "lxml")
            for tag in soup.find_all("script", type="application/ld+json"):
                try:
                    data = json.loads(tag.string or "")
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        if item.get("@type") in ("Product", "ProductGroup"):
                            offers = item.get("offers") or {}
                            if isinstance(offers, list): offers = offers[0]
                            raw = offers.get("price") or offers.get("lowPrice")
                            if raw:
                                p2 = parse_nok_price(str(raw))
                                if p2 and 10 < p2 < 30000:
                                    return p2
                except Exception:
                    pass
            # CSS selector
            try:
                text = page.text_content(price_sel, timeout=6000)
                return parse_nok_price(text)
            except PWTimeout:
                pass
        except Exception as e:
            print(f"  Playwright-feil: {e}")
        finally:
            browser.close()
    return None


def main():
    data = client.read()
    changed = False

    for item in data["items"]:
        url = item.get("url", "").lower()
        name = item.get("name", "")

        # Merk utsolgte Zalando-varer
        if "zalando.no" in url and not item.get("price_current"):
            is_soldout = any(zid in url for zid in SOLD_OUT_ZALANDO)
            if is_soldout:
                item["last_error"] = "Ser ut til å være utsolgt / fjernet fra Zalando"
                print(f"Utsolgt Zalando: {name}")
                changed = True
            continue

        # Fiks Power.no-sleeve med feil pris
        if "power.no" in url and item.get("price_current", 0) > 50000:
            print(f"Fikser Power.no: {name}")
            price = pw_scrape_price(item["url"], ".product-price, [class*='price-now'], [class*='current-price']")
            if price:
                item["price_current"] = price
                item["last_error"] = None
                print(f"  Ny pris: {price} kr")
                changed = True
            else:
                print(f"  Kunne ikke hente pris")

        # Fiks Next.no
        if "next.no" in url and not item.get("price_current"):
            print(f"Fikser Next.no: {name}")
            price = pw_scrape_price(item["url"], "[data-testid='price'], .price, [class*='Price']")
            if price:
                item["price_current"] = price
                item["last_error"] = None
                print(f"  Ny pris: {price} kr")
                changed = True
            else:
                print(f"  Kunne ikke hente pris")

    if changed:
        print("Lagrer til JSONBin...")
        client.write(data)
    print("Ferdig.")


if __name__ == "__main__":
    main()
