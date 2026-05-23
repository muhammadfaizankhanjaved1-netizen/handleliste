import re
import json
import time
from pathlib import Path
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup

# ── Shopify JSON API ──────────────────────────────────────────────────────────
def _shopify_scrape(url: str) -> dict | None:
    """Henter produkt via Shopify sitt eget JSON-endepunkt — ingen blokkering."""
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    # Ekstraher product handle fra URL
    m = re.search(r"/products/([^/?#]+)", path)
    if not m:
        return None
    handle = m.group(1)
    base = f"{parsed.scheme}://{parsed.netloc}"
    api_url = f"{base}/products/{handle}.json"
    try:
        r = requests.get(api_url, headers={"User-Agent": USER_AGENT}, timeout=10)
        if not r.ok:
            return None
        p = r.json().get("product", {})
        if not p:
            return None
        name  = p.get("title")
        image = (p.get("images") or [{}])[0].get("src")
        price_raw = (p.get("variants") or [{}])[0].get("price")
        price = parse_nok_price(str(price_raw)) if price_raw else None
        return {"name": name, "image": image, "price_current": price, "error": None}
    except Exception as e:
        return {"error": str(e)}

# ── FINN.no ───────────────────────────────────────────────────────────────────
def _finn_scrape(url: str) -> dict | None:
    m = re.search(r"finnkode=(\d+)", url)
    if not m:
        return None
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=12)
        soup = BeautifulSoup(r.text, "lxml")
        name = None
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            name = re.sub(r"\s*\|.*$", "", og_title["content"]).strip()
        if not name:
            h1 = soup.find("h1")
            if h1:
                name = h1.get_text(strip=True)
        og_img = soup.find("meta", property="og:image")
        image = og_img["content"] if og_img and og_img.get("content") else None
        price = None
        # JSON-LD
        for tag in soup.find_all("script", type="application/ld+json"):
            try:
                d = json.loads(tag.string or "")
                offers = d.get("offers", {})
                if isinstance(offers, list):
                    offers = offers[0]
                raw = offers.get("price") or offers.get("lowPrice")
                if raw:
                    price = parse_nok_price(str(raw))
                    break
            except Exception:
                pass
        # Fallback: tekst-søk etter pris i HTML
        if not price:
            price = _source_price(r.text)
        return {"name": name, "image": image, "price_current": price, "error": None}
    except Exception as e:
        return {"error": str(e)}

# ── Zalando API ───────────────────────────────────────────────────────────────
def _zalando_scrape(url: str) -> dict | None:
    """Henter produkt via Zalando sin offentlige katalog-API."""
    m = re.search(r"-([A-Z0-9]{5,15})-[A-Z]\d+\.html", url, re.IGNORECASE)
    if not m:
        # Prøv å finne artikkel-ID på slutten av URL-en
        m = re.search(r"([A-Z0-9]{5,15})-[A-Z]\d+\.html", url, re.IGNORECASE)
    if not m:
        return None
    article_id = m.group(1).upper()
    try:
        api_url = f"https://api.zalando.com/articles/{article_id}"
        headers = {
            "User-Agent": USER_AGENT,
            "Accept-Language": "nb-NO,nb;q=0.9",
        }
        r = requests.get(api_url, headers=headers, timeout=10)
        if not r.ok:
            return None
        d = r.json()
        name  = d.get("name")
        units = d.get("units", [{}])
        price = None
        for u in units:
            p = u.get("price", {}).get("value")
            if p:
                price = int(float(p))
                break
        image = None
        imgs = d.get("media", {}).get("images", [])
        if imgs:
            image = imgs[0].get("largeHdUrl") or imgs[0].get("largeUrl")
        return {"name": name, "image": image, "price_current": price, "error": None}
    except Exception as e:
        return {"error": str(e)}

SELECTORS_FILE = Path(__file__).parent.parent / "selectors.json"


def search_image(name: str) -> str | None:
    """Soker etter produktbilde via Bing Images som siste utvei."""
    try:
        from urllib.parse import quote_plus
        q = quote_plus(f"{name} product")
        r = requests.get(
            f"https://www.bing.com/images/search?q={q}&form=HDRSC2&first=1",
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
                     "Accept-Language": "en-US,en;q=0.9"},
            timeout=10,
        )
        # Bing embed product images as murl in JSON attributes
        for m in re.finditer(r'"murl":"(https?://[^"]+\.(?:jpg|jpeg|png|webp))"', r.text):
            url = m.group(1)
            if any(skip in url for skip in ["bing.com", "microsoft.com"]):
                continue
            return url
    except Exception:
        pass
    return None
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
    # fjern desimaldel (.90 / ,9000 osv) — norske priser er alltid hele kroner
    text = re.sub(r"[,.](\d+)$", "", text)
    # fjern tusenskilletegn
    text = re.sub(r"[,.]", "", text)
    text = re.sub(r"[^\d]", "", text)
    try:
        return int(text) if text else None
    except ValueError:
        return None


