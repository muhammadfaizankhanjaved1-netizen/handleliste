"""Fikser Power.no-prisen med den nye parse_nok_price-logikken."""
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
import jsonbin_client as client
from scrape import parse_nok_price
import requests
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1"

def get_price(url):
    r = requests.get(url, headers={"User-Agent": UA}, timeout=12)
    soup = BeautifulSoup(r.text, "lxml")
    for prop in ["product:price:amount", "og:price:amount"]:
        tag = soup.find("meta", property=prop)
        if tag:
            p = parse_nok_price(tag.get("content", ""))
            if p and 10 < p < 50000:
                return p
    return None

data = client.read()
for item in data["items"]:
    url = item.get("url", "")
    if "power.no" in url and (item.get("price_current", 0) > 50000 or not item.get("price_current")):
        price = get_price(url)
        if price:
            item["price_current"] = price
            item["last_error"] = None
            print(f"Power.no fikset: {item['name']} => {price} kr")

client.write(data)
print("Lagret.")
