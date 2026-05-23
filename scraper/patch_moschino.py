"""Patcher Moschino lommebok-bilde direkte inn i JSONBin."""
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client

data = client.read()
changed = False

for item in data["items"]:
    if item.get("image"):
        continue
    name = item.get("name", "")
    if "moschino" in name.lower():
        item["image"] = "https://cdn-images.farfetch-contents.com/18/25/49/68/18254968_39521551_322.jpg"
        print(f"Patcha Moschino: {name[:60]}")
        changed = True

if changed:
    client.write(data)
    print("Lagret til JSONBin.")
else:
    print("Ingen endringer (allerede bilde eller ikke funnet).")
print("Ferdig.")
