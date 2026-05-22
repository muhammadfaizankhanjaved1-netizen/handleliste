"""Fikser varer med dårlige navn (Zalando/Boozt-blokk) ved å bruke nye API-er."""
import sys, json
from datetime import datetime, timezone
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import scrape, get_domain

BAD_NAMES = {
    "zalando", "vi skreddersyr din opplevelse", "boozt oops!",
    "verifying your connection...", "access denied", "client challenge",
    "google search",
}

def is_bad(item):
    name = (item.get("name") or "").lower().strip()
    if not name or name.startswith("http"):
        return True
    return name in BAD_NAMES

LOG = lambda msg: print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

def main():
    LOG("Leser fra JSONBin...")
    data = client.read()
    bad = [i for i in data["items"] if is_bad(i)]
    delete_ids = set()

    LOG(f"{len(bad)} varer trenger oppdatering.")

    for item in bad:
        url = item.get("url", "")
        # Slett Google Search-lenker
        if "google.com/search" in url:
            LOG(f"  Sletter Google Search-vare")
            delete_ids.add(item["id"])
            continue

        LOG(f"  Scraper: {url[:70]}...")
        try:
            result = scrape(url)
            now = datetime.now(timezone.utc).isoformat()
            if result.get("name") and result["name"].lower() not in BAD_NAMES:
                item.update({
                    "name":          result["name"],
                    "image":         result["image"] or item.get("image"),
                    "price_current": result["price_current"] or item.get("price_current"),
                    "price_history": [{"date": now[:10], "price": result["price_current"]}]
                                      if result["price_current"] else item.get("price_history", []),
                    "categories":    result["categories"] or item.get("categories", []),
                    "status":        "ønske",
                    "last_error":    result.get("error"),
                })
                LOG(f"    OK: {item['name']!r} — {item['price_current']} kr")
            else:
                LOG(f"    Fortsatt blokkert: {result.get('name')!r}")
        except Exception as e:
            LOG(f"    FEIL: {e}")

    # Slett ugyldige varer
    data["items"] = [i for i in data["items"] if i["id"] not in delete_ids]

    LOG("Lagrer til JSONBin...")
    client.write(data)
    LOG("Ferdig.")

if __name__ == "__main__":
    main()
