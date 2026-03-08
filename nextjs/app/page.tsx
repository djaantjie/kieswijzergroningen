"use client";

import { useState, useEffect } from "react";
import { Motie, Antwoord, Stem, AppView, SelectieOpties } from "../lib/types";
import { laadMoties, selecteerMoties } from "../lib/data";
import WelkomScherm from "../components/stemwijzer/WelkomScherm";
import MotieSelectie from "../components/stemwijzer/MotieSelectie";
import VraagKaart from "../components/stemwijzer/VraagKaart";
import Resultaten from "../components/stemwijzer/Resultaten";

export default function Home() {
  const [view, setView] = useState<AppView>("welkom");
  const [alleMoties, setAlleMoties] = useState<Motie[]>([]);
  const [geselecteerdeMoties, setGeselecteerdeMoties] = useState<Motie[]>([]);
  const [huidigeIndex, setHuidigeIndex] = useState(0);
  const [antwoorden, setAntwoorden] = useState<Antwoord[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    laadMoties()
      .then((m) => {
        setAlleMoties(m);
        setLaden(false);
      })
      .catch((e) => {
        setFout("Kon moties niet laden: " + e.message);
        setLaden(false);
      });
  }, []);

  const handleSelectie = (opties: SelectieOpties) => {
    const moties = selecteerMoties(alleMoties, opties);
    setGeselecteerdeMoties(moties);
    setHuidigeIndex(0);
    setAntwoorden(moties.map((m) => ({ motieNr: m.motie_nr, stem: "overgeslagen" as Stem })));
    setView("quiz");
  };

  const handleStem = (stem: Stem) => {
    const motieNr = geselecteerdeMoties[huidigeIndex].motie_nr;
    setAntwoorden((prev) =>
      prev.map((a) => (a.motieNr === motieNr ? { ...a, stem } : a))
    );
  };

  const handleVolgende = () => {
    if (huidigeIndex < geselecteerdeMoties.length - 1) {
      setHuidigeIndex((i) => i + 1);
    } else {
      setView("resultaten");
    }
  };

  const handleVorige = () => {
    if (huidigeIndex > 0) {
      setHuidigeIndex((i) => i - 1);
    }
  };

  const handleSlaOver = () => {
    handleVolgende();
  };

  const handleOpnieuw = () => {
    setView("welkom");
    setHuidigeIndex(0);
    setAntwoorden([]);
    setGeselecteerdeMoties([]);
  };

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
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Moties laden...</p>
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
          padding: "2rem",
        }}
      >
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #ef4444",
            borderRadius: "12px",
            padding: "2rem",
            maxWidth: "400px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
          <h2 style={{ color: "#ef4444", marginBottom: "0.5rem" }}>Fout</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>{fout}</p>
        </div>
      </div>
    );
  }

  if (view === "welkom") {
    return (
      <WelkomScherm
        onStart={() => setView("selectie")}
        aantalMoties={alleMoties.length}
      />
    );
  }

  if (view === "selectie") {
    return (
      <MotieSelectie
        moties={alleMoties}
        onSelectie={handleSelectie}
        onTerug={() => setView("welkom")}
      />
    );
  }

  if (view === "quiz" && geselecteerdeMoties.length > 0) {
    const motie = geselecteerdeMoties[huidigeIndex];
    const huidigeStem =
      antwoorden.find((a) => a.motieNr === motie.motie_nr)?.stem ?? null;
    const huidigeStemGeldig =
      huidigeStem !== "overgeslagen" ? huidigeStem : null;

    return (
      <VraagKaart
        motie={motie}
        index={huidigeIndex}
        totaal={geselecteerdeMoties.length}
        huidigeStem={huidigeStemGeldig}
        onStem={handleStem}
        onVolgende={handleVolgende}
        onVorige={handleVorige}
        onSlaOver={handleSlaOver}
        kanVorige={huidigeIndex > 0}
        kanVolgende={huidigeIndex < geselecteerdeMoties.length - 1}
      />
    );
  }

  if (view === "resultaten") {
    return (
      <Resultaten
        moties={geselecteerdeMoties}
        antwoorden={antwoorden}
        onOpnieuw={handleOpnieuw}
      />
    );
  }

  return null;
}
