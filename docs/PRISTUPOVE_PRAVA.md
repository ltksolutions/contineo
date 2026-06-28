# Prístupové práva (ABAC + multitenant hierarchia) — návrh

> **Stav:** návrh na schválenie (aktualizované 2026-06-26). Žiadne zmeny v živom kóde (systém nie je nasadený).
> **Cieľ:** nie každý má prístup k všetkému — riadiť, čo používateľ smie vidieť vo vyhľadávaní aj v odpovediach bota.
> **Naviazanie:** Fáza 5 (Prístupové úrovne) v `docs/Contineo_RAG_Projektovy_plan.md`.
> **Súvisiace:** `docs/CISELNIKY_governance.md`, `docs/INGESTION_zdroje_reconciliation.md`, `docs/rag-architecture.md`.
> **Rozhodnutia (2026-06-26):** verejný prístup = **hybrid podľa nasadenia**; interná hierarchia = **zdieľanie konfigurovateľné per dokument**; skupiny = **auto-sync členstva zo sportnet.online + ručné content-skupiny**.

---

## 1. Doménový rámec (prečo je to zložité)

Slovenský futbal = „štát v štáte": 130 000+ aktívnych osôb. Hierarchia zväzov:

```
SFZ
 ├── Regionálny zväz 1 (napr. SsFZ)
 │     ├── Oblastný zväz 1.1
 │     ├── … (10–12 oblastných)
 ├── Regionálny zväz 2 (×4 regionálne spolu)
 └── …
```

Každý zväz (SFZ, regionálny, oblastný) = **samostatné CompanyID** so vzťahom k SFZ, ale samostatné → **multitenant hierarchia**. SFZ a jeho zväzy riadia ~**400 súťaží/rok**, ale **dokumentov „Rozpis súťaží" je len ~42–43** — jeden na zväz a ročník, pričom jeden rozpis pokrýva viacero súťaží naprieč vekovými úrovňami.

**Dva svety obsahu:**

| | VEREJNÝ (public) | INTERNÝ (internal) |
|---|---|---|
| Príklady | Stanovy SFZ, Súťažný/Registračný/Prestupový poriadok, Smernice, **Rozpisy súťaží** ktoréhokoľvek zväzu pre daný ročník | Interné smernice SFZ, interné nariadenia regionálnych/oblastných zväzov |
| Kto vidí | **ktokoľvek** (je to už verejné na futbalsfz.sk) | len zamestnanci/funkcionári **vlastného CompanyID** (+ konfigurovateľné zdieľanie) |
| Izolácia | **žiadna** — naprieč celou hierarchiou | **tvrdá per-CompanyID** |
| Zdroj | `futbalsfz.sk/legislativa-predpisy-sfz/` + rozpisy zväzov | privátne dokumenty zväzov |

> **Kľúčová oprava oproti prvej verzii návrhu:** tvrdá tenant izolácia sa týka **iba interného obsahu**. Verejný obsah (normy + rozpisy) NIE je izolovaný — je dostupný všetkým. To zodpovedá realite (normy SFZ platia pre všetkých; rozpis ktoréhokoľvek zväzu je verejný).

**Prístup je vzťahový, nie „jedno členstvo".** Jedna osoba má súbežne viac vzťahov: napr. člen komisie regionálneho zväzu + člen klubu, ktorého družstvá hrajú súťaže riadené SFZ aj regionálnym aj oblastným zväzom. Preto pri verejnom obsahu na zväze nezáleží, a pri internom sa práva skladajú ako **zjednotenie** všetkých vzťahov osoby.

---

## 2. Princíp: filter JE bezpečnostná hranica

Prístupové právo = **povinný filter v dotaze, odvodený z prihláseného používateľa**, pridaný k filtrom z číselníkov a aplikovaný na **obe** vetvy hybridného vyhľadávania (`$vectorSearch` aj `$search`).

1. **Server-side only** — filter sa skladá zo session, nikdy z parametrov klienta.
2. **Default-deny (fail-closed)** — čo nie je výslovne povolené, sa nevráti; ak sa identita nezistí → len `public` (alebo nič).
3. **Filter pred LLM** — model vidí len povolené chunky; nedá sa „vyžalovať" promptom. Platí aj pre citácie zdrojov.

---

## 3. Dva režimy nasadenia (rozhodnuté: hybrid)

