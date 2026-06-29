import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pingtally",
    short_name: "Pingtally",
    description: "ניהול הוצאות, קבלות, קניות ותקציבים מתוך וואטסאפ.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F1",
    theme_color: "#0F766E",
    lang: "he",
    dir: "rtl",
    icons: [
      { src: "/pingtally-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pingtally-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
