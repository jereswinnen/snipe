type Props = {
  values: number[];           // oldest → newest
  width?: number;
  height?: number;
  className?: string;
};

export function Sparkline({ values, width = 120, height = 28, className }: Props) {
  if (values.length < 2) {
    return <svg width={width} height={height} className={className} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const stroke = last < first ? "#10b981" : last > first ? "#ef4444" : "#737373";
  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={points} />
    </svg>
  );
}