| Režim | Identita | accessLevels | Vidí |
|---|---|---|---|
| **Verejný widget** (napr. na futbalsfz.sk, overlay) | anonymný | `["public"]` | len `public` obsah (normy, rozpisy) — naprieč celou hierarchiou |
| **Interný portál zväzu** (subdoména, SSO) | prihlásený | `["public","internal"]` | `public` + `internal` toho CompanyID, ku ktorému má vzťah |

Ten istý obsah, ten istý index — líši sa len bezpečnostný filter poskladaný zo session. Verejný režim nikdy nevidí `internal`, lebo session nemá žiadne členstvá.

---

## 4. Identita — sportnet.online ako primárny zdroj

ISSF **netreba** integrovať priamo: všetky dáta o zväzoch, kluboch a osobách sa real-time zrkadlia do **sportnet.online**. Osoby, ich roly, vzťahy k CompanyID aj skupiny sú v sportnet.online; k dispozícii je **MCP `mcp.sportnet.online`** (vo vývoji). Dáta preberáme a podľa nich povoľujeme/zakladáme skupiny.

Poskytovatelia (NextAuth providers) → jedna kanonická session:

| Poskytovateľ | Typ | Rola |
|---|---|---|
| **sportnet.online** | **OAuth** | primárny login pre futbalovú populáciu + zdroj členstiev/rolí |
| `mcp.sportnet.online` | MCP (vo vývoji) | preberanie osôb, vzťahov k CompanyID, rolí, skupín |
| `api.sportnet.online/v1` | REST (CRM) | **zdroj pravdy pre Company a People** — `https://api.sportnet.online/v1/docs/`; mapovanie polí na `companyCode`/`person_memberships`/`sportnet_role_map` |
| Microsoft Entra ID | OIDC/SSO | zamestnanci zväzov (firemné účty) |
| Google Workspace | OIDC/SSO | zamestnanci (alternatíva) |
| Vlastná DB | credentials | účty mimo vyššie uvedených |

> ISSF sa neintegruje samostatne (je pokrytý cez sportnet.online).

### 4.1 Kanonická session
```js
session.user = {
  id, email, name,
  idp: "sportnet.online",
  isAuthenticated: true,
  accessLevels: ["public","internal"],
  // VZŤAHY (zjednotenie všetkých) — z sportnet.online
  // sportnet vracia "membership" k CompanyID a "person profily" (tréner/hráč/
  // rozhodca/delegát/funkcionár) k CompanyID
  memberships: [
    { companyCode: "SsFZ",   sportnetProfile: "funkcionar" },
    { companyCode: "ObFZ_ZA", sportnetProfile: "delegat" }
  ],
  memberCompanyCodes: ["SsFZ","ObFZ_ZA"],   // odvodené z memberships
  // SKUPINY (po konverzii cez sportnet_role_map — kap. 4.2)
  membershipGroups: ["ssfz:funkcionar"],    // auto-sync zo sportnet.online
  contentGroups: ["sfz:interne_smernice"]   // ručne udelené (kap. 5)
}
```

Pri 130k+ osobách sa členstvá **nedotazujú zo sportnet.online pri každom dotaze** — načítajú sa pri prihlásení a cachujú (`person_memberships`).

**Re-sync (rozhodnuté): pri prihlásení + webhook.** Sync prebehne pri každom logine a navyše sportnet.online cez **webhook** notifikuje o zmenách (nová/zrušená príslušnosť, zmena profilu) → Contineo aktualizuje cache okamžite, bez čakania na ďalší login.

### 4.2 Konverzná tabuľka profilov → role/skupiny Contineo (`sportnet_role_map`)

sportnet.online pozná profily ako `tréner`, `hráč`, `rozhodca`, `delegát`, `funkcionár` (vždy vo vzťahu k CompanyID). Tie nie sú totožné s tým, čo potrebuje Contineo, preto je nutná **konverzná tabuľka** (per tenant):

```js
{ companyCode: "SsFZ", sportnetProfile: "funkcionar", contineoGroup: "ssfz:funkcionar" }
{ companyCode: "SsFZ", sportnetProfile: "delegat",    contineoGroup: "ssfz:delegat" }
{ companyCode: "SFZ",  sportnetProfile: "rozhodca",   contineoGroup: "sfz:rozhodca" }
```
- Vstup: `(companyCode, sportnetProfile)` → výstup: interná členská skupina Contineo.
- Neznámy profil/dvojica → **nemapuje sa** (default-deny), nie na „všetko".
- Tabuľka je riadená (admin) a je zdrojom pravdy pre auto-sync členských skupín.

