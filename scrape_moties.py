"""
Scraper voor moties van de Gemeente Groningen gemeenteraad
Haalt moties op voor 2025 en 2026, inclusief stemgedrag en PDF-samenvatting
"""

import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime

BASE_URL = "https://gemeenteraad.groningen.nl"
from config import ROOT, PDF_DIR, RAW_PAD
OUTPUT_DIR = ROOT
# PDF_DIR uit config
os.makedirs(PDF_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
}

session = requests.Session()
session.headers.update(HEADERS)


def fetch_page(url, retries=3, as_json=False):
    for i in range(retries):
        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            if as_json:
                return resp.json()
            resp.encoding = "utf-8"
            return resp.text
        except Exception as e:
            print(f"  Fout bij {url}: {e} (poging {i+1}/{retries})")
            time.sleep(2)
    return None


def get_moties_for_month(jaar, maand):
    """Haal alle moties op voor een bepaald jaar/maand via de lijst-pagina."""
    url = f"{BASE_URL}/Documenten/Moties/{jaar}/{maand}"
    print(f"  Ophalen: {url}")
    html = fetch_page(url)
    if not html:
        return []

    soup = BeautifulSoup(html, "lxml")
    moties = parse_moties_van_soup(soup, jaar, maand)

    # Paginering: zoek naar expliciete "volgende pagina" link
    # Gebruik een set van bekende doc_ids om duplicaten te detecteren
    bekende_ids = {m.get("doc_id") for m in moties if m.get("doc_id")}
    page = 2
    while True:
        next_link = soup.find("a", string=re.compile(r"^\s*[>»]\s*$|volgende", re.I))
        if not next_link:
            break  # Geen expliciete volgende-pagina link: stop

        next_url = f"{url}?page={page}"
        html2 = fetch_page(next_url)
        if not html2:
            break
        soup2 = BeautifulSoup(html2, "lxml")
        nieuwe = parse_moties_van_soup(soup2, jaar, maand)
        if not nieuwe:
            break
        # Stop als de nieuwe pagina exact dezelfde IDs bevat (herhaalde content)
        nieuwe_ids = {m.get("doc_id") for m in nieuwe if m.get("doc_id")}
        if nieuwe_ids and nieuwe_ids.issubset(bekende_ids):
            break
        for m in nieuwe:
            if m.get("doc_id") not in bekende_ids:
                moties.append(m)
                bekende_ids.add(m.get("doc_id"))
        soup = soup2
        page += 1
        time.sleep(0.3)

    return moties


def parse_moties_van_soup(soup, jaar, maand):
    """Extraheer motie-items uit de overzichtspagina soup."""
    moties = []

    # Moties staan in li.document-list-row binnen ul.document-list
    rijen = soup.select("li.document-list-row")

    for rij in rijen:
        try:
            motie = extraheer_motie_uit_rij(rij, jaar, maand)
            if motie:
                moties.append(motie)
        except Exception as e:
            print(f"  Fout bij parsen rij: {e}")

    return moties


def extraheer_motie_uit_rij(rij, jaar, maand):
    """Extraheer motie-gegevens uit een li.document-list-row element."""
    # Document ID
    doc_div = rij.select_one("[data-document-id]")
    doc_id = doc_div.get("data-document-id") if doc_div else None

    # PDF-link (a.doc-link)
    doc_link = rij.select_one("a.doc-link")
    if not doc_link:
        return None

    pdf_href = doc_link.get("href", "")
    pdf_url = urljoin(BASE_URL, pdf_href) if pdf_href.endswith(".pdf") else None

    # Titel (span.row-title)
    titel_el = rij.select_one("span.row-title")
    if not titel_el:
        return None
    volledige_titel = titel_el.get_text(strip=True)

    # Status extraheren uit de titel
    status = "ONBEKEND"
    for s in ["AANGENOMEN", "VERWORPEN", "INGETROKKEN"]:
        if s in volledige_titel.upper():
            status = s
            break

    # Schone titel (zonder status)
    schone_titel = re.sub(r"\b(AANGENOMEN|VERWORPEN|INGETROKKEN)\b", "", volledige_titel, flags=re.I).strip()
    schone_titel = re.sub(r"\s+", " ", schone_titel).strip()

    # Motie-nummer (M 01, M 12 etc.)
    motie_nr_match = re.match(r"M\s*(\d+)\s*", schone_titel)
    motie_nr = motie_nr_match.group(0).strip() if motie_nr_match else ""

    # Indieners: alles na het laatste "–" of "-" teken
    indieners = []
    if "–" in schone_titel:
        indieners_str = schone_titel.split("–")[-1].strip()
        indieners = [p.strip() for p in re.split(r"[,&]", indieners_str) if p.strip()]
    elif " - " in schone_titel:
        indieners_str = schone_titel.split(" - ")[-1].strip()
        indieners = [p.strip() for p in re.split(r"[,&]", indieners_str) if p.strip()]

    # Voting button data-voting-ref voor stemmingen API
    stem_btn = rij.select_one("button[data-voting-ref]")
    voting_ref = stem_btn.get("data-voting-ref") if stem_btn else doc_id

    return {
        "jaar": jaar,
        "maand": maand,
        "motie_nr": motie_nr,
        "titel": schone_titel,
        "volledige_titel": volledige_titel,
        "status": status,
        "indieners": indieners,
        "pdf_url": pdf_url,
        "doc_id": doc_id,
        "voting_ref": voting_ref,
    }


