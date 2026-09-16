/**
 * Kostry na čas čakania (O20).
 *
 * **Kostra, nie koliesko.** Točiace sa koliesko povie iba to, že sa čaká;
 * kostra povie aj to, čo príde — koľko toho bude a ako to bude rozložené.
 * Preto tu nie je žiadny všeobecný `<Loader />`: každá kostra má tvar
 * konkrétnej obrazovky a skladá sa z tých istých tried, aké používa hotová
 * stránka (`.panel-row`, `.card`). Kostra, po ktorej obsah poskočí, je horšia
 * než prázdne miesto.
 *
 * Všetko je **serverové a synchrónne**. `loading.tsx` sa musí vykresliť
 * okamžite; keby si čokoľvek z tohto niečo načítavalo, čakalo by sa dvakrát.
 *
 * Pre čítačku obrazovky kostra neexistuje — `aria-hidden` a `role="status"`
 * na obale. Zoznam prázdnych obdĺžnikov nie je informácia; informácia je
 * „načítava sa", a tú povie obal jednou vetou.
 */

import type { ReactNode } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"

/** Jeden obdĺžnik. Všetko ostatné v tomto súbore je len jeho skladba. */
export function Skeleton({
  className = "",
  width,
  height,
}: {
  className?: string
  width?: number | string
  height?: number | string
}) {
  return <span className={`skeleton ${className}`.trim()} style={{ width, height }} />
}

/**
 * Obal, ktorý čakanie pomenuje. Bez neho by čítačka obrazovky pri prechode na
 * stránku prečítala ticho — a človek, ktorý nevidí shimmer, by nevedel, či sa
 * niečo deje, alebo je stránka prázdna.
 */
export function SkeletonRegion({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="skeleton-label">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

/** Nadpis stránky (+ voliteľný podnadpis). Výška sedí s `h1`, takže sa obsah po načítaní neposunie. */
export function SkeletonHeading({ sub = true }: { sub?: boolean }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <Skeleton className="skeleton-title" />
      {sub && <Skeleton className="skeleton-sub" />}
    </div>
  )
}

/** Odsek textu. Posledný riadok je kratší — inak to vyzerá ako tabuľka, nie text. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`skeleton-line${i === lines - 1 ? " skeleton-line--last" : ""}`}
        />
      ))}
    </div>
  )
}

/**
 * Panel so zoznamom. `rows` sa nemá hádať vysoko: kostra desiatich riadkov nad
 * zoznamom o troch je viditeľný skok. Päť je počet, pri ktorom panel vyzerá
 * zaplnený a pritom sa málokedy preženie.
 */
export function SkeletonPanel({
  rows = 5,
  head = true,
  chip = false,
}: {
  rows?: number
  head?: boolean
  /** Pravý štítok v riadku — pre zoznamy so stavom (termín, rola, stav znenia). */
  chip?: boolean
}) {
  return (
    <div className="card panel">
      {head && (
        <div className="panel-head">
          <Skeleton className="skeleton-line" width={140} />
        </div>
      )}
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton-row-main">
            <Skeleton className="skeleton-line" width={`${58 + ((i * 11) % 30)}%`} />
            <Skeleton className="skeleton-line" width={`${28 + ((i * 7) % 22)}%`} height={10} />
          </div>
          {chip && <Skeleton className="skeleton-chip" />}
        </div>
      ))}
    </div>
  )
}

/** Karta s textom. Na detailných obrazovkách ich býva viac pod sebou. */
export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className="card">
      <Skeleton className="skeleton-line" width={120} />
      <div style={{ marginTop: 12 }}>
        <SkeletonText lines={lines} />
      </div>
    </div>
  )
}

/**
 * Formulár. Políčko je vysoké 38 px ako skutočné `input` — na formulárových
 * obrazovkách je skok najviditeľnejší, lebo človek už mieri kurzorom.
 */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} style={{ display: "grid", gap: 7 }}>
          <Skeleton className="skeleton-line" width={110} height={11} />
          <Skeleton height={38} />
        </div>
      ))}
      <Skeleton height={38} width={140} />
    </div>
  )
}

