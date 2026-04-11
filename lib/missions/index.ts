import type { MissionConfig, MissionSummary } from "@/lib/types";
import { artemis2 } from "./artemis2/config";
import { artemis1 } from "./artemis1/config";

const missions: MissionConfig[] = [artemis2, artemis1];

export function getAllMissions(): MissionSummary[] {
  const now = Date.now();
  return missions.map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    launchUtc: m.launchUtc,
    endUtc: m.endUtc,
    crewed: m.crew.length > 0,
    status: now < m.launchUtc ? "upcoming" : now > m.endUtc ? "past" : "active",
  }));
}

export function getMission(id: string): MissionConfig | undefined {
  return missions.find(m => m.id === id);
}

export function getAllMissionIds(): string[] {
  return missions.map(m => m.id);
}
