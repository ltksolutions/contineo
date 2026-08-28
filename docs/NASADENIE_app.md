# Nasadenie testovacieho rozhrania

> Aplikácia pre právnikov (`app/`), oddelená od marketingového webu (`web/`).
> Vercel projekt: **contineo-app** · tím `ltksolutions-projects`

---

## Stav

| Vec | Stav |
|---|---|
| Vercel projekt | ✅ `contineo-app`, root directory `app` |
| Nasadenie | ✅ https://contineo-app.vercel.app |
| Ochrana prihlásením | ✅ overené — `/` presmeruje, `/api/chat` vráti 401 |
| Vlastná doména `app.contineo.app` | ✅ beží |
| Prístup do Atlasu z Vercelu | ✅ overené — adaptér číta z databázy |
| Zoznam pozvaných | ✅ overené — cudzia adresa dostane `AccessDenied` |
| Odosielanie e-mailov | ✅ overené — odkaz dorazil |
| Prihlásenie celkovo | ✅ povolená adresa dostane odkaz, cudzia `AccessDenied` |

---

## 0. Nasadenie beží automaticky z Gitu (od 2026-08-28)

Push do vetvy `main` na GitHube spustí produkčné nasadenie sám. Nič sa ručne
nespúšťa.

| Vec | Hodnota |
|---|---|
| Repozitár | `ltksolutions/contineo` |
| Produkčná vetva | `main` |
| Root directory | `app` |
| Projekt | `contineo-app` (tím `ltksolutions-projects`) |

Z toho istého repozitára sa nasadzuje aj marketingový web — projekt `contineo`
s root directory `web`. Jeden push teda spustí **dve** nezávislé nasadenia,
každé zo svojho podadresára. Ani jedno z nich nemá nastavený *Ignored Build
Step*, takže sa prestavia obe aj vtedy, keď sa zmenili len dokumenty v `docs/`.
Je to zbytočná práca navyše, nie chyba; ak by build minúty začali prekážať, dá
sa v nastaveniach projektu doplniť `git diff --quiet HEAD^ HEAD -- .`, čo build
preskočí, keď sa v root directory nič nezmenilo.

### Prečo to takto stojí v dokumentácii

Do 2026-08-28 projekt `contineo-app` napojený nebol a nikto si to nevšimol:
posledné nasadenie bolo staré 31 dní, hoci v repozitári medzitým pribudlo
desať commitov. Kód bol hotový, testy prechádzali, živá aplikácia o ňom
nevedela. Preto je stav napojenia vedený tu, a nie len v nastaveniach Vercelu.

### Ručné nasadenie, keď treba

Stále funguje a hodí sa na overenie zmeny bez commitu:

```bash
cd ~/Documents/GitHub/contineo/app
vercel deploy --prod --yes
```

Build trvá rádovo pol minúty. Predchádzajúce nasadenia zostávajú dostupné,
takže návrat späť je `vercel rollback <url>`.

---

## 0b. `intranet.futbalsfz.sk` (2026-08-28)

Adresa onboardingového portálu SFZ. Na Websupporte:

| Typ | Názov | Hodnota |
|---|---|---|
| `CNAME` | `intranet` | `75b9ff58792d32ba.vercel-dns-016.com` |

Vercel dnes odporúča tento projektový cieľ; `cname.vercel-dns.com` uvádza ako
druhú možnosť a fungujú obe.

**Pôvodne sa uvažovalo o `internal.futbalsfz.sk` — tá je obsadená.** Vedie
`CNAME` na `sportnet.online` (109.74.154.242) a prepnutie by odstavilo to, čo
tam beží. Preto `intranet`, nie `internal`; kto v starších zápisoch narazí na
`internal.futbalsfz.sk`, číta neplatný stav.

Nezabudnúť: **doména musí byť aj v kolekcii `tenants`**, inak na nej portál nič
neukáže ani po správnom DNS — neznámy hostiteľ je zakázaný (D29). Už tam je:

```bash
cd ~/Documents/GitHub/contineo/app
node scripts/tenant_set.mjs --stav
```

Sú to zámerne dve nezávislé miesta. Preklep v jednom z nich nikoho nepustí dnu,
namiesto toho, aby ho pustil k cudziemu obsahu.

### Doména tenanta žije na troch miestach

Otázka, ktorá príde pri každom ďalšom tenantovi: *stačí CNAME?* Nestačí —
a „Redirect" vo Verceli je niečo iné, než to znie.

| Kde | Čo tam patrí | Čo bez toho nefunguje |
|---|---|---|
| **DNS** (pri SFZ Websupport) | `CNAME intranet → cname.vercel-dns.com` | prevádzka sa k Vercelu vôbec nedostane |
| **Vercel → projekt `contineo-app` → Domains** | `intranet.futbalsfz.sk` | Vercel požiadavku dostane, ale nevie, ktorému projektu patrí — a nevystaví certifikát, takže padne aj HTTPS |
| **Kolekcia `tenants`** | doména v `hostnames` | portál odpovie `404` (D29) |

