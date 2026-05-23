import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import search_image

data = client.read()
changed = False

for item in data["items"]:
    if item.get("image"):
        continue
    name = item.get("name", "")
    if not name:
        continue
    print(f"Soker bilde: {name[:45]}...")
    img = search_image(name)
    if img:
        item["image"] = img
        print(f"  OK: {img[:70]}")
        changed = True
    else:
        print(f"  Ingen bilde funnet")

if changed:
    client.write(data)
    print("Lagret.")
print("Ferdig.")
