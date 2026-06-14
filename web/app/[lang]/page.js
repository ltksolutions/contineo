import { notFound } from "next/navigation";
import { locales, getDictionary, sampleKB } from "@/lib/dictionaries";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import BotDemo from "@/components/BotDemo";
import Audience from "@/components/Audience";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home({ params }) {
  const { lang } = params;
  if (!locales.includes(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <Nav dict={dict} lang={lang} />
      <main>
        <Hero dict={dict} />
        <Features dict={dict} />
        <HowItWorks dict={dict} />
        <BotDemo dict={dict} kb={sampleKB[lang]} />
        <Audience dict={dict} />
        <CTA dict={dict} />
      </main>
      <Footer dict={dict} lang={lang} />
    </>
  );
}
