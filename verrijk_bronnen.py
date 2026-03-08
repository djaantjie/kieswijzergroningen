"""
Voeg bronnen toe aan de voor/nadelen analyse van elke motie.
Alleen betrouwbare, verifieerbare URLs (officiële NL-overheidssites).
Slaat al verrijkte moties over.
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
            for r in f:
                if r.startswith("ANTHROPIC_API_KEY="):
                    API_KEY = r.split("=", 1)[1].strip().strip('"').strip("'")
                    break

client = anthropic.Anthropic(api_key=API_KEY)

# Betrouwbare basisdomeinen die Claude mag gebruiken
BETROUWBARE_DOMEINEN = [
    "gemeenteraad.groningen.nl",
    "groningen.nl",
    "cbs.nl",
    "rijksoverheid.nl",
    "rvo.nl",
    "pbl.nl",
    "cpb.nl",
    "rivm.nl",
    "vng.nl",
    "platformparticipatie.nl",
    "omgevingsbeleid.nl",
    "atlasleefomgeving.nl",
    "duo.nl",
    "centrumgezondleven.nl",
    "milieucentraal.nl",
    "rli.nl",
    "woningmarktbeleid.nl",
    "volksgezondheidenzorg.info",
    "politie.nl",
    "justitie.nl",
]

PROMPT = """Je bent een feitelijke informatieassistent voor gemeentepolitiek. Analyseer deze motie en zoek relevante officiële bronnen.

Motie: {titel}
Categorie: {categorie}
Uitleg: {uitleg}
Context: {context}

Geef maximaal 3 relevante bronnen. Gebruik ALLEEN URLs van deze betrouwbare domeinen:
{domeinen}

Regels:
- Geef alleen bronnen als je ZEKER bent van het exacte URL-pad
- Voor gemeenteraad.groningen.nl: gebruik altijd de exacte vergadering-URL die je al kent
- Twijfel je over een URL? Geef dan alleen de domeinnaam zonder pad
- Geef altijd een beschrijving van wat de bron bevat
- Voeg altijd de gemeenteraad-pagina toe als eerste bron (gebruik pdf_url_vergadering)

JSON formaat:
{{
  "bronnen": [
    {{
      "naam": "Beschrijvende naam van de bron",
      "url": "https://exact-url.nl/of/pad",
      "beschrijving": "Wat vind je hier (1 zin)"
    }}
  ]
}}

Vergadering-URL: {vergadering_url}
PDF-URL: {pdf_url}

