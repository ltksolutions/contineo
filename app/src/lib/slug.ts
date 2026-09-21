/**
 * Kľúč dokumentu z názvu (ADR-010).
 *
 * Malé písmená bez diakritiky, medzery a interpunkcia na podčiarkovník:
 * „Pracovný poriadok SFZ" → `pracovny_poriadok_sfz`. Tvar sedí
 * s `KEY_PATTERN` (`codelists.ts`), takže čo tu vznikne, server prijme.
 *
 * Čistá funkcia bez závislostí zámerne — volá ju `checkMetadata()` na
 * serveri aj náhľad vo formulári v prehliadači, a obe strany musia dôjsť
 * k tomu istému kľúču. Keby existovali dve kópie, raz sa rozídu.
 */
export function slugifyKey(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
}
