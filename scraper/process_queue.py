"""
Behandler alle items med status 'pending' i JSONBin.
Kjøres automatisk av Task Scheduler ved oppstart og annenhver dag.
"""
import sys
from datetime import datetime, timezone

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import scrape

LOG = lambda msg: print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def main():
    LOG("Leser wishlist fra JSONBin...")
    try:
        data = client.read()
    except Exception as e:
        LOG(f"JSONBin utilgjengelig: {e}")
        return
    pending = [i for i in data["items"] if i.get("status") == "pending"]

    if not pending:
        LOG("Ingen ventende varer.")
        return

    LOG(f"{len(pending)} ventende vare(r) funnet.")
    changed = False

    for item in pending:
        url = item.get("url", "")
        LOG(f"Scraper: {url[:60]}...")
        try:
            result = scrape(url)
            now = datetime.now(timezone.utc).isoformat()
            item.update({
                "name":          result["name"] or url,
                "image":         result["image"],
                "price_current": result["price_current"],
                "price_history": [{"date": now[:10], "price": result["price_current"]}]
                                  if result["price_current"] else [],
                "currency":      result.get("currency", "NOK"),
                "categories":    result["categories"],
                "status":        "ønske",
                "last_error":    result.get("error"),
            })
            LOG(f"  OK: {item['name']!r} — {item['price_current']} kr")
            changed = True
        except Exception as e:
            item["last_error"] = str(e)
            LOG(f"  FEIL: {e}")
            changed = True  # save error state too

    if changed:
        LOG("Lagrer til JSONBin...")
        try:
            client.write(data)
            LOG("Ferdig.")
        except Exception as e:
            LOG(f"Lagring feilet: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
