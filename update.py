"""
Master update script voor de Groningen Stemwijzer.
Werkt zowel lokaal als in GitHub Actions.

Gebruik:
  python update.py                    # Volledige run
  python update.py --alleen-bouw      # Alleen herbouwen
  python update.py --geen-scrape      # Verrijk + bouw, geen scrape
  python update.py --droog            # Droog run (toont wat er zou gebeuren)
"""

import subprocess
import sys
import os
import json
from datetime import datetime

# Importeer gedeelde configuratie
from config import ROOT, DATA_DIR, VERRIJKT_PAD, laad_api_key

LOG_PAD = os.path.join(ROOT, "update_log.txt")

STAPPEN = [
    {
        "id": "scrape",
        "naam": "Moties scrapen van gemeenteraad.groningen.nl",
        "script": "scrape_moties.py",
        "vereist_api": False,
        "overslaan_bij": ["--alleen-bouw", "--geen-scrape"],
    },
    {
        "id": "verrijken",
        "naam": "Titels & uitleg genereren (Claude Haiku)",
        "script": "verrijk_moties.py",
        "vereist_api": True,
        "overslaan_bij": ["--alleen-bouw"],
    },
    {
        "id": "categoriseren",
        "naam": "Categorieën toewijzen (Claude Haiku)",
        "script": "categoriseer_moties.py",
        "vereist_api": True,
        "overslaan_bij": ["--alleen-bouw"],
    },
    {
        "id": "voordelen",
        "naam": "Voor- en nadelen genereren (Claude Haiku)",
        "script": "verrijk_voornadelenMOTIE.py",
        "vereist_api": True,
        "overslaan_bij": ["--alleen-bouw"],
    },
    {
        "id": "bronnen",
        "naam": "Bronnen toevoegen (Claude Haiku)",
        "script": "verrijk_bronnen.py",
        "vereist_api": True,
        "overslaan_bij": ["--alleen-bouw"],
    },
    {
        "id": "bouw",
        "naam": "Stemwijzer HTML bouwen",
        "script": "maak_stemwijzer.py",
        "vereist_api": False,
        "overslaan_bij": [],
    },
]


def log(bericht):
    tijdstip = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    regel = f"[{tijdstip}] {bericht}"
    print(regel)
    with open(LOG_PAD, "a", encoding="utf-8") as f:
        f.write(regel + "\n")


def run_script(script, api_key=None):
    pad = os.path.join(ROOT, script)
    env = os.environ.copy()
    if api_key:
        env["ANTHROPIC_API_KEY"] = api_key
    result = subprocess.run(
        [sys.executable, pad],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result


def statistieken():
    if not os.path.exists(VERRIJKT_PAD):
        return "Geen data gevonden"
    with open(VERRIJKT_PAD, encoding="utf-8") as f:
        data = json.load(f)
    totaal = len(data)
    return (
        f"Totaal: {totaal} moties | "
        f"Uitleg: {sum(1 for m in data if m.get('uitleg'))} | "
        f"Categorie: {sum(1 for m in data if m.get('categorie'))} | "
        f"Voor/nadelen: {sum(1 for m in data if m.get('voordelen'))} | "
        f"Bronnen: {sum(1 for m in data if m.get('bronnen'))}"
    )


def main():
    args = sys.argv[1:]
    droog = "--droog" in args

    log("=" * 60)
    log("Groningen Stemwijzer - Update gestart")
    log(f"Argumenten: {args or 'geen (volledige run)'}")
    log(statistieken())

    api_key = laad_api_key()
    if not api_key:
        log("Waarschuwing: geen ANTHROPIC_API_KEY gevonden — API-stappen worden overgeslagen")

    for stap in STAPPEN:
        if any(arg in args for arg in stap["overslaan_bij"]):
            log(f"  SKIP: {stap['naam']}")
            continue
        if stap["vereist_api"] and not api_key:
            log(f"  SKIP (geen API): {stap['naam']}")
            continue

        log(f"\n>> {stap['naam']}")
        if droog:
            log("   [droog] zou draaien: " + stap["script"])
            continue

        result = run_script(stap["script"], api_key if stap["vereist_api"] else None)

        for regel in (result.stdout + result.stderr).split("\n"):
            regel = regel.strip()
            if regel:
                log("   " + regel)

        if result.returncode != 0:
            log(f"   FOUT (exitcode {result.returncode})")
        else:
            log(f"   Klaar")

    log("\n" + "=" * 60)
    log("Update voltooid")
    log(statistieken())


if __name__ == "__main__":
    main()