# Cache voor vergadering-pagina's: meeting_url -> {doc_id: item_id}
_vergadering_cache = {}


def haal_item_ids_voor_vergadering(meeting_url):
    """Haal de mapping van doc_id -> item_id op voor een vergadering-pagina."""
    if meeting_url in _vergadering_cache:
        return _vergadering_cache[meeting_url]

    html = fetch_page(meeting_url)
    if not html:
        _vergadering_cache[meeting_url] = {}
        return {}

    soup = BeautifulSoup(html, "lxml")
    mapping = {}

    for row in soup.select("[data-item-id]"):
        item_id = row.get("data-item-id")
        if not item_id:
            continue
        btn = row.select_one("button[data-voting-ref]")
        if btn:
            doc_id = btn.get("data-voting-ref")
            if doc_id:
                mapping[doc_id] = item_id

    _vergadering_cache[meeting_url] = mapping
    return mapping


def haal_stemmingen_op(item_id):
    """Haal stemgedrag op via de API met het agenda-item ID."""
    if not item_id:
        return {}

    url = f"{BASE_URL}/vergaderingen/stemmingen/agendapunt/{item_id}"
    data = fetch_page(url, as_json=True)

    if not data:
        return {}

    votes = data.get("votes", [])
    stemmingen = {"voor": [], "tegen": [], "onthouden": [], "uitslag": "", "partij_detail": {}}

    for vote in votes:
        html = vote.get("voteResultHtml", "")
        if html:
            stemmingen.update(_parse_vote_html(html))
        else:
            # Fallback: enkelvoudig uitslag-veld
            stem = str(vote.get("vote") or vote.get("result") or "").strip()
            if stem:
                stemmingen["uitslag"] = stem

    return stemmingen


def _parse_vote_html(html):
    """Parseer de voteResultHtml tabel naar een stemmen-dict."""
    soup = BeautifulSoup(html, "lxml")
    stemmingen = {"voor": [], "tegen": [], "onthouden": [], "uitslag": "", "partij_detail": {}}

    rows = soup.select("tbody tr")
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 2:
            continue

        # Partijnaam (eerste span in eerste cel)
        partij_span = cells[0].find("span")
        partij = partij_span.get_text(strip=True) if partij_span else cells[0].get_text(strip=True)

        # Verwijder personen-aantallen notatie: "GroenLinks (7 personen)" -> "GroenLinks"
        partij_naam = re.sub(r"\s*\(\d+\s+pers\w*\)", "", partij).strip()

        # Totaal-rij overslaan
        if partij_naam.lower() == "totaal":
            voor_n = int(cells[1].get_text(strip=True) or 0)
            tegen_n = int(cells[2].get_text(strip=True) or 0)
            ont_n = int(cells[3].get_text(strip=True) or 0) if len(cells) > 3 else 0
            stemmingen["uitslag"] = f"Voor: {voor_n}, Tegen: {tegen_n}" + (f", Onthouden: {ont_n}" if ont_n else "")
            continue

        try:
            voor_n = int(cells[1].get_text(strip=True) or 0)
            tegen_n = int(cells[2].get_text(strip=True) or 0)
            ont_n = int(cells[3].get_text(strip=True) or 0) if len(cells) > 3 else 0
        except (ValueError, IndexError):
            continue

        stemmingen["partij_detail"][partij_naam] = {
            "voor": voor_n, "tegen": tegen_n, "onthouden": ont_n
        }

        if voor_n > 0 and tegen_n == 0:
            stemmingen["voor"].append(partij_naam)
        elif tegen_n > 0 and voor_n == 0:
            stemmingen["tegen"].append(partij_naam)
        elif voor_n > 0 and tegen_n > 0:
            stemmingen["voor"].append(f"{partij_naam} ({voor_n}v/{tegen_n}t)")
        elif ont_n > 0:
            stemmingen["onthouden"].append(partij_naam)

    return stemmingen


