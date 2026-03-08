"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Motie } from "../../lib/types";
import { berekenCorrelatie } from "../../lib/correlatie";
import { PARTIJ_KLEUREN } from "../../lib/data";

interface Props {
  moties: Motie[];
}

interface GraphData {
  nodes: Array<{ id: string; color: string; val: number }>;
  links: Array<{ source: string; target: string; value: number }>;
}

export default function CoalitieNetwerk({ moties }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drempelwaarde, setDrempelwaarde] = useState(0.7);
  const [geselecteerdPartij, setGeselecteerdPartij] = useState<string | null>(null);
  const [GraphComponent, setGraphComponent] = useState<React.ComponentType<{
    graphData: GraphData;
    nodeColor: (n: { color: string }) => string;
    linkWidth: (l: { value: number }) => number;
    linkColor: (l: { source: string | { id: string }; target: string | { id: string } }) => string;
    onNodeClick: (n: { id: string }) => void;
    backgroundColor: string;
    width: number;
    height: number;
    nodeLabel: (n: { id: string }) => string;
  }> | null>(null);
  const [breedte, setBreedte] = useState(560);

  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      setGraphComponent(() => mod.default as unknown as typeof GraphComponent);
    });
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      setBreedte(containerRef.current.clientWidth);
    }
  }, []);

  const { matrix, partijen } = useMemo(() => berekenCorrelatie(moties), [moties]);

  const graphData: GraphData = useMemo(() => {
    const nodes = partijen.map((p) => ({
      id: p,
      color: PARTIJ_KLEUREN[p] || "#475569",
      val: 6,
    }));

    const links: GraphData["links"] = [];
    for (let i = 0; i < partijen.length; i++) {
      for (let j = i + 1; j < partijen.length; j++) {
        if (matrix[i][j] >= drempelwaarde) {
          links.push({
            source: partijen[i],
            target: partijen[j],
            value: matrix[i][j],
          });
        }
      }
    }
    return { nodes, links };
  }, [partijen, matrix, drempelwaarde]);

  const getNodeColor = (node: { color: string }) => {
    if (!geselecteerdPartij) return node.color;
    return node.color;
  };

  const getLinkColor = (link: { source: string | { id: string }; target: string | { id: string } }) => {
    const src = typeof link.source === "string" ? link.source : link.source.id;
    const tgt = typeof link.target === "string" ? link.target : link.target.id;
    if (
      geselecteerdPartij &&
      src !== geselecteerdPartij &&
      tgt !== geselecteerdPartij
    ) {
      return "rgba(100,100,100,0.15)";
    }
    return "rgba(147, 197, 253, 0.6)";
  };

  const getLinkWidth = (link: { value: number }) => {
    return Math.max(1, (link.value - drempelwaarde) * 20);
  };

  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "1.25rem",
      }}
    >
      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "0.5rem" }}>
        🕸️ Coalitieovereenkomst netwerk
      </h3>
      <p style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "1rem" }}>
        Lijnen tonen partijen die minstens {Math.round(drempelwaarde * 100)}% van de moties hetzelfde stemden.
        Klik een partij om te markeren.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.8rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
          Drempel: {Math.round(drempelwaarde * 100)}%
        </span>
        <input
          type="range"
          min={50}
          max={95}
          value={Math.round(drempelwaarde * 100)}
          onChange={(e) => setDrempelwaarde(Number(e.target.value) / 100)}
          style={{ flex: 1, accentColor: "#2563eb" }}
        />
        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
          {graphData.links.length} verbindingen
        </span>
      </div>

      {geselecteerdPartij && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.75rem",
            fontSize: "0.78rem",
            color: "#94a3b8",
          }}
        >
          <span>Geselecteerd:</span>
          <span
            style={{
              color: PARTIJ_KLEUREN[geselecteerdPartij] || "#93c5fd",
              fontWeight: 700,
            }}
          >
            {geselecteerdPartij}
          </span>
          <button
            onClick={() => setGeselecteerdPartij(null)}
            style={{
              background: "none",
              border: "1px solid #334155",
              borderRadius: "4px",
              padding: "0.1rem 0.4rem",
              fontSize: "0.72rem",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          background: "#0f172a",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #263348",
        }}
      >
        {GraphComponent ? (
          <GraphComponent
            graphData={graphData}
            nodeColor={getNodeColor}
            linkWidth={getLinkWidth}
            linkColor={getLinkColor}
            onNodeClick={(n: { id: string }) => setGeselecteerdPartij(n.id === geselecteerdPartij ? null : n.id)}
            backgroundColor="#0f172a"
            width={breedte - 2}
            height={380}
            nodeLabel={(n: { id: string }) => n.id}
          />
        ) : (
          <div
            style={{
              height: "380px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475569",
              fontSize: "0.85rem",
            }}
          >
            Netwerk laden...
          </div>
        )}
      </div>
    </div>
  );
}
