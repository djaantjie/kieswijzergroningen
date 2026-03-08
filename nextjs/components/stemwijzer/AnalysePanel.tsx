"use client";

import { useState } from "react";
import { Motie } from "../../lib/types";

interface Props {
  motie: Motie;
}

type Tab = "voordelen" | "nadelen" | "context" | "bronnen";

export default function AnalysePanel({ motie }: Props) {
  const [actieveTab, setActieveTab] = useState<Tab>("voordelen");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "voordelen", label: "Voordelen", icon: "✅" },
    { id: "nadelen", label: "Nadelen", icon: "⚠️" },
    { id: "context", label: "Context", icon: "📖" },
    { id: "bronnen", label: "Bronnen", icon: "🔗" },
  ];

  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.8)",
        border: "1px solid #334155",
        borderRadius: "12px",
        overflow: "hidden",
        marginTop: "1rem",
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #334155",
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActieveTab(tab.id)}
            style={{
              flex: 1,
              minWidth: "80px",
              background: actieveTab === tab.id ? "rgba(37, 99, 235, 0.15)" : "transparent",
              border: "none",
              borderBottom: `2px solid ${actieveTab === tab.id ? "#2563eb" : "transparent"}`,
              padding: "0.6rem 0.5rem",
              fontSize: "0.8rem",
              color: actieveTab === tab.id ? "#93c5fd" : "#64748b",
              cursor: "pointer",
              fontWeight: actieveTab === tab.id ? 700 : 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.3rem",
              whiteSpace: "nowrap",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "1rem" }}>
        {actieveTab === "voordelen" && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {(motie.voordelen || []).length > 0 ? (
              motie.voordelen.map((v, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    color: "#cbd5e1",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: "#22c55e", flexShrink: 0 }}>✓</span>
                  <span>{v}</span>
                </li>
              ))
            ) : (
              <li style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Geen voordelen beschikbaar
              </li>
            )}
          </ul>
        )}

        {actieveTab === "nadelen" && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {(motie.nadelen || []).length > 0 ? (
              motie.nadelen.map((n, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                    color: "#cbd5e1",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: "#ef4444", flexShrink: 0 }}>✗</span>
                  <span>{n}</span>
                </li>
              ))
            ) : (
              <li style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Geen nadelen beschikbaar
              </li>
            )}
          </ul>
        )}

        {actieveTab === "context" && (
          <p
            style={{
              fontSize: "0.875rem",
              color: "#cbd5e1",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {motie.context || "Geen context beschikbaar."}
          </p>
        )}

        {actieveTab === "bronnen" && (
          <div>
            {(motie.bronnen || []).length > 0 ? (
              motie.bronnen.map((bron, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: "0.75rem",
                    padding: "0.75rem",
                    background: "#1e293b",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                  }}
                >
                  <a
                    href={bron.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#60a5fa",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    🔗 {bron.naam}
                  </a>
                  {bron.beschrijving && (
                    <p
                      style={{
                        margin: "0.25rem 0 0",
                        fontSize: "0.8rem",
                        color: "#64748b",
                      }}
                    >
                      {bron.beschrijving}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Geen bronnen beschikbaar
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
