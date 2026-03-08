"use client";

import { useState, useMemo } from "react";
import { Motie, Antwoord, Stem } from "../../lib/types";
import { PARTIJ_KLEUREN, PARTIJ_KORT, CAT_ICOON } from "../../lib/data";

interface Props {
  moties: Motie[];
  antwoorden: Antwoord[];
  onOpnieuw: () => void;
}

function berekenPartijScores(moties: Motie[], antwoorden: Antwoord[]) {
  const partijen = new Set<string>();
  for (const m of moties) {
    for (const p of Object.keys(m.stemmingen.partij_detail)) {
      if (p !== "Plv. voorzitter gemeenteraad") partijen.add(p);
    }
  }

  const scores: Record<string, { match: number; totaal: number }> = {};
  for (const partij of partijen) {
    scores[partij] = { match: 0, totaal: 0 };
  }

  for (const antwoord of antwoorden) {
    if (antwoord.stem === "neutraal" || antwoord.stem === "overgeslagen") continue;
    const motie = moties.find((m) => m.motie_nr === antwoord.motieNr);
    if (!motie) continue;

    for (const partij of partijen) {
      const detail = motie.stemmingen.partij_detail[partij];
      if (!detail) continue;
      const totaal = detail.voor + detail.tegen + detail.onthouden;
      if (totaal === 0) continue;

      scores[partij].totaal++;

      // Determine partij's stance
      let partijStem: Stem | null = null;
      if (detail.voor > detail.tegen) partijStem = "eens";
      else if (detail.tegen > detail.voor) partijStem = "oneens";

      if (partijStem && partijStem === antwoord.stem) {
        scores[partij].match++;
      }
    }
  }

  return Object.entries(scores)
    .map(([partij, { match, totaal }]) => ({
      partij,
      score: totaal > 0 ? Math.round((match / totaal) * 100) : 0,
      match,
      totaal,
    }))
    .sort((a, b) => b.score - a.score);
}

