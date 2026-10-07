# Widget helpdesku pre cudzí systém (ISSF)

> Pre prevádzkovateľa ISSF (Informačný systém slovenského futbalu) a správcu
> kanála v Contineu. **ISSF nie je Sportnet**: Sportnet je platforma
> sportnet.online s CRM a identifikátorom `sportnetID`; ISSF má vlastný
> identifikátor osoby, **registračné číslo**. Rozhodnutie:
> ADR-028, D166. Stav 6. 10. 2026: implementované (krok 5), naostro
> neoverené — čaká na vydávanie tokenu na strane ISSF.

## Ako to funguje

1. Človek je prihlásený v ISSF. ISSF mu po prihlásení vydá **krátko platný
   podpísaný token** (JWT HS256) s jeho identitou.
2. Stránka ISSF vloží skript widgetu z Continea a dá mu token. Widget je
   plávajúce tlačidlo a panel; bez knižníc, v Shadow DOM, farba organizácie.
3. Otázka ide na `/api/widget/<kanál>/chat` na doméne organizácie
   (`intranet.futbalsfz.sk`) s tokenom. Contineo token overí, osobu si
   založí alebo spáruje (bez prístupu do intranetu), odpovie z predpisov
   a FAQ kanála — **len verejný obsah** — a odpoveď zapíše na hodnotenie.
4. Palec dole dvakrát v rozhovore → widget ponúkne **napísať helpdesku**.
   Ticket pristane vo fronte riešiteľov kanála (Kanály → Tickety), riešiteľ
   odpovie e-mailom na adresu z tokenu.

## Čo urobí správca kanála (Contineo)

Kanály (menu, správca organizácie) → kanál typu **widget**:

- **Kľúč kanála** pridelí Contineo pri založení (UUID, napr.
  `6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b`); je na obrazovke kanála.
  Odovzdať prevádzkovateľovi ISSF spolu s tajným kľúčom — ide do `aud`
  tokenu a do adresy skriptu.
- **Povolené pôvody**: `https://issf.futbalsfz.sk` (presný pôvod stránky,
  bez cesty). Z iného pôvodu API odpovie 403.
- **Tajný kľúč**: „Vytvoriť nový tajný kľúč" — ukáže sa **raz**;
  odovzdať prevádzkovateľovi ISSF bezpečným kanálom. Každé ďalšie vytvorenie
  starý zneplatní. Kľúč kanála je verejný (je v adrese skriptu), tajný kľúč
  nie — podpisuje ním tokeny len server ISSF.
- **Obsah kanála** (priečinky knižnice) a **jazyky** — prvý jazyk je jazyk
  textov widgetu, keď token jazyk nenesie.
- **Strop otázok na osobu a hodinu** (predvolene 60).

## Čo urobí ISSF

### 1. Vydávanie tokenu

Na strane servera ISSF, pre prihláseného používateľa, JWT **HS256**
podpísaný tajným kľúčom kanála:

Názvy `iss`, `aud`, `sub`, `iat`, `exp` sú **štandardné claimy JWT**
a `given_name`, `family_name`, `email` štandardné claimy OIDC (rovnaké
posielajú tokeny Microsoftu a Googlu). Každá JWT knižnica ich sama nastaví
aj overí; preto nemajú vlastné názvy (rozhodnutie Jána 6. 10. 2026).

| claim | význam v ISSF |
|---|---|
| `iss` | **kto token vydal** — pôvod stránky ISSF, napr. `https://issf.futbalsfz.sk`. Musí byť medzi povolenými pôvodmi kanála v Contineu. |
| `aud` | **pre koho je** — kľúč kanála v Contineu (UUID z obrazovky kanála), napr. `6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b`. |
| `sub` | **jedinečný identifikátor osoby v ISSF** — registračné číslo. Podľa neho sa osoba pri ďalšej otázke spozná a riešiteľ ju podľa neho nájde v ISSF. (Iný systém by sem dal svoj identifikátor, napr. platforma Sportnet `sportnetID`.) |
| `email` | e-mail účtu — sem príde odpoveď helpdesku. Musí byť v ISSF overený. |
| `given_name` | meno |
| `family_name` | priezvisko |
| `name` | celé meno — len záloha, keď `given_name` a `family_name` chýbajú |
| `roles` | pole rolí, napr. `["klubový manažér", "rozhodca"]` — vyberá FAQ pre publikum, riešiteľ ich vidí pri tickete |
| `club` | klub (nepovinné) |
| `lang` | `sk`, `cs` alebo `en` (nepovinné) |
| `iat`, `exp` | vydanie a platnosť; `exp − iat` **najviac 15 minút** |

