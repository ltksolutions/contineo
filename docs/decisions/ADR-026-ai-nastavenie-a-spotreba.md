# ADR-026 — Umelá inteligencia ako nastavenie organizácie a prehľad spotreby

> **Stav:** prijaté · **Dátum:** 2026-10-05
> **Rozhodol:** Ján Letko (2026-10-05) — nastavenie AI v organizácii (kľúč,
> modely), pod ním prehľad spotreby s filtrom obdobia a exportom CSV a Excel;
> znenie otázky sa do spotreby **neukladá**, bez vlastného kľúča sa použije
> kľúč prevádzkovateľa, záznamy spotreby sa držia **25 mesiacov**.
> **Nadväzuje na:** ADR-001 (adaptéry poskytovateľov), D51 (audit bez tajomstiev),
> D43 (šifrované tajomstvá prihlásenia), ADR-012 (retencia)
> **Implementácia:** PR 1 — `lib/aiSettings.ts`, `getTenantProfile()` + `withAi()`,
> `/organisation/ai`; PR 2 — `lib/aiUsage.ts` (kolekcia `ai_usage`, TTL index),
> `lib/aiUsageExport.ts`, `/api/ai-usage` (CSV a Excel), záložka Spotreba
> (`/organisation/ai?view=usage`); zápis v `llmGenerator`, `/api/chat`
> (úprava a klasifikácia otázky) a pri prepise PDF v knižnici.

---

## 1. Kontext

Claude sa volá na troch miestach: odpoveď asistenta, úprava otázky pred
vyhľadávaním (a klasifikácia) a prepis skenovaných PDF v knižnici. Kľúč
(`ANTHROPIC_API_KEY`) aj modely boli v prostredí na Verceli a v kóde. Zmena
modelu znamenala nové nasadenie, všetky organizácie platili cez kľúč
prevádzkovateľa a nikde nebolo vidieť, kto koľko minul.

## 2. Rozhodnutia

### D157 — Kľúč a modely nastavuje organizácia

Nová časť **Organizácia → Umelá inteligencia** (`/organisation/ai`), len pre
správcu organizácie.

- **Poskytovateľ:** Anthropic (Claude), zatiaľ jediný — ukazuje sa ako text.
- **API kľúč:** ukladá sa **zašifrovaný** (`secrets.ts`, AES-256-GCM, ten istý
  kľúč ako pri tajomstvách prihlásenia). Von sa nevracia; obrazovka ukazuje
  koncovku, kedy a kto ho zadal. Pred uložením sa overí bezplatným volaním
  (zoznam modelov) — neplatný kľúč sa neuloží. Prázdne pole kľúč nemení,
  na odstránenie je samostatné tlačidlo. Do auditu ide len koncovka.
- **Bez vlastného kľúča** sa použije kľúč prevádzkovateľa — tak ako doteraz.
  Vlastný kľúč, ktorý sa nedá rozšifrovať, **nepadá potichu** na kľúč
  prevádzkovateľa: volanie zlyhá s vetou, že treba kľúč zadať znova.
- **Modely** pre tri účely zo **zúženého zoznamu** (`AI_MODELS`):
  odpovede (Sonnet 5, Sonnet 5.5, Opus 5.5), prepis skenov (Sonnet 4.5,
  Sonnet 5.5, Opus 5.5). **Úprava otázky len Haiku 4.5**: beží pred
  vyhľadávaním so stropom 2,5 s a 256 tokenmi; novšie modely premýšľajú vždy
  a premýšľanie by rozpočet minulo skôr, než napíšu odpoveď.
- Nastavenie sa číta **pri každom volaní, mimo cache profilu** — zmena platí
  od ďalšej otázky na každej inštancii servera.
- Týka sa len adaptéra `anthropic`. Bedrock a vlastné servery (ADR-001) majú
  kľúč aj model v profile a nastavenie organizácie ich nemení.

### D158 — Spotreba bez znenia otázky (PR 2)

Každé volanie sa zapíše do `ai_usage`: kto (meno ako kópia), kedy, účel
a popis, model, tokeny, odhad sumy v USD s verziou cenníka, ktorý kľúč.
**Znenie otázky sa neukladá** — môže obsahovať osobné údaje (meno hráča
v disciplinárnej veci) a prehľad nákladov by sa stal ďalším registrom
osobných údajov. Na kontrolu nákladov stačí účel, osoba a čas.

### D159 — Spotreba sa drží 25 mesiacov (PR 2)

Celý predchádzajúci rok na porovnanie a rezerva na ročnú uzávierku; potom
sa záznamy zmažú automaticky (TTL index). Nie sú to dôkazné záznamy (D24),
ale prevádzkový výkaz nákladov.

## 3. Cenník

Overený 2026-10-05 (platform.claude.com/docs/en/about-claude/pricing).
Sonnet 5 ostal na $2/$10 — ohlásené zdraženie na $3/$15 od 1. 9. 2026 sa
nekonalo; `pricing.ts` dovtedy po 1. 9. počítal o 50 % viac.

## 4. Čo výkaz nevidí

- Volania cez **Bedrock a vlastné servery** (`kind: "bedrock" | "openai"`)
  zapisuje len odpoveď asistenta; ich `complete()` tokeny nehlási. Dnes
  žiadna organizácia takýto profil nemá.
- **Zrušené volanie** (prerušenie, časový strop úpravy otázky 2,5 s) sa zapíše
  s príznakom zlyhania a bez tokenov — Anthropic ho môže účtovať, my nevieme
  koľko.
- Obdobie sa delí podľa **dní v UTC**; volanie medzi polnocou a druhou ráno
  miestneho času padne do predchádzajúceho dňa. Čas v riadku je miestny.
