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
  env: {
    APP_VERZIA: pkg.version,
    // Lokálne prázdne — lokálny beh nie je nasadenie, o ktorom sa niekto pýta.
    APP_REVIZIA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
  },
}

export default nextConfig
