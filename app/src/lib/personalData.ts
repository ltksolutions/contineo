/**
 * personalData.ts — čistenie osobných údajov z textu pravidlom (ADR-030).
 *
 * Pôvodne v `faqMining.ts`; po zrušení FAQ (ADR-034, D220) ho používa
 * ťažba histórie helpdesku a analýza histórie.
 */

/**
 * Osobné údaje, ktoré sa dajú chytiť pravidlom: adresy, telefóny, čísla od
 * 6 číslic (registračné čísla, faktúry), rodné čísla, IBAN. Mená pravidlo nechytí — o tie sa
 * stará pokyn modelu a potom správca obsahu pri schvaľovaní.
 */
export function scrubPersonalData(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    // Rodné číslo (6/3–4) a telefón (aspoň 9 číslic s medzerami či pomlčkami);
    // „čl. 12“ ani „sezóna 2026/2027“ sa nechytia.
    .replace(/\b\d{6}\/\d{3,4}\b/g, "[číslo]")
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, m => (m.replace(/\D/g, "").length >= 9 ? "[číslo]" : m))
    // Samostatné číslo od 6 číslic — registračné číslo ISSF, číslo faktúry,
    // variabilný symbol (podklad pre DPO, kap. 2; schválené 9. 10. 2026).
    .replace(/\b\d{6,}\b/g, "[číslo]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}\b/g, "[účet]")
    .replace(/https?:\/\/\S+/g, "[odkaz]")
}