**Nie „Redirect".** Presmerovanie vo Verceli znamená `301` z jednej domény na
druhú (typicky `www` → apex). Tu by bolo nielen zbytočné, ale **škodlivé**:
tenant sa určuje z hlavičky `Host` a po presmerovaní na `app.contineo.app` by
sa človek zo zväzu ocitol pod cudzou hlavičkou. `intranet.futbalsfz.sk` preto
obsluhuje aplikáciu priamo.

Overenie, že prvé dve miesta sedia:

```bash
vercel domains inspect futbalsfz.sk    # sekcia „Projects"
```

Varovanie o chýbajúcom `A` zázname pre samotné `futbalsfz.sk` sa nás netýka —
apex domény smeruje inde a Vercel to hlási pri každej doméne, ktorú nemá
celú pod sebou.

### Dodávateľské domény nepatria zákazníkovi (2026-08-28)

Do 28. 8. mal tenant `SFZ` medzi doménami aj `app.contineo.app`,
`contineo-app.vercel.app` a `localhost`. Pri jedinom tenantovi to bolo
neviditeľné a na testovanie praktické — ale znamenalo to, že na
**dodávateľskej doméne visela značka zákazníka**. Kto by otvoril
`app.contineo.app`, videl by logo SFZ.

Pravidlo: **doména dodávateľa má vlastného tenanta.**

| Tenant | Domény | Načo |
|---|---|---|
| `SFZ` | `intranet.futbalsfz.sk`, `sfz.localhost` | portál zväzu |
| `LTK` | `app.contineo.app`, `contineo-app.vercel.app`, `contineo-app-ltksolutions-projects.vercel.app`, `localhost` | ukážka a vývoj, značka „Contineo" |

```bash
# Poradie je dôležité: skript odmietne doménu, ktorá ešte patrí inému
# tenantovi. Najprv ju treba uvoľniť, až potom priradiť.
node scripts/tenant_set.mjs --company SFZ \
  --host intranet.futbalsfz.sk --host sfz.localhost

node scripts/tenant_set.mjs --company LTK \
  --host app.contineo.app --host contineo-app.vercel.app \
  --host contineo-app-ltksolutions-projects.vercel.app --host localhost \
  --name Contineo --short Contineo --language sk --languages sk,cs,en
```

**Pre vývoj to má priamy dôsledok.** `npm run dev` beží na `localhost`, teda
pod tenantom `LTK` so značkou Contineo. Kto potrebuje vidieť rozhranie tak,
ako ho uvidí zväz, otvorí **`http://sfz.localhost:3000`** — prehliadače
smerujú celé `*.localhost` na `127.0.0.1`, takže netreba nič nastavovať.

**Zmena sa neprejaví okamžite.** `tenants.ts` si výsledok drží 5 minút
(`HIT_TTL_MS`), takže warm lambda môže ešte chvíľu vracať starého tenanta.
Nie je to chyba, len sa treba chvíľu počkať.

V `LTK` zámerne nie je ani jedna osoba: kto sa tam prihlási, uvidí, že do
tejto organizácie nepatrí (D32). Je to ukážková doména, nie druhý portál.

---

## 1. DNS pre `app.contineo.app`

Doménu `contineo.app` **nespravuje Vercel, ale Websupport** (nameservery
`ns1–ns3.websupport.sk`). Poddoménu preto treba pridať tam:

| Typ | Názov | Hodnota |
|---|---|---|
| `CNAME` | `app` | `cname.vercel-dns.com` |

Po pridaní záznamu (šírenie býva do hodiny):

```bash
cd ~/Documents/GitHub/contineo/app
vercel alias set contineo-app.vercel.app app.contineo.app --scope ltksolutions-projects
```

Certifikát si Vercel vystaví sám. Kým to nie je hotové, aplikácia beží na
`contineo-app.vercel.app` a funguje rovnako — `NEXTAUTH_URL` je ale nastavené
na `https://app.contineo.app`, takže **prihlasovacie odkazy budú mieriť tam**.
Ak treba testovať skôr, prepnúť premennú:

```bash
printf '%s' 'https://contineo-app.vercel.app' | vercel env add NEXTAUTH_URL production --yes --force
vercel deploy --prod --yes
```

## 2. Prístup do MongoDB Atlas

Vercel nemá pevné IP adresy, takže cluster musí prijať spojenie odkiaľkoľvek:

**Atlas → Network Access → Add IP Address → `0.0.0.0/0`** ✅ nastavené 2026-07-27

