# ADR-022 — Ochrana osobných údajov podľa organizácie

> **Stav:** prijaté · **Dátum:** 2026-09-28
> **Rozhodol:** Ján Letko (2026-09-28) — odpoveď na otázku, čo sa má dať
> nastaviť pre každú organizáciu zvlášť: všetky štyri navrhnuté časti.
> **Nadväzuje na:** ADR-012 (retencia, DPO), ADR-021 (retencia vzdelávania),
> ADR-001 (adaptéry podľa profilu tenanta), C1 (informovanie dotknutých osôb)
> **Implementácia:** hotová (2026-09-28) — PR #165 (krajina, sprostredkovatelia), #166 (lehoty, verzia), doplnkový text v nasledujúcom PR.

---

## 1. Kontext

Stránka `/privacy` je jedna pre celú platformu. Z nastavení organizácie už
berie prevádzkovateľa (právny názov, sídlo, IČO), kontakt na DPO (osoby
s rolou `dpo`) a zapnuté moduly (Vzdelávanie, ADR-021). Natvrdo v nej však
zostalo to, čo sa medzi organizáciami líši:

- **dozorný úrad a zákony** — slovenské aj pre organizáciu so sídlom v Česku;
- **sprostredkovatelia** — rovnaký zoznam, aj keď organizácia napríklad
  generuje odpovede na vlastnom serveri a Anthropic nepoužíva;
- **lehoty uchovávania** — rozhodnutia DPO SFZ (ADR-012, ADR-021) platia
  pre všetkých, v texte aj v mazacej dávke;
- **nič vlastné** — DPO organizácie nemá kam doplniť, čo je u nej iné.

## 2. Rozhodnutie

### D134 — Krajina sídla prevádzkovateľa

Pri prevádzkovateľovi pribudne `controller.country` (`SK` | `CZ`, chýba =
`SK`), nastavuje sa v Nastaveniach → Značka pri právnom názve. Určuje
**dozorný úrad** (sťažnosť) a **zákon o archívoch** (certifikát, D132).
**Nie jazyk:** Čech v slovenskej organizácii číta text po česky, ale
sťažuje sa slovenskému úradu. Iné krajiny, kým pre ne nie sú texty, nejdú.

### D135 — Sprostredkovatelia z profilu adaptérov

Zoznam sa skladá z profilu organizácie (`tenant_profiles`, ADR-001):
Anthropic len pri generovaní cez Anthropic, Amazon Bedrock s regiónom pri
Bedrocku, Voyage AI len pri Atlas embeddingu alebo rerankingu. Databáza,
beh aplikácie a e-maily sú spoločné pre nasadenie. Text sa tak nerozíde
s tým, kam údaje naozaj idú.

### D136 — Lehoty uchovávania nastaviteľné pre organizáciu

DPO organizácie nastaví na `/dpo` lehoty, ktoré riadi **denná dávka**:
roky od skončenia vzťahu (predvolene 3), strop od poslednej udalosti (5)
a orezanie podrobností vzdelávania po dokončení kurzu (12 mesiacov).
**Tie isté čísla** číta mazacia dávka aj text na `/privacy` — nemôže sa
stať, že text sľubuje niečo iné, než systém robí. Predvolené hodnoty sú
rozhodnutia DPO SFZ.

Lehoty riadené **indexom v databáze** (čas čítania 12 mesiacov, pripomienky
90 dní, audit 24 mesiacov) sú spoločné pre platformu — index nevie
rozlišovať organizácie. V texte zostávajú ako pevné.

Zmena sa zapíše do auditu. Skrátenie lehoty môže pri ostrom mazaní
(`RETENTION_MODE=delete`) zmazať záznamy hneď v najbližšom behu — obrazovka
na to upozorní.

### D137 — Doplnkový text prevádzkovateľa

DPO organizácie môže na `/dpo` dopísať **vlastný odsek** (v jazykoch
organizácie), ktorý sa zobrazí na `/privacy` v samostatnej časti. Je to
doplnok, nie náhrada: základný text zostáva spoločný a overený.

### D138 — Verzia textu podľa organizácie

Dátum verzie na `/privacy` je neskorší z dvoch: zmena spoločného textu
v kóde (`PRIVACY_NOTICE_VERSION`) a posledná zmena nastavení ochrany údajov
organizácie (lehoty, doplnkový text, krajina). Tak je z dátumu vidieť, kedy
sa zmenilo to, čo človek čítal.

## 3. Čo sa tým vedome kazí

- Text je spoločný — organizácia, ktorej nesedí veta v základnom texte,
  ju nezmení sama, len doplní odsek. Zmena spoločného textu ide cez nás.
- Lehoty v indexoch sa pre jednu organizáciu zmeniť nedajú.

## 4. Implementácia

1. D134, D135 — krajina sídla v Nastaveniach, úrad a zákon podľa nej,
   sprostredkovatelia z profilu.
2. D136, D138 — lehoty organizácie na `/dpo`, mazacia dávka a text ich
   čítajú; verzia textu podľa organizácie.
3. D137 — doplnkový text na `/dpo` a jeho zobrazenie na `/privacy`.
