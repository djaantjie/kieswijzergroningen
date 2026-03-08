"""
Genereer een interactieve Stemwijzer HTML-app op basis van de Groningen moties data.
"""

import json
import re
import os
from collections import defaultdict

from config import VERRIJKT_PAD as DATA_PAD, HTML_OUTPUT as OUTPUT_PAD


# Partijen die we meenemen (geen procedurele rollen)
PARTIJEN_EXCLUSIE = {"Plv. voorzitter gemeenteraad", "Griffier", "Burgemeester", "Presidium", "Audit Committee"}

PARTIJ_KLEUREN = {
    "GroenLinks": "#4CAF50",
    "PvdA": "#E53935",
    "D66": "#00ACC1",
    "SP": "#E64A19",
    "VVD": "#1565C0",
    "ChristenUnie": "#5C6BC0",
    "Partij voor de Dieren": "#2E7D32",
    "CDA": "#388E3C",
    "Stadspartij 100% voor Groningen": "#F57C00",
    "Student en Stad": "#8E24AA",
    "PVV": "#1A237E",
    "Partij voor het Noorden": "#00695C",
    "Groep Staijen": "#546E7A",
}


def laad_data():
    with open(DATA_PAD, encoding="utf-8") as f:
        data = json.load(f)

    moties = []
    for m in data:
        partij_detail = m.get("stemmingen", {}).get("partij_detail", {})
        if not partij_detail:
            continue
        samenvatting = m.get("samenvatting", "").strip()
        if not samenvatting or len(samenvatting) < 20:
            continue

        # Filter procedurele partijen uit stemdetail
        stem_gefilterd = {
            p: v for p, v in partij_detail.items()
            if p not in PARTIJEN_EXCLUSIE
        }
        if not stem_gefilterd:
            continue

        # Bouw vereenvoudigd stemrecord: partij -> "voor" | "tegen" | "onthouden"
        stem_richting = {}
        for partij, aantallen in stem_gefilterd.items():
            v = aantallen.get("voor", 0)
            t = aantallen.get("tegen", 0)
            o = aantallen.get("onthouden", 0)
            if v > t:
                stem_richting[partij] = "voor"
            elif t > v:
                stem_richting[partij] = "tegen"
            elif o > 0:
                stem_richting[partij] = "onthouden"

        # Schone samenvatting (max 600 tekens)
        samen_kort = re.sub(r"\*\*([^*]+)\*\*", r"\1", samenvatting)  # Verwijder markdown bold
        samen_kort = re.sub(r"\s+", " ", samen_kort).strip()[:600]

        titel_leesbaar = m.get("titel_leesbaar", "").strip()
        uitleg = m.get("uitleg", "").strip()

        moties.append({
            "id": m.get("doc_id", ""),
            "nr": m.get("motie_nr", ""),
            "titel": titel_leesbaar or m.get("titel", "").strip(),
            "titel_origineel": m.get("titel", "").strip(),
            "jaar": m.get("jaar"),
            "maand": m.get("maand"),
            "status": m.get("status", ""),
            "indieners": m.get("indieners", []),
            "uitleg": uitleg,
            "samenvatting": uitleg or samen_kort,
            "categorie": m.get("categorie", "Overig"),
            "voordelen": m.get("voordelen", []),
            "nadelen": m.get("nadelen", []),
            "context": m.get("context", ""),
            "bronnen": m.get("bronnen", []),
            "pdf_url": m.get("pdf_url", ""),
            "uitslag": m.get("stemmingen", {}).get("uitslag", ""),
            "stem_richting": stem_richting,
        })

    return moties


def bereken_correlatie(alle_data, partijen):
    """Bereken de overeenkomst-matrix tussen alle partijparen (0–100%)."""
    EXCL = set(PARTIJEN_EXCLUSIE) | {"Gemeenteraad"}

    agree = defaultdict(int)
    total = defaultdict(int)
    # Per motie: ook bijhouden wat elke partij stemde (voor analyse per motie)
    motie_stemmen = []  # lijst van {partij: 'voor'|'tegen'}

    for m in alle_data:
        detail = m.get("stemmingen", {}).get("partij_detail", {})
        if not detail:
            continue
        richting = {}
        for p, v in detail.items():
            if p in EXCL:
                continue
            if v["voor"] > v["tegen"]:
                richting[p] = "voor"
            elif v["tegen"] > v["voor"]:
                richting[p] = "tegen"
        motie_stemmen.append(richting)

        ps = [p for p in partijen if p in richting]
        for i, p1 in enumerate(ps):
            for p2 in ps[i + 1:]:
                key = (p1, p2)
                total[key] += 1
                if richting[p1] == richting[p2]:
                    agree[key] += 1

    # Bouw NxN matrix (symmetrisch, diagonaal = 100)
    n = len(partijen)
    matrix = [[100 if i == j else 0 for j in range(n)] for i in range(n)]
    counts = [[0] * n for _ in range(n)]

    for i, p1 in enumerate(partijen):
        for j, p2 in enumerate(partijen):
            if i == j:
                counts[i][j] = len(motie_stemmen)
                continue
            key = (p1, p2) if (p1, p2) in total else (p2, p1)
            if key in total and total[key] > 0:
                pct = round(agree[key] / total[key] * 100)
                matrix[i][j] = pct
                counts[i][j] = total[key]

    # Top-paren (minimaal 20 gedeelde stemmen)
    paren = []
    for (p1, p2), t in total.items():
        if t >= 20:
            pct = round(agree[(p1, p2)] / t * 100)
            paren.append({"p1": p1, "p2": p2, "pct": pct, "n": t})
    paren.sort(key=lambda x: x["pct"], reverse=True)

    return {
        "matrix": matrix,
        "counts": counts,
        "partijen": partijen,
        "top_eens": paren[:10],
        "top_oneens": paren[-10:][::-1],
    }