const MAANDEN = ["", "jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export default function Resultaten({ moties, antwoorden, onOpnieuw }: Props) {
  const [actieveTab, setActieveTab] = useState<"match" | "moties" | "vergelijking">("match");
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");

  const partijScores = useMemo(
    () => berekenPartijScores(moties, antwoorden),
    [moties, antwoorden]
  );

  const beantwoord = antwoorden.filter(
    (a) => a.stem !== "overgeslagen"
  ).length;
  const totaal = antwoorden.length;

  // Build motie list with antwoord
  const motiesMetAntwoord = moties
    .map((m) => {
      const a = antwoorden.find((a) => a.motieNr === m.motie_nr);
      return { motie: m, stem: a?.stem ?? null };
    })
    .filter((x) => x.stem && x.stem !== "overgeslagen");

  const gefilterd = motiesMetAntwoord.filter((x) => {
    const zoek = filter.toLowerCase();
    const matchTekst =
      !zoek ||
      x.motie.titel_leesbaar?.toLowerCase().includes(zoek) ||
      x.motie.categorie.toLowerCase().includes(zoek);
    const matchStatus =
      statusFilter === "alle" || x.motie.status === statusFilter;
    return matchTekst && matchStatus;
  });

  const tabs = [
    { id: "match" as const, label: "Jouw match", icon: "🎯" },
    { id: "moties" as const, label: "Alle moties", icon: "📋" },
    { id: "vergelijking" as const, label: "Partijvergelijking", icon: "📊" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        paddingBottom: "3rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f, #1e293b)",
          borderBottom: "1px solid #334155",
          padding: "2rem 1rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h1
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
              fontWeight: 800,
              color: "#e2e8f0",
              marginBottom: "0.5rem",
            }}
          >
            🎯 Jouw resultaten
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            Je hebt {beantwoord} van de {totaal} moties beantwoord
          </p>

          {/* Top 3 matches */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "1.5rem",
            }}
          >
            {partijScores.slice(0, 3).map((ps, i) => (
              <div
                key={ps.partij}
                style={{
                  background: "#1e293b",
                  border: `2px solid ${i === 0 ? "#f59e0b" : "#334155"}`,
                  borderRadius: "12px",
                  padding: "0.75rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                </span>
                <div>
                  <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.9rem" }}>
                    {PARTIJ_KORT[ps.partij] || ps.partij}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: i === 0 ? "#f59e0b" : "#64748b",
                      fontWeight: i === 0 ? 700 : 400,
                    }}
                  >
                    {ps.score}% match
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onOpnieuw}
            style={{
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "0.5rem 1.25rem",
              fontSize: "0.85rem",
              color: "#94a3b8",
              cursor: "pointer",
            }}
          >
            🔄 Opnieuw beginnen
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          borderBottom: "1px solid #334155",
          background: "#1e293b",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "flex",
            overflowX: "auto",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActieveTab(tab.id)}
              style={{
                flex: 1,
                minWidth: "100px",
                background: actieveTab === tab.id ? "rgba(37, 99, 235, 0.15)" : "transparent",
                border: "none",
                borderBottom: `3px solid ${actieveTab === tab.id ? "#2563eb" : "transparent"}`,
                padding: "0.9rem 0.5rem",
                fontSize: "0.85rem",
                color: actieveTab === tab.id ? "#93c5fd" : "#64748b",
                cursor: "pointer",
                fontWeight: actieveTab === tab.id ? 700 : 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                whiteSpace: "nowrap",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "1.5rem 1rem" }}>
        {/* Jouw match */}
        {actieveTab === "match" && (
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "1rem" }}>
              Partijmatch op basis van jouw stemmen
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {partijScores.map((ps, i) => (
                <div
                  key={ps.partij}
                  style={{
                    background: "#1e293b",
                    border: `1px solid ${i === 0 ? "#f59e0b44" : "#334155"}`,
                    borderRadius: "10px",
                    padding: "0.85rem 1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div
                        style={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          background: PARTIJ_KLEUREN[ps.partij] || "#475569",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "0.9rem" }}>
                        {ps.partij}
                      </span>
                      {i === 0 && (
                        <span
                          style={{
                            background: "rgba(245, 158, 11, 0.2)",
                            border: "1px solid rgba(245, 158, 11, 0.4)",
                            borderRadius: "999px",
                            padding: "0.1rem 0.5rem",
                            fontSize: "0.7rem",
                            color: "#f59e0b",
                            fontWeight: 700,
                          }}
                        >
                          Beste match
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        color: ps.score >= 70 ? "#22c55e" : ps.score >= 50 ? "#f59e0b" : "#94a3b8",
                        fontSize: "1rem",
                      }}
                    >
                      {ps.score}%
                    </span>
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
                        width: `${ps.score}%`,
                        background:
                          ps.score >= 70
                            ? "#22c55e"
                            : ps.score >= 50
                            ? "#f59e0b"
                            : "#475569",
                        borderRadius: "999px",
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.35rem" }}>
                    {ps.match} van {ps.totaal} moties overeengekomen
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alle moties */}
        {actieveTab === "moties" && (
          <div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              <input
                type="text"
                placeholder="Zoek op titel of categorie..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "200px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  padding: "0.5rem 0.85rem",
                  fontSize: "0.875rem",
                  color: "#e2e8f0",
                  outline: "none",
                }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  padding: "0.5rem 0.85rem",
                  fontSize: "0.875rem",
                  color: "#e2e8f0",
                  outline: "none",
                }}
              >
                <option value="alle">Alle statussen</option>
                <option value="AANGENOMEN">Aangenomen</option>
                <option value="VERWORPEN">Verworpen</option>
                <option value="INGETROKKEN">Ingetrokken</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {gefilterd.map(({ motie, stem }) => {
                const statusKleur =
                  motie.status === "AANGENOMEN"
                    ? "#22c55e"
                    : motie.status === "VERWORPEN"
                    ? "#ef4444"
                    : "#f59e0b";
                const stemKleur =
                  stem === "eens"
                    ? "#22c55e"
                    : stem === "oneens"
                    ? "#ef4444"
                    : "#f59e0b";
                const stemLabel =
                  stem === "eens" ? "👍 Eens" : stem === "oneens" ? "👎 Oneens" : "🤷 Neutraal";

                return (
                  <div
                    key={motie.motie_nr}
                    style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "10px",
                      padding: "0.85rem 1rem",
                      display: "flex",
                      gap: "1rem",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.35rem",
                          marginBottom: "0.35rem",
                        }}
                      >
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {CAT_ICOON[motie.categorie] || "📌"} {motie.categorie}
                        </span>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: statusKleur,
                            fontWeight: 600,
                          }}
                        >
                          · {motie.status}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          color: "#e2e8f0",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {motie.titel_leesbaar || motie.titel}
                      </div>
                    </div>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: "0.78rem",
                        color: stemKleur,
                        fontWeight: 700,
                        background: `${stemKleur}22`,
                        border: `1px solid ${stemKleur}55`,
                        borderRadius: "6px",
                        padding: "0.2rem 0.5rem",
                      }}
                    >
                      {stemLabel}
                    </span>
                  </div>
                );
              })}
              {gefilterd.length === 0 && (
                <p style={{ color: "#475569", textAlign: "center", padding: "2rem" }}>
                  Geen moties gevonden
                </p>
              )}
            </div>
          </div>
        )}

        {/* Partijvergelijking */}
        {actieveTab === "vergelijking" && (
          <div>
            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#e2e8f0",
                marginBottom: "1rem",
              }}
            >
              Partijvergelijking per motie
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <th
                      style={{
                        padding: "0.5rem",
                        textAlign: "left",
                        color: "#64748b",
                        fontWeight: 600,
                        minWidth: "180px",
                      }}
                    >
                      Motie
                    </th>
                    <th style={{ padding: "0.5rem", color: "#64748b", fontWeight: 600 }}>
                      Jij
                    </th>
                    {partijScores.slice(0, 6).map((ps) => (
                      <th
                        key={ps.partij}
                        style={{
                          padding: "0.5rem",
                          color: PARTIJ_KLEUREN[ps.partij] || "#94a3b8",
                          fontWeight: 600,
                          textAlign: "center",
                        }}
                      >
                        {PARTIJ_KORT[ps.partij] || ps.partij}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {antwoorden
                    .filter((a) => a.stem !== "overgeslagen")
                    .map((a) => {
                      const motie = moties.find((m) => m.motie_nr === a.motieNr);
                      if (!motie) return null;
                      return (
                        <tr
                          key={a.motieNr}
                          style={{ borderBottom: "1px solid #1e293b" }}
                        >
                          <td
                            style={{
                              padding: "0.5rem",
                              color: "#cbd5e1",
                              maxWidth: "200px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {motie.titel_leesbaar || motie.titel}
                          </td>
                          <td style={{ padding: "0.5rem", textAlign: "center" }}>
                            {a.stem === "eens" ? "✅" : a.stem === "oneens" ? "❌" : "➖"}
                          </td>
                          {partijScores.slice(0, 6).map((ps) => {
                            const detail = motie.stemmingen.partij_detail[ps.partij];
                            if (!detail) return (
                              <td key={ps.partij} style={{ padding: "0.5rem", textAlign: "center", color: "#334155" }}>—</td>
                            );
                            const partijStem =
                              detail.voor > detail.tegen
                                ? "eens"
                                : detail.tegen > detail.voor
                                ? "oneens"
                                : "neutraal";
                            const match = partijStem === a.stem;
                            return (
                              <td
                                key={ps.partij}
                                style={{
                                  padding: "0.5rem",
                                  textAlign: "center",
                                  background: match ? "rgba(34, 197, 94, 0.05)" : "transparent",
                                }}
                              >
                                {partijStem === "eens"
                                  ? "✅"
                                  : partijStem === "oneens"
                                  ? "❌"
                                  : "➖"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <a
                href="/kieswijzergroningen/dashboard/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "rgba(37, 99, 235, 0.15)",
                  border: "1px solid rgba(37, 99, 235, 0.4)",
                  borderRadius: "8px",
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  color: "#93c5fd",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                📊 Bekijk volledig dashboard →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
