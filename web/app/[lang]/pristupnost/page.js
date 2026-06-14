import { notFound } from "next/navigation";
import { locales, getDictionary } from "@/lib/dictionaries";
import Nav from "@/components/Nav";
import LegalArticle from "@/components/LegalArticle";
import Footer from "@/components/Footer";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const dict = getDictionary(params.lang);
  return { title: "Contineo — " + dict.legal.accessibility.title, description: dict.legal.accessibility.intro };
}

export default function AccessibilityPage({ params }) {
  const { lang } = params;
  if (!locales.includes(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Nav dict={dict} lang={lang} />
      <LegalArticle dict={dict} lang={lang} kind="accessibility" />
      <Footer dict={dict} lang={lang} />
    </>
  );
}
