"use client";

import { useMemo, useState } from "react";
import { Motie } from "../../lib/types";
import { berekenControversialiteitPrecies, CAT_ICOON } from "../../lib/data";

interface Props {
  moties: Motie[];
}

export default function ControversieelRanking({ moties }: Props) {
  const [expandedNr, setExpandedNr] = useState<string | null>(null);

  const top = useMemo(() => {
    return [...moties]
      .filter((m) => m.status !== "ONBEKEND")
      .map((m) => {
        const pd = m.stemmingen.partij_detail;
        let voor = 0, tegen = 0;
        for (const p of Object.values(pd)) {
          voor += p.voor;
          tegen += p.tegen;
        }
        const totaal = voor + tegen;
        const marge = totaal > 0 ? Math.abs(voor - tegen) : 999;
        const score = berekenControversialiteitPrecies(m);
        return { m, voor, tegen, totaal, marge, score };
      })
      .sort((a, b) => a.marge - b.marge)
      .slice(0, 20);
  }, [moties]);

  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "1.25rem 1.25rem 0.75rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>
          ⚡ Top 20 meest controversiële moties
        </h3>
        <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.25rem" }}>
          Gesorteerd op kleinste marge tussen voor- en tegenstemmen
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ borderTop: "1px solid #334155", borderBottom: "1px solid #334155" }}>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#64748b", fontWeight: 600, width: "40px" }}>#</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#64748b", fontWeight: 600 }}>Motie</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#64748b", fontWeight: 600 }}>Voor</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#64748b", fontWeight: 600 }}>Tegen</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#64748b", fontWeight: 600 }}>Marge</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#64748b", fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {top.map(({ m, voor, tegen, marge }, i) => {
              const isOpen = expandedNr === m.motie_nr;
              const statusKleur =
                m.status === "AANGENOMEN"
                  ? "#22c55e"
                  : m.status === "VERWORPEN"
                  ? "#ef4444"
                  : "#f59e0b";
              return (
                <>
                  <tr
                    key={m.motie_nr}
                    onClick={() => setExpandedNr(isOpen ? null : m.motie_nr)}
                    style={{
                      borderBottom: "1px solid #1e293b",
                      cursor: "pointer",
                      background: isOpen ? "rgba(37, 99, 235, 0.08)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    }}
                  >
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center", color: "#475569" }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", maxWidth: "280px" }}>
                      <div style={{ color: "#e2e8f0", fontWeight: 500, lineHeight: 1.3 }}>
                        {m.titel_leesbaar || m.titel}
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.72rem", marginTop: "0.15rem" }}>
                        {CAT_ICOON[m.categorie] || "📌"} {m.categorie} · {m.motie_nr}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center", color: "#22c55e", fontWeight: 600 }}>
                      {voor}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center", color: "#ef4444", fontWeight: 600 }}>
                      {tegen}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                      <span
                        style={{
                          background: marge <= 3 ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.1)",
                          color: marge <= 3 ? "#ef4444" : "#f59e0b",
                          borderRadius: "999px",
                          padding: "0.1rem 0.5rem",
                          fontWeight: 700,
                        }}
                      >
                        ±{marge}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                      <span style={{ color: statusKleur, fontWeight: 600, fontSize: "0.72rem" }}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${m.motie_nr}-detail`} style={{ background: "rgba(37, 99, 235, 0.05)" }}>
                      <td colSpan={6} style={{ padding: "0.75rem 1.25rem" }}>
                        <div style={{ fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.6, marginBottom: "0.5rem" }}>
                          {m.uitleg || m.samenvatting}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <a
                            href={m.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: "0.75rem",
                              color: "#60a5fa",
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            📄 Bekijk motie PDF
                          </a>
                          <span style={{ color: "#334155" }}>·</span>
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            Indieners: {m.indieners.filter(i => i && i.length < 30).join(", ")}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
