import type { WorldObject } from "@/lib/types";

// Persistent world objects — things that exist independently of any mission
export const WORLD_OBJECTS: WorldObject[] = [
  {
    id: "iss",
    name: "International Space Station",
    type: "orbital",
    since: new Date("1998-11-20T06:40:00Z").getTime(), // Zarya module launch
    icon: "🛰️",
    color: "#60a5fa",
    facts: [
      "Orbital altitude: ~408 km",
      "Orbital speed: 7.66 km/s",
      "Orbital period: 92 minutes",
      "Mass: ~420,000 kg",
      "Wingspan: 109 m (solar arrays)",
      "Pressurized volume: 916 m³",
    ],
  },
];
