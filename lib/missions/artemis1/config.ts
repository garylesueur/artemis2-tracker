import type { MissionConfig, MissionPhase, CameraPreset, SpacecraftDef } from "@/lib/types";

const LAUNCH_UTC = new Date("2022-11-16T06:47:44Z").getTime();
const FLYBY_UTC = new Date("2022-11-21T12:57:00Z").getTime();
const SPLASHDOWN_UTC = new Date("2022-12-11T17:40:00Z").getTime();

const phases: MissionPhase[] = [
  { name: "Pre-launch", startFraction: -Infinity, color: "#3b82f6" },
  { name: "Earth Orbit", startFraction: 0, color: "#3b82f6" },
  { name: "Translunar Injection", startFraction: 0.03, color: "#3b82f6" },
  { name: "Outbound Coast", startFraction: 0.08, color: "#3b82f6" },
  { name: "Lunar Flyby 1", startFraction: 0.20, color: "#eab308" },
  { name: "Distant Retrograde Orbit", startFraction: 0.25, color: "#a855f7" },
  { name: "Lunar Flyby 2", startFraction: 0.75, color: "#eab308" },
  { name: "Return Coast", startFraction: 0.80, color: "#3b82f6" },
  { name: "Re-entry", startFraction: 0.97, color: "#ef4444" },
  { name: "Splashdown", startFraction: 1.0, color: "#22c55e" },
];

const spacecraft: SpacecraftDef = {
  id: "orion",
  name: "ORION MPCV",
  modelUrl: "/orion-capsule.stl",
  modelFormat: "stl",
  modelScale: 0.09,
  icon: "🚀",
  color: "#ffcc22",
  type: "Crew Vehicle — Artemis I (Uncrewed)",
  facts: [
    "Crew module: 5.02m diameter",
    "Mass: ~22,700 kg (uncrewed)",
    "Service module: ESA-built",
    "Solar array span: 19m",
    "Uncrewed test flight",
    "Heat shield: 5m AVCOAT",
  ],
};

const cameraPresets: CameraPreset[] = [
  { id: "full", label: "FULL MISSION", icon: "◎", behavior: { type: "full", defaultR: 140 } },
  { id: "orion", label: "FOLLOW ORION", icon: "△", behavior: { type: "follow-craft", defaultR: 0.15 } },
  { id: "flyby", label: "FLYBY VIEW", icon: "⟐", behavior: { type: "flyby" } },
  { id: "moon", label: "MOON", icon: "◑", behavior: { type: "follow-body", body: "moon", defaultR: 6 } },
  { id: "earth", label: "EARTH", icon: "◉", behavior: { type: "follow-body", body: "earth", defaultR: 25 } },
];

export const artemis1: MissionConfig = {
  id: "artemis1",
  name: "ARTEMIS I",
  description: "Uncrewed test flight of the Space Launch System and Orion spacecraft. Orion spent 25.5 days in space, including 6 days in distant retrograde orbit around the Moon.",
  launchUtc: LAUNCH_UTC,
  endUtc: SPLASHDOWN_UTC,
  phases,
  spacecraft,
  crew: [], // Uncrewed
  pois: [
    { name: "KSC LC-39B", lat: 28.63, lon: -80.62, body: "earth", type: "Launch Site", detail: "Nov 16 2022 · Kennedy Space Center, Florida · Launch Complex 39B · SLS Block 1 first flight" },
    { name: "Splashdown Zone", lat: 24.6, lon: -120.5, body: "earth", type: "Splashdown", detail: "Dec 11 2022 · Pacific Ocean west of Baja California · USS Portland recovery" },
  ],
  countdowns: [
    { label: "LUNAR FLYBY", targetMs: FLYBY_UTC, completedText: "COMPLETE", color: "#eab308", completedColor: "#22c55e" },
    { label: "SPLASHDOWN", targetMs: SPLASHDOWN_UTC, completedText: "COMPLETE", color: "#60a5fa", completedColor: "#22c55e" },
  ],
  cameraPresets,
  loadTrajectory: async () => {
    const { OEM } = await import("./trajectory");
    return OEM;
  },
};
