/**
 * widget-test.mjs — skúšobná stránka widgetu bez cudzieho systému (ADR-028, D166).
 *
 * Spustí malý HTTP server na povolenom pôvode kanála, vydá token podpísaný
 * tajomstvom kanála (to isté, čo by urobil ISSF) a vloží skript widgetu
 * z Continea. Tak sa dá krok 5 vyskúšať naostro skôr, než token vydáva
 * prevádzkovateľ ISSF.
 *
 *   npm run widget:test -- --company SFZ --channel issf --origin http://localhost:4567 \
 *     --app https://intranet.futbalsfz.sk --email jan@klub.sk --given Ján --family Letko --sub 1234567
 *
 * Predpoklady: kanál má tajomstvo widgetu a `--origin` je medzi jeho
 * povolenými pôvodmi (Organizácia → Helpdesk). Tajomstvo sa číta z databázy
 * a rozšifruje kľúčom `OAUTH_SECRET_ENCRYPTION_KEY` — rovnaký tvar ako
 * `lib/secrets.ts` (`v1.<iv>.<tag>.<cipher>`, AES-256-GCM, base64url).
 * Nič sa nezapisuje.
 */

import http from "node:http"
import { createDecipheriv, createHmac } from "node:crypto"
import { MongoClient } from "mongodb"

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] ?? ""] : [])).filter(x => x.length))
const company = args.company ?? "SFZ"
const channelKey = args.channel ?? "issf"
const origin = (args.origin ?? "http://localhost:4567").replace(/\/+$/, "")
const app = (args.app ?? "https://intranet.futbalsfz.sk").replace(/\/+$/, "")
const person = { sub: args.sub ?? "1234567", email: args.email ?? "test@example.com", given: args.given ?? "Test", family: args.family ?? "Osoba", roles: (args.roles ?? "klubový manažér").split(",").map(s => s.trim()).filter(Boolean), club: args.club ?? "FK Test", lang: args.lang ?? "sk" }

function decrypt(stored, hex) {
  const [v, iv, tag, data] = stored.split(".")
  if (v !== "v1") throw new Error("neznámy tvar tajomstva")
  const d = createDecipheriv("aes-256-gcm", Buffer.from(hex, "hex"), Buffer.from(iv, "base64url"))
  d.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8")
}
const b64 = s => Buffer.from(s).toString("base64url")
function sign(secret) {
  const iat = Math.floor(Date.now() / 1000)
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payload = b64(JSON.stringify({ iss: origin, aud: channelKey, sub: person.sub, email: person.email, given_name: person.given, family_name: person.family, roles: person.roles, club: person.club, lang: person.lang, iat, exp: iat + 15 * 60 }))
  return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`
}

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const channel = await client.db(process.env.MONGODB_DB).collection("helpdesk_channels").findOne({ companyCode: company, key: channelKey })
await client.close()
if (!channel) { console.error(`Kanál ${company}/${channelKey} neexistuje.`); process.exit(1) }
if (!channel.widget?.secretEnc) { console.error("Kanál nemá tajomstvo widgetu — vytvor ho v Organizácia → Helpdesk."); process.exit(1) }
if (!(channel.widget.origins ?? []).some(o => o.replace(/\/+$/, "") === origin)) {
  console.error(`Pôvod ${origin} nie je medzi povolenými pôvodmi kanála (${(channel.widget.origins ?? []).join(", ") || "žiadne"}). Pridaj ho v Organizácia → Helpdesk.`)
  process.exit(1)
}
const secret = decrypt(channel.widget.secretEnc, process.env.OAUTH_SECRET_ENCRYPTION_KEY ?? "")

const page = () => `<!doctype html><html lang="${person.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Skúšobná stránka widgetu</title>
<style>body{font:16px/1.5 system-ui;margin:40px;color:#222}code{background:#eee;padding:2px 6px;border-radius:4px}</style></head>
<body><h1>Skúšobná stránka widgetu — ${channel.name}</h1>
<p>Prihlásená osoba (z tokenu): <b>${person.given} ${person.family}</b>, ${person.email}, ${person.roles.join(", ")}, ${person.club}, identifikátor ${person.sub}.</p>
<p>Skript: <code>${app}/api/widget/${channelKey}/script</code>. Token platí 15 minút, widget si pri 401 vyžiada nový z <code>/token</code>.</p>
<script src="${app}/api/widget/${encodeURIComponent(channelKey)}/script" data-token="${sign(secret)}" data-token-url="/token" defer></script>
</body></html>`

const port = Number(new URL(origin).port || 80)
http.createServer((req, res) => {
  if (req.url === "/token") { res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }); res.end(sign(secret)); return }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(page())
}).listen(port, () => console.log(`Skúšobná stránka: ${origin}  (kanál ${company}/${channelKey}, aplikácia ${app})`))
