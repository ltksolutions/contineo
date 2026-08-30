/**
 * verzia.ts — čo presne beží.
 *
 * Obe hodnoty sa vpisujú pri builde cez `next.config.mjs`, nie sa čítajú za
 * behu. Dôvod: `package.json` na serveri Vercelu v runtime nie je a
 * `process.env.npm_package_version` tam nikdy nie je vyplnené — číslo by
 * potom bolo prázdne práve tam, kde ho treba.
 *
 * Jediná pravda o čísle verzie je `app/package.json`. Tu sa neprepisuje.
 */

/** Číslo verzie z `package.json`, napr. `0.1.0`. */
export const VERSION = process.env.APP_VERZIA ?? "?"

/**
 * Prvých sedem znakov commitu, z ktorého nasadenie vzniklo. Lokálne je
 * prázdne — a to je v poriadku, lokálny beh nie je nasadenie, o ktorom by
 * sa niekto pýtal.
 */
export const REVISION = process.env.APP_REVIZIA ?? ""