Antwoord ALLEEN met JSON."""


def vergadering_url_van_pdf(pdf_url):
    """Extraheer de vergadering-pagina URL uit de PDF-URL."""
    if not pdf_url:
        return ""
    # .../16:30/M-08-.../M-08-....pdf → .../16:30/
    parts = pdf_url.split("/")
    # Verwijder laatste 2 segmenten (mapnaam + bestandsnaam)
    if len(parts) >= 4:
        return "/".join(parts[:-2]) + "/"
    return pdf_url


def maak_prompt(motie):
    pdf_url = motie.get("pdf_url", "")
    verg_url = vergadering_url_van_pdf(pdf_url)
    return PROMPT.format(
        titel=motie.get("titel_leesbaar") or motie.get("titel", ""),
        categorie=motie.get("categorie", ""),
        uitleg=motie.get("uitleg", "")[:250],
        context=motie.get("context", ""),
        domeinen="\n".join(f"- {d}" for d in BETROUWBARE_DOMEINEN),
        vergadering_url=verg_url,
        pdf_url=pdf_url,
    )


def verwerk_batch(batch_id, moties_lookup):
    resultaten = {}
    fouten = 0

    for result in client.messages.batches.results(batch_id):
        if result.result.type != "succeeded":
            fouten += 1
            continue

        tekst = result.result.message.content[0].text.strip()
        if "```" in tekst:
            for part in tekst.split("```"):
                part = part.strip().lstrip("json").strip()
                if part.startswith("{"):
                    tekst = part
                    break
        try:
            data = json.loads(tekst)
            bronnen = data.get("bronnen", [])

            # Valideer en saneer bronnen
            valide_bronnen = []
            for b in bronnen[:3]:
                url = b.get("url", "")
                naam = b.get("naam", "")
                beschr = b.get("beschrijving", "")
                if not naam:
                    continue
                # Check of URL een betrouwbaar domein heeft
                url_valide = any(d in url for d in BETROUWBARE_DOMEINEN)
                if not url_valide:
                    url = ""  # URL weggooien als niet vertrouwd
                valide_bronnen.append({
                    "naam": naam,
                    "url": url,
                    "beschrijving": beschr,
                })

            resultaten[result.custom_id] = valide_bronnen
        except json.JSONDecodeError:
            fouten += 1

    print(f"  Verwerkt: {len(resultaten)} OK, {fouten} fouten")
    return resultaten


def main():
    with open(DATA_PAD, encoding="utf-8") as f:
        data = json.load(f)

    # Moties zonder bronnen (of met lege bronnenlijst)
    te_verrijken = [
        m for m in data
        if not m.get("bronnen")
    ]
    print(f"Bronnen toe te voegen: {len(te_verrijken)} / {len(data)}")

    if not te_verrijken:
        print("Alle moties al voorzien van bronnen.")
        return

    BATCH_GROOTTE = 100
    alle_resultaten = {}

    for start in range(0, len(te_verrijken), BATCH_GROOTTE):
        chunk = te_verrijken[start:start + BATCH_GROOTTE]
        print(f"\nBatch {start // BATCH_GROOTTE + 1}: {len(chunk)} moties...")

        requests = [
            Request(
                custom_id=str(m.get("doc_id", i + start)),
                params=MessageCreateParamsNonStreaming(
                    model="claude-haiku-4-5",
                    max_tokens=500,
                    messages=[{"role": "user", "content": maak_prompt(m)}]
                )
            )
            for i, m in enumerate(chunk)
        ]

        batch = client.messages.batches.create(requests=requests)
        print(f"  Batch ID: {batch.id}")

        while True:
            batch = client.messages.batches.retrieve(batch.id)
            if batch.processing_status == "ended":
                break
            print(f"  Bezig... ({batch.request_counts.processing} resterend)")
            time.sleep(8)

        print(f"  Klaar: {batch.request_counts.succeeded} OK, {batch.request_counts.errored} fouten")
        resultaten = verwerk_batch(batch.id, {str(m.get("doc_id")): m for m in chunk})
        alle_resultaten.update(resultaten)

    updated = 0
    for m in data:
        key = str(m.get("doc_id", ""))
        if key in alle_resultaten:
            bronnen = alle_resultaten[key]
            # Voeg altijd de PDF toe als eerste bron als die er nog niet in zit
            pdf_url = m.get("pdf_url", "")
            if pdf_url and not any(b.get("url") == pdf_url for b in bronnen):
                bronnen.insert(0, {
                    "naam": "Originele motietekst (PDF)",
                    "url": pdf_url,
                    "beschrijving": "De volledige officiële motietekst zoals ingediend bij de gemeenteraad.",
                })
            m["bronnen"] = bronnen
            updated += 1

    with open(DATA_PAD, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nKlaar: {updated} moties voorzien van bronnen")
    print(f"Opgeslagen: {DATA_PAD}")

    # Voorbeeld
    voorbeeld = next((m for m in data if m.get("bronnen")), None)
    if voorbeeld:
        print(f"\nVoorbeeld: {voorbeeld.get('titel_leesbaar','')[:60]}")
        for b in voorbeeld.get("bronnen", []):
            print(f"  - {b['naam']}: {b.get('url','(geen url)')[:60]}")


if __name__ == "__main__":
    main()
