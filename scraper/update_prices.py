"""
Oppdaterer priser på alle aktive varer (ikke 'kjøpt').
Kjøres av Task Scheduler annenhver dag kl. 07:00.
"""
import sys
import io
from datetime import datetime, timezone

# Force UTF-8 output so Unicode chars don't crash on Windows cp1252 terminals
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import scrape_price_only

LOG = lambda msg: print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def main():
    LOG("Leser wishlist fra JSONBin...")
    data = client.read()
    active = [i for i in data["items"]
              if i.get("status") not in ("kjøpt", "pending") and i.get("url")]

    if not active:
        LOG("Ingen aktive varer å oppdatere.")
        return

    LOG(f"Oppdaterer priser for {len(active)} vare(r)...")
    changed = False
    today = datetime.now(timezone.utc).isoformat()[:10]

    for item in active:
        url = item.get("url", "")
        LOG(f"  {item.get('name', url[:40])!r}...")
        try:
            new_price = scrape_price_only(url)
            if new_price and new_price != item.get("price_current"):
                old = item.get("price_current")
                item["price_current"] = new_price
                history = item.get("price_history") or []
                history.append({"date": today, "price": new_price})
                item["price_history"] = history
                item["last_error"] = None
                changed = True  # sett FØR LOG så prisen lagres selv om print feiler
                direction = "ned" if (old and new_price < old) else "opp"
                LOG(f"    Pris oppdatert: {old} -> {new_price} kr ({direction})")
            elif new_price:
                LOG(f"    Ingen endring: {new_price} kr")
            else:
                LOG(f"    Kunne ikke hente pris")
        except Exception as e:
            item["last_error"] = str(e)
            LOG(f"    FEIL: {e}")
            changed = True

    if changed:
        LOG("Lagrer til JSONBin...")
        client.write(data)
    LOG("Prisoppdatering ferdig.")


if __name__ == "__main__":
    main()
