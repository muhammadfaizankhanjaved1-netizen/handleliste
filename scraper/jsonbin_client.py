import requests
import json

# Migrert til Cloudflare KV 2026-07-24 (se memory: project_cloudflare_kv_migration_20260724).
# Den gamle JSONBin-binen (6a1007006877513b27b2fcfe) er forlatt og oppdateres ikke lenger av appen.
API_URL = "https://handleliste.muhammadfaizankhanjaved1.workers.dev/api/data"


def read():
    r = requests.get(API_URL, timeout=10)
    r.raise_for_status()
    return r.json()


def write(data):
    r = requests.put(API_URL, headers={"Content-Type": "application/json"},
                      data=json.dumps(data, ensure_ascii=True), timeout=10)
    r.raise_for_status()
    return r.json()


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
