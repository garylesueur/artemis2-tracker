import type { OEMPoint } from "@/lib/types";

const HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api";

export interface TrajectoryRequest {
  spiceId: string;    // e.g. "-1023" for Artemis 1
  startTime: string;  // ISO date: "2022-11-16T09:00:00"
  stopTime: string;   // ISO date: "2022-12-11T17:00:00"
  stepSize?: string;  // default "30m"
}

export async function fetchTrajectory(opts: TrajectoryRequest): Promise<OEMPoint[]> {
  const step = opts.stepSize ?? "30m";

  const params = new URLSearchParams({
    format: "text",
    COMMAND: `'${opts.spiceId}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@399'",
    START_TIME: `'${opts.startTime}'`,
    STOP_TIME: `'${opts.stopTime}'`,
    STEP_SIZE: `'${step}'`,
    REF_SYSTEM: "'ICRF'",
    REF_PLANE: "'FRAME'",
    VEC_TABLE: "'1'",
    OUT_UNITS: "'KM-S'",
    CSV_FORMAT: "'YES'",
  });

  const url = `${HORIZONS_API}?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Horizons API error: ${res.status} ${res.statusText}`);

  const text = await res.text();
  return parseHorizonsResponse(text);
}

function parseHorizonsResponse(text: string): OEMPoint[] {
  const soeIdx = text.indexOf("$$SOE");
  const eoeIdx = text.indexOf("$$EOE");
  if (soeIdx === -1 || eoeIdx === -1) {
    throw new Error("Could not find $$SOE/$$EOE markers in Horizons response");
  }

  const dataBlock = text.slice(soeIdx + 5, eoeIdx).trim();
  const lines = dataBlock.split("\n").filter(l => l.trim().length > 0);

  const points: OEMPoint[] = [];
  for (const line of lines) {
    // CSV format: JDTDB, Calendar Date (TDB), X, Y, Z,
    const cols = line.split(",").map(s => s.trim());
    if (cols.length < 5) continue;

    const dateStr = cols[1]; // e.g. "A.D. 2022-Nov-16 09:00:00.0000"
    const x = parseFloat(cols[2]);
    const y = parseFloat(cols[3]);
    const z = parseFloat(cols[4]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

    const ms = parseHorizonsDate(dateStr);
    points.push([ms, Math.round(x), Math.round(y), Math.round(z)]);
  }

  return points;
}

function parseHorizonsDate(dateStr: string): number {
  // Input: " A.D. 2022-Nov-16 09:00:00.0000"
  const cleaned = dateStr.replace("A.D.", "").trim();
  // Now: "2022-Nov-16 09:00:00.0000"
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const match = cleaned.match(/(\d{4})-(\w{3})-(\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (!match) throw new Error(`Cannot parse date: ${dateStr}`);

  const [, year, mon, day, time] = match;
  const mm = months[mon];
  if (!mm) throw new Error(`Unknown month: ${mon}`);

  return new Date(`${year}-${mm}-${day}T${time}Z`).getTime();
}
