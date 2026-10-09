/**
 * Ikona servera (návrh ORG-konektory, Q11): obrázok stiahnutý pri pripojení
 * (`data:` PNG/JPEG/WebP do 32 kB, nikdy SVG), inak prvé písmeno názvu.
 * Obrázok z cudzej adresy sa nikdy nenačíta priamo — prezradil by návštevu.
 */

import type { ConnectorView } from "@/lib/connectors"

export default function ServerIcon({ c, large = false }: { c: Pick<ConnectorView, "name" | "status" | "server">; large?: boolean }) {
  const cls = `sico${large ? " sico--lg" : ""}${c.status === "error" ? " is-bad" : ""}`
  const icon = c.server?.icon
  if (icon && /^data:image\/(png|jpeg|webp);base64,/.test(icon)) {
    // eslint-disable-next-line @next/next/no-img-element -- `data:` obrázok, optimalizácia Next tu nemá čo robiť
    return <span className={cls} aria-hidden="true"><img src={icon} alt="" /></span>
  }
  return <span className={cls} aria-hidden="true">{(c.name.trim()[0] ?? "?").toUpperCase()}</span>
}
