"""Henter og:image via Playwright for varer uten bilde."""
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import USER_AGENT
from playwright.sync_api import sync_playwright

data = client.read()
targets = [i for i in data["items"] if not i.get("image") and i.get("url")]
if not targets:
    print("Alle varer har bilde."); exit()

print(f"Henter bilder for {len(targets)} vare(r)...")
changed = False

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for item in targets:
        page = browser.new_page(user_agent=USER_AGENT)
        try:
            page.goto(item["url"], wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1500)
            img = page.evaluate("() => document.querySelector('meta[property=\"og:image\"]')?.content")
            if img:
                item["image"] = img
                changed = True
                print(f"  OK: {item['name'][:40]}")
            else:
                print(f"  Ingen bilde: {item['name'][:40]}")
        except Exception as e:
            print(f"  Feil: {item['name'][:40]} — {e}")
        finally:
            page.close()
    browser.close()

if changed:
    client.write(data)
    print("Lagret.")
