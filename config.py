"""
Gedeelde configuratie voor alle scripts.
Paden zijn relatief aan de project-root zodat alles werkt
op zowel Windows (lokaal) als Linux (GitHub Actions / server).
"""

import os

# Root van het project (map waar config.py staat)
ROOT = os.path.dirname(os.path.abspath(__file__))

# Data-bestanden
DATA_DIR   = os.path.join(ROOT, "data")
PDF_DIR    = os.path.join(ROOT, "pdfs")      # Lokaal, niet in git
RAW_PAD    = os.path.join(DATA_DIR, "moties_resultaten.json")
VERRIJKT_PAD = os.path.join(DATA_DIR, "moties_verrijkt.json")

# Output
HTML_OUTPUT = os.path.join(ROOT, "index.html")  # GitHub Pages serveert index.html

# Zorg dat mappen bestaan
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PDF_DIR, exist_ok=True)

# API key (omgevingsvariabele of .env)
def laad_api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        env_pad = os.path.join(ROOT, ".env")
        if os.path.exists(env_pad):
            with open(env_pad) as f:
                for regel in f:
                    if regel.startswith("ANTHROPIC_API_KEY="):
                        key = regel.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    return key
