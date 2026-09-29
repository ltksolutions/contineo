/**
 * SectionTiles — dlaždice sekcií v skupinách (SHELL-rozcestnik).
 *
 * Od 640 px nie je stále menu; sekcie sú tieto dlaždice na Prehľade. Na
 * telefóne ich tie isté ukazuje `/more` (Q4) — rovnaké poradie, názvy aj
 * popisy všade, takže sa človek nemusí učiť dve mapy portálu.
 *
 * Dlaždica nesie aj jednu vetu, čo v sekcii je: bežná osoba nevie, čo je
 * „Reťaz dôkazov", a názov sám jej to nepovie. Počet ako odznak len keď
 * niečo čaká — nula sa nekreslí (ten istý dôvod ako na lište).
 *
 * Serverový komponent, bez JavaScriptu — sú to len odkazy.
 */

import Link from "next/link"
import Icon from "./Icon"
import type { MoreGroupKey, NavItem, NavKey } from "@/lib/appNav"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export default function SectionTiles({
  groups,
  language,
  single = false,
}: {
  groups: { key: MoreGroupKey; items: NavItem[] }[]
  language?: UiLanguage
  /** Jeden stĺpec aj na širokej obrazovke — `/more` je zoznam na palec. */
  single?: boolean
}) {
  const t = dictionary(language).nav
  const title: Record<MoreGroupKey, string> = {
    tasks: t.groupTasks,
    organisation: t.groupOrganisation,
    management: t.groupManagement,
  }
  const desc = t.desc as Partial<Record<NavKey, string>>

  return (
    <>
      {groups.map(group => (
        <section key={group.key} className="section-group" aria-labelledby={group.key}>
          {/* `id` je kotva pre krok skupiny v ceste (`/#management`). */}
          <h2 className="section-group-title" id={group.key}>{title[group.key]}</h2>
          <div className={single ? "section-tiles section-tiles--single" : "section-tiles"}>
            {group.items.map(o => {
              const n = typeof o.count === "number" && o.count > 0 ? o.count : 0
              return (
                <Link key={o.href} href={o.href} className="section-tile">
                  <span className="section-tile-icon"><Icon name={o.key} size={20} /></span>
                  <span className="section-tile-name">{t[o.key]}</span>
                  {desc[o.key] && <span className="section-tile-desc">{desc[o.key]}</span>}
                  {n > 0 && <span className="section-tile-count" aria-label={t.waiting(n)}>{n}</span>}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
