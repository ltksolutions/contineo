"use client"

/**
 * ScrollToCited — po rozbalení náhľadu článku posunie jeho okno na prvý
 * citovaný odsek (Ján 11. 10. 2026). Posúva sa len okno náhľadu, nie
 * stránka — rozhodovanie pod ním ostáva na mieste. Bez JavaScriptu sa
 * náhľad otvorí na začiatku článku, zvýraznenie ostáva.
 */

import { useEffect, useRef } from "react"

export default function ScrollToCited() {
  const mark = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const details = mark.current?.closest("details")
    if (!details) return
    const onToggle = () => {
      if (!details.open) return
      const box = details.querySelector<HTMLElement>(".norm-preview-body")
      const cited = box?.querySelector<HTMLElement>(".is-cited")
      if (!box || !cited) return
      box.scrollTop = cited.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 12
    }
    details.addEventListener("toggle", onToggle)
    return () => details.removeEventListener("toggle", onToggle)
  }, [])
  return <span ref={mark} hidden />
}
