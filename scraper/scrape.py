import re
import json
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

SELECTORS_FILE = Path(__file__).parent.parent / "selectors.json"
USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)
_domain_last_request: dict[str, float] = {}


def get_domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    for part in ["www.", "m."]:
        host = host.replace(part, "")
    return host


def rate_limit(domain: str, delay: float = 2.0):
    last = _domain_last_request.get(domain, 0)
    wait = delay - (time.time() - last)
    if wait > 0:
        time.sleep(wait)
    _domain_last_request[domain] = time.time()


def parse_nok_price(text) -> int | None:
    if not text:
        return None
    text = str(text).strip()
    text = re.sub(r"(?i)(kr\.?|nok)", "", text).strip()
    text = text.replace(",-", "").replace(":-", "").strip()
    text = re.sub(r"\s| ", "", text)
    # remove trailing ,00 or .00
    text = re.sub(r"[,.]00$", "", text)
    # remove all remaining dots and commas (thousands separators)
    text = re.sub(r"[,.]", "", text)
    text = re.sub(r"[^\d]", "", text)
    try:
        return int(text) if text else None
    except ValueError:
        return None


def _og_meta(soup: BeautifulSoup) -> dict:
    def meta(prop):
        tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        return tag.get("content", "").strip() if tag else None

    def itemprop(name):
        tag = soup.find(attrs={"itemprop": name})
        return (tag.get("content") or tag.get_text()).strip() if tag else None

    name = (
        meta("og:title")
        or meta("product:title")
        or (soup.title.get_text().strip() if soup.title else None)
    )
    image = meta("og:image") or meta("product:image")
    price_raw = (
        meta("product:price:amount")
        or meta("og:price:amount")
        or itemprop("price")
        or meta("price")
    )
    currency = meta("product:price:currency") or meta("og:price:currency") or "NOK"
    return {"name": name, "image": image, "price_raw": price_raw, "currency": currency}


def _playwright_scrape(url: str, selectors: dict) -> dict:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    result = {"name": None, "image": None, "price_raw": None}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            page.wait_for_timeout(2000)

            if sel := selectors.get("price"):
                try:
                    result["price_raw"] = page.text_content(sel, timeout=8000)
                except PWTimeout:
                    pass

            if sel := selectors.get("name"):
                try:
                    result["name"] = page.text_content(sel, timeout=5000)
                except PWTimeout:
                    pass

            # image always from og:meta in page source
            og_img = page.query_selector("meta[property='og:image']")
            if og_img:
                result["image"] = og_img.get_attribute("content")

        except Exception as e:
            result["error"] = str(e)
        finally:
            browser.close()
    return result


def load_selectors() -> dict:
    try:
        return json.loads(SELECTORS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def guess_categories(url: str, name: str = "") -> list[str]:
    url_l = url.lower()
    name_l = (name or "").lower()
    combined = url_l + " " + name_l

    domain_defaults = {
        "zalando": ["Klær"],
        "boozt":   ["Klær"],
        "xxl":     ["Gym", "Fritid"],
        "power":   ["Skole"],
        "elkjop":  ["Skole"],
        "komplett":["Skole"],
    }
    cats = []
    for domain, default in domain_defaults.items():
        if domain in url_l:
            cats = default[:]
            break

    keyword_map = {
        "Gym":    ["treningss", "løpes", "gym", "fitness", "sport"],
        "Klær":   ["bukse", "genser", "jakke", "skjorte", "t-skjort", "klær", "undertøy", "støvl", "sandal"],
        "Skole":  ["pc", "laptop", "bærbar", "penn", "blyant", "bok", "mappe", "vesker"],
        "Fritid": ["fotball", "flaske", "kosttilskudd", "protein", "kamera"],
    }
    for cat, words in keyword_map.items():
        if any(w in combined for w in words) and cat not in cats:
            cats.append(cat)

    return cats[:2] if cats else ["Klær"]


def scrape(url: str) -> dict:
    domain = get_domain(url)
    rate_limit(domain)
    selectors = load_selectors().get(domain, {})

    result = {"name": None, "image": None, "price_current": None,
              "currency": "NOK", "categories": [], "error": None}

    # Step 1: og:meta via requests
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=12)
        soup = BeautifulSoup(resp.text, "lxml")
        og = _og_meta(soup)
        result["name"]    = og["name"]
        result["image"]   = og["image"]
        result["currency"] = og["currency"] or "NOK"
        price = parse_nok_price(og["price_raw"])
        if price:
            result["price_current"] = price
    except Exception as e:
        result["error"] = f"og:meta feil: {e}"

    # Step 2: Playwright if price or name missing
    if not result["price_current"] or not result["name"]:
        try:
            pw = _playwright_scrape(url, selectors)
            if not result["name"] and pw.get("name"):
                result["name"] = pw["name"].strip()
            if not result["image"] and pw.get("image"):
                result["image"] = pw["image"]
            if not result["price_current"]:
                result["price_current"] = parse_nok_price(pw.get("price_raw"))
            if pw.get("error"):
                result["error"] = pw["error"]
            else:
                result["error"] = None
        except Exception as e:
            result["error"] = f"Playwright feil: {e}"

    result["categories"] = guess_categories(url, result["name"] or "")
    return result


def scrape_price_only(url: str) -> int | None:
    domain = get_domain(url)
    rate_limit(domain)
    selectors = load_selectors().get(domain, {})

    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=12)
        soup = BeautifulSoup(resp.text, "lxml")
        og = _og_meta(soup)
        price = parse_nok_price(og["price_raw"])
        if price:
            return price
    except Exception:
        pass

    if price_sel := selectors.get("price"):
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(user_agent=USER_AGENT)
                page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                page.wait_for_timeout(2000)
                text = page.text_content(price_sel, timeout=8000)
                browser.close()
                return parse_nok_price(text)
        except Exception:
            pass

    return None
