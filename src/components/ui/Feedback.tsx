import type { ReactNode } from "react";
import "./Feedback.css";

/** shadcn/ui Alert — default | destructive, plus the DER accent and secondary tones. */
export function Alert({
  variant = "default",
  icon,
  title,
  description,
  action,
}: {
  variant?: "default" | "destructive" | "accent" | "secondary";
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`alert alert-${variant}`} role={variant === "destructive" ? "alert" : "status"}>
      {icon && <span className="alert-icon">{icon}</span>}
      <div className="alert-body">
        <p className="alert-title">{title}</p>
        {description && <p className="alert-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** shadcn/ui Progress — tone picks the fill; value is 0..100. */
export function Progress({ value, tone = "default" }: { value: number; tone?: "default" | "export" | "import" | "muted" }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`progress progress-${tone}`} role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-indicator" style={{ width: `${clamped}%` }} />
    </div>
  );
}

/** shadcn/ui DialogContent — modal with a title, description, body and footer actions. */
export function Dialog({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 id="dialog-title" className="dialog-title">
          {title}
        </h2>
        {description && <p className="dialog-description">{description}</p>}
        {children}
        <div className="dialog-footer">{footer}</div>
      </div>
    </div>
  );
}
