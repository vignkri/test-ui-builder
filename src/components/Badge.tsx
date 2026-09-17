import type { ReactNode } from "react";
import "./Badge.css";

type Tone = "green" | "blue" | "amber" | "red" | "slate";

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