/**
 * Obrys `AppShell`-u pre `loading.tsx`.
 *
 * **Prečo vôbec musí existovať:** `AppShell` si vyžiada každá stránka sama,
 * nie je v `layout.tsx` (a to je zámer — viď jeho docstring). `loading.tsx`
 * nahrádza stránku, takže počas čakania zmizne aj pás odkazov. Bez obrysu by
 * obsah poskočil o jeho výšku hore a po načítaní zase dole — a práve skok je
 * to, čo na čakaní najviac vadí.
 *
 * Obe formy navigácie sú v strome naraz, rovnako ako v `AppNav`: pás pre
 * širokú obrazovku a 44 px prepínač zásuvky pre úzku. Prepína ich to isté
 * `@media` na 940 px, takže sa geometria nemôže rozísť s hotovou stránkou.
 *
 * Šesť položiek nie je náhoda — toľko ich vidí človek so všetkými rolami.
 * Kto má menej, uvidí kostru o kúsok širšiu než skutočnosť; opačná chyba
 * (kostra kratšia než pás) by vyzerala ako chýbajúci odkaz.
 */
export function SkeletonShell({
  language,
  children,
}: {
  /**
   * Jazyk vety pre čítačku. `loading.tsx` ho **nemá odkiaľ vziať** — osoba sa
   * číta z databázy a kostra sa musí vykresliť okamžite — takže zostane
   * predvolený. Je to jediné slovo na celej kostre; kvôli nemu sa oplatí
   * čakať menej než nič.
   */
  language?: UiLanguage
  children: ReactNode
}) {
  return (
    <div className="app-shell app-shell--topbar" role="status" aria-live="polite" aria-busy="true">
      <span className="skeleton-label">{dictionary(language).nav.loading}</span>

      <div className="app-nav app-nav--topbar skeleton-nav" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton className="skeleton-nav-item" key={i} width={62 + ((i * 17) % 40)} />
        ))}
      </div>

      {/* Úzka obrazovka: na mieste prepínača zásuvky. `div` s triedou
          `app-nav-toggle` drží presne tých 44 px, ktoré tam bude mať
          `summary` — kliknúť sa naň nedá a ani nemá, kostra nie je ovládací
          prvok. */}
      <div className="app-nav-drawer" aria-hidden="true">
        <div className="app-nav-toggle">
          <Skeleton className="skeleton-line" width={70} />
        </div>
      </div>

      <div className="app-main" aria-hidden="true">
        {children}
      </div>
    </div>
  )
}

/**
 * Pás filtrov a prepínačov nad zoznamom.
 *
 * Zoznamové obrazovky v tomto systéme majú nad sebou rovnaký pás: pár
 * prepínačov a pole na hľadanie (`/documents`, `/people`, `/hr`, `/library`).
 * Je vysoký cez 40 px, takže keby v kostre chýbal, celý zoznam by po načítaní
 * skočil o ten kus nadol.
 */
export function SkeletonToolbar({ buttons = 3, search = true }: { buttons?: number; search?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
      {Array.from({ length: buttons }, (_, i) => (
        <Skeleton key={i} height={32} width={78 + ((i * 23) % 44)} />
      ))}
      {search && <Skeleton height={32} width="min(240px, 100%)" />}
    </div>
  )
}

/**
 * Zoznam ako stĺpec kariet.
 *
 * **Nie `SkeletonPanel`.** Zoznamy predpisov, dokumentov a osôb nie sú panel
 * s riadkami — každá položka je vlastná `.card` s medzerou medzi nimi. Kostra
 * z panela by mala o tie medzery menej a po načítaní by sa celý zoznam
 * roztiahol. Panel zostáva pre widget na domovskej obrazovke, kde panel
 * naozaj je.
 */
export function SkeletonList({ items = 5, chip = true }: { items?: number; chip?: boolean }) {
  return (
    <div style={{ display: "grid", gap: "var(--gap)" }}>
      {Array.from({ length: items }, (_, i) => (
        <div className="card" key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: "1 1 160px", minWidth: 0, display: "grid", gap: 8 }}>
            <Skeleton className="skeleton-line" width={`${52 + ((i * 13) % 34)}%`} />
            <Skeleton className="skeleton-line" width={`${26 + ((i * 9) % 26)}%`} height={10} />
          </div>
          {chip && <Skeleton className="skeleton-chip" />}
        </div>
      ))}
    </div>
  )
}
