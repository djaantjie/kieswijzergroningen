"""
Verrijk moties met leesbare titels en uitleg via Claude API (Batches).
Haiku 4.5 voor kostenefficiëntie, Batches API voor 50% korting.
"""

import json
import os
import time
import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request

from config import RAW_PAD as DATA_PAD, VERRIJKT_PAD, PDF_DIR, laad_api_key



API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
if not API_KEY:
    # Probeer uit .env bestand
    env_pad = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_pad):
        with open(env_pad) as f:
            for regel in f:
                if regel.startswith("ANTHROPIC_API_KEY="):
                    API_KEY = regel.split("=", 1)[1].strip().strip('"').strip("'")
                    break

if not API_KEY:
    raise ValueError(
        "ANTHROPIC_API_KEY niet gevonden.\n"
        "Zet hem via: set ANTHROPIC_API_KEY=sk-ant-...\n"
        "Of maak een .env bestand aan met: ANTHROPIC_API_KEY=sk-ant-..."
    )

client = anthropic.Anthropic(api_key=API_KEY)


def laad_pdf_tekst(motie):
    """Laad de PDF-tekst van een motie."""
    pdf_pad = motie.get("pdf_pad")
    if not pdf_pad or not os.path.exists(pdf_pad):
        return motie.get("samenvatting", "")

    try:
        import pypdf
        reader = pypdf.PdfReader(pdf_pad)
        tekst = ""
        for pagina in reader.pages:
            tekst += pagina.extract_text() or ""
        return tekst.strip()
    except Exception:
        return motie.get("samenvatting", "")


def maak_prompt(motie, pdf_tekst):
    """Maak de prompt voor Claude."""
    ruwe_titel = motie.get("titel", "").strip()
    indieners = ", ".join(motie.get("indieners", [])) or "onbekend"
    status = motie.get("status", "ONBEKEND")

    # Beperk PDF-tekst tot 1500 tekens
    tekst_voor_api = pdf_tekst[:1500] if pdf_tekst else ruwe_titel

    return f"""Je analyseert een motie van de gemeenteraad van Groningen.

Ruwe titel: {ruwe_titel}
Ingediend door: {indieners}
Status: {status}

Motietekst (fragment):
{tekst_voor_api}

Geef in JSON-formaat:
1. "titel": Een heldere, neutrale Nederlandse titel (max 8 woorden, geen partijnamen, geen motienummer). Beschrijf het onderwerp.
2. "uitleg": Een uitleg in 2-3 normale Nederlandse zinnen. Beschrijf: wat wil de motie bereiken, en wat vraagt het de gemeente? Schrijf alsof je het uitlegt aan iemand die niets weet van gemeentepolitiek. Geen jargon, geen bullet points.

Antwoord ALLEEN met geldige JSON, niets anders:
{{"titel": "...", "uitleg": "..."}}"""


