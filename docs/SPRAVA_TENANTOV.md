# Správa tenantov — koncepcia

> **Stav: plán, rozsah A sa implementuje.** Zadanie (2026-08-28): obrazovka so
> správou tenantov so všetkými potrebnými údajmi. Správcovský účet je
> `office@ltk.solutions`.
>
> Zaradenie: **Fáza 5b** (prístupové práva), predbieha zvyšok Fázy 5 rovnako,
> ako Fáza 8 predbehla Fázu 4.

---

## 1. Prečo obrazovka, keď existujú skripty

`npm run stav` a `npm run domeny` odpovedia na všetko, čo obrazovka ukáže —
ale len tomu, kto sedí pri repozitári s `.env.local`. To je dnes jeden človek.
Pri druhom zákazníkovi to prestane stačiť a odpoveď na otázku „v akom stave je
tá organizácia" nemá byť podmienená prístupom k produkčnej databáze.

Druhý dôvod je vecný: zakladanie tenanta má dnes **tri kroky v dvoch
systémoch** (zápis, doména vo Verceli, DNS u zákazníka). Skript ich už spája,
ale kto ho spustí zle, nedozvie sa to — obrazovka dokáže ukázať stav priebežne.

---

## 2. Prístup

### D41 — `platform-admin` vidí naprieč tenantmi 🔴

**Otázka:** D32 hovorí, že viditeľnosť je per `companyCode` a hierarchia
neudeľuje nič. Správca platformy ale musí vidieť všetkých.

**Rozhodnuté (2026-08-28): rola `platform-admin` v `persons`, nie premenná.**

- Záznam v `persons` pod tenantom `LTK`, `roles: ["platform-admin"]`.
- Ide **overenou cestou prihlásenia cez `persons`** (I1c), vrátane evidencie
  prihlásení a odhlásenia. Odobratie práv je zmena jedného záznamu, nie
  premennej a nasadenia.
- **Je to výslovná výnimka z D32**, nie jej ohnutie: rola neruší `companyCode`
  ostatných, len otvára samostatnú obrazovku, ktorá číta prehľadové údaje.
  **Neotvára obsah** — na dokumenty a potvrdenia cudzej organizácie správca
  platformy nevidí a vidieť nemá. To je oddelenie, ktoré musí prežiť aj vtedy,
  keď bude zákazníkov dvadsať.

Zvažovaná bola premenná so zoznamom správcov (ako `POVOLENE_EMAILY`).
Zamietnuté: presne taká premenná dnes tri týždne skrývala, že sa cesta cez
`persons` nikdy netestovala.

```bash
npm run admin                                          # kto rolu má
npm run admin -- --email office@ltk.solutions --meno "Ján Letko"
npm run admin -- --email office@ltk.solutions --odobrat
```

Odoberá sa **rola, nie osoba** — zmazať človeka, ktorý niečo potvrdil, by
znamenalo osirotené auditné záznamy (D24). Skript rolu odmietne prideliť
niekomu mimo tenanta dodávateľa: inak by správca zákazníka videl prehľad
ostatných organizácií.

### D42 — Správa beží len na doméne dodávateľa 🔴

**Rozhodnuté (2026-08-28):** `/admin` odpovie len vtedy, keď hostiteľ patrí
tenantovi `LTK` (`app.contineo.app`). Na doméne zákazníka **neexistuje** —
`notFound()`, nie „nemáte prístup".

Dôvod je ten istý ako pri značke: na doméne zväzu nemá byť nič, čo patrí
dodávateľovi. A druhý, praktickejší: keby obrazovka odpovedala všade, stačila
by jediná chyba v kontrole roly na to, aby ju uvidel niekto zo zákazníka.
Takto musia zlyhať dve nezávislé podmienky naraz.

**Kontroluje sa oboje** — rola aj hostiteľ. Nie jedno z toho.

---

## 3. Čo obrazovka ukazuje

Na jednom mieste to, čo dnes vypíšu dva skripty:

| Údaj | Odkiaľ |
|---|---|
| kód, názov, stav, jazyky | `tenants` |
| domény a či ich zákazník už nasmeroval | `tenants` + **naživo z Vercelu** |
| osoby: koľko ich je a koľko sa už prihlásilo | `persons` |
| trasy a ich kroky | `onboarding_tracks` |
| dokumenty a z toho koľko má platné znenie | `documents` (D6) |
| potvrdenia | `acknowledgements` |
| kedy a komu boli poslané pokyny k doméne | `tenants.domainSetup` |

**Čísla sa nikde neukladajú, počítajú sa pri zobrazení.** Uložený súčet je
druhá kópia pravdy a rozíde sa (D27). Stav domén sa rovnako číta naživo —
uložený by klamal presne vtedy, keď si zákazník prestaví DNS.

`documents` bez platného znenia sú vypísané menovite. Je to najčastejšia tichá
príčina, prečo sa človeku v zozname nič neobjaví, a dnes ju odhalí len skript.

---

## 4. Fázovanie

