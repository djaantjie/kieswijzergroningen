"use client";

import { useMemo } from "react";
import { Motie } from "../../lib/types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Props {
  moties: Motie[];
}

const MAANDEN_KORT = [
  "", "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

export default function MotiesTimeline({ moties }: Props) {
  const data = useMemo(() => {
    const perMaand: Record<string, { naam: string; aangenomen: number; verworpen: number; ingetrokken: number; onbekend: number }> = {};

    for (const m of moties) {
      const key = `${m.jaar}-${String(m.maand).padStart(2, "0")}`;
      if (!perMaand[key]) {
        perMaand[key] = {
          naam: `${MAANDEN_KORT[m.maand]} ${m.jaar}`,
          aangenomen: 0,
          verworpen: 0,
          ingetrokken: 0,
          onbekend: 0,
        };
      }
      switch (m.status) {
        case "AANGENOMEN":
          perMaand[key].aangenomen++;
          break;
        case "VERWORPEN":
          perMaand[key].verworpen++;
          break;
        case "INGETROKKEN":
          perMaand[key].ingetrokken++;
          break;
        default:
          perMaand[key].onbekend++;
      }
    }

    return Object.entries(perMaand)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [moties]);

  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "1.25rem",
      }}
    >
      <h3
        style={{
          fontSize: "1rem",
          fontWeight: 700,
          color: "#e2e8f0",
          marginBottom: "1rem",
        }}
      >
        📅 Moties per maand
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="naam"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#263348",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#e2e8f0",
              fontSize: "0.8rem",
            }}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: "0.78rem", color: "#94a3b8" }}
          />
          <Bar dataKey="aangenomen" name="Aangenomen" fill="#22c55e" stackId="a" radius={[0, 0, 0, 0]} />
          <Bar dataKey="verworpen" name="Verworpen" fill="#ef4444" stackId="a" />
          <Bar dataKey="ingetrokken" name="Ingetrokken" fill="#f59e0b" stackId="a" />
          <Bar dataKey="onbekend" name="Onbekend" fill="#475569" stackId="a" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
