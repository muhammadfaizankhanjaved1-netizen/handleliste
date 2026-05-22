"""Oppdaterer varer med riktige navn og priser basert på manuell søk."""
import sys, re
from datetime import datetime, timezone
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client

TODAY = datetime.now(timezone.utc).isoformat()[:10]

# URL-substring → (navn, pris, bilde)
FIXES = {
    "po222s0nt": ("Polo Ralph Lauren Houndstooth Luxury Jersey Pullover", 2350, None),
    "po222q06w": ("Polo Ralph Lauren Estate Rib Quarter Zip Pullover - Svart", 1646, None),
    "po222s0hu": ("Polo Ralph Lauren Vest - Svart", None, None),
    "jam22t0ck": ("Jack & Jones Premium Imitert Skinnjakke - Svart", None, None),
    "jam22t0cb": ("Jack & Jones Premium Blend Lett Jakke - Grå", None, None),
    "6mo52f008": ("Moschino Lommebok - Svart", None, None),
    "proteinfabrikken": ("Pro BB Hood Black - Better Bodies", 1999, None),
    "clasohlson": ("Vegglampe opp/ned oppladbar, dimbar LED USB - Hvit", 150, None),
    "dahlbergs": ("Studio Knit Cardigan - Dahlbergs", 342,
                  "https://cdn.shopify.com/s/files/1/1056/5494/4082/files/3.png?v=1776582819"),
    "next.no": ("Next Skjorte", None, None),
}

def clean_boozt_name(name: str) -> str:
    """Fjern farge i parentes og pris på slutten: 'Produkt (Farge) - 999 kr' → 'Produkt'"""
    name = re.sub(r"\s*\([^)]+\)\s*-\s*\d+ kr$", "", name).strip()
    name = re.sub(r"\s*-\s*\d+ kr$", "", name).strip()
    return name

LOG = lambda msg: print(msg, flush=True)

def main():
    data = client.read()
    changed = False

    for item in data["items"]:
        url = (item.get("url") or "").lower()
        name = item.get("name") or ""

        # Boozt-navn-opprydding
        if "boozt.com" in url and name and "Boozt" not in name:
            clean = clean_boozt_name(name)
            if clean != name:
                item["name"] = clean
                LOG(f"Boozt navn fikset: '{clean}'")
                changed = True

        # Spesifikke fikser
        for key, (new_name, new_price, new_image) in FIXES.items():
            if key.lower() in url:
                if new_name and item.get("name") != new_name:
                    item["name"] = new_name
                    LOG(f"Navn: '{new_name}'")
                    changed = True
                if new_price and item.get("price_current") != new_price:
                    item["price_current"] = new_price
                    history = item.get("price_history") or []
                    history.append({"date": TODAY, "price": new_price})
                    item["price_history"] = history
                    LOG(f"  Pris: {new_price} kr")
                    changed = True
                if new_image and not item.get("image"):
                    item["image"] = new_image
                    changed = True
                item["status"] = "ønske"
                break

    if changed:
        client.write(data)
        LOG("Lagret til JSONBin.")
    else:
        LOG("Ingen endringer.")

if __name__ == "__main__":
    main()
