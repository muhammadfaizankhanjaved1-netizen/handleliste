import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from scrape import parse_nok_price
import requests, re

ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
urls = [
    ("Jack & Jones Skinnjakke", "https://www.zalando.no/jack-and-jones-premium-imitert-skinnjakke-black-jam22t0ck-q11.html"),
    ("Jack & Jones Lett Jakke",  "https://www.zalando.no/jack-and-jones-premium-jprblacobbs-blend-lett-jakke-dark-grey-jam22t0cb-c11.html"),
    ("Moschino Lommebok",        "https://www.zalando.no/moschino-portafogli-lommebok-nero-6mo52f008-q11.html"),
    ("PRL Vest",                 "https://www.zalando.no/polo-ralph-lauren-vest-vest-black-po222s0hu-q11.html"),
    ("Next Skjorte",             "https://www.next.no/en/style/su396805/e66541"),
]

patterns = [
    r'"price":\s*"?(\d[\d.,]+)"?',
    r'"normalPrice":\s*"?(\d[\d.,]+)"?',
    r'"displayedPrice":\s*"?(\d[\d .,]+)"?',
    r'"salesPrice":\s*"?(\d[\d .,]+)"?',
    r'"amount":\s*"?(\d[\d.,]+)"?',
    r'NOK\s*(\d[\d .,]+)',
]

for name, url in urls:
    try:
        r = requests.get(url, headers={"User-Agent": ua}, timeout=12)
        found = None
        for pat in patterns:
            for m in re.findall(pat, r.text):
                p = parse_nok_price(m)
                if p and 50 < p < 30000:
                    found = p
                    break
            if found:
                break
        print(f"{name}: {found} kr (HTTP {r.status_code})")
    except Exception as e:
        print(f"{name}: FEIL - {e}")
