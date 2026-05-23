"""
Henter bilder via alternative domener:
- Zalando .no -> .co.uk (samme produkt-ID)
- next.no -> next.us
"""
import sys, re, requests
from bs4 import BeautifulSoup
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"

def og_image(url):
    try:
        r = requests.get(url, headers={"User-Agent": UA, "Accept-Language": "en-GB,en;q=0.9"}, timeout=12)
        if not r.ok:
            return None
        soup = BeautifulSoup(r.text, "lxml")
        tag = soup.find("meta", property="og:image")
        return tag["content"] if tag and tag.get("content") else None
    except Exception:
        return None

def alt_url(url):
    if "zalando.no" in url:
        # Swap .no -> .co.uk, and fjern tracking-params
        clean = re.sub(r"\?.*$", "", url)
        return clean.replace("zalando.no", "zalando.co.uk")
    if "next.no" in url:
        clean = re.sub(r"\?.*$", "", url)
        return clean.replace("next.no", "next.us")
    return None

data = client.read()
changed = False

for item in data["items"]:
    if item.get("image"):
        continue
    url = item.get("url", "")
    name = item.get("name", "")[:45]
    alt = alt_url(url)
    if not alt:
        print(f"Ingen alt-URL: {name}")
        continue
    print(f"Prover {alt[:60]}...")
    img = og_image(alt)
    if img:
        item["image"] = img
        print(f"  Bilde OK: {name}")
        changed = True
    else:
        print(f"  Ingen bilde: {name}")

if changed:
    client.write(data)
    print("Lagret.")
print(f"Ferdig.")
