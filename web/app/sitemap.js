import { locales } from "@/lib/dictionaries";

export default function sitemap() {
  const base = "https://contineo.app";
  const now = new Date();
  const paths = ["", "/technologia"];
  const urls = [];

  for (const lang of locales) {
    for (const p of paths) {
      urls.push({
        url: `${base}/${lang}${p}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: p === "" ? 1 : 0.8,
        alternates: {
          languages: Object.fromEntries(locales.map((l) => [l, `${base}/${l}${p}`])),
        },
      });
    }
  }
  return urls;
}