**Rozsah A — vidieť** `[1–2 dni]`
- rola `platform-admin`, `requirePlatformAdmin()` (rola **a** hostiteľ)
- `/admin` — zoznam tenantov s prehľadom vyššie
- `/admin/tenanti/[kod]` — detail vrátane menovitého zoznamu problémov
- mobile first, testy na to, čo môže ukázať nepravdu

**Rozsah B — meniť, čo je bezpečné** `[2–3 dni]`
- názov, logo, farba, jazyky, zapnutie/vypnutie tenanta
- kontrola kolízie domén sa **presunie zo skriptu do `lib/tenants.ts`**, aby
  existovala raz. Dnes je v `tenant_set.mjs` a obrazovka by ju musela napísať
  druhýkrát — a druhá kópia pravidla o vlastníctve domén je presne to, čo
  nesmie vzniknúť.
- každá zmena zapíše, kto a kedy ju spravil

**Rozsah C — zakladať** `[2–3 dni]`
- nový tenant z obrazovky vrátane domén
- volanie Vercel API zo servera (`VERCEL_TOKEN` medzi premennými nasadenia)
- odoslanie pokynov zákazníkovi jedným tlačidlom (dnes `npm run domeny --poslat`)

**Vypnutie tenanta je jediná nezvratná vec v rozsahu B** — ľudia sa okamžite
prestanú prihlásiť. Preto potvrdenie s napísaním kódu organizácie, nie
obyčajné „naozaj?".

---

## 5. Čo tu zámerne nie je

- **Prístup k obsahu cudzej organizácie.** Správca platformy vidí počty, nie
  dokumenty a nie potvrdenia. Keby to raz bolo treba (podpora), je to
  samostatné rozhodnutie so záznamom o každom nahliadnutí — nie vlastnosť
  tejto roly.
- **Správa osôb zákazníka.** Na to je import a HR obrazovka (Fáza 9 rozsah B).
- **Fakturácia a zmluvy.** Iný systém, iný životný cyklus.

---

## 6. `VERCEL_TOKEN` — jediné, čo ešte treba nastaviť ručne

Keď správcovská obrazovka zakladá organizáciu, priradí jej doménu projektu vo
Verceli sama. Na to potrebuje token. Bez neho sa organizácia **založí** a
domény sa **uložia** — obrazovka len povie, že do Vercelu ich nepridala a treba
to spraviť ručne. Poradie je zámerné: `tenants` je zdroj pravdy a výpadok
cudzieho API nesmie brániť zákazníka založiť.

**Token z `vercel login` na to nestačí.** CLI si svoju hodnotu priebežne
obnovuje; kto ju prečíta zo súboru, dostane po čase neplatnú (overené
2026-08-28 — Vercel vrátil 403). Skripty na vývojárskom stroji si ju doplnia
samy (`scripts/lib/vercel-auth.mjs`), ale na server patrí vlastný token.

### Vytvorenie

1. `https://vercel.com/account/tokens` (avatar vpravo hore → **Settings** →
   **Tokens**).
2. **Create Token**.
3. **Name:** `contineo-admin` — nech je z výpisu vidieť, čo ho používa.
4. **Scope:** tím, pod ktorým je projekt `contineo`. Nie „Personal Account",
   ak projekt patrí tímu — token by na projekt nevidel.
5. **Expiration:** `No Expiration` pre prevádzku. Kratšia platnosť je bezpečnejšia,
   ale znamená, že jedného dňa prestane obrazovka pridávať domény bez toho, aby
   sa čokoľvek zmenilo v kóde.
6. **Create** → hodnota sa ukáže **jediný raz**. Skopírovať hneď.

### Kam ho dať

**Lokálne** — `app/.env.local`, nový riadok:

```
VERCEL_TOKEN=<hodnota>
```

`.env.local` je v `.gitignore`; token do repozitára nepatrí.

**Do nasadenia** — `https://vercel.com/<tím>/contineo/settings/environment-variables`:

- **Key:** `VERCEL_TOKEN`
- **Value:** tá istá hodnota
- **Environments:** Production, Preview, Development
- **Sensitive:** zapnúť — Vercel ju potom už nikdy neukáže späť

Alebo z príkazového riadka v `app/`:

```bash
vercel env add VERCEL_TOKEN production
```

**Premenná sa prejaví až novým nasadením.** Existujúce beží so starým
prostredím; stačí `vercel --prod` alebo ďalší commit.

### Overenie

```bash
cd app
npm run domeny            # vypíše stav domén každého tenanta
```

Keď token neplatí, skripty aj obrazovka to povedia menovite („Vercel token
neprijal") — nie všeobecnou chybou. Rozdiel medzi „token chýba" a „token
neplatí" je podstatný: prvé je nedokončené nastavenie, druhé je vypršaná
hodnota, ktorá pred týždňom fungovala.

---

**Súvisiace:** D29 (hostiteľ určuje tenanta), D32 (viditeľnosť per
`companyCode`), D27 (stav sa odvodzuje), D6 (platné znenie), I1c
(overená cesta cez `persons`).
