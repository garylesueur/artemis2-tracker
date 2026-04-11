import type { POI, WorldObject } from "@/lib/types";
import { WORLD_POIS } from "./pois";
import { WORLD_OBJECTS } from "./objects";

export function getVisiblePois(dateMs: number): POI[] {
  return WORLD_POIS.filter(p => !p.since || dateMs >= p.since);
}

export function getVisibleObjects(dateMs: number): WorldObject[] {
  return WORLD_OBJECTS.filter(o =>
    dateMs >= o.since && (!o.until || dateMs <= o.until)
  );
}

export { WORLD_POIS, WORLD_OBJECTS };
