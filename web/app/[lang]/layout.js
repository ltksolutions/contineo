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
  const dict = getDictionary(params.lang);
  const meta = META[params.lang] ?? META.sk;
  const title = "Contineo — " + meta.podtitul;
  return {
    title,
    description: dict.metaDescription,
    alternates: {
      canonical: `/${params.lang}`,
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
      url: `/${params.lang}`,
      locale: meta.ogLocale,
    },
    twitter: {
      title,
      description: dict.metaDescription,
    },
  };
}

export default function LangLayout({ children, params }) {
  const skip = (META[params.lang] ?? META.sk).skip;
  return (
    <div lang={params.lang}>
      <a href="#main" className="skip-link">{skip}</a>
      {children}
    </div>
  );
}
