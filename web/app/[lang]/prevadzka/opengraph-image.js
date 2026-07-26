import { locales } from "@/lib/dictionaries";
import { ogObrazok, OG_SIZE, OG_TYPE } from "@/lib/og";

export const alt = "Contineo";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function Image({ params }) {
  return ogObrazok(params.lang, "prevadzka");
}
