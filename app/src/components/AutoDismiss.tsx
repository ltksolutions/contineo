"use client"

/**
 * AutoDismiss — oznam s „Vrátiť", ktorý po piatich sekundách zmizne
 * (ASK-historia-otazok). Bez skriptu ostane, kým človek neodíde zo stránky;
 * tlačidlo vo vnútri je formulár a funguje aj tak.
 */

import { useEffect, useState, type ReactNode } from "react"

export default function AutoDismiss({ ms = 5000, children }: { ms?: number; children: ReactNode }) {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setShown(false), ms)
    return () => clearTimeout(timer)
  }, [ms])
  return shown ? <>{children}</> : null
}
