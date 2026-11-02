"use client"

/**
 * Pole Druh pri nahrávaní dokumentu s možnosťou založiť nový druh
 * (ZAKLAD-novy-druh-pri-nahravani, 2. 11. 2026).
 *
 * Kto smie: len správca číselníkov (`canCreate`, správca osôb — Q1). Ostatní
 * vidia pri prázdnom hľadaní vetu, kto druh pridá.
 *
 * **Druh nevzniká tu, ale pri odoslaní** (Q3): formulár pošle `categoryNew`
 * a `categoryRole` a `uploadAction` založí položku číselníka naraz
 * s dokumentom. Nedokončené nahrávanie tak nenechá v číselníku osirelý druh.
 *
 * Bez JavaScriptu ostáva len výber z existujúcich (`<noscript>` vo `Select`).
 *
 * **Úprava dokumentu** (3. 11. 2026) používa to isté pole s `editing`: druh je
 * tam nepovinný (prvá voľba „— neurčené —"), predvyplnený súčasným
 * a nový vzniká pri „Uložiť údaje" — `saveDocumentMetadataAction` volá ten
 * istý `categoryFromForm`.
 */

import { useState } from "react"
import Select, { type SelectOption } from "./Select"
import { dictionary, type UiLanguage } from "@/lib/i18n"

const ROLES = ["binding", "guidance", "record"] as const

export default function CategoryField({
  options,
  canCreate,
  language,
  editing,
}: {
  options: SelectOption[]
  canCreate: boolean
  language: UiLanguage
  /** Úprava existujúceho dokumentu: súčasný druh a popis voľby „neurčené". */
  editing?: { initial: string; unsetLabel: string }
}) {
  const d = dictionary(language)
  const t = d.library.upload
  const tl = d.library.list
  const tr = d.org.codelists
  // Text nového druhu; `null` = vyberá sa z existujúcich.
  const [fresh, setFresh] = useState<string | null>(null)

  if (fresh === null) {
    return (
      <div className="field">
        <span className="field-label">{tl.category}</span>
        <Select language={language}
          name="category"
          required={!editing}
          searchable
          fieldLabel={tl.category}
          options={editing ? [{ value: "", label: editing.unsetLabel }, ...options] : options}
          initial={editing?.initial}
          emptyText={canCreate ? undefined : t.categoryNoRight}
          onCreate={canCreate ? setFresh : undefined}
          createLabel={t.categoryCreate("{text}")}
        />
        {!editing && <span className="quiet field-hint">{t.categoryNote}</span>}
        {!editing && <p className="field-error"><span className="field-error-mark" aria-hidden="true">!</span>{t.categoryMissing}</p>}
      </div>
    )
  }

  return (
    <div className="field">
      <span className="field-label">{tl.category} <span className="quiet">· {t.categoryNewTag}</span></span>
      <input className="field-input" name="categoryNew" required autoFocus
        defaultValue={fresh} aria-label={t.categoryNewLabel} />
      <span className="quiet field-hint">{editing ? t.categoryNewHintEdit : t.categoryNewHint}</span>
      <p className="field-error"><span className="field-error-mark" aria-hidden="true">!</span>{t.categoryMissing}</p>
      <button type="button" className="button button--quiet button--sm category-back" onClick={() => setFresh(null)}>
        {t.categoryPickExisting}
      </button>
      <label className="field category-role">
        <span className="field-label">{tr.roleLabel}</span>
        <Select language={language}
          name="categoryRole"
          initial="guidance"
          fieldLabel={tr.roleLabel}
          options={ROLES.map(r => ({ value: r, label: tr.roles[r] }))}
        />
        <span className="quiet field-hint">{tr.roleHint}</span>
      </label>
    </div>
  )
}
