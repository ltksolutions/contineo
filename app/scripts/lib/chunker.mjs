/**
 * chunker.mjs — presunuté do `src/lib/chunker.mjs`.
 *
 * Zostáva ako preberací bod pre skripty, ktoré ho importovali. Definícia je
 * jedna, v knižnici: odkedy sa dokumenty nahrávajú aj z obrazovky, dve kópie
 * pravidiel členenia by znamenali, že tá istá norma sa raz nareže inak — a
 * rozišli by sa presne pri novele, keď na tom najviac záleží.
 *
 * Kód sa pri presune **nezmenil ani o znak**; typy sú vedľa v `chunker.d.ts`.
 */
export {
  CIEL_MIN, CIEL_MAX, PREDVOLENY_PROFIL, vzoryPreProfil,
  odhadTokenov, ocisti, parsujStrukturu, chunkuj,
} from "../../src/lib/chunker.mjs"
