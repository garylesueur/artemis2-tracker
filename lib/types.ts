// Shared types for the multi-mission space tracker

export type Vec3 = { x: number; y: number; z: number };
export type OEMPoint = [number, number, number, number]; // [ms, x_km, y_km, z_km]

export interface MissionPhase {
  name: string;
  startFraction: number; // 0.0–1.0 of mission duration
  color: string;
}

export interface SpacecraftDef {
  id: string; // "orion"
  name: string; // "ORION MPCV"
  modelUrl: string; // "/models/orion-capsule.stl"
  modelFormat: "stl" | "gltf";
  modelScale: number;
  facts: string[];
  icon: string;
  color: string;
  type: string; // "Crew Vehicle — Artemis II"
}

export interface POI {
  name: string;
  lat: number;
  lon: number;
  body: "earth" | "moon";
  type: string; // "Launch Site", "Landing Site", etc.
  detail: string;
  color?: string;
  since?: number; // timestamp_ms — only show if viewer time >= this
}

export interface CrewMember {
  n: string;
  r: string;
  full: string;
  title: string;
  age: number;
  img: string;
  rank: string;
  born: string;
  flights: number;
  days: number;
  evas: number;
  bio: string;
  url: string;
}

export interface Countdown {
  label: string;
  targetMs: number;
  completedText: string;
  color: string;
  completedColor: string;
}

export type CameraBehavior =
  | { type: "full"; defaultR: number }
  | { type: "follow-craft"; defaultR: number }
  | { type: "follow-body"; body: "moon" | "earth"; defaultR: number }
  | { type: "flyby" };

export interface CameraPreset {
  id: string;
  label: string;
  icon: string;
  behavior: CameraBehavior;
}

export interface WorldObjectLink {
  objectId: string; // e.g. "iss"
  relation: string; // "dock", "rendezvous", "flyby"
  eventUtc: number;
  label: string; // "ISS Docking"
}

export interface MissionSummary {
  id: string;
  name: string;
  description: string;
  launchUtc: number;
  endUtc: number;
  crewed: boolean;
  status: "past" | "active" | "upcoming";
}

export interface MissionConfig {
  id: string; // URL slug: "artemis2"
  name: string; // "ARTEMIS II"
  description: string;
  launchUtc: number; // ms timestamp
  endUtc: number; // splashdown / mission end
  launchConfirmed?: boolean; // false = launch date is TBC (defaults to true)

  phases: MissionPhase[];
  spacecraft: SpacecraftDef;
  crew: CrewMember[];
  pois: POI[];
  countdowns: Countdown[];
  cameraPresets: CameraPreset[];
  worldObjectLinks?: WorldObjectLink[];

  // Loaded separately (large data)
  loadTrajectory: () => Promise<OEMPoint[]>;
}

// World objects — persistent things like ISS
export interface WorldObject {
  id: string;
  name: string;
  type: "orbital" | "surface-poi";
  since: number; // timestamp_ms when it began
  until?: number; // timestamp_ms when decommissioned
  body?: "earth" | "moon";
  icon: string;
  color: string;
  facts: string[];
  modelUrl?: string;
  modelFormat?: "stl" | "gltf";
  modelScale?: number;
}
