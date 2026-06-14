export default function JsonLd({ dict, lang }) {
  const base = "https://contineo.app";
  const url = `${base}/${lang}`;
  const desc = dict.metaDescription;

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: "Contineo",
        url: base,
        logo: `${base}/icon-512.png`,
        email: "office@contineo.app",
        description: desc,
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name: "Contineo",
        inLanguage: lang === "en" ? "en" : "sk",
        publisher: { "@id": `${base}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "Contineo",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: desc,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        publisher: { "@id": `${base}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
