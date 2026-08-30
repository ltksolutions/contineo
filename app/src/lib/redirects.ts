/**
 * presmerovanie.ts — rozoznanie `redirect()` od skutočnej chyby.
 *
 * `redirect()` v Nexte **vyhadzuje výnimku**; tak sa presmerovanie dostane
 * von zo serverovej akcie. Keď je volanie na ceste úspechu vnútri `try`, jeho
 * vlastný `catch` ho zachytí a ohlási ako neúspech.
 *
 * Nie je to teoretická nepríjemnosť. Presne to sa stalo pri zakladaní
 * oddelenia: záznam vznikol, audit sa zapísal — a človek videl „Zmenu sa
 * nepodarilo uložiť". Je to najhorší druh chyby, lebo hlási neúspech tam, kde
 * bol úspech, takže sa akcia opakuje a vzniknú duplicity.
 *
 * Preto je to **jedna funkcia na jednom mieste** a nie `"digest" in e`
 * rozpísané v každej akcii zvlášť. Voľná kontrola by navyše zožrala aj
 * `notFound()`, ktorý nesie `digest` tiež — a stránka by namiesto „nenájdené"
 * ukázala chybu zápisu.
 */

/** Predpona, ktorou Next označuje výnimku z `redirect()`. */
const PREFIX = "NEXT_REDIRECT"

export function isRedirect(e: unknown): boolean {
  if (!e || typeof e !== "object" || !("digest" in e)) return false
  const digest = (e as { digest?: unknown }).digest
  return typeof digest === "string" && digest.startsWith(PREFIX)
}
