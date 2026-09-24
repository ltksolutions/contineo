/**
 * FlowSteps — krokovník postupu znenia (rám KNIZNICA-postup-znenia, ADR-014).
 *
 * Zoznam, nie obrázok: čítačka prečíta štyri kroky v poradí a pri aktuálnom
 * `aria-current="step"`. Na telefóne sa popisy stavu skryjú (CSS), názov
 * a číslo zostanú.
 */

import type { StepState } from "@/lib/versionFlow"

export default function FlowSteps({
  states,
  names,
  subs,
  label,
}: {
  states: StepState[]
  names: string[]
  subs: string[]
  label: string
}) {
  return (
    <ol className="flow-steps" aria-label={label}>
      {names.map((name, i) => {
        const state = states[i] ?? "todo"
        return (
          <li key={name} className={`flow-step is-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="flow-step-dot" aria-hidden="true">
              {state === "done" ? "✓" : state === "rejected" ? "✕" : i + 1}
            </span>
            <span className="flow-step-name">{name}</span>
            <span className="flow-step-state">{subs[i] || "—"}</span>
          </li>
        )
      })}
    </ol>
  )
}