def maak_batch(moties_met_tekst):
    """Maak een batch-aanvraag aan."""
    requests = []
    for motie_id, (motie, pdf_tekst) in moties_met_tekst.items():
        prompt = maak_prompt(motie, pdf_tekst)
        requests.append(Request(
            custom_id=str(motie_id),
            params=MessageCreateParamsNonStreaming(
                model="claude-haiku-4-5",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
        ))
    return requests


def verwerk_batch_resultaten(batch_id, moties_lookup):
    """Haal resultaten op en verwerk ze."""
    resultaten = {}
    fouten = 0

    for result in client.messages.batches.results(batch_id):
        motie_id = result.custom_id
        if result.result.type == "succeeded":
            tekst = result.result.message.content[0].text.strip()
            try:
                # Verwijder markdown-codeblokken als die er in zitten
                if tekst.startswith("```"):
                    tekst = tekst.split("```")[1]
                    if tekst.startswith("json"):
                        tekst = tekst[4:]
                data = json.loads(tekst)
                resultaten[motie_id] = {
                    "titel_leesbaar": data.get("titel", ""),
                    "uitleg": data.get("uitleg", "")
                }
            except json.JSONDecodeError:
                print(f"  JSON-fout voor {motie_id}: {tekst[:80]}")
                fouten += 1
        else:
            print(f"  Fout voor {motie_id}: {result.result.type}")
            fouten += 1

    print(f"  Verwerkt: {len(resultaten)} OK, {fouten} fouten")
    return resultaten


def main():
    print("=== Motie Verrijking met Claude Haiku ===\n")

    # Laad bestaande data
    with open(DATA_PAD, encoding="utf-8") as f:
        alle_moties = json.load(f)

    # Controleer of al eerder verrijkt
    verrijkt_bestaand = {}
    if os.path.exists(VERRIJKT_PAD):
        with open(VERRIJKT_PAD, encoding="utf-8") as f:
            verrijkt_bestaand = {m.get("doc_id"): m for m in json.load(f)}
        print(f"Bestaande verrijking geladen: {len(verrijkt_bestaand)} moties")

    # Selecteer moties die verrijkt moeten worden (niet al verrijkt)
    te_verrijken = {}
    for m in alle_moties:
        doc_id = m.get("doc_id", m.get("motie_nr", ""))
        if not doc_id:
            continue
        if str(doc_id) in verrijkt_bestaand and verrijkt_bestaand[str(doc_id)].get("titel_leesbaar"):
            continue  # Al verrijkt

        pdf_tekst = laad_pdf_tekst(m)
        te_verrijken[str(doc_id)] = (m, pdf_tekst)

    print(f"Te verrijken: {len(te_verrijken)} moties")

    if not te_verrijken:
        print("Alle moties zijn al verrijkt!")
    else:
        # Splits in batches van max 100 per keer (API-limiet: 100.000, maar veilig)
        BATCH_GROOTTE = 100
        items = list(te_verrijken.items())
        alle_resultaten = {}

        for start in range(0, len(items), BATCH_GROOTTE):
            chunk = dict(items[start:start + BATCH_GROOTTE])
            print(f"\nBatch {start//BATCH_GROOTTE + 1}: {len(chunk)} moties...")

            requests = maak_batch(chunk)
            batch = client.messages.batches.create(requests=requests)
            print(f"  Batch aangemaakt: {batch.id}")

            # Wacht tot batch klaar is
            while True:
                batch = client.messages.batches.retrieve(batch.id)
                if batch.processing_status == "ended":
                    break
                n_processing = batch.request_counts.processing
                n_done = batch.request_counts.succeeded + batch.request_counts.errored
                print(f"  Status: {batch.processing_status} ({n_done}/{len(chunk)} klaar)...")
                time.sleep(10)

            print(f"  Batch klaar: {batch.request_counts.succeeded} OK, {batch.request_counts.errored} fouten")
            resultaten = verwerk_batch_resultaten(batch.id, chunk)
            alle_resultaten.update(resultaten)

        print(f"\nTotaal verrijkt: {len(alle_resultaten)} moties")

        # Update de moties met de verrijkte data
        for m in alle_moties:
            doc_id = str(m.get("doc_id", m.get("motie_nr", "")))
            if doc_id in alle_resultaten:
                m["titel_leesbaar"] = alle_resultaten[doc_id]["titel_leesbaar"]
                m["uitleg"] = alle_resultaten[doc_id]["uitleg"]
            elif doc_id in verrijkt_bestaand:
                m["titel_leesbaar"] = verrijkt_bestaand[doc_id].get("titel_leesbaar", "")
                m["uitleg"] = verrijkt_bestaand[doc_id].get("uitleg", "")

    # Verwijder pdf_pad (lokaal pad, niet relevant voor stemwijzer)
    moties_clean = []
    for m in alle_moties:
        m_clean = {k: v for k, v in m.items() if k not in ("pdf_pad",)}
        moties_clean.append(m_clean)

    with open(VERRIJKT_PAD, "w", encoding="utf-8") as f:
        json.dump(moties_clean, f, ensure_ascii=False, indent=2)
    print(f"\nVerrijkte data opgeslagen: {VERRIJKT_PAD}")

    # Statistieken
    met_leesbaar = sum(1 for m in moties_clean if m.get("titel_leesbaar"))
    met_uitleg = sum(1 for m in moties_clean if m.get("uitleg"))
    print(f"Moties met leesbare titel: {met_leesbaar}/{len(moties_clean)}")
    print(f"Moties met uitleg: {met_uitleg}/{len(moties_clean)}")

    # Voorbeelden
    print("\nVoorbeelden:")
    for m in moties_clean[:5]:
        if m.get("titel_leesbaar"):
            print(f"\n  Ruwe titel:     {m.get('titel','')[:60]}")
            print(f"  Leesbare titel: {m.get('titel_leesbaar','')}")
            print(f"  Uitleg:         {m.get('uitleg','')[:120]}...")


if __name__ == "__main__":
    main()