def genereer_html(moties, correlatie):
    partijen = sorted(
        set(p for m in moties for p in m["stem_richting"]),
        key=lambda p: p.lower()
    )

    moties_json = json.dumps(moties, ensure_ascii=False)
    partijen_json = json.dumps(partijen, ensure_ascii=False)
    kleuren_json = json.dumps(PARTIJ_KLEUREN, ensure_ascii=False)
    correlatie_json = json.dumps(correlatie, ensure_ascii=False)

    html = f"""<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Stemwijzer Groningen 2025–2026</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root {{
    --accent: #2563eb;
    --accent2: #7c3aed;
    --bg: #0f172a;
    --surface: #1e293b;
    --surface2: #263348;
    --border: #334155;
    --text: #f1f5f9;
    --muted: #94a3b8;
    --voor: #22c55e;
    --voor-dark: #166534;
    --tegen: #ef4444;
    --tegen-dark: #991b1b;
    --neutraal: #64748b;
    --gold: #f59e0b;
    --radius: 16px;
    --radius-sm: 10px;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.6;
  }}

  /* ── HEADER ── */
  header {{
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #7c3aed 100%);
    padding: 0 24px;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  }}
  .header-inner {{
    max-width: 900px;
    margin: 0 auto;
    padding: 16px 0;
    display: flex;
    align-items: center;
    gap: 16px;
  }}
  .header-logo {{
    font-size: 1.8rem;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3));
  }}
  .header-text h1 {{
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: white;
  }}
  .header-text p {{ font-size: 0.78rem; opacity: 0.75; color: white; }}
  #progress-bar-wrap {{
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 3px;
    background: rgba(255,255,255,0.15);
    display: none;
  }}
  #progress-bar {{
    height: 100%;
    background: linear-gradient(90deg, #a5f3fc, #818cf8);
    transition: width 0.5s cubic-bezier(.4,0,.2,1);
    width: 0%;
    border-radius: 0 2px 2px 0;
  }}
  #progress-label {{
    display: none;
    font-size: 0.72rem;
    opacity: 0.7;
    margin-top: 2px;
    color: white;
  }}

  /* ── VIEWS ── */
  .view {{ display: none; max-width: 780px; margin: 0 auto; padding: 32px 20px 80px; }}
  .view.active {{ display: block; animation: fadeUp 0.3s ease; }}
  @keyframes fadeUp {{
    from {{ opacity: 0; transform: translateY(16px); }}
    to {{ opacity: 1; transform: translateY(0); }}
  }}

  /* ── WELKOM ── */
  .welkom-hero {{
    background: linear-gradient(135deg, #1e3a8a22, #7c3aed22);
    border: 1px solid #334155;
    border-radius: var(--radius);
    padding: 40px 36px;
    margin-bottom: 20px;
    position: relative;
    overflow: hidden;
  }}
  .welkom-hero::before {{
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 200px; height: 200px;
    background: radial-gradient(circle, #7c3aed33, transparent 70%);
    pointer-events: none;
  }}
  .welkom-hero h2 {{
    font-size: 2rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, #93c5fd, #c4b5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 12px;
  }}
  .welkom-hero p {{
    color: var(--muted);
    font-size: 1rem;
    line-height: 1.7;
    margin-bottom: 10px;
    max-width: 520px;
  }}
  .welkom-stats {{
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    margin: 24px 0;
  }}
  .stat-pill {{
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 100px;
    padding: 8px 18px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }}
  .stat-pill span {{ opacity: 0.6; font-weight: 400; }}
  .welkom-features {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 24px 0;
  }}
  .feature-item {{
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    font-size: 0.85rem;
    color: var(--muted);
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }}
  .feature-item .fi {{ font-size: 1.1rem; flex-shrink: 0; }}
  .btn-start {{
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: white;
    padding: 15px 32px;
    border-radius: 100px;
    border: none;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 20px rgba(37,99,235,0.4);
    letter-spacing: -0.01em;
  }}
  .btn-start:hover {{ transform: translateY(-2px); box-shadow: 0 8px 28px rgba(37,99,235,0.5); }}
  .btn-start:active {{ transform: translateY(0); }}
  .btn-secondary {{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--muted);
    padding: 12px 24px;
    border-radius: 100px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 10px;
  }}
  .btn-secondary:hover {{ border-color: var(--accent); color: #93c5fd; }}

  /* ── VRAAG ── */
  .vraag-card {{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 28px;
    margin-bottom: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }}
  #view-vraag .meta {{
    font-size: 0.72rem;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }}
  #view-vraag .meta::before {{
    content: '';
    display: inline-block;
    width: 6px; height: 6px;
    background: var(--accent);
    border-radius: 50%;
  }}
  #view-vraag h2 {{
    font-size: 1.3rem;
    font-weight: 800;
    line-height: 1.35;
    letter-spacing: -0.02em;
    margin-bottom: 18px;
    color: var(--text);
  }}
  .samenvatting-box {{
    background: linear-gradient(135deg, #1e3a8a18, #1e293b);
    border: 1px solid #2563eb33;
    border-left: 3px solid var(--accent);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    padding: 16px 18px;
    margin-bottom: 10px;
    font-size: 0.92rem;
    line-height: 1.75;
    color: #cbd5e1;
  }}
  .samenvatting-meer {{ display: none; margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px; color: var(--muted); font-size: 0.82rem; }}
  .toggle-meer {{
    background: none;
    border: none;
    color: #60a5fa;
    font-size: 0.8rem;
    cursor: pointer;
    margin-bottom: 18px;
    padding: 4px 0;
    font-weight: 500;
    transition: color 0.15s;
  }}
  .toggle-meer:hover {{ color: #93c5fd; }}
  /* Indieners verborgen achter toggle */
  .meta-acties {{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }}
  .btn-pdf-motie {{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #60a5fa;
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 6px 14px;
    background: #1e3a8a22;
    border-radius: 100px;
    border: 1px solid #2563eb44;
    transition: all 0.15s;
  }}
  .btn-pdf-motie:hover {{ background: #1e3a8a44; color: #93c5fd; }}
  .btn-indieners-toggle {{
    background: none;
    border: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 500;
    padding: 5px 12px;
    border-radius: 100px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }}
  .btn-indieners-toggle:hover {{ border-color: var(--muted); color: var(--text); }}
  .indieners {{
    font-size: 0.78rem;
    color: var(--muted);
    margin-bottom: 18px;
    display: none;  /* Verborgen by default */
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }}
  .indieners.open {{ display: flex; }}
  .indieners span {{
    background: var(--surface2);
    border: 1px solid var(--border);
    color: #93c5fd;
    padding: 3px 10px;
    border-radius: 100px;
    font-size: 0.75rem;
    font-weight: 500;
  }}

  /* ── ANALYSE SECTIE ── */
  .toggle-analyse {{
    background: none;
    border: 1px solid #334155;
    color: var(--muted);
    font-size: 0.78rem;
    cursor: pointer;
    margin-bottom: 16px;
    padding: 6px 14px;
    border-radius: 100px;
    font-weight: 500;
    transition: all 0.15s;
    font-family: inherit;
  }}
  .toggle-analyse:hover {{ border-color: var(--accent); color: #93c5fd; }}
  .analyse-wrap {{
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: var(--radius-sm);
    margin-bottom: 12px;
    overflow: hidden;
  }}
  .analyse-tabs {{
    display: flex;
    border-bottom: 1px solid #334155;
    background: #1e293b;
  }}
  .analyse-tab {{
    flex: 1;
    background: none;
    border: none;
    padding: 9px 8px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    color: var(--muted);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.15s;
    font-family: inherit;
    white-space: nowrap;
  }}
  .analyse-tab.actief {{ color: var(--text); border-bottom-color: var(--accent); }}
  .analyse-tab:hover:not(.actief) {{ color: var(--text); }}
  .analyse-inhoud {{
    padding: 14px 16px;
    font-size: 0.85rem;
    line-height: 1.65;
    color: #cbd5e1;
  }}
  .analyse-lijst {{ list-style: none; padding: 0; }}
  .analyse-lijst li {{
    display: flex;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid #1e293b;
    align-items: flex-start;
  }}
  .analyse-lijst li:last-child {{ border-bottom: none; }}
  .analyse-icoon {{ flex-shrink: 0; font-size: 0.9rem; margin-top: 1px; }}
  .analyse-context {{
    font-style: italic;
    color: #94a3b8;
    font-size: 0.83rem;
    line-height: 1.7;
  }}

  /* ── STEM KNOPPEN ── */
  .stem-knoppen {{ display: flex; gap: 10px; flex-wrap: wrap; }}
  .stem-btn {{
    flex: 1; min-width: 110px;
    padding: 18px 12px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--border);
    background: var(--surface2);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.18s cubic-bezier(.4,0,.2,1);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    position: relative;
    overflow: hidden;
  }}
  .stem-btn::after {{
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.2s;
  }}
  .stem-btn .icoon {{ font-size: 1.8rem; transition: transform 0.2s; }}
  .stem-btn:hover {{ transform: translateY(-3px); }}
  .stem-btn:hover .icoon {{ transform: scale(1.15); }}
  .stem-btn.eens {{
    border-color: #22c55e55;
    color: #86efac;
  }}
  .stem-btn.eens:hover, .stem-btn.eens.gekozen {{
    background: linear-gradient(135deg, #14532d, #166534);
    border-color: #22c55e;
    color: #bbf7d0;
    box-shadow: 0 4px 20px #22c55e33;
  }}
  .stem-btn.neutraal {{
    border-color: #64748b55;
    color: #94a3b8;
  }}
  .stem-btn.neutraal:hover, .stem-btn.neutraal.gekozen {{
    background: linear-gradient(135deg, #1e293b, #334155);
    border-color: #64748b;
    color: #cbd5e1;
    box-shadow: 0 4px 20px #64748b33;
  }}
  .stem-btn.oneens {{
    border-color: #ef444455;
    color: #fca5a5;
  }}
  .stem-btn.oneens:hover, .stem-btn.oneens.gekozen {{
    background: linear-gradient(135deg, #7f1d1d, #991b1b);
    border-color: #ef4444;
    color: #fecaca;
    box-shadow: 0 4px 20px #ef444433;
  }}
  .stem-btn.sla-over {{
    border-color: transparent;
    background: none;
    color: var(--muted);
    font-size: 0.8rem;
    min-width: auto;
    flex: 0;
    padding: 8px 18px;
    border-radius: 100px;
    border: 1px solid var(--border);
    margin-top: 4px;
  }}
  .stem-btn.sla-over:hover {{ color: var(--text); border-color: var(--muted); transform: none; }}

  .navigatie {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 18px;
  }}
  .btn-terug {{
    background: none;
    border: 1px solid var(--border);
    color: var(--muted);
    padding: 8px 18px;
    border-radius: 100px;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 500;
    transition: all 0.15s;
  }}
  .btn-terug:hover {{ border-color: var(--accent); color: #93c5fd; }}
  .vraag-nr {{ font-size: 0.8rem; color: var(--muted); font-weight: 500; }}

  /* ── RESULTATEN ── */
  #view-resultaat h2 {{
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, #93c5fd, #c4b5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 6px;
  }}
  #view-resultaat .subtitel {{ color: var(--muted); margin-bottom: 28px; font-size: 0.88rem; }}

  .partij-kaart {{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    margin-bottom: 10px;
    overflow: hidden;
    transition: all 0.2s;
    cursor: default;
  }}
  .partij-kaart:hover {{ border-color: #334155cc; box-shadow: 0 4px 20px rgba(0,0,0,0.25); transform: translateX(3px); }}
  .partij-kaart.top-1 {{
    border-color: var(--gold);
    box-shadow: 0 0 0 1px #f59e0b44, 0 4px 24px #f59e0b22;
    background: linear-gradient(135deg, #78350f18, var(--surface));
  }}
  .partij-header {{ display: flex; align-items: center; gap: 14px; padding: 14px 18px; }}
  .partij-rank {{
    font-size: 0.8rem;
    font-weight: 800;
    color: var(--muted);
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }}
  .top-1 .partij-rank {{ color: var(--gold); font-size: 1rem; }}
  .partij-dot {{ width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }}
  .partij-naam {{ font-weight: 700; font-size: 0.95rem; flex: 1; color: var(--text); }}
  .match-pct {{ font-size: 1.5rem; font-weight: 900; letter-spacing: -0.03em; }}
  .match-bar-wrap {{ height: 4px; background: var(--surface2); }}
  .match-bar {{ height: 100%; transition: width 1s cubic-bezier(.4,0,.2,1); border-radius: 0 2px 2px 0; }}
  .partij-detail {{ padding: 6px 18px 12px 18px; font-size: 0.78rem; color: var(--muted); }}

  /* ── TAB NAV ── */
  .tab-nav {{
    display: flex;
    gap: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 100px;
    padding: 4px;
    margin-bottom: 28px;
    width: fit-content;
  }}
  .tab-btn {{
    background: none;
    border: none;
    padding: 8px 18px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    color: var(--muted);
    border-radius: 100px;
    transition: all 0.2s;
    white-space: nowrap;
    font-family: inherit;
  }}
  .tab-btn.actief {{
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: white;
    box-shadow: 0 2px 12px rgba(37,99,235,0.4);
  }}
  .tab-btn:hover:not(.actief) {{ color: var(--text); background: var(--surface2); }}

  /* ── FILTERS ── */
  .filter-sectie {{ margin-bottom: 20px; }}
  .filter-label {{ font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px; }}
  .filters {{ display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }}
  .filter-btn {{
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 100px;
    padding: 5px 14px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--muted);
    font-family: inherit;
    white-space: nowrap;
  }}
  .filter-btn.actief {{ background: var(--accent); color: white; border-color: var(--accent); }}
  .filter-btn:hover:not(.actief) {{ border-color: var(--accent); color: #93c5fd; }}
  .cat-btn.actief {{ background: var(--accent2); border-color: var(--accent2); }}

  /* ── CATEGORIE LABELS ── */
  .cat-label {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 600;
    color: #c4b5fd;
    background: #7c3aed18;
    border: 1px solid #7c3aed33;
    border-radius: 100px;
    padding: 2px 8px;
    white-space: nowrap;
  }}
  .meta-cat {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.68rem;
    font-weight: 700;
    color: #c4b5fd;
    background: #7c3aed22;
    border: 1px solid #7c3aed44;
    border-radius: 100px;
    padding: 2px 8px;
    text-transform: none;
    letter-spacing: 0;
  }}

  /* ── ZOEK ── */
  .zoek-wrap {{ position: relative; margin-bottom: 16px; }}
  .zoek-icoon {{ position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.9rem; pointer-events: none; }}
  .zoek-input {{
    width: 100%;
    padding: 11px 14px 11px 38px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    color: var(--text);
    font-family: inherit;
    transition: border-color 0.15s;
  }}
  .zoek-input::placeholder {{ color: var(--muted); }}
  .zoek-input:focus {{ outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px #2563eb22; }}

  /* ── TABEL ── */
  .tabel-wrap {{ border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border); }}
  table {{ width: 100%; border-collapse: collapse; background: var(--surface); font-size: 0.82rem; }}
  th {{
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
    padding: 10px 14px;
    text-align: left;
    font-weight: 700;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    white-space: nowrap;
  }}
  td {{ padding: 11px 14px; border-bottom: 1px solid #1e293b; vertical-align: top; color: var(--text); }}
  tr:last-child td {{ border-bottom: none; }}
  tr:hover td {{ background: var(--surface2); }}

  .badge {{ display: inline-block; padding: 3px 9px; border-radius: 100px; font-size: 0.72rem; font-weight: 700; white-space: nowrap; letter-spacing: 0.02em; }}
  .badge-aangenomen {{ background: #14532d; color: #86efac; border: 1px solid #22c55e44; }}
  .badge-verworpen {{ background: #7f1d1d; color: #fca5a5; border: 1px solid #ef444444; }}
  .badge-ingetrokken {{ background: #78350f; color: #fde68a; border: 1px solid #f59e0b44; }}
  .badge-onbekend {{ background: var(--surface2); color: var(--muted); border: 1px solid var(--border); }}

  .partij-chip {{ display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; margin: 1px; }}
  .chip-voor {{ background: #14532d; color: #86efac; }}
  .chip-tegen {{ background: #7f1d1d; color: #fca5a5; }}

  .link-pdf {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #60a5fa;
    text-decoration: none;
    font-size: 0.78rem;
    font-weight: 500;
    padding: 4px 10px;
    background: #1e3a8a22;
    border-radius: 6px;
    border: 1px solid #2563eb33;
    transition: all 0.15s;
  }}
  .link-pdf:hover {{ background: #1e3a8a44; color: #93c5fd; }}

  .tabel-footer {{ padding: 10px 14px; font-size: 0.78rem; color: var(--muted); background: var(--surface2); border-top: 1px solid var(--border); }}

  /* ── RESPONSIVE ── */
  @media (max-width: 600px) {{
    .welkom-features {{ grid-template-columns: 1fr; }}
    .stem-knoppen {{ flex-direction: column; }}
    .stem-btn {{ flex-direction: row; min-width: auto; padding: 14px 16px; }}
    .stem-btn .icoon {{ font-size: 1.4rem; }}
    table {{ display: block; overflow-x: auto; }}
    .tab-nav {{ width: 100%; }}
    .tab-btn {{ flex: 1; text-align: center; padding: 8px 10px; font-size: 0.78rem; }}
  }}

  /* ── SCROLLBAR ── */
  ::-webkit-scrollbar {{ width: 8px; height: 8px; }}
  ::-webkit-scrollbar-track {{ background: var(--bg); }}
  ::-webkit-scrollbar-thumb {{ background: var(--border); border-radius: 4px; }}
  ::-webkit-scrollbar-thumb:hover {{ background: var(--muted); }}
</style>
</head>
<body>

<header>
  <div class="header-inner">
    <div class="header-logo">🗳️</div>
    <div class="header-text">
      <h1>Stemwijzer Groningen</h1>
      <p>Gemeenteraad 2025–2026</p>
    </div>
    <div id="progress-label" style="margin-left:auto;font-size:0.78rem;opacity:0.75;color:white;display:none"></div>
  </div>
  <div id="progress-bar-wrap">
    <div id="progress-bar"></div>
  </div>
</header>

<!-- WELKOM -->
<div id="view-welkom" class="view active">
  <div class="welkom-hero">
    <h2>Wat vind jij?</h2>
    <p>Ontdek welke Groningse raadsfractie het beste bij jouw standpunten past — gebaseerd op échte stemmen in de gemeenteraad.</p>
    <div class="welkom-stats">
      <div class="stat-pill">🗳️ {len(moties)} moties <span>met stemdata</span></div>
      <div class="stat-pill">🏛️ 13 fracties</div>
      <div class="stat-pill">📅 2025–2026</div>
    </div>
    <div class="welkom-features">
      <div class="feature-item"><span class="fi">✅</span>Reageer op stellingen over echte raadsmoties</div>
      <div class="feature-item"><span class="fi">🏆</span>Zie jouw match-percentage per fractie</div>
      <div class="feature-item"><span class="fi">📊</span>Bekijk hoe elke partij stemde per onderwerp</div>
      <div class="feature-item"><span class="fi">🔗</span>Ontdek coalitiepatronen tussen partijen</div>
    </div>
    <button class="btn-start" onclick="startStemwijzer()">▶&nbsp; Start de stemwijzer</button>
    <br>
    <button class="btn-secondary" id="btn-direct-overzicht">📋&nbsp; Bekijk direct alle moties</button>
  </div>
</div>

<!-- VRAAG -->
<div id="view-vraag" class="view">
  <div class="vraag-card">
    <div class="meta" id="vraag-meta"></div>
    <h2 id="vraag-titel"></h2>
    <div class="samenvatting-box">
      <div id="samen-kort"></div>
      <div id="samen-meer" class="samenvatting-meer"></div>
    </div>
    <button class="toggle-meer" id="toggle-meer-btn" onclick="toggleMeer()">▼ Zie originele titel</button>

    <!-- Actiebalk: PDF + indieners toggle -->
    <div class="meta-acties">
      <a id="btn-pdf-motie" href="#" target="_blank" rel="noopener" class="btn-pdf-motie" style="display:none">📄 Bekijk motie</a>
      <button class="btn-indieners-toggle" id="btn-indieners-toggle" onclick="toggleIndieners()" style="display:none">👥 Indieners</button>
    </div>
    <div class="indieners" id="vraag-indieners"></div>

    <!-- Analyse sectie -->
    <div class="analyse-wrap" id="analyse-wrap" style="display:none">
      <div class="analyse-tabs">
        <button class="analyse-tab actief" onclick="toonAnalyseTab('voordelen', this)">✅ Voordelen</button>
        <button class="analyse-tab" onclick="toonAnalyseTab('nadelen', this)">⚠️ Nadelen</button>
        <button class="analyse-tab" onclick="toonAnalyseTab('context', this)">📖 Context</button>
        <button class="analyse-tab" id="tab-bronnen-btn" onclick="toonAnalyseTab('bronnen', this)">🔗 Bronnen</button>
      </div>
      <div class="analyse-inhoud" id="analyse-inhoud"></div>
    </div>
    <button class="toggle-analyse" id="toggle-analyse-btn" onclick="toggleAnalyse()">🔍 Toon analyse</button>
    <div class="stem-knoppen">
      <button class="stem-btn eens" onclick="stemmen('eens')">
        <span class="icoon">👍</span> Eens
      </button>
      <button class="stem-btn neutraal" onclick="stemmen('neutraal')">
        <span class="icoon">🤷</span> Neutraal
      </button>
      <button class="stem-btn oneens" onclick="stemmen('oneens')">
        <span class="icoon">👎</span> Oneens
      </button>
    </div>
  <div class="navigatie">
    <button class="btn-terug" onclick="vorigeVraag()">← Vorige</button>
    <span class="vraag-nr" id="vraag-nr-label"></span>
    <button class="stem-btn sla-over" onclick="stemmen('overslaan')">Sla over →</button>
  </div>
</div>

<!-- RESULTATEN + OVERZICHT (tabbed) -->
<div id="view-resultaat" class="view">
  <div class="tab-nav">
    <button class="tab-btn actief" onclick="toonTab('tab-match')">🏆 Jouw match</button>
    <button class="tab-btn" onclick="toonTab('tab-overzicht')">📋 Alle moties</button>
    <button class="tab-btn" onclick="toonTab('tab-partijen')">🔗 Partijvergelijking</button>
  </div>

  <!-- TAB MATCH -->
  <div id="tab-match">
    <h2>Jouw stemresultaat</h2>
    <p class="subtitel" id="resultaat-subtitel"></p>
    <div id="partij-resultaten"></div>
    <br>
    <button class="btn-start" onclick="toonTab('tab-overzicht')">📋 Bekijk alle moties &amp; stemgedrag</button>
    &nbsp;
    <button class="btn-terug" onclick="herstart()">↩ Opnieuw beginnen</button>
  </div>

  <!-- TAB PARTIJVERGELIJKING -->
  <div id="tab-partijen" style="display:none">
    <h2>Partijvergelijking</h2>
    <p class="subtitel">Hoe vaak stemden fracties hetzelfde? Gebaseerd op 185 moties met stemdata.</p>

    <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:28px">
      <!-- Heatmap -->
      <div style="flex:1;min-width:320px">
        <h3 style="font-size:1rem;margin-bottom:12px;color:var(--muted)">Overeenkomst (%) per partijpaar</h3>
        <div style="overflow-x:auto">
          <canvas id="heatmap-canvas" style="display:block;max-width:100%"></canvas>
        </div>
        <p style="font-size:0.75rem;color:var(--muted);margin-top:6px">Hover over een cel voor details. Groen = vaak eens, rood = vaak oneens.</p>
      </div>
    </div>

    <!-- Netwerk -->
    <h3 style="font-size:1rem;margin-bottom:8px;color:var(--muted)">Stemcoalitie-netwerk</h3>
    <p style="font-size:0.75rem;color:var(--muted);margin-bottom:12px">Lijnen tonen hoe sterk partijen samenstemmen. Dik groen = vaak eens, dun rood = vaak oneens.</p>
    <canvas id="netwerk-canvas" style="display:block;width:100%;border:1px solid var(--border);border-radius:var(--radius);background:white"></canvas>

    <!-- Top paren -->
    <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:28px">
      <div style="flex:1;min-width:260px">
        <h3 style="font-size:0.95rem;margin-bottom:12px;color:var(--voor)">🤝 Meest gelijkgestemd</h3>
        <div id="top-eens"></div>
      </div>
      <div style="flex:1;min-width:260px">
        <h3 style="font-size:0.95rem;margin-bottom:12px;color:var(--tegen)">⚔️ Meest tegengesteld</h3>
        <div id="top-oneens"></div>
      </div>
    </div>
  </div>

  <!-- TAB OVERZICHT -->
  <div id="tab-overzicht" style="display:none">
    <h2>Alle moties 2025–2026</h2>
    <p class="subtitel">Klik op een motie voor de PDF. Jouw keuze is gemarkeerd.</p>
    <div class="filter-sectie">
      <div class="filter-label">Status</div>
      <div class="filters" id="filters-status">
        <button class="filter-btn actief" onclick="filterStatus('alle', this)">Alle</button>
        <button class="filter-btn" onclick="filterStatus('AANGENOMEN', this)">✅ Aangenomen</button>
        <button class="filter-btn" onclick="filterStatus('VERWORPEN', this)">❌ Verworpen</button>
        <button class="filter-btn" onclick="filterStatus('INGETROKKEN', this)">↩ Ingetrokken</button>
      </div>
      <div class="filter-label" style="margin-top:10px">Categorie</div>
      <div class="filters" id="filters-categorie">
        <button class="filter-btn actief" onclick="filterCategorie('alle', this)">Alle</button>
      </div>
    </div>
    <div class="zoek-wrap">
      <span class="zoek-icoon">🔍</span>
      <input class="zoek-input" type="search" placeholder="Zoek op titel, partij, onderwerp..." oninput="zoekMoties(this.value)" id="zoek-input">
    </div>
    <div class="tabel-wrap" id="tabel-wrap"></div>
  </div>
</div>

<script>
const MOTIES = {moties_json};
const PARTIJEN = {partijen_json};
const KLEUREN = {kleuren_json};
const CORRELATIE = {correlatie_json};

let huidigeIndex = 0;
let antwoorden = {{}};  // motie_id -> 'eens'|'neutraal'|'oneens'|'overslaan'
let meerOpen = false;
let actieveFilter = 'alle';
let actieveCategorie = 'alle';
let zoekTerm = '';

const CAT_ICOON = {{
  'Duurzaamheid & Energie': '⚡',
  'Wonen & Ruimte': '🏠',
  'Veiligheid & Handhaving': '🚔',
  'Onderwijs & Jeugd': '🎓',
  'Zorg & Welzijn': '❤️',
  'Verkeer & Mobiliteit': '🚲',
  'Economie & Werk': '💼',
  'Cultuur & Sport': '🎭',
  'Natuur & Openbare Ruimte': '🌳',
  'Bestuur & Financiën': '🏛️',
  'Internationaal & Diversiteit': '🌍',
  'Overig': '📌',
}};

function startStemwijzer() {{
  toonView('view-vraag');
  document.getElementById('progress-bar-wrap').style.display = 'block';
  document.getElementById('progress-label').style.display = 'block';
  huidigeIndex = 0;
  antwoorden = {{}};
  toonVraag();
}}

function toonVraag() {{
  const m = MOTIES[huidigeIndex];
  const n = huidigeIndex + 1;
  const tot = MOTIES.length;

  const catIcoon = CAT_ICOON[m.categorie] || '📌';
  document.getElementById('vraag-meta').innerHTML =
    `${{m.jaar}} · ${{m.nr}} · ${{m.status || ''}}
     &nbsp;<span class="meta-cat">${{catIcoon}} ${{m.categorie || ''}}</span>`;
  document.getElementById('vraag-titel').textContent = m.titel;

  // Uitleg: primaire tekst (AI-gegenereerd), samenvatting als "lees meer"
  const uitleg = m.uitleg || m.samenvatting || '';
  document.getElementById('samen-kort').textContent = uitleg;

  // Originele motietitel als "lees meer"
  const meerEl = document.getElementById('samen-meer');
  const origTitel = m.titel_origineel ? `Originele motietitel: ${{m.titel_origineel}}` : '';
  meerEl.textContent = origTitel;
  meerEl.style.display = 'none';
  document.getElementById('toggle-meer-btn').textContent = '▼ Zie originele titel';
  document.getElementById('toggle-meer-btn').style.display = origTitel ? 'block' : 'none';
  meerOpen = false;

  // PDF-knop
  const pdfKnop = document.getElementById('btn-pdf-motie');
  if (m.pdf_url) {{
    pdfKnop.href = m.pdf_url;
    pdfKnop.style.display = 'inline-flex';
  }} else {{
    pdfKnop.style.display = 'none';
  }}

  // Indieners toggle (verborgen by default)
  const ind = document.getElementById('vraag-indieners');
  const indBtn = document.getElementById('btn-indieners-toggle');
  ind.classList.remove('open');
  if (m.indieners && m.indieners.length) {{
    ind.innerHTML = m.indieners.map(p => `<span>${{p}}</span>`).join('');
    indBtn.style.display = 'inline-flex';
    indBtn.textContent = '👥 ' + m.indieners.length + ' indiener' + (m.indieners.length > 1 ? 's' : '');
  }} else {{
    ind.innerHTML = '';
    indBtn.style.display = 'none';
  }}

  // Analyse sectie resetten
  analyseOpen = false;
  const analyseWrap = document.getElementById('analyse-wrap');
  const analyseBtn = document.getElementById('toggle-analyse-btn');
  const heeftAnalyse = (m.voordelen && m.voordelen.length) || (m.nadelen && m.nadelen.length);
  const heeftBronnen = m.bronnen && m.bronnen.length;
  const tabBronnen = document.getElementById('tab-bronnen-btn');
  if (tabBronnen) tabBronnen.style.display = heeftBronnen ? 'block' : 'none';

  if (heeftAnalyse || heeftBronnen) {{
    analyseWrap.style.display = 'none';
    analyseBtn.style.display = 'inline-flex';
    analyseBtn.textContent = '🔍 Toon analyse';
    toonAnalyseInhoud('voordelen', m);
    document.querySelectorAll('.analyse-tab').forEach((t, i) => t.classList.toggle('actief', i === 0));
  }} else {{
    analyseWrap.style.display = 'none';
    analyseBtn.style.display = 'none';
  }}

  // Herstel knoppen
  document.querySelectorAll('.stem-btn').forEach(b => b.classList.remove('gekozen'));
  const eerdere = antwoorden[m.id];
  if (eerdere) {{
    document.querySelector(`.stem-btn.${{eerdere}}`)?.classList.add('gekozen');
  }}

  // Labels
  document.getElementById('vraag-nr-label').textContent = `${{n}} / ${{tot}}`;
  document.getElementById('progress-bar').style.width = `${{(n-1)/tot*100}}%`;
  document.getElementById('progress-label').textContent = `Vraag ${{n}} van ${{tot}}`;
}}

function toggleMeer() {{
  meerOpen = !meerOpen;
  document.getElementById('samen-meer').style.display = meerOpen ? 'block' : 'none';
  document.getElementById('toggle-meer-btn').textContent = meerOpen ? '▲ Minder' : '▼ Lees meer';
}}

function stemmen(keuze) {{
  const m = MOTIES[huidigeIndex];
  antwoorden[m.id] = keuze;

  document.querySelectorAll('.stem-btn').forEach(b => b.classList.remove('gekozen'));
  document.querySelector(`.stem-btn.${{keuze}}`)?.classList.add('gekozen');

  setTimeout(() => {{
    if (huidigeIndex < MOTIES.length - 1) {{
      huidigeIndex++;
      toonVraag();
    }} else {{
      toonResultaten();
    }}
  }}, 250);
}}

function vorigeVraag() {{
  if (huidigeIndex > 0) {{
    huidigeIndex--;
    toonVraag();
  }}
}}

function toonResultaten() {{
  toonView('view-resultaat');
  document.getElementById('progress-bar-wrap').style.display = 'none';
  document.getElementById('progress-label').style.display = 'none';

  const beantwoord = Object.keys(antwoorden).filter(id => antwoorden[id] !== 'overslaan');
  document.getElementById('resultaat-subtitel').textContent =
    `Je beantwoordde ${{beantwoord.length}} van de ${{MOTIES.length}} stellingen.`;

  // Match berekening per partij
  const scores = {{}};
  PARTIJEN.forEach(p => scores[p] = {{ match: 0, totaal: 0, voor: 0, tegen: 0, mismatch: 0 }});

  MOTIES.forEach(m => {{
    const keuze = antwoorden[m.id];
    if (!keuze || keuze === 'overslaan' || keuze === 'neutraal') return;

    Object.entries(m.stem_richting || {{}}).forEach(([partij, richting]) => {{
      if (!scores[partij]) return;
      scores[partij].totaal++;

      const match =
        (keuze === 'eens' && richting === 'voor') ||
        (keuze === 'oneens' && richting === 'tegen');
      const mismatch =
        (keuze === 'eens' && richting === 'tegen') ||
        (keuze === 'oneens' && richting === 'voor');

      if (match) {{ scores[partij].match++; scores[partij].voor++; }}
      else if (mismatch) {{ scores[partij].mismatch++; scores[partij].tegen++; }}
    }});
  }});

  // Sorteer op match %
  const gesorteerd = PARTIJEN
    .filter(p => scores[p].totaal > 0)
    .map(p => ({{
      naam: p,
      pct: Math.round(scores[p].match / scores[p].totaal * 100),
      ...scores[p]
    }}))
    .sort((a, b) => b.pct - a.pct);

  const container = document.getElementById('partij-resultaten');
  container.innerHTML = '';

  gesorteerd.forEach((s, i) => {{
    const kleur = KLEUREN[s.naam] || '#6b7280';
    const isTop = i === 0;
    const div = document.createElement('div');
    div.className = 'partij-kaart' + (isTop ? ' top-1' : '');
    div.innerHTML = `
      <div class="partij-header">
        <div class="partij-kleur" style="background:${{kleur}}"></div>
        <div class="partij-naam">${{isTop ? '🥇 ' : ''}}<strong>${{s.naam}}</strong></div>
        <div class="match-pct" style="color:${{kleur}}">${{s.pct}}%</div>
      </div>
      <div class="match-bar-wrap">
        <div class="match-bar" style="background:${{kleur}};width:${{s.pct}}%"></div>
      </div>
      <div class="partij-detail">
        ${{s.match}} overeenkomsten · ${{s.mismatch}} verschillen · ${{s.totaal}} vergeleken stemmen
      </div>
    `;
    container.appendChild(div);
  }});

  // Bouw overzichtstabel
  bouwTabel();
}}

function bouwTabel() {{
  initialiseerCategorieFilters();
  renderTabel();
}}

function toggleIndieners() {{
  const ind = document.getElementById('vraag-indieners');
  const btn = document.getElementById('btn-indieners-toggle');
  const open = ind.classList.toggle('open');
  const m = MOTIES[huidigeIndex];
  btn.textContent = open
    ? '👥 Verberg'
    : '👥 ' + (m.indieners || []).length + ' indiener' + ((m.indieners || []).length > 1 ? 's' : '');
}}

// ── ANALYSE VOOR/NADELEN ────────────────────────────────────────────────────

let analyseOpen = false;
let actieveAnalyseTab = 'voordelen';

function toggleAnalyse() {{
  analyseOpen = !analyseOpen;
  const wrap = document.getElementById('analyse-wrap');
  const btn = document.getElementById('toggle-analyse-btn');
  wrap.style.display = analyseOpen ? 'block' : 'none';
  btn.textContent = analyseOpen ? '🔼 Verberg analyse' : '🔍 Toon feitelijke analyse';
}}

function toonAnalyseTab(tab, btnEl) {{
  actieveAnalyseTab = tab;
  document.querySelectorAll('.analyse-tab').forEach(b => b.classList.remove('actief'));
  btnEl.classList.add('actief');
  const m = MOTIES[huidigeIndex];
  toonAnalyseInhoud(tab, m);
}}

function toonAnalyseInhoud(tab, m) {{
  const el = document.getElementById('analyse-inhoud');
  if (!el) return;

  if (tab === 'voordelen') {{
    const items = (m.voordelen || []);
    if (!items.length) {{ el.innerHTML = '<p style="color:var(--muted)">Geen voordelen beschikbaar.</p>'; return; }}
    el.innerHTML = `<ul class="analyse-lijst">${{
      items.map(v => `<li><span class="analyse-icoon" style="color:#22c55e">+</span><span>${{v}}</span></li>`).join('')
    }}</ul>`;
  }} else if (tab === 'nadelen') {{
    const items = (m.nadelen || []);
    if (!items.length) {{ el.innerHTML = '<p style="color:var(--muted)">Geen nadelen beschikbaar.</p>'; return; }}
    el.innerHTML = `<ul class="analyse-lijst">${{
      items.map(v => `<li><span class="analyse-icoon" style="color:#ef4444">−</span><span>${{v}}</span></li>`).join('')
    }}</ul>`;
  }} else if (tab === 'context') {{
    const ctx = m.context || 'Geen context beschikbaar.';
    el.innerHTML = `<p class="analyse-context">${{ctx}}</p>`;
  }} else if (tab === 'bronnen') {{
    const bronnen = m.bronnen || [];
    if (!bronnen.length) {{
      el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">Geen bronnen beschikbaar.</p>';
      return;
    }}
    el.innerHTML = `<ul class="analyse-lijst">${{
      bronnen.map(b => {{
        const link = b.url
          ? `<a href="${{b.url}}" target="_blank" rel="noopener" style="color:#60a5fa;font-weight:700;text-decoration:none;display:block;margin-bottom:2px">${{b.naam}} ↗</a>`
          : `<span style="font-weight:700;display:block;margin-bottom:2px">${{b.naam}}</span>`;
        return `<li style="flex-direction:column;align-items:flex-start;gap:3px">
          ${{link}}
          <span style="font-size:0.78rem;color:var(--muted)">${{b.beschrijving || ''}}</span>
        </li>`;
      }}).join('')
    }}</ul>
    <p style="font-size:0.72rem;color:#475569;margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
      De PDF-link en vergadering-pagina zijn altijd geverifieerd. Externe links zijn suggesties — controleer altijd of de URL nog actueel is.
    </p>`;
  }}
}}

function toonTab(tabId) {{
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('actief'));
  event.target.classList.add('actief');
  document.getElementById('tab-match').style.display = tabId === 'tab-match' ? 'block' : 'none';
  document.getElementById('tab-overzicht').style.display = tabId === 'tab-overzicht' ? 'block' : 'none';
  document.getElementById('tab-partijen').style.display = tabId === 'tab-partijen' ? 'block' : 'none';
  if (tabId === 'tab-overzicht') bouwTabel();
  if (tabId === 'tab-partijen') tekenPartijvergelijking();
}}

// ── PARTIJVERGELIJKING ──────────────────────────────────────────────────────

let partijvergelijkingGetekend = false;

function tekenPartijvergelijking() {{
  if (partijvergelijkingGetekend) return;
  partijvergelijkingGetekend = true;
  tekenHeatmap();
  tekenNetwerk();
  toonTopParen();
}}

function pctNaarKleur(pct) {{
  // 0% = rood, 50% = geel, 100% = groen
  const r = pct < 50 ? 220 : Math.round(220 - (pct - 50) / 50 * 180);
  const g = pct < 50 ? Math.round(pct / 50 * 200) : 200;
  const b = 40;
  return `rgb(${{r}},${{g}},${{b}})`;
}}

function tekenHeatmap() {{
  const canvas = document.getElementById('heatmap-canvas');
  const ps = CORRELATIE.partijen;
  const matrix = CORRELATIE.matrix;
  const counts = CORRELATIE.counts;
  const n = ps.length;

  // Korte namen
  const kort = ps.map(p => p
    .replace('Partij voor de Dieren', 'PvdD')
    .replace('Partij voor het Noorden', 'PvhN')
    .replace('Stadspartij 100% voor Groningen', 'Stadspartij')
    .replace('Student en Stad', 'S&S')
    .replace('ChristenUnie', 'CU')
    .replace('GroenLinks', 'GL')
    .replace('Groep Staijen', 'Staijen')
  );

  const CELL = 46;
  const LABEL_W = 72;
  const LABEL_H = 72;
  const W = LABEL_W + n * CELL;
  const H = LABEL_H + n * CELL;

  canvas.width = W;
  canvas.height = H;
  canvas.style.width = Math.min(W, 700) + 'px';
  canvas.style.height = Math.round(H * Math.min(W, 700) / W) + 'px';

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Labels boven (schuin)
  ctx.save();
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  ctx.fillStyle = '#374151';
  for (let j = 0; j < n; j++) {{
    ctx.save();
    ctx.translate(LABEL_W + j * CELL + CELL / 2, LABEL_H - 6);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = 'left';
    ctx.fillText(kort[j], 0, 0);
    ctx.restore();
  }}
  ctx.restore();

  // Labels links
  ctx.font = '11px Segoe UI, sans-serif';
  ctx.fillStyle = '#374151';
  ctx.textAlign = 'right';
  for (let i = 0; i < n; i++) {{
    ctx.fillText(kort[i], LABEL_W - 4, LABEL_H + i * CELL + CELL / 2 + 4);
  }}

  // Cellen
  for (let i = 0; i < n; i++) {{
    for (let j = 0; j < n; j++) {{
      const pct = matrix[i][j];
      const x = LABEL_W + j * CELL;
      const y = LABEL_H + i * CELL;
      ctx.fillStyle = i === j ? '#e8eef7' : pctNaarKleur(pct);
      ctx.fillRect(x, y, CELL - 1, CELL - 1);

      // Percentage tekst
      ctx.font = `${{CELL < 36 ? '9' : '11'}}px Segoe UI, sans-serif`;
      ctx.fillStyle = pct > 75 || pct < 40 ? 'white' : '#1a202c';
      ctx.textAlign = 'center';
      ctx.fillText(i === j ? '—' : pct + '%', x + CELL / 2, y + CELL / 2 + 4);
    }}
  }}

  // Tooltip via mousemove
  canvas.onmousemove = (e) => {{
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const ci = Math.floor((my - LABEL_H) / CELL);
    const cj = Math.floor((mx - LABEL_W) / CELL);
    if (ci >= 0 && ci < n && cj >= 0 && cj < n && ci !== cj) {{
      canvas.title = `${{ps[ci]}} & ${{ps[cj]}}: ${{matrix[ci][cj]}}% eens (${{counts[ci][cj]}} moties)`;
    }} else {{
      canvas.title = '';
    }}
  }};
}}

function tekenNetwerk() {{
  const canvas = document.getElementById('netwerk-canvas');
  const ps = CORRELATIE.partijen;
  const matrix = CORRELATIE.matrix;
  const n = ps.length;

  const W = canvas.offsetWidth || 700;
  const H = Math.round(W * 0.65);
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Positie partijen op cirkel
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.36;
  const pos = ps.map((_, i) => {{
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    return {{ x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) }};
  }});

  // Teken lijnen (alleen overeenkomsten > 55% of < 45%)
  for (let i = 0; i < n; i++) {{
    for (let j = i + 1; j < n; j++) {{
      const pct = matrix[i][j];
      if (pct >= 55) {{
        const strength = (pct - 55) / 45;  // 0..1
        ctx.beginPath();
        ctx.moveTo(pos[i].x, pos[i].y);
        ctx.lineTo(pos[j].x, pos[j].y);
        ctx.strokeStyle = `rgba(22,163,74,${{0.15 + strength * 0.75}})`;
        ctx.lineWidth = 1 + strength * 5;
        ctx.stroke();
      }} else if (pct <= 44) {{
        const strength = (44 - pct) / 44;
        ctx.beginPath();
        ctx.moveTo(pos[i].x, pos[i].y);
        ctx.lineTo(pos[j].x, pos[j].y);
        ctx.strokeStyle = `rgba(220,38,38,${{0.1 + strength * 0.5}})`;
        ctx.lineWidth = 0.5 + strength * 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }}
    }}
  }}

  // Teken partij-knooppunten
  const kort = ps.map(p => p
    .replace('Partij voor de Dieren', 'PvdD')
    .replace('Partij voor het Noorden', 'PvhN')
    .replace('Stadspartij 100% voor Groningen', 'Stadspartij')
    .replace('Student en Stad', 'S&S')
    .replace('ChristenUnie', 'CU')
    .replace('GroenLinks', 'GL')
    .replace('Groep Staijen', 'Staijen')
  );

  ps.forEach((p, i) => {{
    const {{ x, y }} = pos[i];
    const kleur = KLEUREN[p] || '#6b7280';
    const r = 22;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = kleur;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 10px Segoe UI, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = kort[i];
    ctx.fillText(label, x, y);
  }});

  canvas.title = 'Groene lijnen = vaak samen, rode stippellijnen = vaak tegenover elkaar';
}}

function toonTopParen() {{
  const eensEl = document.getElementById('top-eens');
  const oneensEl = document.getElementById('top-oneens');

  function renderParen(paren, container, isEens) {{
    container.innerHTML = paren.map((p, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:1.1rem;width:24px;text-align:center;color:var(--muted)">${{i+1}}</div>
        <div style="flex:1">
          <div style="font-size:0.85rem;font-weight:600">${{p.p1}} &amp; ${{p.p2}}</div>
          <div style="font-size:0.75rem;color:var(--muted)">${{p.n}} moties vergeleken</div>
        </div>
        <div style="font-size:1.1rem;font-weight:800;color:${{isEens ? 'var(--voor)' : 'var(--tegen)'}}">${{p.pct}}%</div>
      </div>
    `).join('');
  }}

  renderParen(CORRELATIE.top_eens, eensEl, true);
  renderParen(CORRELATIE.top_oneens, oneensEl, false);
}}

function filterStatus(status, btn) {{
  actieveFilter = status;
  document.querySelectorAll('#filters-status .filter-btn').forEach(b => b.classList.remove('actief'));
  btn.classList.add('actief');
  renderTabel();
}}

function filterCategorie(cat, btn) {{
  actieveCategorie = cat;
  document.querySelectorAll('#filters-categorie .filter-btn').forEach(b => b.classList.remove('actief'));
  btn.classList.add('actief');
  renderTabel();
}}

let categorieFiltersGemaakt = false;
function initialiseerCategorieFilters() {{
  if (categorieFiltersGemaakt) return;
  categorieFiltersGemaakt = true;
  const container = document.getElementById('filters-categorie');
  if (!container) return;
  const cats = [...new Set(MOTIES.map(m => m.categorie).filter(Boolean))].sort();
  cats.forEach(cat => {{
    const btn = document.createElement('button');
    btn.className = 'filter-btn cat-btn';
    btn.setAttribute('data-cat', cat);
    btn.innerHTML = `${{CAT_ICOON[cat] || '📌'}} ${{cat}}`;
    btn.onclick = () => filterCategorie(cat, btn);
    container.appendChild(btn);
  }});
}}

function zoekMoties(term) {{
  zoekTerm = term.toLowerCase();
  renderTabel();
}}

function renderTabel() {{
  const gefilterd = MOTIES.filter(m => {{
    const statusOk = actieveFilter === 'alle' || m.status === actieveFilter;
    const catOk = actieveCategorie === 'alle' || m.categorie === actieveCategorie;
    const zoekOk = !zoekTerm ||
      m.titel.toLowerCase().includes(zoekTerm) ||
      (m.uitleg || m.samenvatting || '').toLowerCase().includes(zoekTerm) ||
      (m.indieners || []).some(p => p.toLowerCase().includes(zoekTerm)) ||
      (m.categorie || '').toLowerCase().includes(zoekTerm) ||
      Object.keys(m.stem_richting || {{}}).some(p => p.toLowerCase().includes(zoekTerm));
    return statusOk && catOk && zoekOk;
  }});

  const statusBadge = {{
    'AANGENOMEN': 'badge-aangenomen',
    'VERWORPEN': 'badge-verworpen',
    'INGETROKKEN': 'badge-ingetrokken',
  }};

  const wrap = document.getElementById('tabel-wrap');
  if (!gefilterd.length) {{
    wrap.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px">Geen moties gevonden.</p>';
    return;
  }}

  // Unieke partijen voor header
  const allePartijen = [...new Set(gefilterd.flatMap(m => Object.keys(m.stem_richting || {{}})))].sort();

  let html = `<table>
    <thead><tr>
      <th>#</th>
      <th>Titel</th>
      <th>Status</th>
      <th>Categorie</th>
      <th>Indieners</th>
      <th>Stemmen (voor / tegen)</th>
      <th>Jouw keuze</th>
      <th>PDF</th>
    </tr></thead><tbody>`;

  gefilterd.forEach(m => {{
    const badge = statusBadge[m.status] || 'badge-onbekend';
    const keuze = antwoorden[m.id] || '';
    const keuzeIcoon = {{eens:'✅', oneens:'❌', neutraal:'➖', overslaan:'⏭', '': ''}}[keuze] || '';

    const voor = Object.entries(m.stem_richting || {{}})
      .filter(([,r]) => r === 'voor').map(([p]) => `<span class="partij-chip chip-voor">${{p}}</span>`).join('');
    const tegen = Object.entries(m.stem_richting || {{}})
      .filter(([,r]) => r === 'tegen').map(([p]) => `<span class="partij-chip chip-tegen">${{p}}</span>`).join('');

    const indieners = (m.indieners || []).join(', ');
    const pdfLink = m.pdf_url ? `<a href="${{m.pdf_url}}" target="_blank" class="link-pdf">📄 PDF</a>` : '';

    const catIcoon = CAT_ICOON[m.categorie] || '📌';
    html += `<tr>
      <td style="white-space:nowrap;color:var(--muted);font-size:0.75rem">${{m.nr}}</td>
      <td>
        <div style="font-weight:700;font-size:0.88rem;margin-bottom:3px">${{m.titel}}</div>
        <div style="color:var(--muted);font-size:0.78rem">${{(m.uitleg || '').slice(0,110)}}...</div>
      </td>
      <td><span class="badge ${{badge}}">${{m.status || '?'}}</span></td>
      <td><span class="cat-label">${{catIcoon}} ${{m.categorie || ''}}</span></td>
      <td style="font-size:0.78rem;color:var(--muted)">${{indieners}}</td>
      <td style="font-size:0.75rem">${{voor}}${{voor && tegen ? '<br>' : ''}}${{tegen}}</td>
      <td style="text-align:center;font-size:1.1rem">${{keuzeIcoon}}</td>
      <td>${{pdfLink}}</td>
    </tr>`;
  }});

  html += '</tbody></table>';
  html += `</table><div class="tabel-footer">${{gefilterd.length}} moties weergegeven</div>`;
  wrap.innerHTML = html;
}}

function toonView(id) {{
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}}

function herstart() {{
  antwoorden = {{}};
  huidigeIndex = 0;
  toonView('view-welkom');
  document.getElementById('progress-bar-wrap').style.display = 'none';
  document.getElementById('progress-label').style.display = 'none';
}}

// Direct overzicht
document.getElementById('btn-direct-overzicht').onclick = () => {{
  antwoorden = {{}};
  toonView('view-resultaat');
  document.getElementById('tab-match').style.display = 'none';
  document.getElementById('tab-overzicht').style.display = 'block';
  document.getElementById('tab-partijen').style.display = 'none';
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('actief', i===1));
  bouwTabel();
  setTimeout(() => document.getElementById('zoek-input').focus(), 100);
}};
</script>
</body>
</html>"""

    return html


def main():
    print("Laden van motie-data...")
    with open(DATA_PAD, encoding="utf-8") as f:
        alle_data = json.load(f)
    moties = laad_data()
    print(f"{len(moties)} moties geladen voor stemwijzer")

    partijen = sorted(
        set(p for m in moties for p in m["stem_richting"]),
        key=lambda p: p.lower()
    )
    print("Correlatiematrix berekenen...")
    correlatie = bereken_correlatie(alle_data, partijen)

    print("HTML genereren...")
    html = genereer_html(moties, correlatie)

    with open(OUTPUT_PAD, "w", encoding="utf-8") as f:
        f.write(html)

    grootte = os.path.getsize(OUTPUT_PAD) / 1024
    print(f"Stemwijzer opgeslagen: {OUTPUT_PAD} ({grootte:.0f} KB)")
    print("Open het bestand in een browser!")


if __name__ == "__main__":
    main()
