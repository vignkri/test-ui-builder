import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
type Size = "sm" | "default" | "lg" | "icon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

/** shadcn/ui Button — variant × size, optional leading icon. Disabled → opacity 50%. */
export function Button({ variant = "default", size = "sm", icon, className = "", children, ...rest }: Props) {
  return (
    <button type="button" className={`button button-${variant} button-size-${size} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}
