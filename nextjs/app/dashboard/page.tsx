"use client";

import { useState, useEffect } from "react";
import { Motie } from "../../lib/types";
import { laadMoties, getStemPartijen } from "../../lib/data";
import StatistiekeKaarten from "../../components/dashboard/StatistiekeKaarten";
import MotiesTimeline from "../../components/dashboard/MotiesTimeline";
import CategorieChart from "../../components/dashboard/CategorieChart";
import ControversieelRanking from "../../components/dashboard/ControversieelRanking";
import PartijHeatmap from "../../components/dashboard/PartijHeatmap";
import PartijProfiel from "../../components/dashboard/PartijProfiel";
import CoalitieNetwerk from "../../components/dashboard/CoalitieNetwerk";

type Sectie =
  | "overzicht"
  | "timeline"
  | "categorieen"
  | "controversieel"
  | "partijen"
  | "netwerk";

const SECTIES: { id: Sectie; label: string; icon: string }[] = [
  { id: "overzicht", label: "Overzicht", icon: "📊" },
  { id: "timeline", label: "Timeline", icon: "📅" },
  { id: "categorieen", label: "Categorieën", icon: "🏷️" },
  { id: "controversieel", label: "Controversieel", icon: "⚡" },
  { id: "partijen", label: "Partijen", icon: "🏛️" },
  { id: "netwerk", label: "Coalitie", icon: "🕸️" },
];

export default function DashboardPage() {
  const [moties, setMoties] = useState<Motie[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [actieveSectie, setActieveSectie] = useState<Sectie>("overzicht");

  useEffect(() => {
    laadMoties()
      .then((m) => {
        setMoties(m);
        setLaden(false);
      })
      .catch((e) => {
        setFout(e.message);
        setLaden(false);
      });
  }, []);

  if (laden) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "3px solid #334155",
            borderTop: "3px solid #2563eb",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Dashboard laden...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (fout) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #ef4444",
            borderRadius: "12px",
            padding: "2rem",
            color: "#ef4444",
          }}
        >
          Fout: {fout}
        </div>
      </div>
    );
  }

  const stemPartijen = getStemPartijen(moties).filter(
    (p) => p !== "Plv. voorzitter gemeenteraad"
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f, #1e293b)",
          borderBottom: "1px solid #334155",
          padding: "1rem 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.4rem",
                fontWeight: 800,
                color: "#e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              📊 Dashboard Groningen Moties
            </h1>
            <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.2rem" }}>
              {moties.length} moties · 2025–2026
            </p>
          </div>
          <a
            href="/kieswijzergroningen/"
            style={{
              background: "rgba(37, 99, 235, 0.15)",
              border: "1px solid rgba(37, 99, 235, 0.4)",
              borderRadius: "8px",
              padding: "0.45rem 1rem",
              fontSize: "0.85rem",
              color: "#93c5fd",
              textDecoration: "none",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            🗳️ Naar kieswijzer
          </a>
        </div>
      </div>

      {/* Nav */}
      <div
        style={{
          borderBottom: "1px solid #334155",
          background: "#1e293b",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            display: "flex",
            overflowX: "auto",
            padding: "0 0.5rem",
          }}
        >
          {SECTIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActieveSectie(s.id)}
              style={{
                flex: "0 0 auto",
                background:
                  actieveSectie === s.id
                    ? "rgba(37, 99, 235, 0.15)"
                    : "transparent",
                border: "none",
                borderBottom: `3px solid ${
                  actieveSectie === s.id ? "#2563eb" : "transparent"
                }`,
                padding: "0.8rem 0.9rem",
                fontSize: "0.82rem",
                color: actieveSectie === s.id ? "#93c5fd" : "#64748b",
                cursor: "pointer",
                fontWeight: actieveSectie === s.id ? 700 : 400,
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                whiteSpace: "nowrap",
              }}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "1.5rem 1rem",
        }}
      >
        {actieveSectie === "overzicht" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <StatistiekeKaarten moties={moties} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "1rem",
              }}
            >
              <MotiesTimeline moties={moties} />
              <CategorieChart moties={moties} />
            </div>
          </div>
        )}

        {actieveSectie === "timeline" && <MotiesTimeline moties={moties} />}

        {actieveSectie === "categorieen" && <CategorieChart moties={moties} />}

        {actieveSectie === "controversieel" && (
          <ControversieelRanking moties={moties} />
        )}

        {actieveSectie === "partijen" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "1rem",
            }}
          >
            <PartijProfiel moties={moties} partijen={stemPartijen} />
            <PartijHeatmap moties={moties} />
          </div>
        )}

        {actieveSectie === "netwerk" && (
          <CoalitieNetwerk moties={moties} />
        )}
      </div>
    </div>
  );
}
