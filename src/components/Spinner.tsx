export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="spinner-wrap">{label}</div>;
}
