import { readFileSync } from "node:fs"

/**
 * Verzia a revízia sa vpisujú do buildu.
 *
 * `package.json` sa na serveri Vercelu za behu prečítať nedá a
 * `npm_package_version` tam nie je vyplnené — jediné spoľahlivé miesto je
 * teda build. Jediná pravda o čísle zostáva `package.json`; tu sa len
 * prenáša ďalej, nikde sa neduplikuje.
 */
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /*
   * `pdfjs-dist` sa **nezabalí** do serverless zväzku.
   *
   * Knižnica si za behu doťahuje vlastný pracovný modul (`pdf.worker.mjs`)
   * dynamickým importom vedľa seba. Zabalená do `.next/server/chunks/` ho
   * tam nenájde a prevod PDF spadne na
   * „Setting up fake worker failed" — v produkcii, nie pri builde, a teda
   * až vtedy, keď niekto nahráva normu. `useWorkerFetch: false` v
   * `conversion.ts` to nerieši: aj „fake worker" sa importuje.
   *
   * Takto sa načíta z `node_modules`, kde `pdf.worker.mjs` leží vedľa
   * `pdf.mjs`. Zistené nácvikom na ostrom PDF 2026-09-14; dovtedy sa všetky
   * dokumenty nahrávali skriptom, takže cesta cez rozhranie nebola nikdy
   * prejdená.
   */
  serverExternalPackages: ["pdfjs-dist"],
  env: {
    APP_VERZIA: pkg.version,
    // Lokálne prázdne — lokálny beh nie je nasadenie, o ktorom sa niekto pýta.
    APP_REVIZIA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
  },
}

export default nextConfig
