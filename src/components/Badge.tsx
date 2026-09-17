import "./Badge.css";

type Tone = "green" | "blue" | "amber" | "red" | "slate";

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
