import { notFound } from "next/navigation";
import { locales, getDictionary } from "@/lib/dictionaries";
import Nav from "@/components/Nav";
import Security from "@/components/Security";
import Residency from "@/components/Residency";
import Identity from "@/components/Identity";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const dict = getDictionary(params.lang);
  return {
    title: "Contineo — " + dict.residency.navLabel,
    description: dict.residency.subtitle,
  };
}

export default function BezpecnostPage({ params }) {
  const { lang } = params;
  if (!locales.includes(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <Nav dict={dict} lang={lang} />
      <main>
        <Security dict={dict} />
        <Residency dict={dict} />
        <Identity dict={dict} />
        <CTA dict={dict} />
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
