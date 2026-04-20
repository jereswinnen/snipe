"use client";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
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
);

type Point = { t: string | Date; v: number };

const STROKE = "#10b981";
const STROKE_RGB = "16,185,129";
const MUTED = "#737373";

export function TrendChart({
  points,
  height = 140,
  className,
}: {
  points: Point[];
  height?: number;
  className?: string;
}) {
  if (points.length < 2) {
    return <div style={{ height }} className={className} />;
  }
  const labels = points.map((p) => new Date(p.t));
  const values = points.map((p) => p.v);

  return (
    <div style={{ height }} className={className ?? "w-full"}>
      <Line
        data={{
          labels: labels.map((d) => formatShortDate(d)),
          datasets: [
            {
              data: values,
              borderColor: STROKE,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: STROKE,
              pointHoverBorderColor: "#fff",
              pointHoverBorderWidth: 2,
              tension: 0.3,
              fill: true,
              backgroundColor: (ctx: ScriptableContext<"line">) => {
                const { ctx: c, chartArea } = ctx.chart;
                if (!chartArea) return `rgba(${STROKE_RGB},0)`;
                const grad = c.createLinearGradient(
                  0,
                  chartArea.top,
                  0,
                  chartArea.bottom,
                );
                grad.addColorStop(0, `rgba(${STROKE_RGB},0.22)`);
                grad.addColorStop(1, `rgba(${STROKE_RGB},0)`);
                return grad;
              },
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          interaction: { mode: "index", intersect: false },
          scales: {
            x: {
              display: true,
              grid: { display: false },
              border: { display: false },
              ticks: {
                color: MUTED,
                font: { size: 10 },
                maxRotation: 0,
                autoSkipPadding: 24,
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
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(17,17,17,0.92)",
              padding: 10,
              cornerRadius: 10,
              displayColors: false,
              titleFont: { size: 11, weight: 500 },
              bodyFont: { size: 13, weight: 600 },
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  return formatDateTime(labels[idx]);
                },
                label: (item) => money(Number(item.parsed.y)),
              },
            },
          },
        }}
      />
    </div>
  );
}
