import { notFound } from "next/navigation";
import { locales, getDictionary } from "@/lib/dictionaries";
import Nav from "@/components/Nav";
import UseCases from "@/components/UseCases";
import Versions from "@/components/Versions";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }) {
  const dict = getDictionary(params.lang);
  return {
    title: "Contineo — " + dict.usecases.navLabel,
    description: dict.usecases.subtitle,
  };
}

export default function PreKohoPage({ params }) {
  const { lang } = params;
  if (!locales.includes(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <Nav dict={dict} lang={lang} />
      <main>
        <UseCases dict={dict} />
        {/* Verzie patria aj sem — je to spolocny menovatel vsetkych styroch
            segmentov a bez neho zostava „pre koho" len zoznamom odvetvi. */}
        <Versions dict={dict} />
        <CTA dict={dict} />
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
