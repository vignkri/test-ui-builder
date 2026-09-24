import { useState } from "react";
import type { Resource } from "../../types";
import { ACK_BOUND_MS, activeSetpoint, formatDuration, formatKw } from "../../mqtt/derive";
import { SETPOINT_HOLD_MS, releasePreview, sendRelease, sendSetpoint } from "../../mqtt/fleet";
import { Button } from "../ui/Button";
import { CodeBlock } from "../ui/DataDisplay";
import { Dialog } from "../ui/Feedback";

/** 08c — confirm a Release, and make the difference from "Setpoint 0 kW" explicit. */
export function ReleaseDialog({ resource: r, onClose }: { resource: Resource; onClose: () => void }) {
  const [choice, setChoice] = useState<"release" | "zero">("release");
  // Stamped once when the dialog opens; the real message is stamped again on send.
  const [openedAt] = useState(() => Date.now());
  const heldCommand = activeSetpoint(r.command, openedAt);
  const held = heldCommand ? formatKw(heldCommand.setpointKw) : null;
  const preview =
    choice === "release"
      ? releasePreview(r, openedAt)
      : { resourceId: r.id, activation: "Setpoint", setpoint: 0, unit: "kW", endsAt: openedAt + SETPOINT_HOLD_MS, serverTimestamp: openedAt };

  const send = () => {
    const ok = choice === "release" ? sendRelease(r) : sendSetpoint(r, 0);
    if (ok) onClose();
  };

  return (
    <Dialog
      title={`Release ${r.id}?`}
      description={
        held
          ? `The resource returns to its own control logic and the current setpoint of ${held} is no longer held.`
          : "The resource returns to its own control logic."
      }
      onClose={onClose}
      footer={
        <>
          <span className="dialog-footnote">Expect acknowledgement within {formatDuration(ACK_BOUND_MS)}</span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} autoFocus>
            {choice === "release" ? "Send Release" : "Send Setpoint 0 kW"}
          </Button>
        </>
      }
    >
      <div className="release-options" role="radiogroup" aria-label="Command">
        <button
          type="button"
          role="radio"
          aria-checked={choice === "release"}
          className={`release-option ${choice === "release" ? "release-option-on" : ""}`}
          onClick={() => setChoice("release")}
        >
          <span className="release-option-title">Release</span>
          <span className="release-option-text">activation: "Release" — no setpoint, no endsAt. Back to own control.</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={choice === "zero"}
          className={`release-option ${choice === "zero" ? "release-option-on" : ""}`}
          onClick={() => setChoice("zero")}
        >
          <span className="release-option-title">Setpoint 0 kW</span>
          <span className="release-option-text">Holds zero power. Stays under platform control until released.</span>
        </button>
      </div>
      <CodeBlock topic={`→ v2/activation/${r.id}`} code={preview} />
    </Dialog>
  );
}
