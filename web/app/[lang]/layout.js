import { locales, getDictionary } from "@/lib/dictionaries";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const dict = getDictionary(params.lang);
  return {
    title:
      "Contineo — " +
      (params.lang === "en" ? "intelligent search & helpdesk" : "inteligentné vyhľadávanie a helpdesk"),
    description: dict.metaDescription,
    alternates: {
      languages: { sk: "/sk", en: "/en" },
    },
  };
}

export default function LangLayout({ children, params }) {
  return <div lang={params.lang}>{children}</div>;
}
