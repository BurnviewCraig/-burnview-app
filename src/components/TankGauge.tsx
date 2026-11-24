export function TankGauge({ pct, size }: { pct: number; size?: "small" }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={`tm-gauge${size === "small" ? " small" : ""}`} style={{ ["--tm-pct" as string]: clamped }}>
      <span className="tm-gauge-value">{clamped.toFixed(0)}%</span>
    </div>
  );
}
