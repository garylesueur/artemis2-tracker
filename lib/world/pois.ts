import type { POI } from "@/lib/types";

// World POIs — permanent features of celestial bodies
// `since` is the timestamp when the POI came into existence
// POIs without `since` are always visible (geological features, etc.)

export const WORLD_POIS: POI[] = [
  // Apollo landing sites — visible only after their landing dates
  { name: "Apollo 11", lat: 0.67, lon: 23.47, body: "moon", type: "Landing Site", detail: "Jul 20 1969 · Sea of Tranquility · Armstrong & Aldrin · First crewed lunar landing, 21 h 36 m on surface", since: new Date("1969-07-20T20:17:00Z").getTime() },
  { name: "Apollo 12", lat: -3.01, lon: -23.42, body: "moon", type: "Landing Site", detail: "Nov 19 1969 · Ocean of Storms · Conrad & Bean · Precision landing 163 m from Surveyor 3", since: new Date("1969-11-19T06:54:00Z").getTime() },
  { name: "Apollo 14", lat: -3.64, lon: -17.47, body: "moon", type: "Landing Site", detail: "Feb 5 1971 · Fra Mauro · Shepard & Mitchell · Shepard hit two golf balls on the Moon", since: new Date("1971-02-05T09:18:00Z").getTime() },
  { name: "Apollo 15", lat: 26.13, lon: 3.63, body: "moon", type: "Landing Site", detail: "Jul 30 1971 · Hadley–Apennine · Scott & Irwin · First use of the Lunar Roving Vehicle", since: new Date("1971-07-30T22:16:00Z").getTime() },
  { name: "Apollo 16", lat: -8.97, lon: 15.50, body: "moon", type: "Landing Site", detail: "Apr 21 1972 · Descartes Highlands · Young & Duke · Only mission to the lunar highlands", since: new Date("1972-04-21T02:23:00Z").getTime() },
  { name: "Apollo 17", lat: 20.19, lon: 30.77, body: "moon", type: "Landing Site", detail: "Dec 11 1972 · Taurus–Littrow · Cernan & Schmitt · Last crewed lunar mission, longest stay: 74 h 59 m", since: new Date("1972-12-11T19:54:00Z").getTime() },

  // Major craters — always visible (geological features)
  { name: "Tycho", lat: -43.31, lon: -11.36, body: "moon", type: "Impact Crater", detail: "Diameter 85 km · Age ~108 million years · Prominent ray system visible from Earth · Central peak rises 1.6 km" },
  { name: "Copernicus", lat: 9.62, lon: -20.08, body: "moon", type: "Impact Crater", detail: "Diameter 93 km · Age ~800 million years · Terraced walls 3.8 km deep · Named after Nicolaus Copernicus" },
  { name: "Aristarchus", lat: 23.73, lon: -47.49, body: "moon", type: "Impact Crater", detail: "Diameter 40 km · Brightest large crater on the Moon · Frequent transient lunar phenomena reported here" },

  // Artemis target — always visible (geographical feature)
  { name: "South Pole", lat: -89.5, lon: 0, body: "moon", type: "Artemis Target", detail: "Permanently shadowed craters may contain water ice · Target for Artemis III crewed landing · Shackleton crater rim" },
];
