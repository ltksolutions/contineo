---
name: env-prazdne-hodnoty
description: "Prečo bol .env.local prázdny, prečo `vercel env pull` nepomôže, a ako je súbor usporiadaný teraz"
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

# `.env.local` — prázdne hodnoty a `vercel env pull`

Zistené a upravené 2026-09-06, doplnené 2026-09-07.

## Jadro problému

Kód používa vzor `process.env.X ?? "predvoľba"`. **`??` reaguje len na `undefined`, nie na prázdny reťazec.** Riadok `VECTOR_PATH=` teda predvoľbu neprepustí — nastaví `""`, a `$vectorSearch` spadne na `Path '' is not indexed`. Prázdna premenná je horšia než chýbajúca.

## Pull nezapisuje prázdno — zapisuje `[SENSITIVE]`

Overené 2026-09-07 na produkčnom projekte: `vercel env pull --environment=production` zapíše pri premennej typu **Secret** doslova

```
EMAIL_ODOSIELATEL="[SENSITIVE]"
```

**To je horšie než prázdna hodnota.** Prázdny reťazec aspoň neprejde kontrolou „je to vyplnené"; `[SENSITIVE]` prejde každou. Odosielateľ e-mailov by sa tak stal reťazcom `[SENSITIVE]`, prihlasovacie správy by odišli s neplatnou adresou a v kóde by na to neupozornilo nič.

Premenná typu **Config** sa naopak stiahne s naozajstnou hodnotou.

Dôsledok: **hodnotu premennej typu Secret sa z Vercelu prečítať nedá — ani cez CLI, ani cez API.** Vidno ju len v UI cez Edit. Kto potrebuje starú hodnotu skopírovať do novej premennej, musí ísť do UI; skript to za neho nespraví.

## Zobrazenie v `vercel env ls` klame

Pri premennej typu Config vypíše `vercel env ls` do stĺpca „value" reťazec ako `eyJ2IjoidjIiLCJjIj…`. **Nie je to hodnota**, je to vnútorné kódovanie Vercelu. Overené 2026-09-07: `ALLOWED_EMAILS` takto vyzeralo pokazene, ale `vercel env pull` vrátil správnu adresu správcu. Nediagnostikovať z `env ls` — pullovať do dočasného súboru.

## Zmena premennej si vyžaduje nové nasadenie

Premenné sa viažu na nasadenie **v čase buildu**. Zmena vo Verceli sa na bežiacu produkciu neprejaví, kým sa nenasadí nanovo. Rovnaká pasca ako pri `MONGODB_DB` (2026-09-04). Po každej zmene premennej teda redeploy — inak beží stav, ktorý už v konfigurácii nie je.

## Prečo bol súbor prázdny

`.env.local` začínal hlavičkou `# Created by Vercel CLI` — bol to výstup `vercel env pull`. Pull zapíše názvy premenných a hodnoty ako `""` alebo `"[SENSITIVE]"`. Overené 2026-09-06: opakovaný pull prepísal aj tie tri premenné, ktoré boli vyplnené ručne (`MONGODB_URI`, `MONGODB_DB`, `BLOB_READ_WRITE_TOKEN`), a pridal systémové premenné Vercelu.

**Preto: pred `vercel env pull` si vždy odložiť kópiu.** Pull nie je obnova, je to strata. A pullovať do dočasného súboru, nie priamo do `.env.local`.

## Ako je súbor usporiadaný teraz

Tri sekcie s vysvetľujúcou hlavičkou:

1. **Pripojenie a tajomstvá** — dopĺňa človek. Prázdne je tu neškodné, lebo tieto premenné predvoľbu nemajú.
2. **Konfigurácia** — vyplnená naozajstnými hodnotami, ktoré zodpovedajú predvoľbám v kóde (`VECTOR_PATH=text`, `EMBEDDING_MODEL=voyage-4`, `GENERATION_KIND=anthropic`, `RERANK_MODEL=rerank-2` …). Nikdy tu nenechať prázdnu hodnotu — nepotrebnú premennú **zakomentovať**, nie vyprázdniť.
3. **Voliteľné** — zakomentované, bez predvoľby (`GOOGLE_*`, `MICROSOFT_*`, `GENERATION_REGION`, `VERCEL_ORG_ID` …).

## Pomocník v kóde

`src/lib/ecomail.ts` má `env(...names)`: vezme prvú **neprázdnu** premennú zo zoznamu, takže rieši aj prázdny reťazec, aj preklad starého názvu na nový.

```ts
sender: env("EMAIL_SENDER", "EMAIL_ODOSIELATEL"),
```

**Pri ďalšom preklade premennej použiť ten istý vzor** — kód číta najprv nový názov, pri prázdnom starý, aby nasadenie nespadlo v okamihu medzi zmenou kódu a zmenou premennej vo Verceli.

## Stav premenných na Verceli (2026-09-07, po redeploy)

- `CRON_SECRET` — nastavená, cron je v nasadení zaregistrovaný (`[{"path":"/api/cron/overdue","schedule":"0 6 * * 1"}]`). Prvý beh pondelok 06:00 UTC.
- `ALLOWED_EMAILS` — jedna adresa správcu. Je to **núdzová brzda pred `persons`**, nie zoznam používateľov: kto je na nej, dostane sa dnu aj bez `persons` a aj pri nedostupnom Atlase. Doménový zápis (`@futbalsfz.sk`) by znamenal, že celý zväz obíde evidenciu prístupov.
- `EMAIL_SENDER`, `EMAIL_SENDER_NAME` — nastavené (typ Config, teda čitateľné), hodnoty overené pullom.
- `POVOLENE_EMAILY`, `EMAIL_ODOSIELATEL`, `EMAIL_MENO_ODOSIELATELA` — **odstránené**.

### Pozor na rollback

Staré slovenské premenné už na Verceli nie sú, ale kód ich stále číta ako zálohu. **Návrat (rollback) na nasadenie staršie než `0886f39` odosielanie e-mailov rozbije** — ten kód pozná len `EMAIL_ODOSIELATEL`, ktorý neexistuje. Rovnako `bf9bb10` a staršie nepoznajú anglické routy. Pri rollbacku ďalej než po `b0b1f8e` teda treba premenné dočasne vrátiť.

### Čo overiť behom, nie výpisom

Odosielanie e-mailov sa z konfigurácie overiť nedá. Skutočný test je **vyžiadať si prihlasovací odkaz** na `/sign-in` a pozrieť, či príde a s akou adresou odosielateľa.
