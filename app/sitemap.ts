import type { MetadataRoute } from "next";
import { getAllMissionIds } from "@/lib/missions";

const SITE_URL = "https://artemis2.lesueur.uk";

export default function sitemap(): MetadataRoute.Sitemap {
  const missionEntries = getAllMissionIds().map((id) => ({
    url: `${SITE_URL}/missions/${id}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...missionEntries,
  ];
}
