import requests
import json

API_URL  = "https://api.jsonbin.io/v3/b"
MASTER_KEY = "$2a$10$YQtpXheoXVrQaXo3Sch4G..IWw/ZuAWYFnc1XPBxa82aBCieCR6XC"
BIN_ID   = "6a1007006877513b27b2fcfe"

HEADERS_READ  = {"X-Master-Key": MASTER_KEY}
HEADERS_WRITE = {"X-Master-Key": MASTER_KEY, "Content-Type": "application/json"}


def read():
    r = requests.get(f"{API_URL}/{BIN_ID}/latest", headers=HEADERS_READ, timeout=10)
    r.raise_for_status()
    return r.json()["record"]


def write(data):
    r = requests.put(f"{API_URL}/{BIN_ID}", headers=HEADERS_WRITE,
                     data=json.dumps(data), timeout=10)
    r.raise_for_status()
    return r.json()


def create_bin(initial_data):
    headers = {**HEADERS_WRITE, "X-Bin-Name": "handleliste", "X-Bin-Private": "true"}
    r = requests.post(API_URL, headers=headers, data=json.dumps(initial_data), timeout=10)
    r.raise_for_status()
    return r.json()["metadata"]["id"]


def update_item(data, item_id, fields):
    for item in data["items"]:
        if item["id"] == item_id:
            item.update(fields)
            break
    return data


def find_item(data, item_id):
    return next((i for i in data["items"] if i["id"] == item_id), None)


def add_item(data, item):
    data["items"].append(item)
    return data
