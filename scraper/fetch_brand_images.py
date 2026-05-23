"""Henter bilder fra merkets egne nettsider og andre forhandlere."""
import sys, requests, json, re
from bs4 import BeautifulSoup
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}

def og(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
        if not r.ok: return None
        soup = BeautifulSoup(r.text, "lxml")
        tag = soup.find("meta", property="og:image")
        if tag and tag.get("content"):
            return tag["content"]
        # JSON-LD fallback
        for s in soup.find_all("script", type="application/ld+json"):
            try:
                d = json.loads(s.string or "")
                imgs = d.get("image", [])
                if isinstance(imgs, list) and imgs: return imgs[0]
                if isinstance(imgs, str): return imgs
            except: pass
    except Exception as e:
        print(f"  Feil: {e}")
    return None

# Manuell mapping: varenavn-fragment -> URL pa brand-side
BRAND_URLS = {
    "Houndstooth": "https://www.ralphlauren.com/men-clothing-sweatshirts/houndstooth-luxury-jersey-pullover/650373.html",
    "Quarter Zip": "https://www.ralphlauren.com/men-clothing-sweatshirts/estate-rib-quarter-zip-pullover/462512.html",
    "Polo Ralph Lauren Vest": "https://www.ralphlauren.com/men-clothing-jackets-coats-vests/r/vests/polo-ralph-lauren",
    "Skinnjakke": "https://www.jackjones.com/en-us/product/12269629_2161/biker-collar-jacket",
    "Blend Lett Jakke": "https://www.jackjones.com/en-us/jackets",
    "Moschino": "https://www.farfetch.com/no/shopping/men/moschino-wallets-1/items.aspx",
    "Next Skjorte": "https://www.next.us/en/style/su396805/e66541",
}

data = client.read()
changed = False

for item in data["items"]:
    if item.get("image"):
        continue
    name = item.get("name", "")
    matched_url = None
    for key, url in BRAND_URLS.items():
        if key.lower() in name.lower():
            matched_url = url
            break
    if not matched_url:
        print(f"Ingen brand-URL: {name[:45]}")
        continue
    print(f"Prover brand: {name[:40]} -> {matched_url[:50]}...")
    img = og(matched_url)
    if img:
        item["image"] = img
        print(f"  Bilde OK!")
        changed = True
    else:
        print(f"  Ingen bilde")

if changed:
    client.write(data)
    print("Lagret.")
print("Ferdig.")
