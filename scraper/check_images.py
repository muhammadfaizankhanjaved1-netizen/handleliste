"""Sjekk at alle varebilder finnes og passer kortformatet i appen.

Kjøres som del av handleliste-rutinen (etter update_prices.py).
Flagger, men endrer ALDRI data:
  - dødt bilde (ikke HTTP 200 / ikke image content-type / kan ikke dekodes)
  - for lav oppløsning (< 200 px på korteste side, blir uskarpt i kortet)
  - ekstremt format (høyde/bredde > 2.2 → treffer max-height-taket på 340px,
    eller bredde/høyde > 2.5 → blir en tynn stripe i kortet)
"""
import io
import sys
from pathlib import Path

import requests
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import jsonbin_client as client

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

MIN_SIDE = 200
MAX_PORTRAIT = 2.2   # h/b over dette = for høyt for kortet
MAX_LANDSCAPE = 2.5  # b/h over dette = tynn stripe
MAX_CLOTHING_LANDSCAPE = 1.2  # klesplagg skal være portrett — liggende = feil CDN-crop

def check(url, is_clothing=False):
    """Returnerer (ok, melding)."""
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=20, stream=True)
    except Exception as e:
        return False, f"nedlasting feilet: {type(e).__name__}"
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}"
    ctype = r.headers.get("Content-Type", "")
    if not ctype.startswith("image/"):
        return False, f"ikke bilde (Content-Type: {ctype[:40]})"
    try:
        img = Image.open(io.BytesIO(r.content))
        w, h = img.size
    except Exception:
        return False, "kunne ikke dekodes som bilde"
    if min(w, h) < MIN_SIDE:
        return False, f"lav oppløsning ({w}x{h})"
    if h / w > MAX_PORTRAIT:
        return False, f"for høyt format ({w}x{h}, ratio {h/w:.1f})"
    if w / h > MAX_LANDSCAPE:
        return False, f"for bredt format ({w}x{h}, ratio {w/h:.1f})"
    if is_clothing and w / h > MAX_CLOTHING_LANDSCAPE:
        return False, f"liggende format på klesplagg ({w}x{h}) — sannsynlig feil CDN-crop, sjekk om ?w=/&h=-params kan fjernes"
    return True, f"{w}x{h} OK"

def main():
    data = client.read()
    items = [i for i in data["items"] if i.get("status") != "kjøpt"]
    problems = []
    missing = []
    for it in items:
        name = (it.get("name") or it.get("url", "?"))[:55]
        url = it.get("image")
        if not url:
            missing.append(name)
            continue
        is_clothing = "Klær" in (it.get("categories") or [])
        ok, msg = check(url, is_clothing)
        if not ok:
            problems.append((name, msg, url))
            print(f"  FEIL  {name} — {msg}")
        elif "-v" in sys.argv:
            print(f"  ok    {name} — {msg}")

    print()
    print(f"{len(items)} aktive varer sjekket.")
    if missing:
        print(f"{len(missing)} uten bilde: " + "; ".join(missing))
    if problems:
        print(f"{len(problems)} bilde(r) passer IKKE formatet — finn bedre bilde-URL og")
        print("oppdater via Rediger-modalen i appen eller direkte i JSONBin:")
        for name, msg, url in problems:
            print(f"  - {name}: {msg}")
            print(f"      {url}")
    else:
        print("Alle bilder passer formatet.")

if __name__ == "__main__":
    main()
