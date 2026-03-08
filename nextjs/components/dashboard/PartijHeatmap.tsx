"use client";

import { useMemo, useState } from "react";
import { Motie } from "../../lib/types";
import { berekenCorrelatie } from "../../lib/correlatie";
import { PARTIJ_KLEUREN, PARTIJ_KORT } from "../../lib/data";

interface Props {
  moties: Motie[];
}

function getKleur(score: number, isDiagonaal: boolean): string {
  if (isDiagonaal) return "#2563eb";
  // Red (low agreement) → Yellow → Green (high agreement)
  const r = score < 0.5 ? 255 : Math.round(255 - (score - 0.5) * 2 * 255);
  const g = score > 0.5 ? 255 : Math.round(score * 2 * 255);
  return `rgb(${r},${g},80)`;
}

export default function PartijHeatmap({ moties }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    partijA: string;
    partijB: string;
    score: number;
    count: number;
  } | null>(null);

  const { matrix, partijen } = useMemo(() => berekenCorrelatie(moties), [moties]);

  const n = partijen.length;
  const celGrootte = Math.min(42, Math.floor(560 / n));

  // Build count matrix for tooltips
  const counts = useMemo(() => {
    const c: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    // Rough count from votes overlap
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let count = 0;
        for (const m of moties) {
          const di = m.stemmingen.partij_detail[partijen[i]];
          const dj = m.stemmingen.partij_detail[partijen[j]];
          if (di && dj && (di.voor + di.tegen + di.onthouden) > 0 && (dj.voor + dj.tegen + dj.onthouden) > 0) {
            count++;
          }
        }
        c[i][j] = count;
      }
    }
    return c;
  }, [moties, partijen, n]);

  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "1.25rem",
        overflow: "hidden",
      }}
    >
      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.5rem" }}>
        🔥 Partijovereenstemming heatmap
      </h3>
      <p style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "1rem" }}>
        Percentage moties waarbij twee partijen hetzelfde stemden
      </p>

      <div style={{ overflowX: "auto" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          {/* Y-axis labels */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", marginRight: "4px", paddingTop: `${celGrootte}px` }}>
              {partijen.map((p, i) => (
                <div
                  key={i}
                  style={{
                    height: `${celGrootte}px`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: "6px",
                    fontSize: "10px",
                    color: PARTIJ_KLEUREN[p] || "#94a3b8",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {PARTIJ_KORT[p] || p.slice(0, 6)}
                </div>
              ))}
            </div>

            <div>
              {/* X-axis labels */}
              <div style={{ display: "flex", marginBottom: "2px" }}>
                {partijen.map((p, j) => (
                  <div
                    key={j}
                    style={{
                      width: `${celGrootte}px`,
                      height: `${celGrootte}px`,
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingBottom: "3px",
                      fontSize: "9px",
                      color: PARTIJ_KLEUREN[p] || "#94a3b8",
                      fontWeight: 600,
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {PARTIJ_KORT[p] || p.slice(0, 6)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid */}
              {matrix.map((row, i) => (
                <div key={i} style={{ display: "flex" }}>
                  {row.map((score, j) => {
                    const isDiag = i === j;
                    const kleur = getKleur(score, isDiag);
                    const pct = isDiag ? 100 : Math.round(score * 100);
                    return (
                      <div
                        key={j}
                        onMouseEnter={(e) => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltip({
                            x: rect.left,
                            y: rect.top,
                            partijA: partijen[i],
                            partijB: partijen[j],
                            score: pct,
                            count: counts[i][j],
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          width: `${celGrootte}px`,
                          height: `${celGrootte}px`,
                          background: kleur,
                          opacity: isDiag ? 0.7 : 0.85,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: celGrootte > 36 ? "9px" : "0",
                          color: "rgba(0,0,0,0.7)",
                          fontWeight: 700,
                          cursor: "default",
                          margin: "1px",
                          borderRadius: "2px",
                        }}
                      >
                        {celGrootte > 36 && !isDiag ? `${pct}` : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            top: `${tooltip.y - 70}px`,
            left: `${tooltip.x + 10}px`,
            background: "#263348",
            border: "1px solid #334155",
            borderRadius: "8px",
            padding: "0.5rem 0.75rem",
            fontSize: "0.78rem",
            color: "#e2e8f0",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {PARTIJ_KORT[tooltip.partijA] || tooltip.partijA} ↔{" "}
            {PARTIJ_KORT[tooltip.partijB] || tooltip.partijB}
          </div>
          <div style={{ color: tooltip.score >= 70 ? "#22c55e" : tooltip.score >= 50 ? "#f59e0b" : "#ef4444" }}>
            {tooltip.score}% overeenstemming
          </div>
          <div style={{ color: "#64748b" }}>{tooltip.count} moties vergeleken</div>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "1rem",
          fontSize: "0.72rem",
          color: "#64748b",
        }}
      >
        <span>Weinig eens</span>
        <div
          style={{
            flex: 1,
            height: "8px",
            borderRadius: "999px",
            background: "linear-gradient(90deg, rgb(255,80,80), rgb(255,255,80), rgb(80,255,80))",
          }}
        />
        <span>Veel eens</span>
      </div>
    </div>
  );
}
