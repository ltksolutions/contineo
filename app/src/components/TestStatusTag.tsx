import type { TestDisplayStatus } from "@/lib/testView"

/** Pilulka stavu testu (rám TESTS): Pripravený · ⚠ Nedostatok otázok · Koncept · Vyradený. */
export default function TestStatusTag({ status, labels }: {
  status: TestDisplayStatus
  labels: { tagReady: string; tagShort: string; tagDraft: string; tagRetired: string }
}) {
  const map: Record<TestDisplayStatus, [string, string]> = {
    ready: ["tag tag--published", labels.tagReady],
    short: ["tag tag--warn", `⚠ ${labels.tagShort}`],
    draft: ["tag tag--draft", labels.tagDraft],
    retired: ["tag tag--archived", labels.tagRetired],
  }
  return <span className={map[status][0]}>{map[status][1]}</span>
}