Token s dlhšou platnosťou Contineo odmietne (`widget.tokenClaims`).
Tolerancia hodín je 60 s.

Príklad (Node):

```js
const { createHmac } = require("node:crypto")
const CHANNEL_KEY = "6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b" // kľúč kanála z Continea
const b64 = s => Buffer.from(s).toString("base64url")
function issueToken(user, secret) {
  const iat = Math.floor(Date.now() / 1000)
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = b64(JSON.stringify({
    iss: "https://issf.futbalsfz.sk", aud: CHANNEL_KEY, sub: user.registrationNumber,
    email: user.email, given_name: user.firstName, family_name: user.lastName,
    roles: user.roles, club: user.club, lang: "sk",
    iat, exp: iat + 15 * 60,
  }))
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")
  return `${header}.${payload}.${sig}`
}
```

### 2. Obnova tokenu

Token platí 15 minút, stránka ISSF dlhšie. ISSF vystaví **endpoint na
rovnakom pôvode** (napr. `GET /api/contineo-token`), ktorý prihlásenému
používateľovi vráti nový token — ako čistý text alebo `{"token": "…"}`.
Widget ho zavolá sám, keď API odpovie 401.

### 3. Vloženie skriptu

```html
<script src="https://intranet.futbalsfz.sk/api/widget/6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b/script"
        data-token="<token vydaný pri načítaní stránky>"
        data-token-url="/api/contineo-token" defer></script>
```

Skript sa cachuje hodinu; zmena textov alebo farby v Contineu sa prejaví
do hodiny bez zásahu v ISSF.

## Skúška bez ISSF

Kým ISSF token nevydáva, krok 5 sa dá vyskúšať lokálnou stránkou, ktorá
token podpíše tajným kľúčom kanála sama (to isté, čo urobí ISSF):

```bash
cd app && npm run widget:test -- --company SFZ --channel 6f1d2c3a-9b4e-4c7d-8a2f-1e5b7c9d0a3b --origin http://localhost:4567 --app https://intranet.futbalsfz.sk --email jan@klub.sk --given Ján --family Letko --sub 1234567
```

`--channel` je kľúč kanála z jeho obrazovky. Predtým v Kanáloch pridať
`http://localhost:4567` medzi povolené pôvody kanála. Stránka beží na tom pôvode, vloží skript widgetu
z aplikácie a pri 401 si vyžiada nový token z `/token`. Po skúške pôvod
z kanála odobrať.

## Čo API vracia

| volanie | odpoveď |
|---|---|
| `POST …/chat` `{token, query, language?}` | SSE stream ako `/api/chat` (`phase`, `token`, `citation`, `done`) + `{type:"recorded", id}` po zápise odpovede; 401 s `{error:"widget.token…"}` pri zlom tokene; 429 `widget.rateLimited` nad stropom |
| `POST …/feedback` `{token, id, verdict: 0\|1}` | `{ok:true}`; len vlastné záznamy |
| `POST …/ticket` `{token, message, conversation:[{recordId, question, verdict}]}` | `{ok:true, id}` — ticket vo fronte kanála |

Všetky volania vyžadujú hlavičku `Origin` z povolených pôvodov; preflight
`OPTIONS` vracia 204 s CORS hlavičkami pre ten pôvod.

## Osobné údaje

- Osoba z tokenu sa hľadá podľa identifikátora (`sub`), potom podľa
  **e-mailu** — zamestnanec s rovnakou adresou v ISSF aj intranete sa len
  spáruje a intranet mu ostáva. Inak sa založí s druhom **`external`**:
  **nemôže sa prihlásiť do intranetu**, aj keby mala adresu, ktorú by
  prihlásenie prijalo. Import osôb správcom druh prepíše a tým ju pustí dnu.
- E-mail, meno, priezvisko, roly, klub a registračné číslo (`sub`) sú
  kópia z tokenu v čase otázky; riešiteľ ich vidí pri tickete.
- Otázky a odpovede sú záznamy v `evaluations` ako pri intranete
  (hodnotenie, kurácia); účel „helpdesk" patrí do informovania dotknutých
  osôb (ADR-022) — doplní DPO.
