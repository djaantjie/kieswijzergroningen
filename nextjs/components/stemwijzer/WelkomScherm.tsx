"use client";

interface Props {
  onStart: () => void;
  aantalMoties: number;
}

export default function WelkomScherm({ onStart, aantalMoties }: Props) {
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      {/* Hero Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #1e293b 50%, #2d1b69 100%)",
          borderBottom: "1px solid #334155",
          padding: "3rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(37, 99, 235, 0.2)",
              border: "1px solid rgba(37, 99, 235, 0.4)",
              borderRadius: "999px",
              padding: "0.25rem 1rem",
              fontSize: "0.8rem",
              color: "#93c5fd",
              marginBottom: "1.5rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            🏛️ Groningen Gemeenteraad
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              fontWeight: 800,
              marginBottom: "1rem",
              lineHeight: 1.1,
              background: "linear-gradient(135deg, #e2e8f0, #93c5fd, #c4b5fd)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Kieswijzer Groningen
          </h1>

          <p
            style={{
              fontSize: "1.15rem",
              color: "#94a3b8",
              maxWidth: "600px",
              margin: "0 auto 2rem",
              lineHeight: 1.7,
            }}
          >
            Ontdek welke partij het best bij jouw standpunten past op basis van
            echte raadsmoties uit 2025–2026.
          </p>

          {/* Stat pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
              marginBottom: "2.5rem",
            }}
          >
            {[
              { label: `${aantalMoties} moties`, icon: "📋" },
              { label: "13 fracties", icon: "🏛️" },
              { label: "2025–2026", icon: "📅" },
            ].map((pill) => (
              <div
                key={pill.label}
                style={{
                  background: "rgba(30, 41, 59, 0.8)",
                  border: "1px solid #334155",
                  borderRadius: "999px",
                  padding: "0.4rem 1rem",
                  fontSize: "0.9rem",
                  color: "#cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span>{pill.icon}</span>
                <span>{pill.label}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={onStart}
              style={{
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "0.85rem 2rem",
                fontSize: "1rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              🗳️ Start kieswijzer
            </button>
            <a
              href="/kieswijzergroningen/dashboard/"
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                color: "#94a3b8",
                border: "1px solid #334155",
                borderRadius: "12px",
                padding: "0.85rem 2rem",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              📊 Direct naar dashboard
            </a>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ maxWidth: "900px", margin: "3rem auto", padding: "0 1.5rem" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "#e2e8f0",
            marginBottom: "1.5rem",
          }}
        >
          Hoe werkt het?
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
          }}
        >
          {[
            {
              icon: "⚙️",
              title: "Kies jouw moties",
              desc: "Selecteer alle moties, de meest controversiële, per categorie of een willekeurige selectie.",
            },
            {
              icon: "🗳️",
              title: "Stem op elke motie",
              desc: "Lees de uitleg, analyseer voordelen en nadelen, en geef jouw stem: eens, neutraal of oneens.",
            },
            {
              icon: "📊",
              title: "Zie jouw match",
              desc: "Vergelijk jouw standpunten met alle 13 Groningse fracties en ontdek waar jij het meest mee eens bent.",
            },
            {
              icon: "🔍",
              title: "Verdiep je",
              desc: "Bekijk het volledige dashboard met partijvergelijkingen, trends en coalitieanalyses.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "12px",
                padding: "1.25rem",
              }}
            >
              <div style={{ fontSize: "1.8rem", marginBottom: "0.75rem" }}>
                {feature.icon}
              </div>
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#e2e8f0",
                  marginBottom: "0.4rem",
                }}
              >
                {feature.title}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", lineHeight: 1.6 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