Je to **vedomý ústupok**, nie odporúčaný stav. Chráni len meno a heslo
databázového používateľa. Prijateľné pre testovacie prostredie s verejnými
normami; pred pridaním interných smerníc treba buď Vercel Secure Compute
(vyhradené IP, platený doplnok), alebo iné umiestnenie aplikácie.

Zaznamenané v otvorenom bode k bezpečnosti.

## 3. Odosielanie e-mailov

Ecomail vyžaduje **platený účet a overenú odosielaciu doménu**.

```bash
cd ~/Documents/GitHub/contineo/app
bash scripts/nastav_ecomail.sh 'kluc-z-ecomailu'
```

Skript kľúč **najprv vyskúša priamo proti Ecomailu** a až potom uloží
a nasadí. Opačné poradie by znamenalo nasadiť a čakať, kým sa niekto pokúsi
prihlásiť — presne to sa stalo pri prvom pokuse.

| Odpoveď | Znamená |
|---|---|
| `200` | v poriadku, e-mail odišiel |
| `401 Wrong api key` | zlý kľúč, alebo sa doň dostali úvodzovky či nový riadok |
| `403` | neoverená odosielacia doména alebo neplatený účet |

Kým kľúč nefunguje, **neprihlási sa nikto** — vrátane teba.

## 4. Kto má prístup

Zoznam je v premennej `POVOLENE_EMAILY`, oddeľovač čiarka, bodkočiarka alebo
nový riadok. Zápis `@futbalsfz.sk` povolí celú doménu.

```bash
printf '%s' 'jan.letko@futbalsfz.sk,legislativec@futbalsfz.sk' \
  | vercel env add POVOLENE_EMAILY production --yes --force
vercel deploy --prod --yes
```

**Prázdny zoznam nepustí nikoho** — zámerne. Zabudnutá premenná by inak
otvorila rozhranie s internými smernicami komukoľvek.

### Do brzdy nepatrí bežná pracovná adresa (2026-08-28)

Brzda sa vyhodnocuje **prvá**, takže adresa, ktorá je v nej, sa nikdy
neprihlási cez `persons` — a cesta, ktorou pôjdu ostatní, zostane
neodskúšaná. Presne to sa stalo: `jan.letko@futbalsfz.sk` bol v brzde
a týždne to vyzeralo, že prihlásenie „funguje".

Brzda preto obsahuje **osobitnú správcovskú adresu**, ktorá sa nepoužíva
na bežnú prácu — dnes `intranet@futbalsfz.sk`. Správca sa cez ňu dostane
dnu aj pri nedostupnom Atlase; všetky ostatné adresy, jeho vlastnú
pracovnú nevynímajúc, púšťa `persons`.

**Overuje sa to runtime logom, nie premennou.** `vercel env pull` vracia
pre túto premennú prázdnu hodnotu, aj keď nastavená je (2026-08-28), takže
podľa neho sa riadiť nedá. Rozhodujúce je, čo napíše beh:

```
[auth] pouzitie-odkazu: adresa — cez núdzovú brzdu   ← brzda
[auth] pouzitie-odkazu: adresa — persons povolil     ← cesta pre ľudí
```

**Zmena premennej sa prejaví až po novom nasadení** (`vercel redeploy`).

---

## Nastavené premenné

`MONGODB_URI` · `MONGODB_DB` · `ANTHROPIC_API_KEY` · `EMBEDDING_MODEL` ·
`VECTOR_INDEX` · `VECTOR_PATH` · `NEXTAUTH_SECRET` · `NEXTAUTH_URL` ·
`POVOLENE_EMAILY` · `EMAIL_ODOSIELATEL` · `EMAIL_MENO_ODOSIELATELA` ·
`GENERATION_KIND` · `GENERATION_MODEL` · `DATA_RESIDENCY`

**Overené 2026-08-28:** nastavené sú všetky vrátane `ECOMAIL_API_KEY`. (Skorší text tvrdil, že chýba — už neplatí.)

---

## Na čo si dať pozor

**`vercel env add` potrebuje `--yes`.** Bez neho sa CLI pýta na potvrdenie
a spotrebuje naň práve tú rúru, z ktorej mala prísť hodnota. Premenné sa
uložia **prázdne** a build padne na `MongoParseError`. Stalo sa to pri prvom
pokuse a z výpisu to nebolo poznať — `vercel env ls` ukazuje len „Encrypted".
Overiť sa dá dĺžkou:

```bash
vercel env pull /tmp/o.env --environment=production --yes
awk -F= '{print $1, length($0)-length($1)-1}' /tmp/o.env && rm /tmp/o.env
```

**Build nesmie potrebovať databázu.** `next build` prechádza route handlery,
takže naimportuje aj `mongodb.ts`. Preto sa spojenie zostavuje až pri prvom
použití, nie na úrovni modulu.