---

## 5. Dva druhy skupín

| Druh | Príklad | Pôvod | Viaže sa na |
|---|---|---|---|
| **Členská (company-bound)** | `ssfz:clen_komisie` | **auto-sync** zo sportnet.online (osoba→CompanyID→rola) | spoločnosť / CompanyID |
| **Content-bound (prístupová)** | `sfz:interne_smernice` | **ručne** spravovaná (admin per tenant) | obsah / kategória dokumentov |

- Členské skupiny dávajú `memberCompanyCodes` a roly → základ pre prístup k internému obsahu vlastného zväzu. Vznikajú **auto-sync** zo sportnet.online cez konverznú tabuľku `sportnet_role_map` (kap. 4.2).
- Content-skupiny umožnia jemnejšie „toto smie len táto skupina" (napr. „Interné smernice" len pre vedenie), nezávisle od členstva. Spravujú sa **ručne** (admin per tenant).
- Pre SSO mimo sportnet (Entra/Google) sa externé skupiny mapujú cez `identity_group_map`; neznáme externé → default-deny (nemapuje sa na „všetko").

---

## 6. Model na obsahu + vyhodnotenie prístupu

### 6.1 Polia na obsahu (`document_chunks` / `documents`)
```js
accessLevel: "internal",              // public | internal
companyCode: "SsFZ",                  // vlastník (CompanyID)
scope: "company",                     // global | company | region (komu obsah platí)
accessGroups: ["sfz:interne_smernice"], // content-skupiny; [] = bez extra obmedzenia
// per-dokument zdieľanie interného obsahu (rozhodnuté: konfigurovateľné)
sharedWithCompanyCodes: [],           // explicitný zoznam CompanyID, čo smú vidieť navyše
isActive: true
```

> „Zdieľanie nahor/nadol" v hierarchii je v UI len pohodlie — pri uložení sa rozbalí na **explicitný** `sharedWithCompanyCodes[]` (cez `companyCode.parent`), aby filter ostal jednoduchý a jednoznačný.

### 6.2 Logika prístupu k chunku
```
isActive = true                         // vždy
AND (
  accessLevel = "public"                // verejné → vidí každý (aj anonym)
  OR (
    accessLevel = "internal"            // interné → len ak:
    AND session.isAuthenticated
    AND (
         companyCode ∈ session.memberCompanyCodes          // vlastný zväz
      OR sharedWithCompanyCodes ∩ session.memberCompanyCodes ≠ ∅  // per-doc zdieľané
      OR accessGroups ∩ session.contentGroups ≠ ∅          // content-skupina
    )
    AND ( accessGroups = []  OR  accessGroups ∩ session.contentGroups ≠ ∅ )
  )
)
```

---

## 7. Enforcement vo filtri

### 7.1 Query builder (jediné miesto pravdy) — `app/src/lib/mongoSearch.ts`
```
securityFilter(session) → {
  isActive: true,
  $or: [
    { accessLevel: "public" },
    { $and: [
        { accessLevel: "internal" },
        // len ak prihlásený; inak táto vetva odpadá
        { $or: [
            { companyCode: { $in: session.memberCompanyCodes } },
            { sharedWithCompanyCodes: { $in: session.memberCompanyCodes } },
            { accessGroups: { $in: session.contentGroups } }
        ]},
        { $or: [ { accessGroups: { $exists: false } },
                 { accessGroups: { $size: 0 } },
                 { accessGroups: { $in: session.contentGroups } } ] }
    ]}
  ]
}
```
- Aplikuje sa **identicky** do `$vectorSearch.filter` aj `compound.filter` v `$search`.
- Anonymný (verejný widget): `memberCompanyCodes=[]`, `contentGroups=[]`, `accessLevels=["public"]` → vráti len `public`.

### 7.2 Atlas indexy (doplniť filtrovacie polia)
- `rag_vector_index`: + `accessGroups`, `sharedWithCompanyCodes` (filter); `accessLevel`, `companyCode` už sú.
- `rag_text_index`: + `accessGroups`, `sharedWithCompanyCodes` (token).
- (Systém nie je nasadený — len súčasť návrhu indexov.)

---

## 8. Dopady na dátový model

| Kolekcia | Zmena |
|---|---|
| `document_chunks` / `documents` | + `accessGroups[]`, + `sharedWithCompanyCodes[]` |
| `companyCode` (číselník) | + `parent` (viacúrovňová hierarchia SFZ→regionálny→oblastný); = **CompanyID**, plný zoznam sync zo sportnet.online |
| nová `tenant_groups` (per tenant) | členské + content-skupiny |
| nová `sportnet_role_map` | `(companyCode, sportnetProfile)` → interná členská skupina Contineo |
| nová `identity_group_map` | externá skupina Entra/Google → interná skupina (mimo sportnet) |
| nová `person_memberships` (cache) | osoba → [{companyCode, sportnetProfile}], sync pri logine + webhook |
| nová `cms_uploaders` (allowlist) | kto smie nahrávať obsah — **ručne** povolené, nie z rolí sportnet |
| NextAuth | providers (sportnet.online OAuth, Entra, Google, vlastná DB) + callback napĺňajúci session zo sportnet.online |

---

## 9. Naviazanie na fázy

| Krok | Fáza |
|---|---|
| sportnet.online OAuth + MCP sync osôb/členstiev → session | Fáza 5 |
| `securityFilter()` (oba indexy), default-deny | Fáza 5 |
| `accessGroups` + `sharedWithCompanyCodes` v schéme + tagovanie pri importe | Fáza 5 (na Fázu 4 ingesciu) |
| `companyCode.parent` + import hierarchie zo sportnet.online | Fáza 4/5 |
| `tenant_groups`, `identity_group_map`, `person_memberships` + admin UI | Fáza 5 |
| Verejný widget (anonymný public) vs interný portál (SSO) | Fáza 5 |
| Audit prístupov (GDPR retencia) | Fáza 6 |

---

## 10. Rozhodnutia a otvorené otázky

**Uzavreté (2026-06-26):**

1. **Práva v CMS** — netreba samostatný pojem „rola". Kto smie nahrávať obsah, sa povoľuje **ručne** (allowlist `cms_uploaders`), oddelene od čítacích práv (tie idú cez členské/content-skupiny).
2. **sportnet identita** — vracia `membership` k CompanyID a „person profily" (`tréner`/`hráč`/`rozhodca`/`delegát`/`funkcionár`) k CompanyID. Mapovanie na členské skupiny Contineo cez konverznú tabuľku `sportnet_role_map` (kap. 4.2).
3. **Re-sync** — pri **logine + webhook** (sportnet notifikuje zmeny).
4. **Relevancia cez riadiaci zväz** — každá súťaž má svoj **riadiaci zväz**, takže dotaz typu „4. liga ZsFZ" jednoznačne smeruje na normy/rozpis zväzu **ZsFZ** (+ globálne poriadky SFZ). Pri dotaze sa identifikuje súťaž → jej riadiaci zväz (`companyCode`) z CRM → uprednostní sa `Rozpis súťaží` daného zväzu. Je to **relevancia, nie prístup** (rozpisy sú public). Implementačné ladenie vo Fáze 4/5; väzba súťaž→companyCode pochádza z CRM.
5. **Verejný widget rozsah** — **dá sa zúžiť** na konkrétny zväz podľa toho, kde je widget vložený (embed konfigurácia nesie `companyCode` kontext) → verejné výsledky sa obmedzia na daný zväz + globálne normy SFZ.
6. **`sectionKey` podľa legislatívy SFZ** — uzamknuté top-level skupiny (`futbalsfz.sk/legislativa-predpisy-sfz/`): **Stanovy · Poriadky · Štatúty a kódexy · Smernice · Rozpisy a manuály · Tlačivá/formuláre**; pod „Poriadky" → súťažný / registračný a prestupový / disciplinárny… Premietnuté vo vzore `app/src/codelists/sectionKey.json` (listy sa dopĺňajú z korpusu).

**Otvorené:**

7. **CRM mapovanie** — Company a People dáta: `https://api.sportnet.online/v1/docs/` (služba **CRM**, + MCP). Treba zmapovať presné polia (CompanyID, hierarchia zväzov, profily osôb, **väzba súťaž→riadiaci zväz**) na `companyCode`, `person_memberships`, `sportnet_role_map`. *Čaká na sprístupnenie CRM connectora pre túto session.*
