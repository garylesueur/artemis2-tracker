import { fetchTrajectory, type TrajectoryRequest } from "./horizons";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MISSIONS: Record<string, TrajectoryRequest> = {
  artemis1: {
    spiceId: "-1023",
    startTime: "2022-11-16T09:00:00",
    stopTime: "2022-12-11T17:00:00",
    stepSize: "30m",
  },
  artemis2: {
    spiceId: "-1024",
    startTime: "2026-04-01T22:40:00",
    stopTime: "2026-04-11T22:00:00",
    stepSize: "30m",
  },
};

async function main() {
  const missionId = process.argv[2];
  if (!missionId || !MISSIONS[missionId]) {
    console.error(`Usage: npx tsx lib/jpl/generate-trajectory.ts <mission>`);
    console.error(`Available: ${Object.keys(MISSIONS).join(", ")}`);
    process.exit(1);
  }

  const mission = MISSIONS[missionId];
  console.log(`Fetching ${missionId} trajectory from JPL Horizons...`);
  console.log(`  SPICE ID: ${mission.spiceId}`);
  console.log(`  Range: ${mission.startTime} → ${mission.stopTime}`);
  console.log(`  Step: ${mission.stepSize}`);

  const points = await fetchTrajectory(mission);
  console.log(`  Received ${points.length} points`);

  const outPath = resolve(__dirname, "..", "missions", missionId, "trajectory.ts");
  const content = [
    `import type { OEMPoint } from "@/lib/types";`,
    ``,
    `// JPL Horizons ephemeris — SPICE ID ${mission.spiceId}, EME2000 Earth-centered`,
    `// Generated ${new Date().toISOString().slice(0, 10)} via lib/jpl/generate-trajectory.ts`,
    `// Format: [timestamp_ms, x_km, y_km, z_km]`,
    `export const OEM: OEMPoint[] = [`,
    ...points.map(p => `  [${p[0]},${p[1]},${p[2]},${p[3]}],`),
    `];`,
    ``,
  ].join("\n");

  writeFileSync(outPath, content, "utf-8");
  console.log(`  Written to ${outPath}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
