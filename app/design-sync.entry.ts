/*
 * Vstup pre /design-sync (3. 10. 2026). Re-exportuje skutočné komponenty
 * aplikácie — žiadna kópia ani náhrada. Sú tu len tie, ktoré nezávisia od
 * Nextu (next/link, next/navigation), relácie ani databázy; ostatné by sa
 * v Claude Design nevykreslili. Vzhľad zvyšku aplikácie nesú triedy
 * v globals.css (.button, .tabs, .view-switch, .empty, .card, .page-head).
 */
export { default as Icon } from "./src/components/Icon"
export { ContineoMark } from "./src/components/ContineoMark"
export { default as SearchStrip } from "./src/components/SearchStrip"
export { default as Select } from "./src/components/Select"
export { default as MultiSelect } from "./src/components/MultiSelect"
export { Skeleton, SkeletonCard, SkeletonList } from "./src/components/Skeleton"
export { default as Fact } from "./src/components/Fact"
export { default as TabsBar } from "./src/components/TabsBar"
export { default as CopyLink } from "./src/components/CopyLink"
