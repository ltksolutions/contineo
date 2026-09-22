/**
 * Pätička — kto systém dodáva a ktorá verzia práve beží.
 *
 * Prečo to tu má byť: portál nesie značku organizácie, nie dodávateľa (a to
 * je správne — nad záväzným potvrdením smernice nemá stáť cudzia značka).
 * Niekde sa to ale povedať musí, inak človek, ktorý má s aplikáciou problém,
 * nevie ani to, ako sa volá. Pätička je na to presne to miesto: nikoho neruší
 * a kto ju hľadá, nájde ju.
 *
 * Číslo verzie tu nie je ozdoba. Keď niekto napíše „nefunguje mi to",
 * prvá otázka je „čo presne ti beží" — a bez tohto sa to nedá zistiť inak
 * než hádaním.
 */

import { ContineoMark, GitHubMark } from "./ContineoMark"
import { REVISION, VERSION } from "@/lib/appVersion"
import { dictionary, type UiLanguage } from "@/lib/i18n"

/**
 * Odkazy von majú `rel="noreferrer"` zámerne: bez neho by sa cieľová stránka
 * dozvedela presnú adresu, z ktorej sa na ňu kliklo — teda internú doménu
 * zväzu. Nie je to tajomstvo, ale posielať ju cudzím serverom netreba.
 */
const EXTERNAL = { target: "_blank", rel: "noreferrer" } as const

export default function Footer({ language }: { language?: UiLanguage }) {
  const t = dictionary(language)
  return (
    <footer className="footer">
      <div className="wrap--shell footer-inner">
        <p className="footer-block">
          <span className="quiet">{t.footer.runsOn}</span>
          <a className="footer-link" href="https://contineo.app" {...EXTERNAL}>
            {/*
              20 px a `--muted` (`ZAKLAD.md`, odchýlka B). Do 22. 9. 2026 tu
              bolo 16 px — v tej veľkosti sa značka nedá odlíšiť od lupy.
              Tu nie je ikonou v poli, ale logom vedľa vlastného názvu, takže
              zámena nehrozí; 28 px z hlavičky by bolo vedľa 13 px textu
              priveľa. Tlmená farba drží dôraz na slove, nie na značke.
            */}
            <span className="footer-mark" aria-hidden="true">
              <ContineoMark size={20} />
            </span>
            Contineo
          </a>
        </p>

        <a
          className="footer-link"
          href="https://github.com/ltksolutions/contineo"
          {...EXTERNAL}
        >
          <GitHubMark />
          {t.footer.sourceCode}
        </a>

        <p className="quiet footer-version">
          verzia {VERSION}
          {REVISION && <> · {REVISION}</>}
        </p>
      </div>
    </footer>
  )
}
