import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kieswijzer Groningen Gemeenteraad",
  description:
    "Welke partij past het beste bij jouw standpunten? Vergelijk jouw mening met 800+ moties en 13 fracties van de Groningse gemeenteraad.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={inter.className}>
      <body style={{ background: "#0f172a", color: "#f1f5f9", minHeight: "100vh" }}>
        <header
          style={{
            background: "linear-gradient(135deg,#1e3a8a,#2563eb,#7c3aed)",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "14px 0",
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <span style={{ fontSize: "1.6rem" }}>🗳️</span>
            <div>
              <h1
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "white",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Kieswijzer Groningen
              </h1>
              <p style={{ fontSize: "0.75rem", opacity: 0.75, color: "white", margin: 0 }}>
                Gemeenteraad 2025–2026
              </p>
            </div>
            <nav style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Link
                href="/"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  textDecoration: "none",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 100,
                  border: "1px solid rgba(255,255,255,0.3)",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                🗳️ Kieswijzer
              </Link>
              <Link
                href="/dashboard"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  textDecoration: "none",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 100,
                  border: "1px solid rgba(255,255,255,0.3)",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                📊 Dashboard
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
