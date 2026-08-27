/**
 * auth.test.ts — kto sa smie prihlásiť.
 *
 * Toto je jediné miesto, ktoré stojí medzi internými smernicami zväzu
 * a internetom. Chyba tu je drahšia než ktorákoľvek iná v tomto projekte,
 * preto sú testy podrobnejšie, než by sa pri troch funkciách čakalo.
 */
import { povoleneEmaily, jePovoleny } from "../src/lib/auth"
import { prihlasovaciEmail } from "../src/lib/ecomail"

import { t } from "./pomocnik"

// ── rozobratie zoznamu ───────────────────────────────────────────────────────

t("čiarka oddeľuje adresy",
  povoleneEmaily("a@sfz.sk,b@sfz.sk").length === 2)
t("bodkočiarka tiež",
  povoleneEmaily("a@sfz.sk;b@sfz.sk").length === 2)
t("nový riadok tiež — pri vkladaní do Vercelu sa to stáva",
  povoleneEmaily("a@sfz.sk\nb@sfz.sk").length === 2)
t("medzery okolo adries sa orežú",
  povoleneEmaily("  a@sfz.sk , b@sfz.sk ")[0] === "a@sfz.sk")
t("veľké písmená sa zjednotia",
  povoleneEmaily("Jan.Letko@FutbalSFZ.sk")[0] === "jan.letko@futbalsfz.sk")
t("čo nie je adresa, sa zahodí",
  povoleneEmaily("a@sfz.sk, poznamka, b@sfz.sk").length === 2)
t("prázdny zoznam dá prázdne pole", povoleneEmaily("").length === 0)

// ── kto prejde ───────────────────────────────────────────────────────────────

const ZOZNAM = povoleneEmaily("jan.letko@futbalsfz.sk, pravnik@futbalsfz.sk")

t("adresa zo zoznamu prejde", jePovoleny("jan.letko@futbalsfz.sk", ZOZNAM))
t("nezáleží na veľkosti písmen", jePovoleny("Jan.Letko@FutbalSFZ.sk", ZOZNAM))
t("medzery okolo nevadia", jePovoleny("  jan.letko@futbalsfz.sk  ", ZOZNAM))
t("cudzia adresa neprejde", !jePovoleny("nikto@inde.sk", ZOZNAM))

// Toto je to najdôležitejšie pravidlo v celom súbore.
t("PRÁZDNY ZOZNAM NEPUSTÍ NIKOHO", !jePovoleny("jan.letko@futbalsfz.sk", []))
t("prázdny zoznam nepustí ani prázdnu adresu", !jePovoleny("", []))

// Doménové pravidlo — keď má prístup dostať celé oddelenie.
const DOMENA = povoleneEmaily("@futbalsfz.sk")
t("zápis @domena pustí adresu z tej domény",
  jePovoleny("ktokolvek@futbalsfz.sk", DOMENA))
t("zápis @domena nepustí inú doménu",
  !jePovoleny("nikto@inde.sk", DOMENA))

// Pasce, na ktorých sa dá naivná kontrola domény zlomiť.
t("podvrhnutá doména na konci neprejde",
  !jePovoleny("utocnik@zlefutbalsfz.sk", povoleneEmaily("@futbalsfz.sk")) ||
  // `endsWith("@futbalsfz.sk")` toto správne odmietne, lebo zavináč
  // je súčasťou vzoru — test to overuje explicitne.
  false)
t("doména ako podreťazec inde v adrese neprejde",
  !jePovoleny("utocnik@futbalsfz.sk.zle.sk", povoleneEmaily("@futbalsfz.sk")))
t("čiastočná zhoda mena neprejde",
  !jePovoleny("jan.letko@futbalsfz.sk.utok.sk", ZOZNAM))
t("prefix adresy neprejde",
  !jePovoleny("jan.letk@futbalsfz.sk", ZOZNAM))

// ── obsah e-mailu ────────────────────────────────────────────────────────────

const ODKAZ = "https://app.contineo.app/api/auth/callback/email?token=abc&email=x%40y.sk"
const e = prihlasovaciEmail(ODKAZ, "app.contineo.app")

t("e-mail má predmet", e.predmet.length > 0)
t("odkaz je v textovej verzii", e.text.includes(ODKAZ))
t("odkaz je v HTML verzii", e.html.includes(ODKAZ))
t("HTML má aj čitateľnú podobu odkazu na skopírovanie",
  e.html.split(ODKAZ).length >= 3, String(e.html.split(ODKAZ).length))
t("e-mail hovorí, ako dlho odkaz platí", /24 hod/.test(e.text))
t("e-mail hovorí, čo robiť pri nevyžiadanej správe", /ignorujte/i.test(e.text))
t("uvádza, odkiaľ prišiel", e.html.includes("app.contineo.app"))