def _source_price(html: str) -> int | None:
    """Last-resort: find price in JS data blobs in page source."""
    patterns = [
        r'"salesPrice"[:\s]+(\d[\d .,]+)',
        r'"currentPrice"[:\s]+(\d[\d .,]+)',
        r'"salePrice"[:\s]+(\d[\d .,]+)',
        r'"price"[:\s]+"?(\d[\d .,]+)"?',
    ]
    for pat in patterns:
        matches = re.findall(pat, html)
        for m in matches:
            p = parse_nok_price(m)
            if p and 10 < p < 500_000:
                return p
    return None


def _json_ld(soup: BeautifulSoup) -> dict:
    result = {"name": None, "image": None, "price_raw": None}
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                t = item.get("@type", "")
                if t in ("Product", "ProductGroup", "ItemPage"):
                    result["name"] = result["name"] or item.get("name")
                    img = item.get("image")
                    if img and not result["image"]:
                        result["image"] = img[0] if isinstance(img, list) else img
                    offers = item.get("offers") or item.get("offer")
                    if offers:
                        if isinstance(offers, list):
                            offers = offers[0]
                        result["price_raw"] = (
                            offers.get("price") or offers.get("lowPrice")
                        )
        except Exception:
            continue
    return result


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

            # parse full rendered page for og:meta + JSON-LD
            try:
                ld_src = page.content()
                ld_soup = BeautifulSoup(ld_src, "lxml")
                og_img = ld_soup.find("meta", property="og:image")
                if og_img:
                    result["image"] = og_img.get("content")
                ld = _json_ld(ld_soup)
                if not result["image"]:
                    result["image"] = ld.get("image")
                if not result.get("price_raw") and ld.get("price_raw") is not None:
                    result["price_raw"] = str(ld["price_raw"])
                if not result.get("name") and ld.get("name"):
                    result["name"] = ld["name"]
            except Exception:
                pass

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


_TRACKING_PARAMS = {
    "cq_src","cq_cmp","cq_con","cq_term","cq_med","cq_plac","cq_net","cq_pos","cq_plt",
    "gad_source","gad_campaignid","gbraid","wbraid","gclid","fbclid","msclkid",
    "utm_source","utm_medium","utm_campaign","utm_term","utm_content",
    "st","volume",
}

def _clean_url(url: str) -> str:
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
    p = urlparse(url)
    qs = {k: v for k, v in parse_qs(p.query, keep_blank_values=False).items()
          if k.lower() not in _TRACKING_PARAMS}
    cleaned = urlunparse(p._replace(query=urlencode(qs, doseq=True)))
    return cleaned

def scrape(url: str) -> dict:
    url = _clean_url(url)
    domain = get_domain(url)
    rate_limit(domain)
    selectors = load_selectors().get(domain, {})

    result = {"name": None, "image": None, "price_current": None,
              "currency": "NOK", "categories": [], "error": None}

    # Step 0: FINN.no
    if "finn.no" in domain:
        fr = _finn_scrape(url)
        if fr and not fr.get("error"):
            result.update({k: v for k, v in fr.items() if v is not None})
            result["categories"] = guess_categories(url, result.get("name") or "")
            return result

    # Step 0: Zalando-spesifikk API
    if "zalando." in domain:
        zr = _zalando_scrape(url)
        if zr and (zr.get("name") or zr.get("price_current")):
            result.update({k: v for k, v in zr.items() if v is not None})
            result["categories"] = guess_categories(url, result.get("name") or "")
            return result

    # Step 0b: Shopify JSON API (for boozt, extremefitness, dahlbergs osv.)
    if re.search(r"/products/", url):
        sr = _shopify_scrape(url)
        if sr and (sr.get("name") or sr.get("price_current")):
            result.update({k: v for k, v in sr.items() if v is not None})
            result["categories"] = guess_categories(url, result.get("name") or "")
            return result

    # Step 1: og:meta + JSON-LD + source regex via requests
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=12)
        soup = BeautifulSoup(resp.text, "lxml")
        og = _og_meta(soup)
        ld = _json_ld(soup)
        raw_name = og["name"] or ld["name"]
        if raw_name:
            # Strip " | Butikknavn" suffix
            raw_name = re.sub(r"\s*\|.*$", "", raw_name).strip()
            # Clean "Navn - Kategori - Navn" duplicates
            if " - " in raw_name:
                parts = [p.strip() for p in raw_name.split(" - ")]
                if parts[0] == parts[-1] or (len(parts) >= 3 and parts[0] == parts[2]):
                    raw_name = parts[0]
        result["name"]     = raw_name
        result["image"]    = og["image"] or ld["image"]
        result["currency"] = og["currency"] or "NOK"
        price = (parse_nok_price(og["price_raw"])
                 or parse_nok_price(ld["price_raw"])
                 or _source_price(resp.text))
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

    # Step 3: DuckDuckGo image search fallback hvis bilde mangler
    if not result["image"] and result["name"]:
        result["image"] = search_image(result["name"])

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
