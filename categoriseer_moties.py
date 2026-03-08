"""
Categoriseer moties met Claude Haiku via Batches API.
"""

import json
import os
import time
import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

from config import VERRIJKT_PAD as DATA_PAD, laad_api_key

API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
if not API_KEY:
    env_pad = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_pad):
        with open(env_pad) as f:
            for regel in f:
                if regel.startswith("ANTHROPIC_API_KEY="):
                    API_KEY = regel.split("=", 1)[1].strip().strip('"').strip("'")
                    break

client = anthropic.Anthropic(api_key=API_KEY)

CATEGORIEËN = [
    "Duurzaamheid & Energie",
    "Wonen & Ruimte",
    "Veiligheid & Handhaving",
    "Onderwijs & Jeugd",
    "Zorg & Welzijn",
    "Verkeer & Mobiliteit",
    "Economie & Werk",
    "Cultuur & Sport",
    "Natuur & Openbare Ruimte",
    "Bestuur & Financiën",
    "Internationaal & Diversiteit",
    "Overig",
]

CATEGORIE_LIJST = "\n".join(f"- {c}" for c in CATEGORIEËN)


def maak_prompt(motie):
    titel = motie.get("titel_leesbaar") or motie.get("titel", "")
    uitleg = motie.get("uitleg", "") or motie.get("samenvatting", "")
    return f"""Categoriseer deze gemeenteraadsmotie in precies één categorie.

Titel: {titel}
Uitleg: {uitleg[:300]}

Kies precies één van deze categorieën:
{CATEGORIE_LIJST}

Antwoord met ALLEEN de categorienaam, niets anders."""


def main():
    with open(DATA_PAD, encoding="utf-8") as f:
        data = json.load(f)

    te_categoriseren = [m for m in data if not m.get("categorie")]
    print(f"Te categoriseren: {len(te_categoriseren)} moties")

    if not te_categoriseren:
        print("Alle moties al gecategoriseerd!")
        return

    # Maak batch
    requests = [
        Request(
            custom_id=str(m.get("doc_id", i)),
            params=MessageCreateParamsNonStreaming(
                model="claude-haiku-4-5",
                max_tokens=50,
                messages=[{"role": "user", "content": maak_prompt(m)}]
            )
        )
        for i, m in enumerate(te_categoriseren)
    ]

    batch = client.messages.batches.create(requests=requests)
    print(f"Batch aangemaakt: {batch.id}")

    while True:
        batch = client.messages.batches.retrieve(batch.id)
        if batch.processing_status == "ended":
            break
        print(f"  Wachten... ({batch.request_counts.processing} bezig)")
        time.sleep(8)

    print(f"Klaar: {batch.request_counts.succeeded} OK, {batch.request_counts.errored} fouten")

    # Verwerk resultaten
    id_naar_categorie = {}
    for result in client.messages.batches.results(batch.id):
        if result.result.type == "succeeded":
            cat = result.result.message.content[0].text.strip()
            # Valideer categorie
            if cat not in CATEGORIEËN:
                # Fuzzy match
                cat_lower = cat.lower()
                gevonden = next((c for c in CATEGORIEËN if c.lower() in cat_lower or cat_lower in c.lower()), "Overig")
                cat = gevonden
            id_naar_categorie[result.custom_id] = cat

    # Update data
    for i, m in enumerate(data):
        key = str(m.get("doc_id", i))
        if key in id_naar_categorie:
            m["categorie"] = id_naar_categorie[key]
        elif not m.get("categorie"):
            m["categorie"] = "Overig"

    with open(DATA_PAD, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Opgeslagen: {DATA_PAD}")

    # Statistieken
    from collections import Counter
    cats = Counter(m.get("categorie", "?") for m in data)
    print("\nVerdeling:")
    for cat, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {n}")


if __name__ == "__main__":
    main()
