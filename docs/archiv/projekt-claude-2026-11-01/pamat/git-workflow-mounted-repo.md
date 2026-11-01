---
name: git-workflow-mounted-repo
description: "Git na Contineo: z mountu len čítať, ale commit/push/test/build spúšťať cez Control your Mac"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dfc916c7-c621-4765-baca-93c7daccec20
  modified: 2026-08-27T00:00:00.000Z
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

Pri Contineo (a každom repozitári v Cowork-mountovanom priečinku) platí **rozdiel medzi dvomi prostrediami** — pomýlil som si ich a zbytočne som mesiac diktoval používateľovi príkazy, ktoré som mohol spustiť sám.

**Z mountu (`device_bash`, staršie `mcp__workspace__bash`) — len čítanie a editácia súborov.** Tento shell beží v **Linux VM**, nie na macOS; priečinok je len primountovaný. Dôsledky:
- Mount blokuje `unlink` na `.git/*.lock` („Operation not permitted"), takže aj obyčajný `git status` alebo `git diff` po sebe nechá `.git/index.lock`, ktorý potom **blokuje git na Macu**. Overené znovu 2026-08-27 — commit cez Control your Mac zlyhal presne na tomto. Náprava: `rm -f .git/index.lock` (a `.git/HEAD.lock`, `.git/objects/maintenance.lock`) — spúšťam to preventívne pred každým commitom.
- Nemá SSH kľúč a nedosiahne github.com.
- **`npm test` ani `npm run build` tam nebežia**: `node_modules` sú nainštalované pre macOS/arm64, takže `esbuild` aj `next` padnú na „You installed esbuild for another platform". Nie je to chyba kódu.

Takže z `device_bash`: čítať, hľadať, editovať súbory (python read-modify-write, `sed -i`) — áno. `commit`, `push`, `npm test`, `npm run build` — nie.

**Cez `Control your Mac` (`osascript` + `do shell script`) — všetko.** Beží priamo na Macu, kde SSH kľúč, zámky aj natívne binárky fungujú. Príklad:

```
do shell script "export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; cd $HOME/Documents/GitHub/contineo && rm -f .git/index.lock && npm test 2>&1 | tail -20"
```

`export PATH` je nutný — `do shell script` nemá homebrew v ceste, takže bez neho `npm` ani `node` nenájde. Pozor aj na to, že `git fetch origin 2>&1` sa v `do shell script` občas rozbije (git dostane `2` ako refspec) — presmerovanie radšej vynechať alebo dať príkaz do samostatného volania.

**Ako to používať:** commitovať, pushovať a testovať sám cez Control your Mac; používateľ o to výslovne požiadal (2026-07-27, znovu 2026-08-27). Viď [[contineo-project]] a [[terminal-commands-preference]].
