import { locales, getDictionary } from "@/lib/dictionaries";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const dict = getDictionary(params.lang);
  const title =
    "Contineo — " +
    (params.lang === "en" ? "intelligent search & helpdesk" : "inteligentné vyhľadávanie a helpdesk");
  return {
    title,
    description: dict.metaDescription,
    alternates: {
      canonical: `/${params.lang}`,
      languages: { sk: "/sk", en: "/en", "x-default": "/sk" },
    },
    openGraph: {
      title,
      description: dict.metaDescription,
      url: `/${params.lang}`,
      locale: params.lang === "en" ? "en_US" : "sk_SK",
    },
    twitter: {
      title,
      description: dict.metaDescription,
    },
  };
}

export default function LangLayout({ children, params }) {
  return <div lang={params.lang}>{children}</div>;
}
