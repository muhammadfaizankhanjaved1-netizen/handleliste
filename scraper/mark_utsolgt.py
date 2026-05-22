import sys, requests
from bs4 import BeautifulSoup
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import USER_AGENT

UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"

def get_og_image(url):
    for ua in [UA_DESKTOP, USER_AGENT]:
        try:
            r = requests.get(url, headers={"User-Agent": ua}, timeout=10)
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
    if item.get("status") == "ønske" and not item.get("price_current"):
        item["utsolgt"] = True
        item["last_error"] = None
        print(f"Utsolgt: {item['name']}", end=" ")
        if not item.get("image"):
            img = get_og_image(item["url"])
            if img:
                item["image"] = img
                print(f"+ bilde ✓")
            else:
                print(f"(ingen bilde)")
        else:
            print(f"(bilde allerede OK)")
        changed = True

if changed:
    client.write(data)
    print("Lagret.")
