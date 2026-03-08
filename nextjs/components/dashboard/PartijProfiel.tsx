"use client";

import { useMemo, useState } from "react";
import { Motie } from "../../lib/types";
import { PARTIJ_KLEUREN, CAT_ICOON } from "../../lib/data";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Tooltip,
} from "recharts";

interface Props {
  moties: Motie[];
  partijen: string[];
}

export default function PartijProfiel({ moties, partijen }: Props) {
  const [geselecteerd, setGeselecteerd] = useState(partijen[0] || "GroenLinks");

  const profiel = useMemo(() => {
    const partij = geselecteerd;
    const stats = {
      ingediend: 0,
      aangenomenIngediend: 0,
      totaalGestemd: 0,
      winnaarstem: 0,
    };

    // Ingediende moties
    const ingediendMoties = moties.filter((m) =>
      m.indieners.some((ind) => ind.includes(partij.slice(0, 4)))
    );
    stats.ingediend = ingediendMoties.length;
    stats.aangenomenIngediend = ingediendMoties.filter(
      (m) => m.status === "AANGENOMEN"
    ).length;

    // Stemgedrag per categorie
    const perCat: Record<string, { voor: number; totaal: number }> = {};
    for (const m of moties) {
      if (m.status === "ONBEKEND") continue;
      const detail = m.stemmingen.partij_detail[partij];
      if (!detail) continue;
      const totaal = detail.voor + detail.tegen + detail.onthouden;
      if (totaal === 0) continue;

      stats.totaalGestemd++;
      if (
        (detail.voor > detail.tegen && m.status === "AANGENOMEN") ||
        (detail.tegen > detail.voor && m.status === "VERWORPEN")
      ) {
        stats.winnaarstem++;
      }

      const cat = m.categorie;
      if (!perCat[cat]) perCat[cat] = { voor: 0, totaal: 0 };
      perCat[cat].totaal++;
      if (detail.voor > detail.tegen) perCat[cat].voor++;
    }

    const radarData = Object.entries(perCat).map(([cat, { voor, totaal }]) => ({
      cat: (CAT_ICOON[cat] || "📌") + " " + cat.split(" & ")[0],
      pct: totaal > 0 ? Math.round((voor / totaal) * 100) : 50,
    }));

    // Recent moties (where this party voted)
    const recentMoties = moties
      .filter((m) => {
        const detail = m.stemmingen.partij_detail[partij];
        return detail && (detail.voor + detail.tegen + detail.onthouden) > 0;
      })
      .slice(-5)
      .reverse();

    const succesRate =
      stats.totaalGestemd > 0
        ? Math.round((stats.winnaarstem / stats.totaalGestemd) * 100)
        : 0;

    return { stats, radarData, recentMoties, succesRate };
  }, [moties, geselecteerd]);

  const kleur = PARTIJ_KLEUREN[geselecteerd] || "#2563eb";

  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "1.25rem",
      }}
    >
      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.75rem" }}>
        🏛️ Partijprofiel
      </h3>

      {/* Party selector */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem",
          marginBottom: "1.25rem",
        }}
      >
        {partijen.map((p) => (
          <button
            key={p}
            onClick={() => setGeselecteerd(p)}
            style={{
              background:
                geselecteerd === p
                  ? `${PARTIJ_KLEUREN[p] || "#2563eb"}33`
                  : "rgba(30, 41, 59, 0.8)",
              border: `1px solid ${
                geselecteerd === p
                  ? PARTIJ_KLEUREN[p] || "#2563eb"
                  : "#334155"
              }`,
              borderRadius: "6px",
              padding: "0.3rem 0.65rem",
              fontSize: "0.75rem",
              color:
                geselecteerd === p
                  ? PARTIJ_KLEUREN[p] || "#93c5fd"
                  : "#94a3b8",
              cursor: "pointer",
              fontWeight: geselecteerd === p ? 700 : 400,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: "0.5rem",
          marginBottom: "1.25rem",
        }}
      >
        {[
          { label: "Moties ingediend", value: profiel.stats.ingediend, color: "#94a3b8" },
          {
            label: "Succesvol ingediend",
            value: profiel.stats.aangenomenIngediend,
            color: "#22c55e",
          },
          {
            label: "Meegestemd",
            value: profiel.stats.totaalGestemd,
            color: "#64748b",
          },
          {
            label: "Winnende kant",
            value: `${profiel.succesRate}%`,
            color: kleur,
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "#263348",
              borderRadius: "8px",
              padding: "0.6rem 0.75rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: "0.68rem", color: "#64748b", lineHeight: 1.3 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Radar chart */}
      {profiel.radarData.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "0.5rem" }}>
            Aandeel voor-stemmen per categorie:
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={profiel.radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis
                dataKey="cat"
                tick={{ fill: "#64748b", fontSize: 9 }}
              />
              <Radar
                dataKey="pct"
                stroke={kleur}
                fill={kleur}
                fillOpacity={0.25}
              />
              <Tooltip
                contentStyle={{
                  background: "#263348",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                  fontSize: "0.78rem",
                }}
                formatter={(v) => [`${v}%`, "% voor"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent moties */}
      <div>
        <p style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "0.5rem", fontWeight: 600 }}>
          Recente moties:
        </p>
        {profiel.recentMoties.map((m) => {
          const detail = m.stemmingen.partij_detail[geselecteerd];
          const stem = detail
            ? detail.voor > detail.tegen
              ? "✅"
              : detail.tegen > detail.voor
              ? "❌"
              : "➖"
            : "—";
          const statusKleur =
            m.status === "AANGENOMEN"
              ? "#22c55e"
              : m.status === "VERWORPEN"
              ? "#ef4444"
              : "#f59e0b";
          return (
            <div
              key={m.motie_nr}
              style={{
                display: "flex",
                gap: "0.5rem",
                padding: "0.4rem 0",
                borderBottom: "1px solid #263348",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "0.9rem" }}>{stem}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "#cbd5e1",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.titel_leesbaar || m.titel}
                </div>
                <div style={{ fontSize: "0.68rem", color: statusKleur }}>
                  {m.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
