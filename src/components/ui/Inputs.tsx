import type { InputHTMLAttributes, ReactNode } from "react";
import "./Inputs.css";

/** shadcn/ui Input — optional leading icon; focus draws the ring. */
export function Input({ icon, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }) {
  return (
    <label className={`input ${className}`}>
      {icon}
      <input className="input-field" {...rest} />
    </label>
  );
}

/** shadcn/ui ToggleGroup (type="single") — segmented control, e.g. the price-zone switch. */
export function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="toggle-group" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`toggle-group-item ${o.value === value ? "toggle-group-item-on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** shadcn/ui Toggle as a filter chip — label plus an optional count. */
export function Toggle({
  pressed,
  onPressedChange,
  count,
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`toggle ${pressed ? "toggle-pressed" : ""}`}
      onClick={() => onPressedChange(!pressed)}
    >
      <span className="toggle-label">{children}</span>
      {count !== undefined && <span className="toggle-count">{count}</span>}
    </button>
  );
}
