"use client";

import Link from "next/link";
import type { MissionSummary } from "@/lib/types";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: MissionSummary["status"] }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "rgba(34,197,94,.15)", text: "#22c55e", label: "ACTIVE" },
    past: { bg: "rgba(148,163,184,.12)", text: "#94a3b8", label: "COMPLETED" },
    upcoming: { bg: "rgba(59,130,246,.15)", text: "#3b82f6", label: "UPCOMING" },
  };
  const s = styles[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 1.2,
        padding: "3px 8px",
        borderRadius: 4,
        background: s.bg,
        color: s.text,
      }}
    >
      {s.label}
    </span>
  );
}

function MissionCard({ mission }: { mission: MissionSummary }) {
  return (
    <Link
      href={`/missions/${mission.id}`}
      style={{
        display: "block",
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.1)",
        borderRadius: 12,
        padding: "20px 24px",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color .2s, background .2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,.25)";
        e.currentTarget.style.background = "rgba(255,255,255,.07)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,.1)";
        e.currentTarget.style.background = "rgba(255,255,255,.04)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 18, fontWeight: 700, color: "#fff" }}>
          {mission.name}
        </span>
        <StatusBadge status={mission.status} />
      </div>
      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 12px" }}>
        {mission.description}
      </p>
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b", letterSpacing: 0.5 }}>
        <span>LAUNCH {formatDate(mission.launchUtc)}</span>
        <span>{mission.crewed ? "CREWED" : "UNCREWED"}</span>
      </div>
    </Link>
  );
}

export default function WorldClient({ missions }: { missions: MissionSummary[] }) {
  // Sort: active first, then upcoming, then past
  const order: Record<string, number> = { active: 0, upcoming: 1, past: 2 };
  const sorted = [...missions].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(ellipse at 30% 20%, #0a1628 0%, #030610 70%)",
        color: "#e2e8f0",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        overflow: "auto",
      }}
    >
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 2,
              margin: "0 0 8px",
              background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            SPACE TRACKER
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", letterSpacing: 1 }}>
            REAL-TIME 3D MISSION VISUALIZATION
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#475569", marginTop: 32 }}>
          Built with NASA OEM ephemeris data
        </p>
      </div>
    </div>
  );
}
