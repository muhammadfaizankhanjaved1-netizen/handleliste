"""Alt-i-ett fix: Boozt OOPS, sporingslenker, Jacob Cohen status, last_error, bilder."""
import sys, re
from urllib.parse import urlparse, urlunsplit
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import scrape, USER_AGENT

def clean_url(url):
    """Fjern sporingsparametere, behold bare ren produkt-URL."""
    p = urlparse(url)
    # Zalando: fjern alt etter ? unntatt eventuelt sku
    if "zalando." in p.netloc:
        return urlunsplit((p.scheme, p.netloc, p.path, "", ""))
    # Next.no: fjern tracking
    if "next.no" in p.netloc:
        return urlunsplit((p.scheme, p.netloc, p.path, "", ""))
    # Boozt: fjern utm
    if "boozt.com" in p.netloc:
        params = "&".join(q for q in (p.query or "").split("&") if not q.startswith("utm_"))
        return urlunsplit((p.scheme, p.netloc, p.path, params, ""))
    return url

def pw_get_image(url):
    from playwright.sync_api import sync_playwright, TimeoutError as PWT
    with sync_playwright() as pw:
        br = pw.chromium.launch(headless=True)
        page = br.new_page(user_agent=USER_AGENT)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=25000)
            page.wait_for_timeout(1500)
            img = page.evaluate("()=>document.querySelector('meta[property=\"og:image\"]')?.content")
            return img
        except Exception:
            return None
        finally:
            br.close()

data = client.read()
items = data["items"]
changed = False

# ── 1. Rens sporingslenker ────────────────────────────────────────────────────
for item in items:
    clean = clean_url(item.get("url", ""))
    if clean != item.get("url"):
        print(f"URL ryddet: {item['name'][:40]}")
        item["url"] = clean
        changed = True

# ── 2. Jacob Cohen status ─────────────────────────────────────────────────────
for item in items:
    if "jacob cohen" in (item.get("name") or "").lower() and not item.get("status"):
        item["status"] = "ønske"
        print(f"Status fikset: {item['name']}")
        changed = True

# ── 3. Rydd last_error der vi nå har pris ────────────────────────────────────
for item in items:
    if item.get("price_current") and item.get("last_error"):
        item["last_error"] = None
        changed = True

# ── 4. Slå sammen Boozt OOPS-duplikater, re-scrape én ────────────────────────
oops = [i for i in items if (i.get("name") or "").startswith("Boozt OOPS")]
if len(oops) >= 2:
    # Behold første, fjern resten
    for dup in oops[1:]:
        items.remove(dup)
        print(f"Fjernet duplikat Boozt OOPS")
        changed = True

for item in items:
    if (item.get("name") or "").startswith("Boozt OOPS"):
        url = item["url"]
        print(f"Re-scraper Boozt: {url[:60]}")
        res = scrape(url)
        if res.get("name") and not res["name"].startswith("Boozt OOPS"):
            item.update({
                "name": res["name"],
                "image": res.get("image"),
                "price_current": res.get("price_current"),
                "categories": res.get("categories", []),
                "last_error": res.get("error"),
            })
            if not res.get("price_current"):
                item["utsolgt"] = True
            print(f"  => {item['name']} | {item['price_current']} kr")
        else:
            item["name"] = "Portia Brown Croco Leather Belt"
            item["utsolgt"] = True
            item["last_error"] = None
            print(f"  => Utsolgt/feilside — merket")
        changed = True

# ── 5. Hent bilder for varer uten bilde (Playwright) ─────────────────────────
no_img = [i for i in items if not i.get("image") and i.get("url")]
if no_img:
    print(f"\nHenter bilder for {len(no_img)} vare(r) via Playwright...")
    for item in no_img:
        img = pw_get_image(item["url"])
        if img:
            item["image"] = img
            print(f"  Bilde OK: {item['name'][:40]}")
            changed = True
        else:
            print(f"  Ingen bilde: {item['name'][:40]}")

data["items"] = items
if changed:
    client.write(data)
    print("\nLagret til JSONBin OK")
print(f"Ferdig — {len(items)} varer totalt.")
