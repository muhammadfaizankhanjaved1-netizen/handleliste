"""
Fjerner duplikate varer fra handlelisten basert på URL og navn.
Beholder den med høyest data-kvalitet (pris + bilde).
"""
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client


def score(item):
    return (1 if item.get("price_current") else 0) + (1 if item.get("image") else 0)


def main():
    data = client.read()
    items = data["items"]

    seen_urls = {}
    seen_names = {}
    to_remove = set()

    for i, item in enumerate(items):
        url = (item.get("url") or "").split("?")[0].rstrip("/")
        name = (item.get("name") or "").strip().lower()

        for key, seen in [(url, seen_urls), (name, seen_names)]:
            if not key:
                continue
            if key in seen:
                prev_i = seen[key]
                prev = items[prev_i]
                if score(item) > score(prev):
                    to_remove.add(prev_i)
                    seen[key] = i
                else:
                    to_remove.add(i)
            else:
                seen[key] = i

    if not to_remove:
        print("Ingen duplikater funnet.")
        return

    print(f"Fjerner {len(to_remove)} duplikat(er):")
    for idx in sorted(to_remove, reverse=True):
        print(f"  - {items[idx].get('name')} (index {idx})")
        items.pop(idx)

    data["items"] = items
    client.write(data)
    print("Lagret.")


if __name__ == "__main__":
    main()
