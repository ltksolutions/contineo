# Contineo — prezentačný web

Dvojjazyčný (SK/EN) marketingový web pre **Contineo** — inteligentný helpdesk, ktorý odpovedá z overených noriem. Súčasťou je živé demo „inteligentného vyhľadávania" (ContineoBot) so vzorovými dátami.

## Technológie

- [Next.js 14](https://nextjs.org/) (App Router)
- React 18
- Čisté CSS (žiadne build závislosti navyše)

## Spustenie lokálne

```bash
npm install
npm run dev
```

Web beží na [http://localhost:3000](http://localhost:3000) a presmeruje na `/sk`. Anglická verzia je na `/en`.

## Produkčný build

```bash
npm run build
npm start
```

## Štruktúra

```
app/
  layout.js          # root layout + metadata
  page.js            # presmerovanie / -> /sk
  [lang]/
    layout.js        # generateStaticParams pre sk/en, metadata
    page.js          # skladá sekcie webu
  globals.css        # dizajn systém a brand Contineo
components/
  Nav, Hero, Features, HowItWorks, BotDemo, Audience, CTA, Footer, Icon
lib/
  dictionaries.js    # všetky texty SK/EN + vzorové dáta pre demo
```

## Obsah a preklady

Všetky texty sú v `lib/dictionaries.js` (objekty `sk` a `en`). Úprava textu = úprava jedného súboru, netreba zasahovať do komponentov. Vzorové otázky a odpovede pre demo bota sú tiež tam (`sampleKB`).

## Demo bota

Komponent `components/BotDemo.js` je zatiaľ čisto klientský s ukážkovými dátami. Pri ostrej prevádzke sa funkcia `answer()` nahradí volaním reálneho Contineo API (RAG endpoint) — vráti odpoveď, citácie a skóre, zvyšok UI ostáva.

## Nasadenie

Doména: **contineo.app** (TLD `.app` vynucuje HTTPS). Odporúčané nasadenie cez Vercel:

```bash
# po napojení repozitára na Vercel sa build spustí automaticky
npm run build
```

## Jazyky

- `/sk` — slovenčina (predvolené)
- `/en` — angličtina

Prepínač jazyka je v hlavičke aj v päte.
