import { locales, getDictionary } from "@/lib/dictionaries";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

/** Podtitul, OG locale a text preskočenia pre každý jazyk na jednom mieste. */
const META = {
  sk: { podtitul: "inteligentné vyhľadávanie a helpdesk", ogLocale: "sk_SK", skip: "Preskočiť na obsah" },
  cs: { podtitul: "inteligentní vyhledávání a helpdesk",  ogLocale: "cs_CZ", skip: "Přeskočit na obsah" },
  en: { podtitul: "intelligent search & helpdesk",        ogLocale: "en_US", skip: "Skip to content" },
};

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const dict = getDictionary(lang);
  const meta = META[lang] ?? META.sk;
  const title = "Contineo — " + meta.podtitul;
  return {
    title,
    description: dict.metaDescription,
    alternates: {
      canonical: `/${lang}`,
      // hreflang pre všetky mutácie — inak si vyhľadávače myslia,
      // že ide o duplicitný obsah.
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `/${l}`])),
        "x-default": "/sk",
      },
    },
    openGraph: {
      title,
      description: dict.metaDescription,
      url: `/${lang}`,
      locale: meta.ogLocale,
    },
    twitter: {
      title,
      description: dict.metaDescription,
    },
  };
}

export default async function LangLayout({ children, params }) {
  const { lang } = await params;
  const skip = (META[lang] ?? META.sk).skip;
  return (
    <div lang={lang}>
      <a href="#main" className="skip-link">{skip}</a>
      {children}
    </div>
  );
}
