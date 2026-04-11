import type { Metadata } from "next";
import { getAllMissions } from "@/lib/missions";
import WorldClient from "./world-client";

const SITE_URL = "https://artemis2.lesueur.uk";

export const metadata: Metadata = {
  title: "Space Tracker — Real-Time 3D Mission Visualization",
  description:
    "Track NASA space missions in real time with interactive 3D visualizations built from official NASA OEM ephemeris data.",
  metadataBase: new URL(SITE_URL),
  keywords: [
    "Artemis",
    "NASA",
    "moon",
    "space tracker",
    "3D visualization",
    "mission tracker",
  ],
  authors: [{ name: "Gary Le Sueur" }],
  creator: "Gary Le Sueur",
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Space Tracker",
    description:
      "Interactive 3D tracker for NASA space missions, using real NASA ephemeris data.",
    siteName: "Space Tracker",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Space mission tracker — Earth to Moon and back",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Space Tracker",
    description:
      "Interactive 3D tracker for NASA space missions.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function Home() {
  const missions = getAllMissions();
  return <WorldClient missions={missions} />;
}
