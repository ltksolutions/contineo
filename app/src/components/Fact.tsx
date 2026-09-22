/**
 * Jedno číslo s popiskom — dlaždica do `.admin-data`.
 *
 * Zdieľaná medzi prehľadom organizácií a detailom jednej: to isté číslo má
 * na oboch obrazovkách vyzerať rovnako, inak si ich nikto nespojí. `muted`
 * je pre nulu — nula je platná hodnota, nie chyba, tak sa len stlmí.
 */
export default function Fact({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div>
      <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>{label}</div>
      <div style={{ fontSize: "var(--fs-lead)", fontWeight: 600, color: muted ? "var(--muted)" : undefined }}>
        {value}
      </div>
    </div>
  )
}
