import type { Vec3 } from "./types";
import { OEM } from "./data";

// Simplified lunar ephemeris — low-precision Moon position (Earth-centered, ~0.5° accuracy)
// Based on Meeus Ch.47 simplified. Good enough for visualisation.
export function getMoonPosKm(dateMs: number): Vec3 {
  const JD = dateMs / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525.0;
  const d2r = Math.PI / 180;

  const Lp = (218.3165 + 481267.8813 * T) % 360;
  const D  = (297.8502 + 445267.1115 * T) % 360;
  const M  = (357.5291 + 35999.0503 * T) % 360;
  const Mp = (134.9634 + 477198.8676 * T) % 360;
  const F  = (93.2720 + 483202.0175 * T) % 360;

  const lon = Lp
    + 6.289 * Math.sin(Mp * d2r)
    + 1.274 * Math.sin((2*D - Mp) * d2r)
    + 0.658 * Math.sin(2*D * d2r)
    + 0.214 * Math.sin(2*Mp * d2r)
    - 0.186 * Math.sin(M * d2r)
    - 0.114 * Math.sin(2*F * d2r);

  const lat = 5.128 * Math.sin(F * d2r)
    + 0.281 * Math.sin((Mp + F) * d2r)
    + 0.278 * Math.sin((Mp - F) * d2r);

  const dist = 385001
    - 20905 * Math.cos(Mp * d2r)
    - 3699 * Math.cos((2*D - Mp) * d2r)
    - 2956 * Math.cos(2*D * d2r);

  const lonR = lon * d2r;
  const latR = lat * d2r;
  const eps = 23.4393 * d2r;

  const xEcl = dist * Math.cos(latR) * Math.cos(lonR);
  const yEcl = dist * Math.cos(latR) * Math.sin(lonR);
  const zEcl = dist * Math.sin(latR);

  return {
    x: xEcl,
    y: yEcl * Math.cos(eps) - zEcl * Math.sin(eps),
    z: yEcl * Math.sin(eps) + zEcl * Math.cos(eps),
  };
}

// OEM interpolation — binary search + linear interp
export function interpOEM(timeMs: number): Vec3 {
  if (timeMs <= OEM[0][0]) return { x: OEM[0][1], y: OEM[0][2], z: OEM[0][3] };
  if (timeMs >= OEM[OEM.length-1][0]) { const L = OEM[OEM.length-1]; return { x: L[1], y: L[2], z: L[3] }; }
  let lo = 0, hi = OEM.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (OEM[m][0] <= timeMs) lo = m; else hi = m; }
  const a = OEM[lo], b = OEM[hi];
  const t = (timeMs - a[0]) / (b[0] - a[0]);
  return { x: a[1] + (b[1] - a[1]) * t, y: a[2] + (b[2] - a[2]) * t, z: a[3] + (b[3] - a[3]) * t };
}

// Speed from finite-difference of OEM positions (km/s)
export function getSpeedKmS(timeMs: number): number {
  const dt = 1000; // 1-second step
  const a = interpOEM(timeMs - dt);
  const b = interpOEM(timeMs + dt);
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) / (2 * dt / 1000);
}

// Formatting helpers
export function fmtT(ms: number): string {
  const s = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const hh = String(h).padStart(2, "0"), mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return d > 0 ? `${d}d ${hh}h ${mm}m ${ss}s` : `${hh}h ${mm}m ${ss}s`;
}

export function fmtD(km: number): string {
  return km < 1000 ? `${Math.round(km)} km` : `${Math.round(km).toLocaleString()} km`;
}
