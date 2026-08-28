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
