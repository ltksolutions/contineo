"use client"

/** „Kopírovať odkaz" — bez JavaScriptu ostane odkaz ako text na označenie. */

import { useState, useSyncExternalStore } from "react"

const noop = () => () => {}

export default function CopyLink({ value, label, done }: { value: string; label: string; done: string }) {
  const js = useSyncExternalStore(noop, () => Boolean(navigator.clipboard), () => false)
  const [copied, setCopied] = useState(false)
  if (!js) return null
  return (
    <button type="button" className="button button--quiet" onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}>
      {copied ? `✓ ${done}` : label}
    </button>
  )
}
