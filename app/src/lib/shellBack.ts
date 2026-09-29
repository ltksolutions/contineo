/**
 * shellBack.ts — kam vrátiť človeka po prepnutí panela (`shellActions.ts`).
 *
 * Čistá funkcia, aby sa dala otestovať: `Referer` píše klient, takže sa
 * z neho berie len cesta, a to len vtedy, keď ukazuje na ten istý hostiteľ.
 * Inak domov — radšej o stránku vedľa než presmerovanie mimo portálu.
 */
export function sameOriginPath(referer: string | null | undefined, host: string | null | undefined): string {
  if (!referer || !host) return "/"
  try {
    const url = new URL(referer)
    if (url.host !== host) return "/"
    const path = `${url.pathname}${url.search}`
    // `//evil.sk` by prehliadač chápal ako inú doménu.
    return path.startsWith("/") && !path.startsWith("//") ? path : "/"
  } catch {
    return "/"
  }
}
