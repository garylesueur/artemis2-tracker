import type { MissionConfig, CrewMember, POI, MissionPhase, Countdown, CameraPreset, SpacecraftDef } from "@/lib/types";

const LAUNCH_UTC = new Date("2026-04-01T22:35:00Z").getTime();
const FLYBY_UTC = new Date("2026-04-06T14:30:00Z").getTime();
const SPLASHDOWN_UTC = new Date("2026-04-11T00:06:00Z").getTime();

const phases: MissionPhase[] = [
  { name: "Pre-launch", startFraction: -Infinity, color: "#3b82f6" },
  { name: "Earth Orbit", startFraction: 0, color: "#3b82f6" },
  { name: "Translunar Coast", startFraction: 0.10, color: "#3b82f6" },
  { name: "Lunar Flyby", startFraction: 0.50, color: "#eab308" },
  { name: "Return Coast", startFraction: 0.60, color: "#3b82f6" },
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
  type: "Crew Vehicle — Artemis II",
  facts: [
    "Crew module: 5.02m diameter",
    "Mass: ~26,500 kg (crewed)",
    "Service module: ESA-built",
    "Solar array span: 19m",
    "Crew capacity: 4 astronauts",
    "Heat shield: 5m AVCOAT",
  ],
};

const crew: CrewMember[] = [
  { n: "Wiseman", r: "CDR", full: "Reid Wiseman", title: "Commander", age: 50, img: "/crew/wiseman.jpg", rank: "Captain, U.S. Navy (Ret.)", born: "Baltimore, Maryland", flights: 2, days: 165, evas: 2, bio: "Navy test pilot and engineer. Flew on ISS Expedition 41 in 2014 logging 165 days and two spacewalks. Former NASA Chief Astronaut. Oldest person to travel beyond low Earth orbit.", url: "https://www.nasa.gov/humans-in-space/astronauts/g-reid-wiseman/" },
  { n: "Glover", r: "PLT", full: "Victor Glover", title: "Pilot", age: 49, img: "/crew/glover.jpg", rank: "Captain, U.S. Navy", born: "Pomona, California", flights: 2, days: 168, evas: 4, bio: "Fighter pilot with 3,000+ flight hours across 40+ aircraft and 24 combat missions. Piloted SpaceX Crew-1 to the ISS in 2020. First person of color to travel beyond low Earth orbit.", url: "https://www.nasa.gov/humans-in-space/astronauts/victor-j-glover/" },
  { n: "Koch", r: "MS1", full: "Christina Koch", title: "Mission Specialist 1", age: 47, img: "/crew/koch.jpg", rank: "NASA Astronaut", born: "Grand Rapids, Michigan", flights: 2, days: 328, evas: 6, bio: "Electrical engineer and physicist. Set the record for longest single spaceflight by a woman at 328 days on ISS Expeditions 59\u201361. Participated in the first all-female spacewalks. First woman beyond low Earth orbit.", url: "https://www.nasa.gov/humans-in-space/astronauts/christina-hammock-koch/" },
  { n: "Hansen", r: "MS2", full: "Jeremy Hansen", title: "Mission Specialist 2", age: 50, img: "/crew/hansen.jpg", rank: "Colonel, Canadian Forces", born: "London, Ontario", flights: 1, days: 0, evas: 0, bio: "CF-18 fighter pilot and combat operations officer with NORAD. First Canadian to lead a NASA astronaut class. First non-U.S. citizen to fly beyond low Earth orbit. Selected by the Canadian Space Agency in 2009.", url: "https://www.nasa.gov/humans-in-space/astronauts/jeremy-hansen/" },
];

const pois: POI[] = [
  { name: "KSC LC-39B", lat: 28.63, lon: -80.62, body: "earth", type: "Launch Site", detail: "Apr 1 2026 · Kennedy Space Center, Florida · Launch Complex 39B · SLS Block 1 lifted Orion + crew to orbit" },
  { name: "Splashdown Zone", lat: 32.7, lon: -117.2, body: "earth", type: "Splashdown", detail: "Apr 11 2026 · Pacific Ocean ~60 mi off San Diego, California · USS John P. Murtha recovery · 11-parachute descent at ~17 mph" },
];

const countdowns: Countdown[] = [
  { label: "LUNAR FLYBY", targetMs: FLYBY_UTC, completedText: "COMPLETE", color: "#eab308", completedColor: "#22c55e" },
  { label: "SPLASHDOWN", targetMs: SPLASHDOWN_UTC, completedText: "COMPLETE", color: "#60a5fa", completedColor: "#22c55e" },
];

const cameraPresets: CameraPreset[] = [
  { id: "full", label: "FULL MISSION", icon: "◎", behavior: { type: "full", defaultR: 140 } },
  { id: "orion", label: "FOLLOW ORION", icon: "△", behavior: { type: "follow-craft", defaultR: 0.15 } },
  { id: "flyby", label: "FLYBY VIEW", icon: "⟐", behavior: { type: "flyby" } },
  { id: "moon", label: "MOON", icon: "◑", behavior: { type: "follow-body", body: "moon", defaultR: 6 } },
  { id: "earth", label: "EARTH", icon: "◉", behavior: { type: "follow-body", body: "earth", defaultR: 25 } },
];

export const artemis2: MissionConfig = {
  id: "artemis2",
  name: "ARTEMIS II",
  description: "NASA's first crewed lunar flyby mission since Apollo 17. Four astronauts aboard Orion travel around the Moon and back in a 10-day mission.",
  launchUtc: LAUNCH_UTC,
  endUtc: SPLASHDOWN_UTC,
  launchConfirmed: true,
  phases,
  spacecraft,
  crew,
  pois,
  countdowns,
  cameraPresets,
  loadTrajectory: () => import("./trajectory").then(m => m.OEM),
};
