/**
 * Čas správy v Kuriérovi — deň a čas v čase organizácie.
 *
 * `formatDate()` z i18n dáva len deň; pri rozhovore, kde môže prísť päť
 * správ za hodinu, je čas to, čo človek hľadá. Zóna je tá istá ako pri
 * odpovediach asistenta (`SEARCH_TIME_ZONE`): server beží v UTC a bez zóny
 * by správa z 15:00 vyzerala ako z 13:00.
 */

import { SEARCH_TIME_ZONE } from "@/lib/versionContext"
import type { UiLanguage } from "@/lib/i18n"

export function messageTime(d: Date, language: UiLanguage): string {
  return d.toLocaleString(language === "en" ? "en-GB" : language, {
    timeZone: SEARCH_TIME_ZONE,
    day: "numeric", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}
