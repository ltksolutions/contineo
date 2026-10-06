# Widget helpdesku pre cudzí systém (ISSF)

> Pre Sportnet (vývojár ISSF) a správcu kanála v Contineu. Rozhodnutie:
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
   Ticket pristane vo fronte riešiteľov kanála (`/helpdesk`), riešiteľ
   odpovie e-mailom na adresu z tokenu.

## Čo urobí správca kanála (Contineo)

Organizácia → Helpdesk → kanál:

- **Povolené pôvody**: `https://issf.futbalsfz.sk` (presný pôvod stránky,
  bez cesty). Z iného pôvodu API odpovie 403.
- **Tajomstvo widgetu**: „Vytvoriť nové tajomstvo" — ukáže sa **raz**;
  odovzdať Sportnetu bezpečným kanálom. Každé ďalšie vytvorenie staré
  zneplatní.
- **Obsah kanála** (priečinky knižnice) a **jazyky** — prvý jazyk je jazyk
  textov widgetu, keď token jazyk nenesie.
- **Strop otázok na osobu a hodinu** (predvolene 60).

## Čo urobí ISSF (Sportnet)

### 1. Vydávanie tokenu

Na strane servera ISSF, pre prihláseného používateľa, JWT **HS256**
podpísaný tajomstvom kanála:

| claim | hodnota |
|---|---|
| `iss` | pôvod stránky ISSF, napr. `https://issf.futbalsfz.sk` — musí byť medzi povolenými pôvodmi kanála |
| `aud` | kľúč kanála, napr. `issf` |
| `sub` | stabilný identifikátor osoby v ISSF (Sportnet ID) |
| `email` | e-mail osoby — sem príde odpoveď helpdesku |
| `name` | meno a priezvisko |
| `roles` | pole rolí, napr. `["klubový manažér", "rozhodca"]` — vyberá FAQ pre publikum |
| `club` | klub (nepovinné) |
| `lang` | `sk`, `cs` alebo `en` (nepovinné) |
| `iat`, `exp` | vydanie a platnosť; `exp − iat` **najviac 15 minút** |

Token s dlhšou platnosťou Contineo odmietne (`widget.tokenClaims`).
Tolerancia hodín je 60 s.

Príklad (Node):

```js
const { createHmac } = require("node:crypto")
const b64 = s => Buffer.from(s).toString("base64url")
function issueToken(user, secret) {
  const iat = Math.floor(Date.now() / 1000)
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = b64(JSON.stringify({
    iss: "https://issf.futbalsfz.sk", aud: "issf", sub: user.sportnetId,
    email: user.email, name: user.displayName, roles: user.roles, club: user.club, lang: "sk",
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
<script src="https://intranet.futbalsfz.sk/api/widget/issf/script"
        data-token="<token vydaný pri načítaní stránky>"
        data-token-url="/api/contineo-token" defer></script>
```

Skript sa cachuje hodinu; zmena textov alebo farby v Contineu sa prejaví
do hodiny bez zásahu v ISSF.

## Čo API vracia

| volanie | odpoveď |
|---|---|
| `POST …/chat` `{token, query, language?}` | SSE stream ako `/api/chat` (`phase`, `token`, `citation`, `done`) + `{type:"recorded", id}` po zápise odpovede; 401 s `{error:"widget.token…"}` pri zlom tokene; 429 `widget.rateLimited` nad stropom |
| `POST …/feedback` `{token, id, verdict: 0\|1}` | `{ok:true}`; len vlastné záznamy |
| `POST …/ticket` `{token, message, conversation:[{recordId, question, verdict}]}` | `{ok:true, id}` — ticket vo fronte kanála |

Všetky volania vyžadujú hlavičku `Origin` z povolených pôvodov; preflight
`OPTIONS` vracia 204 s CORS hlavičkami pre ten pôvod.

## Osobné údaje

- Osoba z tokenu sa založí v `persons` s príznakom `widgetOnly` —
  **nemôže sa prihlásiť do intranetu**, aj keby mala adresu, ktorú by
  prihlásenie prijalo. Import osôb správcom príznak zhodí.
- E-mail, meno, roly a klub sú kópia z tokenu v čase otázky.
- Otázky a odpovede sú záznamy v `evaluations` ako pri intranete
  (hodnotenie, kurácia); účel „helpdesk" patrí do informovania dotknutých
  osôb (ADR-022) — doplní DPO.
