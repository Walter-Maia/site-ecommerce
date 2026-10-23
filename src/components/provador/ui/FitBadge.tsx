import type { FitResult } from "@/lib/provador/contract";
import { FIT_LABEL_UI } from "@/lib/provador/outfit";

/** Selo de caimento (texto e tom vêm do motor). Não usar para o skate (prop). */
export function FitBadge({ fit, score = true }: { fit: FitResult; score?: boolean }) {
  const ui = FIT_LABEL_UI[fit.label];
  return (
    <span className="pv-fit" data-tone={ui.tone}>
      {ui.text}
      {score ? <span className="pv-fit__score"> · {fit.score}%</span> : null}
    </span>
  );
}

export function fitTone(fit: FitResult): "warn" | "ok" | "info" {
  return FIT_LABEL_UI[fit.label].tone;
}
