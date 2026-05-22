import sys, re, requests
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import USER_AGENT

UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"

def zalando_image(url):
    m = re.search(r"-([A-Z0-9]{5,15})-[A-Z]\d+\.html", url, re.IGNORECASE)
    if not m:
        return None
    article_id = m.group(1).upper()
    try:
        r = requests.get(
            f"https://api.zalando.com/articles/{article_id}",
            headers={"User-Agent": UA_DESKTOP, "Accept-Language": "nb-NO"},
            timeout=10
        )
        if not r.ok:
            return None
        d = r.json()
        imgs = d.get("media", {}).get("images", [])
        if imgs:
            return imgs[0].get("largeHdUrl") or imgs[0].get("largeUrl")
    except Exception:
        pass
    return None

def next_image(url):
    for ua in [UA_DESKTOP, USER_AGENT]:
        try:
            r = requests.get(url, headers={"User-Agent": ua, "Accept-Language": "nb-NO,nb;q=0.9"}, timeout=10)
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(r.text, "lxml")
            tag = soup.find("meta", property="og:image")
            if tag and tag.get("content"):
                return tag["content"]
        except Exception:
            pass
    return None

data = client.read()
changed = False

for item in data["items"]:
    if item.get("image"):
        continue
    url = item.get("url", "")
    img = None
    if "zalando." in url:
        img = zalando_image(url)
    elif "next.no" in url:
        img = next_image(url)
    if img:
        item["image"] = img
        print(f"Bilde OK: {item['name'][:45]}")
        changed = True
    else:
        print(f"Ingen bilde: {item['name'][:45]}")

if changed:
    client.write(data)
    print("Lagret.")
print("Ferdig.")
