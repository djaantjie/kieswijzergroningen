"use client";

import { useState } from "react";
import { Motie, Stem } from "../../lib/types";
import { CAT_ICOON } from "../../lib/data";
import AnalysePanel from "./AnalysePanel";

const MAANDEN = [
  "", "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

interface Props {
  motie: Motie;
  index: number;
  totaal: number;
  huidigeStem: Stem | null;
  onStem: (stem: Stem) => void;
  onVolgende: () => void;
  onVorige: () => void;
  onSlaOver: () => void;
  kanVorige: boolean;
  kanVolgende: boolean;
}

export default function VraagKaart({
  motie,
  index,
  totaal,
  huidigeStem,
  onStem,
  onVolgende,
  onVorige,
  onSlaOver,
  kanVorige,
  kanVolgende,
}: Props) {
  const [toonIndieners, setToonIndieners] = useState(false);
  const [toonAnalyse, setToonAnalyse] = useState(false);

  const statusKleur =
    motie.status === "AANGENOMEN"
      ? "#22c55e"
      : motie.status === "VERWORPEN"
      ? "#ef4444"
      : "#f59e0b";

  const progress = ((index) / totaal) * 100;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Progress bar */}
      <div style={{ background: "#1e293b", padding: "0.75rem 1rem" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              color: "#64748b",
              marginBottom: "0.4rem",
            }}
          >
            <span>Vraag {index + 1} van {totaal}</span>
            <span>{Math.round(progress)}% voltooid</span>
          </div>
          <div
            style={{
              height: "6px",
              background: "#334155",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(90deg, #2563eb, #7c3aed)",
                borderRadius: "999px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* Card content */}
      <div
        style={{
          flex: 1,
          maxWidth: "700px",
          margin: "0 auto",
          width: "100%",
          padding: "1.5rem 1rem",
        }}
      >
        {/* Meta line */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <span
            style={{
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid #334155",
              borderRadius: "999px",
              padding: "0.25rem 0.75rem",
              fontSize: "0.8rem",
              color: "#94a3b8",
            }}
          >
            {CAT_ICOON[motie.categorie] || "📌"} {motie.categorie}
          </span>
          <span
            style={{
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid #334155",
              borderRadius: "999px",
              padding: "0.25rem 0.75rem",
              fontSize: "0.8rem",
              color: "#94a3b8",
            }}
          >
            {MAANDEN[motie.maand]} {motie.jaar}
          </span>
          <span
            style={{
              background: `${statusKleur}22`,
              border: `1px solid ${statusKleur}66`,
              borderRadius: "999px",
              padding: "0.25rem 0.75rem",
              fontSize: "0.75rem",
              color: statusKleur,
              fontWeight: 700,
            }}
          >
            {motie.status}
          </span>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "clamp(1.1rem, 3vw, 1.5rem)",
            fontWeight: 700,
            color: "#e2e8f0",
            marginBottom: "1rem",
            lineHeight: 1.35,
          }}
        >
          {motie.titel_leesbaar || motie.titel}
        </h2>

        {/* Uitleg */}
        <div
          style={{
            background: "rgba(37, 99, 235, 0.08)",
            border: "1px solid rgba(37, 99, 235, 0.25)",
            borderRadius: "10px",
            padding: "1rem",
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#cbd5e1", lineHeight: 1.7 }}>
            {motie.uitleg}
          </p>
        </div>

        {/* Action buttons row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <a
            href={motie.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "0.4rem 0.85rem",
              fontSize: "0.8rem",
              color: "#94a3b8",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            📄 Bekijk motie
          </a>
          <button
            onClick={() => setToonIndieners(!toonIndieners)}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "0.4rem 0.85rem",
              fontSize: "0.8rem",
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            👥 {motie.indieners.length} indiener
            {motie.indieners.length !== 1 ? "s" : ""}{" "}
            {toonIndieners ? "▲" : "▼"}
          </button>
          <button
            onClick={() => setToonAnalyse(!toonAnalyse)}
            style={{
              background: toonAnalyse
                ? "rgba(37, 99, 235, 0.15)"
                : "#1e293b",
              border: `1px solid ${toonAnalyse ? "#2563eb" : "#334155"}`,
              borderRadius: "8px",
              padding: "0.4rem 0.85rem",
              fontSize: "0.8rem",
              color: toonAnalyse ? "#93c5fd" : "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            🔍 {toonAnalyse ? "Verberg" : "Toon"} analyse
          </button>
        </div>

        {/* Indieners */}
        {toonIndieners && (
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "10px",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem",
            }}
          >
            {motie.indieners.map((ind, i) => (
              <span
                key={i}
                style={{
                  background: "#263348",
                  border: "1px solid #334155",
                  borderRadius: "6px",
                  padding: "0.2rem 0.6rem",
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                }}
              >
                {ind}
              </span>
            ))}
          </div>
        )}

        {/* Analyse panel */}
        {toonAnalyse && <AnalysePanel motie={motie} />}

        {/* Vote buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0.75rem",
            marginTop: "1.5rem",
          }}
        >
          {(
            [
              { stem: "eens" as Stem, label: "Eens", icon: "👍", color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
              { stem: "neutraal" as Stem, label: "Neutraal", icon: "🤷", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
              { stem: "oneens" as Stem, label: "Oneens", icon: "👎", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
            ] as const
          ).map(({ stem, label, icon, color, bg }) => (
            <button
              key={stem}
              onClick={() => onStem(stem)}
              style={{
                background: huidigeStem === stem ? bg : "#1e293b",
                border: `2px solid ${huidigeStem === stem ? color : "#334155"}`,
                borderRadius: "12px",
                padding: "1rem 0.5rem",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.35rem",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>{icon}</span>
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: huidigeStem === stem ? color : "#94a3b8",
                }}
              >
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1.25rem",
            gap: "0.5rem",
          }}
        >
          <button
            onClick={onVorige}
            disabled={!kanVorige}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
              color: kanVorige ? "#94a3b8" : "#334155",
              cursor: kanVorige ? "pointer" : "default",
            }}
          >
            ← Vorige
          </button>

          <span style={{ fontSize: "0.8rem", color: "#475569" }}>
            {index + 1} / {totaal}
          </span>

          {kanVolgende ? (
            <button
              onClick={onVolgende}
              style={{
                background: huidigeStem
                  ? "linear-gradient(135deg, #2563eb, #7c3aed)"
                  : "#1e293b",
                border: `1px solid ${huidigeStem ? "transparent" : "#334155"}`,
                borderRadius: "8px",
                padding: "0.5rem 1rem",
                fontSize: "0.85rem",
                color: huidigeStem ? "white" : "#94a3b8",
                cursor: "pointer",
                fontWeight: huidigeStem ? 700 : 400,
              }}
            >
              Volgende →
            </button>
          ) : (
            <button
              onClick={onVolgende}
              style={{
                background: huidigeStem
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "#1e293b",
                border: `1px solid ${huidigeStem ? "transparent" : "#334155"}`,
                borderRadius: "8px",
                padding: "0.5rem 1rem",
                fontSize: "0.85rem",
                color: huidigeStem ? "white" : "#94a3b8",
                cursor: "pointer",
                fontWeight: huidigeStem ? 700 : 400,
              }}
            >
              Resultaten →
            </button>
          )}
        </div>

        {/* Sla over */}
        <div style={{ textAlign: "center", marginTop: "0.75rem" }}>
          <button
            onClick={onSlaOver}
            style={{
              background: "none",
              border: "none",
              color: "#475569",
              fontSize: "0.8rem",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Sla over →
          </button>
        </div>
      </div>
    </div>
  );
}
