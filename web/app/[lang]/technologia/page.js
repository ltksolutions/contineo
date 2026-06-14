import { notFound } from "next/navigation";
import { locales, getDictionary } from "@/lib/dictionaries";
import Nav from "@/components/Nav";
import Tech from "@/components/Tech";
import Footer from "@/components/Footer";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const dict = getDictionary(params.lang);
  return {
    title: "Contineo — " + dict.tech.navLabel,
    description: dict.tech.subtitle,
  };
}

export default function TechnologiaPage({ params }) {
  const { lang } = params;
  if (!locales.includes(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <Nav dict={dict} lang={lang} />
      <Tech dict={dict} lang={lang} />
      <Footer dict={dict} lang={lang} />
    </>
  );
}
