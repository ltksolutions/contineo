---
name: build-kazi-beziaci-dev-server
description: "Contineo: npm run build zhodí bežiaci npm run dev — zdieľajú .next; overovať buildom až po zastavení dev servera"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5a0f3083-f6ec-49e9-a2bd-8b758212103c
  modified: 2026-07-27T14:04:32.386Z
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

`npm run build` a `npm run dev` v `app/` (aj vo `web/`) zdieľajú priečinok `.next`. Keď spustím build na overenie zmien, **prepíše bežiacemu dev serveru chunky pod rukami** a ten začne vracať 404 alebo 500 na každú stránku. Stalo sa to dvakrát: raz vznikli tri sirotské inštancie na portoch 3000–3002, raz `GET / 500`.

Náprava je reštart dev servera, **nie mazanie `.next`** — to som overila, stačí:

```
pkill -f 'next dev' ; pkill -f 'next-server' ; sleep 3
cd ~/Documents/GitHub/contineo/app && npm run dev
```

**Ako to robiť správne:** počas ladenia s používateľom v prehliadači overovať cez `npm test` a `npm run type-check` (tie `.next` nechytajú). Build spustiť až na záver, keď dev server netreba — alebo ho pred buildom zastaviť a po ňom naštartovať znova. Po každom `pkill` skontrolovať, že nezostali sirotské procesy: `ps ax | grep -E 'next dev|next-server' | grep -v grep | wc -l`.

Viď [[git-workflow-mounted-repo]] a [[contineo-project]].
