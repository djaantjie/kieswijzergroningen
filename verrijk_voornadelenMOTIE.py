"""
Verrijk moties met feitelijke voor- en nadelen via Claude API (Batches).
Kan periodiek herhaald worden — slaat al verrijkte moties over.
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

PROMPT_TEMPLATE = """Je bent een neutrale, feitelijke analist van gemeentepolitiek. Je analyseert een motie van de gemeenteraad van Groningen.

Titel: {titel}
Categorie: {categorie}
Uitleg: {uitleg}
Indieners: {indieners}
Status: {status}

Motietekst (fragment):
{tekst}

Geef een FEITELIJKE analyse van voor- en nadelen. Wees realistisch en concreet:
- Noem echte praktische voordelen (niet alleen wensdenken)
- Noem echte praktische nadelen, risico's of kanttekeningen (niet alleen politieke kritiek)
- Baseer je op wat de motie feitelijk vraagt, niet op politieke kleur
- Max 2-3 punten per kant, elk max 1 zin

Antwoord ALLEEN met geldige JSON:
{{
  "voordelen": ["concreet voordeel 1", "concreet voordeel 2"],
  "nadelen": ["concreet nadeel of risico 1", "concreet nadeel of risico 2"],
  "context": "1 zin feitelijke context of achtergrond die de kiezer helpt dit te begrijpen"
}}"""


def laad_pdf_tekst(motie):
    """Laad PDF-tekst van een motie."""
    import pypdf
    pdf_pad = motie.get("pdf_pad")
    if not pdf_pad or not os.path.exists(pdf_pad):
        return motie.get("samenvatting", "")[:800]
    try:
        reader = pypdf.PdfReader(pdf_pad)
        tekst = ""
        for p in reader.pages:
            tekst += p.extract_text() or ""
        return tekst[:1200]
    except Exception:
        return motie.get("samenvatting", "")[:800]


def maak_prompt(motie):
    return PROMPT_TEMPLATE.format(
        titel=motie.get("titel_leesbaar") or motie.get("titel", ""),
        categorie=motie.get("categorie", ""),
        uitleg=motie.get("uitleg", "")[:300],
        indieners=", ".join(motie.get("indieners", [])) or "onbekend",
        status=motie.get("status", ""),
        tekst=laad_pdf_tekst(motie),
    )


def verwerk_batch(batch_id):
    resultaten = {}
    fouten = 0
    for result in client.messages.batches.results(batch_id):
        if result.result.type != "succeeded":
            fouten += 1
            continue
        tekst = result.result.message.content[0].text.strip()
        # Verwijder eventueel markdown-code-block
        if "```" in tekst:
            parts = tekst.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    tekst = part
                    break
        try:
            data = json.loads(tekst)
            resultaten[result.custom_id] = {
                "voordelen": data.get("voordelen", [])[:3],
                "nadelen": data.get("nadelen", [])[:3],
                "context": data.get("context", ""),
            }
        except json.JSONDecodeError:
            fouten += 1
    print(f"  Verwerkt: {len(resultaten)} OK, {fouten} fouten")
    return resultaten


def main():
    with open(DATA_PAD, encoding="utf-8") as f:
        data = json.load(f)

    # Alleen moties zonder voordelen/nadelen
    te_verrijken = [
        m for m in data
        if not m.get("voordelen") or not m.get("nadelen")
    ]
    print(f"Moties te verrijken: {len(te_verrijken)} / {len(data)}")

    if not te_verrijken:
        print("Alle moties al verrijkt met voor/nadelen.")
        return

    # Batch verzoeken (max 100 per keer)
    alle_resultaten = {}
    BATCH_GROOTTE = 100

    for start in range(0, len(te_verrijken), BATCH_GROOTTE):
        chunk = te_verrijken[start:start + BATCH_GROOTTE]
        print(f"\nBatch {start // BATCH_GROOTTE + 1}: {len(chunk)} moties...")

        requests = [
            Request(
                custom_id=str(m.get("doc_id", i + start)),
                params=MessageCreateParamsNonStreaming(
                    model="claude-haiku-4-5",
                    max_tokens=400,
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

        print(f"  Gereed: {batch.request_counts.succeeded} OK, {batch.request_counts.errored} fouten")
        resultaten = verwerk_batch(batch.id)
        alle_resultaten.update(resultaten)

    # Update data
    updated = 0
    for m in data:
        key = str(m.get("doc_id", ""))
        if key in alle_resultaten:
            m.update(alle_resultaten[key])
            updated += 1

    with open(DATA_PAD, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nKlaar: {updated} moties bijgewerkt met voor/nadelen")
    print(f"  Opgeslagen: {DATA_PAD}")

    # Toon voorbeelden
    print("\nVoorbeelden:")
    for m in data[:3]:
        if m.get("voordelen"):
            print(f"\n  {m.get('titel_leesbaar', '')[:60]}")
            print(f"  Voordelen: {m['voordelen'][:2]}")
            print(f"  Nadelen:   {m['nadelen'][:2]}")


if __name__ == "__main__":
    main()
