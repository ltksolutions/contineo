/**
 * csv.mjs — presunuté do `src/lib/csv.ts`.
 *
 * Zostáva ako preberací bod pre skripty, ktoré ho importovali. Definícia je
 * jedna, v knižnici: odkedy sa osoby importujú aj z obrazovky, dve kópie
 * čítania CSV by znamenali, že ten istý súbor sa raz naimportuje inak.
 */
export { parseCsv, parseLine, detectSeparator, normalizeHeader, toCsv } from "../../src/lib/csv.ts"
