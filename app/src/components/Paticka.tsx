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

import { ZnakContineo, ZnakGitHub } from "./ZnakContineo"
import { REVIZIA, VERZIA } from "@/lib/verzia"

/**
 * Odkazy von majú `rel="noreferrer"` zámerne: bez neho by sa cieľová stránka
 * dozvedela presnú adresu, z ktorej sa na ňu kliklo — teda internú doménu
 * zväzu. Nie je to tajomstvo, ale posielať ju cudzím serverom netreba.
 */
const VON = { target: "_blank", rel: "noreferrer" } as const

export default function Paticka() {
  return (
    <footer className="paticka">
      <div className="obal paticka-obsah">
        <p className="paticka-blok">
          <span className="tichy">Systém beží na aplikácii</span>
          <a className="paticka-odkaz" href="https://contineo.app" {...VON}>
            <ZnakContineo size={16} />
            Contineo
          </a>
        </p>

        <a
          className="paticka-odkaz"
          href="https://github.com/ltksolutions/contineo"
          {...VON}
        >
          <ZnakGitHub />
          Zdrojový kód
        </a>

        <p className="tichy paticka-verzia">
          verzia {VERZIA}
          {REVIZIA && <> · {REVIZIA}</>}
        </p>
      </div>
    </footer>
  )
}
