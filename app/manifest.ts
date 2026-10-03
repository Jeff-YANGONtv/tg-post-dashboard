import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TG SEMI AUTO",
    short_name: "TG SEMI AUTO",
    description: "Manage Telegram content distribution from one dashboard.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#08111f",
    theme_color: "#08111f",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
