import { ImageResponse } from "next/og";

export const alt = "Artemis II Tracker — Real-Time 3D Mission Visualization";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 50%, #1b2838 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: 20,
              letterSpacing: "6px",
              color: "#4b9cd3",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            NASA
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-2px",
              lineHeight: 1,
            }}
          >
            ARTEMIS II
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#8899aa",
              letterSpacing: "4px",
              textTransform: "uppercase",
              marginTop: "4px",
            }}
          >
            Mission Tracker
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "40px",
            marginTop: "48px",
            fontSize: 16,
            color: "#556677",
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          <span>Earth</span>
          <span style={{ color: "#334455" }}>───────</span>
          <span>Moon</span>
          <span style={{ color: "#334455" }}>───────</span>
          <span>Earth</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "40px",
            fontSize: 14,
            color: "#445566",
          }}
        >
          <span>Real-time 3D Visualization</span>
          <span>•</span>
          <span>NASA OEM Ephemeris Data</span>
          <span>•</span>
          <span>Interactive Controls</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
