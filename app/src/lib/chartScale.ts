/**
 * chartScale.ts — os stĺpcového grafu z design systému („Grafy a matice").
 * Spoločné pre Prehľad spotreby AI a štatistiku posudkov.
 */

/** Horná hranica osi: okrúhle číslo tesne nad maximom, nech graf nie je prázdny. */
export function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * p).find(x => x >= v) ?? 10 * p
}
