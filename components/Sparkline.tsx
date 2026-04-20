"use client";
import {
  CategoryScale,
  Chart as ChartJS,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
);

type Props = {
  values: number[]; // oldest → newest
  height?: number;
  className?: string;
};

const UP = "#ef4444";
const DOWN = "#10b981";
const FLAT = "#a3a3a3";

export function Sparkline({ values, height = 28, className }: Props) {
  if (values.length < 2) {
    return <div style={{ height }} className={className} />;
  }
  const first = values[0];
  const last = values[values.length - 1];
  const color = last < first ? DOWN : last > first ? UP : FLAT;

  return (
    <div style={{ height }} className={className ?? "w-full"}>
      <Line
        data={{
          labels: values.map((_, i) => i),
          datasets: [
            {
              data: values,
              borderColor: color,
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.3,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: { display: false },
            y: { display: false },
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          elements: { line: { capBezierPoints: true } },
        }}
      />
    </div>
  );
}
