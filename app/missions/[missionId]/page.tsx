import type { Metadata } from "next";
import { getAllMissionIds, getMission } from "@/lib/missions";
import { notFound } from "next/navigation";
import TrackerClient from "./tracker-client";

const SITE_URL = "https://artemis2.lesueur.uk";

export async function generateStaticParams() {
  return getAllMissionIds().map((id) => ({ missionId: id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ missionId: string }>;
}): Promise<Metadata> {
  const { missionId } = await params;
  const mission = getMission(missionId);
  if (!mission) return {};

  const title = `${mission.name} Tracker — Real-Time 3D Mission Visualization`;
  const description = mission.description;
  const url = `${SITE_URL}/missions/${missionId}`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      url,
      title: `${mission.name} Tracker`,
      description,
      siteName: "Space Mission Tracker",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${mission.name} mission trajectory`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${mission.name} Tracker`,
      description,
      images: ["/opengraph-image"],
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function MissionPage({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  const { missionId } = await params;
  const mission = getMission(missionId);
  if (!mission) notFound();

  return <TrackerClient missionId={missionId} />;
}
