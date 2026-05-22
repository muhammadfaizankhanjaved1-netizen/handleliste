@echo off
cd /d "C:\Users\muham\handleliste\scraper"
python process_queue.py
python update_prices.py
