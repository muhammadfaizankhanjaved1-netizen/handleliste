"""
Fikser varer med status 'ønske' som mangler pris, og varer med åpenbart feil pris.
"""
import sys
from datetime import datetime, timezone

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import scrape

LOG = lambda msg: print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

MAX_PRICE = 50_000  # Priser over dette er sannsynligvis feil

def main():
    LOG("Leser wishlist fra JSONBin...")
    data = client.read()
    today = datetime.now(timezone.utc).isoformat()[:10]

    targets = [
        i for i in data["items"]
        if i.get("status") not in ("kjøpt",) and i.get("url") and (
            not i.get("price_current") or
            (i.get("price_current", 0) > MAX_PRICE)
        )
    ]

    if not targets:
        LOG("Ingen varer å fikse.")
        return

    LOG(f"Fant {len(targets)} vare(r) som trenger fix...")
    changed = False

    for item in targets:
        url = item.get("url", "")
        old_price = item.get("price_current")
        reason = "mangler pris" if not old_price else f"feil pris ({old_price} kr)"
        LOG(f"\n  [{reason}] {item.get('name') or url[:50]}")
        try:
            result = scrape(url)
            new_price = result.get("price_current")
            new_name = result.get("name")
            new_image = result.get("image")

            if new_price and new_price <= MAX_PRICE:
                item["price_current"] = new_price
                history = item.get("price_history") or []
                history.append({"date": today, "price": new_price})
                item["price_history"] = history
                item["last_error"] = None
                LOG(f"    Pris: {old_price} → {new_price} kr ✓")
                changed = True
            else:
                LOG(f"    Kunne ikke hente gyldig pris (fikk: {new_price})")
                if result.get("error"):
                    LOG(f"    Feil: {result['error']}")

            if new_name and not item.get("name"):
                item["name"] = new_name
                changed = True
            if new_image and not item.get("image"):
                item["image"] = new_image
                changed = True
            if result.get("categories") and not item.get("categories"):
                item["categories"] = result["categories"]
                changed = True

        except Exception as e:
            LOG(f"    FEIL: {e}")

    if changed:
        LOG("\nLagrer til JSONBin...")
        client.write(data)
    LOG("Ferdig.")

if __name__ == "__main__":
    main()
