"""Patcher 5 kjente bilde-URLer direkte inn i JSONBin."""
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client

# Manuelt verifiserte bilde-URLer: name-fragment -> image URL
PATCHES = {
    "Houndstooth": "https://image-resizing.booztcdn.com/polo-ralph-lauren/raf710979497_calpinebrownhtr_v105734846zn.webp?has_grey=1&has_webp=1&version=b604e9f8b77542674b601fec16e3328d&size=w400&dpr=2.5",
    "Quarter Zip": "https://www.thesportinglodge.com/cdn/shop/files/Polo-Ralph-Lauren-Estate-Rib-Quarter-Zip-Pullover-Polo-Black_0000_Layer-7-1_074eea35-2620-4e8b-8145-f11f3fd69a89.jpg?v=1713932907&width=1946",
    "Skinnjakke": "https://image-resizing.booztcdn.com/jack-jones/jj12147218_cblack_v178012pu.webp?has_grey=1&has_webp=1&size=w400&dpr=2.5",
    "Blend Lett Jakke": "https://image-resizing.booztcdn.com/jack-jones/jj12286251_cdarkgreymelange_v179084.webp?has_grey=1&has_webp=1&version=c67b6d415cef83c32d7460788905043e&size=w400&dpr=2.5",
    "Polo Ralph Lauren Vest": "https://image-resizing.booztcdn.com/polo-ralph-lauren/raf710934621_cpoloblack_v10581802wbo_10.webp?has_grey=0&has_webp=1&version=6c0f7abbc174068a92e34f012bd3c6e4&size=w400&dpr=2.5",
}

data = client.read()
changed = False

for item in data["items"]:
    if item.get("image"):
        continue
    name = item.get("name", "")
    for key, img_url in PATCHES.items():
        if key.lower() in name.lower():
            item["image"] = img_url
            print(f"Patcha: {name[:50]}")
            changed = True
            break

if changed:
    client.write(data)
    print("Lagret til JSONBin.")
else:
    print("Ingen endringer.")
print("Ferdig.")
