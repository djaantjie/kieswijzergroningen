"use client";

import { useMemo } from "react";
import { Motie } from "../../lib/types";

interface Props {
  moties: Motie[];
}

export default function StatistiekeKaarten({ moties }: Props) {
  const stats = useMemo(() => {
    const aangenomen = moties.filter((m) => m.status === "AANGENOMEN").length;
    const verworpen = moties.filter((m) => m.status === "VERWORPEN").length;
    const ingetrokken = moties.filter((m) => m.status === "INGETROKKEN").length;

    // Meest actieve indiener
    const indienerCount: Record<string, number> = {};
    for (const m of moties) {
      for (const ind of m.indieners) {
        if (ind && ind.length < 30) {
          indienerCount[ind] = (indienerCount[ind] || 0) + 1;
        }
      }
    }
    const topIndiener = Object.entries(indienerCount).sort((a, b) => b[1] - a[1])[0];

    // Succesvollste partij (based on voting parties)
    const partijSuccess: Record<string, { aangenomen: number; totaal: number }> = {};
    for (const m of moties) {
      if (m.status === "ONBEKEND") continue;
      for (const [partij, detail] of Object.entries(m.stemmingen.partij_detail)) {
        if (partij === "Plv. voorzitter gemeenteraad") continue;
        if (!partijSuccess[partij]) partijSuccess[partij] = { aangenomen: 0, totaal: 0 };
        const totaalStemmen = detail.voor + detail.tegen + detail.onthouden;
        if (totaalStemmen === 0) continue;
        partijSuccess[partij].totaal++;
        if (m.status === "AANGENOMEN" && detail.voor > detail.tegen) {
          partijSuccess[partij].aangenomen++;
        }
      }
    }
    const topPartij = Object.entries(partijSuccess)
      .filter(([, s]) => s.totaal >= 10)
      .map(([p, s]) => ({ partij: p, pct: Math.round((s.aangenomen / s.totaal) * 100) }))
      .sort((a, b) => b.pct - a.pct)[0];

    return { aangenomen, verworpen, ingetrokken, topIndiener, topPartij };
  }, [moties]);

  const kaarten = [
    {
      label: "Totaal moties",
      value: moties.length,
      icon: "📋",
      color: "#2563eb",
      bg: "rgba(37, 99, 235, 0.1)",
    },
    {
      label: "Aangenomen",
      value: stats.aangenomen,
      icon: "✅",
      color: "#22c55e",
      bg: "rgba(34, 197, 94, 0.1)",
    },
    {
      label: "Verworpen",
      value: stats.verworpen,
      icon: "❌",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.1)",
    },
    {
      label: "Ingetrokken",
      value: stats.ingetrokken,
      icon: "↩️",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.1)",
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        {kaarten.map((k) => (
          <div
            key={k.label}
            style={{
              background: k.bg,
              border: `1px solid ${k.color}44`,
              borderRadius: "12px",
              padding: "1.1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
            }}
          >
            <div style={{ fontSize: "1.5rem" }}>{k.icon}</div>
            <div
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                color: k.color,
                lineHeight: 1,
              }}
            >
              {k.value}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {stats.topIndiener && (
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div style={{ fontSize: "1.75rem" }}>🏆</div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.15rem" }}>
                Meest actieve indiener
              </div>
              <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.9rem" }}>
                {stats.topIndiener[0]}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#f59e0b" }}>
                {stats.topIndiener[1]} moties ingediend
              </div>
            </div>
          </div>
        )}

        {stats.topPartij && (
          <div
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div style={{ fontSize: "1.75rem" }}>⭐</div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.15rem" }}>
                Succesvollste partij
              </div>
              <div style={{ fontWeight: 700, color: "#e2e8f0", fontSize: "0.9rem" }}>
                {stats.topPartij.partij}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                {stats.topPartij.pct}% aangenomen steun
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
