export default function manifest() {
  return {
    name: "Contineo — vyhľadávanie a potvrdzovanie predpisov",
    short_name: "Contineo",
    description:
      "Vyhľadávanie a riadenie predpisov nad obsahom vašej organizácie — odpoveď s citáciou, potvrdzovanie s dôkazom.",
    start_url: "/sk",
    display: "standalone",
    background_color: "#0d1016",
    theme_color: "#11151c",
    lang: "sk",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
