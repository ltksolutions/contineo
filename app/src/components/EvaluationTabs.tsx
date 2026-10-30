/**
 * Podmenu sekcie Na posúdenie: Podnety · Štatistika (Ján 30. 10. 2026).
 * Obe stránky vidí len hodnotiteľ, takže podmenu nemá čo skrývať.
 */

import SectionTabs from "./SectionTabs"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export default function EvaluationTabs({ current, language }: { current: string; language?: UiLanguage }) {
  const t = dictionary(language).evaluation
  return (
    <SectionTabs
      label={t.tabsLabel}
      current={current}
      tabs={[{ href: "/evaluation", label: t.tabs.queue }, { href: "/evaluation/stats", label: t.tabs.stats }]}
    />
  )
}
