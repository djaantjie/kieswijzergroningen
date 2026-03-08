"use client";

import { useMemo } from "react";
import { Motie } from "../../lib/types";
import { CAT_ICOON } from "../../lib/data";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface Props {
  moties: Motie[];
}

const PIE_KLEUREN = [
  "#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706",
  "#dc2626", "#7c3aed", "#db2777", "#65a30d", "#ea580c",
  "#0284c7", "#6d28d9",
];

export default function CategorieChart({ moties }: Props) {
  const { pieData, barData } = useMemo(() => {
    const perCat: Record<string, { totaal: number; aangenomen: number }> = {};

    for (const m of moties) {
      if (!perCat[m.categorie]) perCat[m.categorie] = { totaal: 0, aangenomen: 0 };
      perCat[m.categorie].totaal++;
      if (m.status === "AANGENOMEN") perCat[m.categorie].aangenomen++;
    }

    const sorted = Object.entries(perCat).sort((a, b) => b[1].totaal - a[1].totaal);

    const pieData = sorted.map(([cat, { totaal }]) => ({
      name: (CAT_ICOON[cat] || "📌") + " " + cat.split(" & ")[0],
      fullName: cat,
      value: totaal,
    }));

    const barData = sorted.map(([cat, { totaal, aangenomen }]) => ({
      naam: (CAT_ICOON[cat] || "📌") + " " + cat.split(" & ")[0],
      fullName: cat,
      successRate: totaal > 0 ? Math.round((aangenomen / totaal) * 100) : 0,
      totaal,
    }));

    return { pieData, barData };
  }, [moties]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "1rem",
      }}
    >
      {/* Pie chart */}
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "1.25rem",
        }}
      >
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "1rem" }}>
          🥧 Moties per categorie
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_KLEUREN[i % PIE_KLEUREN.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#263348",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "0.8rem",
              }}
              formatter={(value, name) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.5rem" }}>
          {pieData.map((d, i) => (
            <span
              key={d.fullName}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.7rem",
                color: "#94a3b8",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: PIE_KLEUREN[i % PIE_KLEUREN.length],
                  flexShrink: 0,
                }}
              />
              {d.name} ({d.value})
            </span>
          ))}
        </div>
      </div>

      {/* Bar chart – success rate */}
      <div
        style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "1.25rem",
        }}
      >
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "1rem" }}>
          📊 Slagingspercentage per categorie
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ top: 0, right: 20, bottom: 0, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="naam"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              contentStyle={{
                background: "#263348",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "0.8rem",
              }}
              formatter={(value, _, props) => [
                `${value}% (${props.payload.totaal} moties)`,
                "Aangenomen",
              ]}
            />
            <Bar dataKey="successRate" fill="#22c55e" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
