"use client";

import { useState } from "react";
import { Motie, SelectieModus, SelectieOpties } from "../../lib/types";
import { CAT_ICOON, getCategorieen } from "../../lib/data";

interface Props {
  moties: Motie[];
  onSelectie: (opties: SelectieOpties) => void;
  onTerug: () => void;
}

export default function MotieSelectie({ moties, onSelectie, onTerug }: Props) {
  const [modus, setModus] = useState<SelectieModus>("controversieel");
  const [aantalWillekeurig, setAantalWillekeurig] = useState(20);
  const [geselecteerdeCategorieen, setGeselecteerdeCategorieen] = useState<string[]>([]);

  const categorieen = getCategorieen(moties);

  const geldigMoties = moties.filter(
    (m) =>
      m.status !== "ONBEKEND" &&
      (m.stemmingen.voor.length > 0 || m.stemmingen.tegen.length > 0) &&
      m.uitleg &&
      m.uitleg.length > 10
  );

  const toggleCategorie = (cat: string) => {
    setGeselecteerdeCategorieen((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const getAantalVoorModus = (): number => {
    switch (modus) {
      case "alle":
        return geldigMoties.length;
      case "controversieel":
        return Math.min(30, geldigMoties.length);
      case "categorie":
        if (geselecteerdeCategorieen.length === 0) return geldigMoties.length;
        return geldigMoties.filter((m) =>
          geselecteerdeCategorieen.includes(m.categorie)
        ).length;
      case "willekeurig":
        return aantalWillekeurig;
      default:
        return 0;
    }
  };

  const handleStart = () => {
    onSelectie({
      modus,
      aantalWillekeurig,
      geselecteerdeCategorieen,
    });
  };

  const opties: { id: SelectieModus; label: string; desc: string; icon: string }[] = [
    {
      id: "alle",
      label: "Alle moties",
      desc: `${geldigMoties.length} moties met bekende uitslag`,
      icon: "📋",
    },
    {
      id: "controversieel",
      label: "Top 30 meest controversieel",
      desc: "Moties waarbij de stemmen het meest verdeeld waren",
      icon: "⚡",
    },
    {
      id: "categorie",
      label: "Per categorie",
      desc: "Kies één of meerdere onderwerpen",
      icon: "🏷️",
    },
    {
      id: "willekeurig",
      label: "Willekeurige selectie",
      desc: "Gespreid over alle categorieën",
      icon: "🎲",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <button
            onClick={onTerug}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              marginBottom: "1rem",
              padding: 0,
            }}
          >
            ← Terug
          </button>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "#e2e8f0",
              marginBottom: "0.5rem",
            }}
          >
            Welke moties wil je beoordelen?
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem" }}>
            Kies een selectiemethode om te bepalen welke moties jij gaat
            beoordelen.
          </p>
        </div>

        {/* Modus selectie */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {opties.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setModus(opt.id)}
              style={{
                background: modus === opt.id ? "rgba(37, 99, 235, 0.15)" : "#1e293b",
                border: `2px solid ${modus === opt.id ? "#2563eb" : "#334155"}`,
                borderRadius: "12px",
                padding: "1rem 1.25rem",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>{opt.icon}</span>
              <div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: modus === opt.id ? "#93c5fd" : "#e2e8f0",
                  }}
                >
                  {opt.label}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                  {opt.desc}
                </div>
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  border: `2px solid ${modus === opt.id ? "#2563eb" : "#475569"}`,
                  background: modus === opt.id ? "#2563eb" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {modus === opt.id && (
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "white",
                    }}
                  />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Categorie picker */}
        {modus === "categorie" && (
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            <p
              style={{
                fontSize: "0.85rem",
                color: "#94a3b8",
                marginBottom: "0.75rem",
                fontWeight: 600,
              }}
            >
              Kies één of meerdere categorieën (leeg = alle):
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {categorieen.map((cat) => {
                const selected = geselecteerdeCategorieen.includes(cat);
                const count = geldigMoties.filter((m) => m.categorie === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategorie(cat)}
                    style={{
                      background: selected
                        ? "rgba(37, 99, 235, 0.25)"
                        : "rgba(30, 41, 59, 0.8)",
                      border: `1px solid ${selected ? "#2563eb" : "#334155"}`,
                      borderRadius: "999px",
                      padding: "0.35rem 0.85rem",
                      fontSize: "0.8rem",
                      color: selected ? "#93c5fd" : "#94a3b8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <span>{CAT_ICOON[cat] || "📌"}</span>
                    <span>{cat}</span>
                    <span
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        borderRadius: "999px",
                        padding: "0 0.4rem",
                        fontSize: "0.7rem",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Willekeurig slider */}
        {modus === "willekeurig" && (
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
              }}
            >
              <span style={{ fontSize: "0.9rem", color: "#94a3b8", fontWeight: 600 }}>
                Aantal moties
              </span>
              <span
                style={{
                  background: "rgba(37, 99, 235, 0.2)",
                  color: "#93c5fd",
                  borderRadius: "6px",
                  padding: "0.1rem 0.5rem",
                  fontWeight: 700,
                }}
              >
                {aantalWillekeurig}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={50}
              value={aantalWillekeurig}
              onChange={(e) => setAantalWillekeurig(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#2563eb" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                color: "#475569",
                marginTop: "0.25rem",
              }}
            >
              <span>10</span>
              <span>50</span>
            </div>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            color: "white",
            border: "none",
            borderRadius: "12px",
            padding: "1rem",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🗳️ Start met {getAantalVoorModus()} motie
          {getAantalVoorModus() !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
