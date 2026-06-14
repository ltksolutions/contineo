export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://contineo.app/sitemap.xml",
    host: "https://contineo.app",
  };
}