def download_pdf(pdf_url, filename):
    """Download een PDF en sla op."""
    filepath = os.path.join(PDF_DIR, filename)
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        print(f"  PDF al aanwezig: {filename}")
        return filepath

    try:
        resp = session.get(pdf_url, timeout=60, stream=True)
        resp.raise_for_status()
        with open(filepath, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        size_kb = os.path.getsize(filepath) / 1024
        print(f"  PDF opgeslagen: {filename} ({size_kb:.1f} KB)")
        return filepath
    except Exception as e:
        print(f"  PDF download fout: {e}")
        return None


def extraheer_tekst_uit_pdf(filepath):
    """Extraheer tekst uit een PDF-bestand."""
    # Probeer pypdf (moderne versie van PyPDF2)
    try:
        import pypdf
        reader = pypdf.PdfReader(filepath)
        tekst = ""
        for pagina in reader.pages:
            tekst += pagina.extract_text() or ""
        if tekst.strip():
            return tekst
    except Exception:
        pass

    # Fallback: pdfminer
    try:
        from pdfminer.high_level import extract_text
        tekst = extract_text(filepath)
        if tekst and tekst.strip():
            return tekst
    except Exception:
        pass

    return ""


def maak_samenvatting(tekst, titel=""):
    """Maak een gestructureerde samenvatting van een motie-tekst."""
    if not tekst or len(tekst.strip()) < 30:
        return "Geen tekst beschikbaar."

    # Opschoning
    tekst = re.sub(r"\s+", " ", tekst).strip()

    onderdelen = {}

    # Typische motie-structuur secties
    secties = [
        ("constaterende", r"constaterende\s+(?:dat\s+)?(.{30,600}?)(?=\n\n|overwegende|verzoekt|draagt|roept|besluit|gezien|gelet|\Z)"),
        ("overwegende", r"overwegende\s+(?:dat\s+)?(.{30,600}?)(?=\n\n|constaterende|verzoekt|draagt|roept|besluit|\Z)"),
        ("verzoekt", r"verzoekt\s+(?:het\s+college\s+)?(?:van\s+burgemeester\s+en\s+wethouders\s+)?(?:om\s+)?(.{30,600}?)(?=\n\n|en\s+gaat|en\s+gaat|\Z)"),
        ("draagt op", r"draagt\s+(?:het\s+college\s+)?(?:op\s+)?(?:om\s+)?(.{30,600}?)(?=\n\n|\Z)"),
        ("roept op", r"roept\s+(?:.{5,30}?\s+)?op\s+(?:om\s+)?(.{30,600}?)(?=\n\n|\Z)"),
        ("besluit", r"besluit\s+(?:om\s+)?(.{30,600}?)(?=\n\n|\Z)"),
    ]

    for label, patroon in secties:
        match = re.search(patroon, tekst, re.I | re.S)
        if match:
            inhoud = match.group(1).strip()[:400]
            inhoud = re.sub(r"\s+", " ", inhoud)
            onderdelen[label] = inhoud

    if onderdelen:
        regels = []
        for label, inhoud in onderdelen.items():
            regels.append(f"**{label.capitalize()}:** {inhoud}")
        return "\n\n".join(regels)
    else:
        # Geef de eerste 600 tekens als fallback
        preview = tekst[:600]
        return preview + ("..." if len(tekst) > 600 else "")


def maak_rapport(moties, output_dir):
    """Schrijf een leesbaar markdown rapport."""
    rapport_pad = os.path.join(output_dir, "moties_rapport.md")

    with open(rapport_pad, "w", encoding="utf-8") as f:
        f.write("# Moties Gemeente Groningen Gemeenteraad\n")
        f.write(f"## Overzicht 2025 en 2026\n\n")
        f.write(f"*Gegenereerd op: {datetime.now().strftime('%d-%m-%Y %H:%M')}*\n\n")
        f.write(f"**Totaal aantal moties:** {len(moties)}\n\n")

        # Statistieken
        statussen = {}
        for m in moties:
            s = m.get("status", "ONBEKEND")
            statussen[s] = statussen.get(s, 0) + 1

        f.write("### Statistieken\n\n")
        f.write("| Status | Aantal |\n|--------|--------|\n")
        for s, n in sorted(statussen.items()):
            f.write(f"| {s} | {n} |\n")
        f.write("\n")

        # Per jaar
        for jaar in [2025, 2026]:
            jaar_moties = [m for m in moties if m.get("jaar") == jaar]
            if not jaar_moties:
                continue

            aangenomen = [m for m in jaar_moties if m.get("status") == "AANGENOMEN"]
            verworpen = [m for m in jaar_moties if m.get("status") == "VERWORPEN"]
            ingetrokken = [m for m in jaar_moties if m.get("status") == "INGETROKKEN"]

            f.write(f"---\n\n## Moties {jaar}\n\n")
            f.write(f"*{len(jaar_moties)} moties: {len(aangenomen)} aangenomen, {len(verworpen)} verworpen, {len(ingetrokken)} ingetrokken*\n\n")

            for m in jaar_moties:
                f.write(f"### {m.get('motie_nr', '')} {m.get('titel', 'Onbekend')}\n\n")

                status = m.get("status", "ONBEKEND")
                status_emoji = {"AANGENOMEN": "✅", "VERWORPEN": "❌", "INGETROKKEN": "↩️"}.get(status, "❓")
                f.write(f"**Status:** {status_emoji} {status}\n\n")

                if m.get("indieners"):
                    f.write(f"**Indieners:** {', '.join(m['indieners'])}\n\n")

                if m.get("pdf_url"):
                    f.write(f"**PDF:** [{m['pdf_url'].split('/')[-1]}]({m['pdf_url']})\n\n")

                # Stemgedrag
                stemmingen = m.get("stemmingen", {})
                voor = stemmingen.get("voor", [])
                tegen = stemmingen.get("tegen", [])
                onthouden = stemmingen.get("onthouden", [])

                if voor or tegen or onthouden:
                    f.write("**Stemgedrag:**\n\n")
                    if voor:
                        f.write(f"- Voor ({len(voor)}): {', '.join(voor)}\n")
                    if tegen:
                        f.write(f"- Tegen ({len(tegen)}): {', '.join(tegen)}\n")
                    if onthouden:
                        f.write(f"- Onthouden ({len(onthouden)}): {', '.join(onthouden)}\n")
                    f.write("\n")
                else:
                    f.write("**Stemgedrag:** Niet beschikbaar\n\n")

                # Samenvatting
                samenvatting = m.get("samenvatting", "")
                if samenvatting:
                    f.write(f"**Samenvatting:**\n\n{samenvatting}\n\n")

                f.write("---\n\n")

    print(f"\nRapport opgeslagen: {rapport_pad}")
    return rapport_pad


def main():
    jaren = [2025, 2026]
    alle_moties = []

    print("=" * 60)
    print("Groningen Gemeenteraad - Moties Scraper")
    print("=" * 60)

    # Stap 1: Verzamel alle moties per maand
    for jaar in jaren:
        max_maand = 12 if jaar < 2026 else datetime.now().month
        print(f"\nJaar {jaar}:")
        for maand in range(1, max_maand + 1):
            moties = get_moties_for_month(jaar, maand)
            if moties:
                print(f"  Maand {maand:2d}: {len(moties)} moties gevonden")
                alle_moties.extend(moties)
            time.sleep(0.5)

    print(f"\n{'='*60}")
    print(f"Totaal gevonden: {len(alle_moties)} moties")
    print(f"{'='*60}\n")

    if not alle_moties:
        print("Geen moties gevonden. Controleer de website-structuur.")
        return

    # Stap 2: Haal stemmingen op en download PDFs
    for i, motie in enumerate(alle_moties, 1):
        print(f"\n[{i:3d}/{len(alle_moties)}] {motie.get('motie_nr', '')} - {motie.get('titel', 'Onbekend')[:60]}")
        print(f"         Status: {motie.get('status', 'onbekend')}")

        # Stemmingen ophalen via agenda-item ID
        pdf_url = motie.get("pdf_url", "")
        doc_id = motie.get("doc_id")
        item_id = None

        if pdf_url and doc_id:
            # Meeting URL = alles tot en met het tijdslot (2 niveaus boven PDF-bestand)
            # bv: .../2025/29-januari/16:30/M-08-.../M-08-....pdf -> .../2025/29-januari/16:30/
            parts = pdf_url.replace(BASE_URL, "").split("/")
            # Verwijder laatste 2 segmenten (mapnaam en bestand)
            if len(parts) >= 3:
                meeting_path = "/".join(parts[:-2])
                meeting_url = BASE_URL + meeting_path
                id_mapping = haal_item_ids_voor_vergadering(meeting_url)
                item_id = id_mapping.get(str(doc_id))

        if item_id:
            stemmingen = haal_stemmingen_op(item_id)
            motie["stemmingen"] = stemmingen
            uitslag = stemmingen.get("uitslag", "")
            voor = stemmingen.get("voor", [])
            tegen = stemmingen.get("tegen", [])
            if uitslag:
                print(f"         Uitslag: {uitslag}")
            if voor:
                print(f"         Voor:  {', '.join(voor)}")
            if tegen:
                print(f"         Tegen: {', '.join(tegen)}")
            time.sleep(0.3)
        else:
            motie["stemmingen"] = {}

        # PDF downloaden
        pdf_url = motie.get("pdf_url")
        if pdf_url:
            safe_titel = re.sub(r"[^\w\-]", "_", motie.get("titel", "motie"))[:50]
            filename = f"{motie['jaar']}_{motie['maand']:02d}_{motie.get('motie_nr','M').replace(' ','_')}_{safe_titel}.pdf"
            filename = re.sub(r"_+", "_", filename)

            pdf_pad = download_pdf(pdf_url, filename)
            motie["pdf_pad"] = pdf_pad

            if pdf_pad:
                pdf_tekst = extraheer_tekst_uit_pdf(pdf_pad)
                motie["samenvatting"] = maak_samenvatting(pdf_tekst, motie.get("titel", ""))
                if motie["samenvatting"]:
                    preview = motie['samenvatting'][:80].encode('ascii', errors='replace').decode('ascii')
                    print(f"         Samenvatting: {preview}...")
            time.sleep(0.3)
        else:
            print("         Geen PDF-link gevonden")
            motie["samenvatting"] = ""

    # Stap 3: Sla resultaten op
    json_pad = RAW_PAD

    # Maak een serialiseerbare versie (zonder raw voting data)
    json_moties = []
    for m in alle_moties:
        m_clean = {k: v for k, v in m.items() if k != "raw"}
        if "stemmingen" in m_clean and "raw" in m_clean["stemmingen"]:
            m_clean["stemmingen"] = {k: v for k, v in m_clean["stemmingen"].items() if k != "raw"}
        json_moties.append(m_clean)

    with open(json_pad, "w", encoding="utf-8") as f:
        json.dump(json_moties, f, ensure_ascii=False, indent=2)
    print(f"\nJSON opgeslagen: {json_pad}")

    # Stap 4: Maak rapport
    rapport_pad = maak_rapport(alle_moties, OUTPUT_DIR)

    print(f"\n{'='*60}")
    print("KLAAR!")
    print(f"- JSON data: {json_pad}")
    print(f"- Rapport:   {rapport_pad}")
    print(f"- PDFs:      {PDF_DIR}")
    print(f"- Totaal:    {len(alle_moties)} moties verwerkt")

    # Snelle statistieken
    statussen = {}
    for m in alle_moties:
        s = m.get("status", "ONBEKEND")
        statussen[s] = statussen.get(s, 0) + 1
    print("\nStatistieken:")
    for s, n in sorted(statussen.items()):
        print(f"  {s}: {n}")


if __name__ == "__main__":
    main()
