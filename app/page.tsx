import type { Metadata } from "next";
import TrackerClient from "./tracker-client";

const SITE_URL = "https://artemis2-ten.vercel.app";

export const metadata: Metadata = {
  title: "Artemis II Tracker — Real-Time 3D Mission Visualization",
  description:
    "Track NASA's Artemis II crewed lunar flyby mission in real time with an interactive 3D visualization built from official NASA OEM ephemeris data.",
  metadataBase: new URL(SITE_URL),
  keywords: [
    "Artemis II",
    "NASA",
    "moon",
    "lunar flyby",
    "Orion",
    "space tracker",
    "3D visualization",
    "mission tracker",
  ],
  authors: [{ name: "Gary Le Sueur" }],
  creator: "Gary Le Sueur",
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Artemis II Tracker",
    description:
      "Interactive 3D tracker for NASA's Artemis II crewed lunar flyby mission, using real NASA ephemeris data.",
    siteName: "Artemis II Tracker",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Artemis II mission trajectory — Earth to Moon and back",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Artemis II Tracker",
    description:
      "Interactive 3D tracker for NASA's Artemis II crewed lunar flyby mission.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function Home() {
  return <TrackerClient />;
}
