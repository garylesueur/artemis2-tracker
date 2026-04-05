import { useState, useEffect, useRef, type FC } from "react";
import type { CamMode, CrewMember } from "./types";
import { LAUNCH_UTC, FLYBY_UTC, SPLASHDOWN_UTC, MISSION_DUR } from "./data";
import { fmtT, fmtD } from "./ephemeris";

export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0}
  .sc{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 14px}
  .lbl{font-size:10px;color:#7b8da4;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px}
  input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;height:20px}
  input[type=range]::-webkit-slider-runnable-track{height:3px;background:linear-gradient(90deg,#1e40af,#3b82f6,#eab308,#3b82f6);border-radius:2px;opacity:.5}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#eab308;border:2px solid #030610;box-shadow:0 0 6px rgba(234,179,8,.4);margin-top:-6px}
  input[type=range]::-moz-range-track{height:3px;background:linear-gradient(90deg,#1e40af,#eab308);border-radius:2px;opacity:.5}
  input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#eab308;border:2px solid #030610}
  button{font-family:inherit;cursor:pointer}
  .hdr-phase-mobile{display:none}
  .cam-btn .cam-label{white-space:nowrap}
  @media(max-width:768px){
    .hdr-bar{padding:8px 12px!important;gap:6px!important}
    .hdr-nasa{display:none!important}
    .hdr-day{display:none!important}
    .hdr-title{font-size:18px!important}
    .hdr-met-label{display:none!important}
    .hdr-met{font-size:15px!important}
    .hdr-phase{display:none!important}
    .hdr-phase-mobile{display:inline-block!important}
    .transport-bar{order:99!important;border-top:1px solid rgba(255,255,255,.15)!important;border-bottom:none!important;padding:6px 10px!important;gap:6px!important;flex-wrap:nowrap!important}
    .transport-ts{font-size:9px!important}
    .transport-ts span:last-child{display:none!important}
    .transport-bar input[type=range]{height:32px!important}
    .transport-bar input[type=range]::-webkit-slider-thumb{width:22px!important;height:22px!important;margin-top:-10px!important}
    .transport-bar input[type=range]::-moz-range-thumb{width:22px!important;height:22px!important}
    .cam-panel{top:auto!important;bottom:8px!important}
    .cam-btn{width:auto!important;min-width:36px!important;justify-content:center!important}
    .cam-btn .cam-label{display:none!important}
    .cam-btn-expanded .cam-label{display:inline!important}
    .cam-btn-expanded{width:155px!important;justify-content:flex-start!important}
    .dist-mi{display:none!important}
    .dist-panel{padding:6px 10px!important}
    .dist-val{font-size:14px!important}
    .hint-text{display:none!important}
    .bottom-bar{display:none!important}
    .sc{padding:6px 10px!important}
    .bottom-flyby,.bottom-splash{display:none!important}
    .crew-bar .lbl{display:none!important}
  }
  @media(max-width:480px){
    .hdr-met{font-size:13px!important}
    .bottom-progress .lbl{display:none!important}
  }
`;

interface HeaderProps {
  phase: string;
  day: number;
  met: number;
  phaseCol: string;
}

export const Header: FC<HeaderProps> = ({ phase, day, met, phaseCol }) => (
  <div className="hdr-bar" style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.1)", flexShrink: 0, gap: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", minWidth: 0 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 10px #22c55e", flexShrink: 0 }} />
      <span className="hdr-title" style={{ fontFamily: "'Outfit',sans-serif", fontSize: 24, fontWeight: 800, color: "#e2e8f0" }}>ARTEMIS II</span>
      <span className="hdr-phase" style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 12, letterSpacing: "1px", background: `${phaseCol}18`, color: phaseCol, border: `1px solid ${phaseCol}33` }}>{phase.toUpperCase()}</span>
      <span className="hdr-day" style={{ fontSize: 12, color: "#7b8da4", fontWeight: 500 }}>DAY {day}</span>
      <span className="hdr-nasa" style={{ fontSize: 9, color: "#5a8abf", background: "rgba(59,130,246,0.12)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(59,130,246,0.2)" }}>NASA OEM DATA</span>
    </div>
    <div style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
      <div className="lbl hdr-met-label">MISSION ELAPSED TIME</div>
      <div className="hdr-met" style={{ fontSize: 20, fontWeight: 700, color: "#60a5fa", fontVariantNumeric: "tabular-nums", letterSpacing: "0.5px" }}>{met > 0 ? fmtT(met) : `T−${fmtT(-met)}`}</div>
      <span className="hdr-phase-mobile" style={{ fontFamily: "'Outfit',sans-serif", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, letterSpacing: "1px", background: `${phaseCol}18`, color: phaseCol, border: `1px solid ${phaseCol}33`, marginTop: 2 }}>{phase.toUpperCase()}</span>
    </div>
  </div>
);

interface TransportProps {
  live: boolean;
  speed: number;
  eNow: number;
  onSpeedClick: (s: number) => void;
  onLive: () => void;
  onSlide: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Transport: FC<TransportProps> = ({ live, speed, eNow, onSpeedClick, onLive, onSlide }) => (
  <div className="transport-bar" style={{ padding: "6px 20px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(255,255,255,.08)", flexShrink: 0, flexWrap: "wrap" }}>
    {([{ l: "⏪", s: -80000 }, { l: "◁", s: -15000 }, { l: "⏸", s: 0 }, { l: "▷", s: 15000 }, { l: "⏩", s: 80000 }] as const).map(b => (
      <button key={b.l} onClick={() => onSpeedClick(b.s)}
        style={{ background: !live && speed === b.s ? "rgba(234,179,8,.15)" : "rgba(255,255,255,.05)", border: !live && speed === b.s ? "1px solid rgba(234,179,8,.3)" : "1px solid rgba(255,255,255,.1)", color: !live && speed === b.s ? "#eab308" : "#8a9bb2", borderRadius: 5, padding: "4px 10px", fontSize: 14 }}>{b.l}</button>
    ))}
    <button onClick={onLive} style={{ background: live ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.05)", border: live ? "1px solid rgba(34,197,94,.3)" : "1px solid rgba(255,255,255,.1)", color: live ? "#22c55e" : "#8a9bb2", borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: live ? 700 : 400, letterSpacing: "1px" }}>● LIVE</button>
    <input type="range" min={-3600000} max={MISSION_DUR + 3600000} value={eNow - LAUNCH_UTC} onChange={onSlide} style={{ flex: 1, minWidth: 120 }} />
    <span className="transport-ts" style={{ fontSize: 10, color: "#7b8da4", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <span>{new Date(eNow).toUTCString().replace("GMT", "UTC")}</span>
      <span style={{ color: "#8a9bb2" }}>{new Date(eNow).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" })}</span>
    </span>
  </div>
);

interface CameraControlsProps {
  camMode: CamMode;
  showLabels: boolean;
  showTrajectory: boolean;
  showMoonOrbit: boolean;
  onCamMode: (mode: CamMode) => void;
  onToggleLabels: () => void;
  onToggleTrajectory: () => void;
  onToggleMoonOrbit: () => void;
}

export const CameraControls: FC<CameraControlsProps> = ({ camMode, showLabels, showTrajectory, showMoonOrbit, onCamMode, onToggleLabels, onToggleTrajectory, onToggleMoonOrbit }) => {
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tap = (fn: () => void): void => {
    fn();
    setExpanded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setExpanded(false), 2000);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const ex = expanded ? " cam-btn-expanded" : "";

  return (
    <div className="cam-panel" style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      {([{ id: "full" as CamMode, label: "FULL MISSION", icon: "◎" }, { id: "orion" as CamMode, label: "FOLLOW ORION", icon: "△" }, { id: "flyby" as CamMode, label: "FLYBY VIEW", icon: "⟐" }, { id: "moon" as CamMode, label: "MOON", icon: "◑" }, { id: "earth" as CamMode, label: "EARTH", icon: "◉" }]).map(v => (
        <button key={v.id} className={`cam-btn${ex}`} onClick={() => tap(() => onCamMode(v.id))}
          style={{ display: "flex", alignItems: "center", gap: 8, background: camMode === v.id ? "rgba(234,179,8,.15)" : "rgba(3,6,16,.75)", backdropFilter: "blur(8px)", border: camMode === v.id ? "1px solid rgba(234,179,8,.35)" : "1px solid rgba(255,255,255,.12)", color: camMode === v.id ? "#eab308" : "#8a9bb2", borderRadius: 6, padding: "7px 12px", fontSize: 11, fontFamily: "inherit", letterSpacing: ".5px", textAlign: "left" as const, width: 155 }}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>{v.icon}</span>
          <span className="cam-label">{v.label}</span>
        </button>
      ))}
      <div style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "4px 0", width: "100%" }} />
      {([{ id: "labels", label: "LABELS", on: showLabels, fn: onToggleLabels }, { id: "traj", label: "TRAJECTORY", on: showTrajectory, fn: onToggleTrajectory }, { id: "morbit", label: "MOON ORBIT", on: showMoonOrbit, fn: onToggleMoonOrbit }] as const).map(t => (
        <button key={t.id} className={`cam-btn${ex}`} onClick={() => tap(t.fn)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: t.on ? "rgba(96,165,250,.1)" : "rgba(3,6,16,.75)", backdropFilter: "blur(8px)", border: t.on ? "1px solid rgba(96,165,250,.25)" : "1px solid rgba(255,255,255,.08)", color: t.on ? "#60a5fa" : "#5a6a80", borderRadius: 6, padding: "6px 12px", fontSize: 10, fontFamily: "inherit", letterSpacing: ".5px", textAlign: "left" as const, width: 155 }}>
          <span style={{ fontSize: 10, lineHeight: 1 }}>{t.on ? "●" : "○"}</span>
          <span className="cam-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
};

interface DistancePanelsProps {
  dE: number;
  dM: number;
}

export const DistancePanels: FC<DistancePanelsProps> = ({ dE, dM }) => (
  <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 5 }}>
    <div className="dist-panel" style={{ background: "rgba(3,6,16,.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "8px 14px" }}>
      <div className="lbl">EARTH DISTANCE</div>
      <div className="dist-val" style={{ fontSize: 18, fontWeight: 700, color: "#60a5fa", fontVariantNumeric: "tabular-nums" }}>{fmtD(dE)}</div>
      <div className="dist-mi" style={{ fontSize: 10, color: "#7b8da4", marginTop: 1 }}>{fmtD(dE * 0.621371).replace("km", "mi")}</div>
    </div>
    <div className="dist-panel" style={{ background: "rgba(3,6,16,.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "8px 14px" }}>
      <div className="lbl">MOON DISTANCE</div>
      <div className="dist-val" style={{ fontSize: 18, fontWeight: 700, color: "#b8c0cc", fontVariantNumeric: "tabular-nums" }}>{fmtD(dM)}</div>
      <div className="dist-mi" style={{ fontSize: 10, color: "#7b8da4", marginTop: 1 }}>{fmtD(dM * 0.621371).replace("km", "mi")}</div>
    </div>
  </div>
);

interface BottomBarProps {
  mf: number;
  eNow: number;
  crew: CrewMember[];
  onCrewClick: () => void;
}

export const BottomBar: FC<BottomBarProps> = ({ mf, eNow, crew, onCrewClick }) => (
  <div className="bottom-bar" style={{ padding: "8px 20px", display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,.1)", flexShrink: 0 }}>
    <div className="sc bottom-progress" style={{ flex: 1, minWidth: 90 }}>
      <div className="lbl">PROGRESS</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#eab308" }}>{(mf * 100).toFixed(1)}%</div>
      <div style={{ height: 3, background: "rgba(255,255,255,.08)", borderRadius: 2, marginTop: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${mf * 100}%`, background: "linear-gradient(90deg,#3b82f6,#eab308)", borderRadius: 2 }} /></div>
    </div>
    <div className="sc bottom-flyby" style={{ flex: 1, minWidth: 110 }}>
      <div className="lbl">LUNAR FLYBY</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: eNow < FLYBY_UTC ? "#eab308" : "#22c55e" }}>{eNow < FLYBY_UTC ? `T−${fmtT(FLYBY_UTC - eNow)}` : "COMPLETE"}</div>
    </div>
    <div className="sc bottom-splash" style={{ flex: 1, minWidth: 110 }}>
      <div className="lbl">SPLASHDOWN</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: eNow < SPLASHDOWN_UTC ? "#60a5fa" : "#22c55e" }}>{eNow < SPLASHDOWN_UTC ? `T−${fmtT(SPLASHDOWN_UTC - eNow)}` : "COMPLETE"}</div>
    </div>
    <div className="sc crew-bar" style={{ flex: 1.5, minWidth: 200 }}>
      <div className="lbl">CREW — ORION &ldquo;INTEGRITY&rdquo;</div>
      <div style={{ display: "flex", gap: 12, marginTop: 3 }}>{crew.map(c => <button key={c.n} onClick={onCrewClick} style={{ fontSize: 12, background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer" }}><span style={{ color: "#7b8da4" }}>{c.r}</span> <span style={{ color: "#d4dde8", borderBottom: "1px solid rgba(255,255,255,.15)" }}>{c.n}</span></button>)}</div>
    </div>
  </div>
);

interface CrewModalProps {
  crew: CrewMember[];
  onClose: () => void;
}

export const CrewModal: FC<CrewModalProps> = ({ crew, onClose }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, maxWidth: 880, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
      {crew.map(c => (
        <div key={c.n} style={{ background: "#0c1220", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,.5)" }}>
          <div style={{ display: "flex", gap: 14, padding: 16 }}>
            <img src={c.img} alt={c.full} style={{ width: 80, height: 107, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 17, fontWeight: 700, color: "#e2e8f0" }}>{c.full}</div>
              <div style={{ fontSize: 10, color: "#eab308", letterSpacing: "1px", marginTop: 2 }}>{c.title.toUpperCase()}</div>
              <div style={{ fontSize: 10, color: "#7b8da4", marginTop: 3 }}>{c.rank}</div>
              <div style={{ fontSize: 10, color: "#7b8da4", marginTop: 1 }}>{c.born}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {[{ v: c.flights, l: "FLIGHTS" }, { v: c.days, l: "DAYS" }, { v: c.evas, l: "EVAS" }].map(s => (
                  <div key={s.l} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa" }}>{s.v}</div>
                    <div style={{ fontSize: 8, color: "#7b8da4", letterSpacing: "1px" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding: "0 16px 12px", fontSize: 11, lineHeight: 1.55, color: "#9aa8ba" }}>{c.bio}</div>
          <div style={{ padding: "0 16px 14px" }}>
            <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#60a5fa", background: "rgba(96,165,250,.08)", border: "1px solid rgba(96,165,250,.2)", borderRadius: 5, padding: "5px 12px", textDecoration: "none", letterSpacing: ".5px" }}>NASA BIO</a>
          </div>
        </div>
      ))}
      <div style={{ gridColumn: "1 / -1", textAlign: "center", paddingTop: 4 }}>
        <button onClick={onClose} style={{ fontSize: 11, color: "#7b8da4", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 6, padding: "8px 24px", letterSpacing: ".5px", fontFamily: "inherit", cursor: "pointer" }}>CLOSE</button>
      </div>
    </div>
  </div>
);
