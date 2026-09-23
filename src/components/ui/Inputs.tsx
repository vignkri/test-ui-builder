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
