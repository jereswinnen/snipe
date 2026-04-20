"use client";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ScriptableContext,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatShortDate, formatDateTime, money } from "@/lib/format";

ChartJS.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
);

type Point = { t: string | Date; v: number };
type Series = { shop: string; points: Point[] };

const PALETTE: Array<{ hex: string; rgb: string }> = [
  { hex: "#10b981", rgb: "16,185,129" }, // emerald
  { hex: "#0284c7", rgb: "2,132,199" }, // sky
  { hex: "#a855f7", rgb: "168,85,247" }, // purple
  { hex: "#ea580c", rgb: "234,88,12" }, // orange
  { hex: "#db2777", rgb: "219,39,119" }, // pink
  { hex: "#d97706", rgb: "217,119,6" }, // amber
];
const MUTED = "#737373";

export function TrendChart({
  series,
  height = 160,
  className,
}: {
  series: Series[];
  height?: number;
  className?: string;
}) {
  const hasData = series.some((s) => s.points.length >= 2);
  if (!hasData) {
    return <div style={{ height }} className={className} />;
  }

  const single = series.length === 1;

  const datasets = series.map((s, i) => {
    const color = PALETTE[i % PALETTE.length];
    // Series with < 2 points can't render as a line, so surface each point
    // as a visible dot. Richer series keep clean zero-radius points.
    const sparse = s.points.length < 2;
    return {
      label: s.shop,
      data: s.points.map((p) => ({
        x: new Date(p.t).getTime(),
        y: p.v,
      })),
      borderColor: color.hex,
      borderWidth: 2,
      pointRadius: sparse ? 4 : 0,
      pointBackgroundColor: color.hex,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: color.hex,
      pointHoverBorderColor: "#fff",
      pointHoverBorderWidth: 2,
      tension: 0.3,
      spanGaps: true,
      fill: single,
      backgroundColor: single
        ? (ctx: ScriptableContext<"line">) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return `rgba(${color.rgb},0)`;
            const grad = c.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            );
            grad.addColorStop(0, `rgba(${color.rgb},0.22)`);
            grad.addColorStop(1, `rgba(${color.rgb},0)`);
            return grad;
          }
        : `rgba(${color.rgb},0)`,
    };
  });

  return (
    <div style={{ height }} className={className ?? "w-full"}>
      <Line
        data={{ datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          interaction: { mode: "nearest", axis: "x", intersect: false },
          scales: {
            x: {
              type: "linear",
              display: true,
              grid: { display: false },
              border: { display: false },
              ticks: {
                color: MUTED,
                font: { size: 10 },
                maxRotation: 0,
                autoSkipPadding: 24,
                callback: (v) => formatShortDate(new Date(Number(v))),
              },
            },
            y: {
              display: true,
              grid: { color: "rgba(0,0,0,0.05)" },
              border: { display: false },
              ticks: {
                color: MUTED,
                font: { size: 10 },
                callback: (v) => money(Number(v)),
              },
            },
          },
          plugins: {
            legend: single
              ? { display: false }
              : {
                  display: true,
                  position: "top",
                  align: "end",
                  labels: {
                    boxWidth: 8,
                    boxHeight: 8,
                    usePointStyle: true,
                    pointStyle: "circle",
                    color: MUTED,
                    font: { size: 11 },
                    padding: 12,
                  },
                },
            tooltip: {
              backgroundColor: "rgba(17,17,17,0.92)",
              padding: 10,
              cornerRadius: 10,
              displayColors: true,
              boxWidth: 8,
              boxHeight: 8,
              usePointStyle: true,
              titleFont: { size: 11, weight: 500 },
              bodyFont: { size: 13, weight: 600 },
              callbacks: {
                title: (items) => {
                  const x = items[0]?.parsed?.x;
                  return x ? formatDateTime(new Date(Number(x))) : "";
                },
                label: (item) => {
                  const shop = item.dataset.label ?? "";
                  return `${shop}  ${money(Number(item.parsed.y))}`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}
