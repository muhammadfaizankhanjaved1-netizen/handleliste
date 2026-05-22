import sys, re, json
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from scrape import USER_AGENT, parse_nok_price
import requests
from bs4 import BeautifulSoup

url = "https://www.power.no/data-og-tilbehoer/veske-og-sekk/sleeve/ferrelli-pure-mac-sleeve-15-16-svart/p-1000690/"

r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15)
print(f"Status: {r.status_code}")
soup = BeautifulSoup(r.text, "lxml")

# JSON-LD
for tag in soup.find_all("script", type="application/ld+json"):
    try:
        data = json.loads(tag.string or "")
        items = data if isinstance(data, list) else [data]
        for item in items:
            if item.get("@type") in ("Product", "ProductGroup"):
                print("JSON-LD Product:", json.dumps(item.get("offers", {}), indent=2)[:300])
    except:
        pass

# og:meta
for prop in ["product:price:amount", "og:price:amount"]:
    tag = soup.find("meta", property=prop)
    if tag:
        print(f"meta[{prop}]: {tag.get('content')}")

# Source price patterns
patterns = [
    r'"price":\s*"?(\d[\d., ]+)"?',
    r'"salesPrice":\s*"?(\d[\d., ]+)"?',
    r'"currentPrice":\s*"?(\d[\d., ]+)"?',
]
for pat in patterns:
    for m in re.findall(pat, r.text):
        p = parse_nok_price(m)
        if p and 50 < p < 50000:
            print(f"  Source regex [{pat[:30]}]: {m!r} => {p} kr")
            break
