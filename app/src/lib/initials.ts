/**
 * Iniciály z mena, a keď meno nie je, z adresy.
 *
 * Samostatný modul bez `"use client"`, aby ich mohla použiť aj serverová
 * stránka (karta kontaktu na znení). `Header.tsx` ich odtiaľto preberá.
 */
export function initials(name: string | undefined, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  if (words.length === 1 && words[0].length > 0) return words[0].slice(0, 2).toUpperCase()
  const before = email.split("@")[0] ?? ""
  return (before.slice(0, 2) || "?").toUpperCase()
}
