/**
 * auth.test.ts — kto sa smie prihlásiť.
 *
 * Toto je jediné miesto, ktoré stojí medzi internými smernicami zväzu
 * a internetom. Chyba tu je drahšia než ktorákoľvek iná v tomto projekte,
 * preto sú testy podrobnejšie, než by sa pri troch funkciách čakalo.
 */
import { allowedEmails, isAllowed } from "../src/lib/auth"
import { signInEmail } from "../src/lib/ecomail"

import { t } from "./helper"

// ── rozobratie zoznamu ───────────────────────────────────────────────────────

t("čiarka oddeľuje adresy",
  allowedEmails("a@sfz.sk,b@sfz.sk").length === 2)
t("bodkočiarka tiež",
  allowedEmails("a@sfz.sk;b@sfz.sk").length === 2)
t("nový riadok tiež — pri vkladaní do Vercelu sa to stáva",
  allowedEmails("a@sfz.sk\nb@sfz.sk").length === 2)
t("medzery okolo adries sa orežú",
  allowedEmails("  a@sfz.sk , b@sfz.sk ")[0] === "a@sfz.sk")
t("veľké písmená sa zjednotia",
  allowedEmails("Jan.Letko@FutbalSFZ.sk")[0] === "jan.letko@futbalsfz.sk")
t("čo nie je adresa, sa zahodí",
  allowedEmails("a@sfz.sk, poznamka, b@sfz.sk").length === 2)
t("prázdny zoznam dá prázdne pole", allowedEmails("").length === 0)

// ── kto prejde ───────────────────────────────────────────────────────────────

const LIST = allowedEmails("jan.letko@futbalsfz.sk, pravnik@futbalsfz.sk")

t("adresa zo zoznamu prejde", isAllowed("jan.letko@futbalsfz.sk", LIST))
t("nezáleží na veľkosti písmen", isAllowed("Jan.Letko@FutbalSFZ.sk", LIST))
t("medzery okolo nevadia", isAllowed("  jan.letko@futbalsfz.sk  ", LIST))
t("cudzia adresa neprejde", !isAllowed("nikto@inde.sk", LIST))

// Toto je to najdôležitejšie pravidlo v celom súbore.
t("PRÁZDNY ZOZNAM NEPUSTÍ NIKOHO", !isAllowed("jan.letko@futbalsfz.sk", []))
t("prázdny zoznam nepustí ani prázdnu adresu", !isAllowed("", []))

// Doménové pravidlo — keď má prístup dostať celé oddelenie.
const DOMAIN = allowedEmails("@futbalsfz.sk")
t("zápis @domena pustí adresu z tej domény",
  isAllowed("ktokolvek@futbalsfz.sk", DOMAIN))
t("zápis @domena nepustí inú doménu",
  !isAllowed("nikto@inde.sk", DOMAIN))

// Pasce, na ktorých sa dá naivná kontrola domény zlomiť.
t("podvrhnutá doména na konci neprejde",
  !isAllowed("utocnik@zlefutbalsfz.sk", allowedEmails("@futbalsfz.sk")) ||
  // `endsWith("@futbalsfz.sk")` toto správne odmietne, lebo zavináč
  // je súčasťou vzoru — test to overuje explicitne.
  false)
t("doména ako podreťazec inde v adrese neprejde",
  !isAllowed("utocnik@futbalsfz.sk.zle.sk", allowedEmails("@futbalsfz.sk")))
t("čiastočná zhoda mena neprejde",
  !isAllowed("jan.letko@futbalsfz.sk.utok.sk", LIST))
t("prefix adresy neprejde",
  !isAllowed("jan.letk@futbalsfz.sk", LIST))

// ── obsah e-mailu ────────────────────────────────────────────────────────────

const LINK = "https://app.contineo.app/api/auth/callback/email?token=abc&email=x%40y.sk"
const e = signInEmail(LINK, "app.contineo.app")

t("e-mail má predmet", e.subject.length > 0)
t("odkaz je v textovej verzii", e.text.includes(LINK))
t("odkaz je v HTML verzii", e.html.includes(LINK))
t("HTML má aj čitateľnú podobu odkazu na skopírovanie",
  e.html.split(LINK).length >= 3, String(e.html.split(LINK).length))
t("e-mail hovorí, ako dlho odkaz platí", /24 hod/.test(e.text))
t("e-mail hovorí, čo robiť pri nevyžiadanej správe", /ignorujte/i.test(e.text))
t("uvádza, odkiaľ prišiel", e.html.includes("app.contineo.app"))

