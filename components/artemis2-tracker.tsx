"use client";

import { useState, useEffect, useRef, useCallback, type FC } from "react";
import * as THREE from "three";
import type { CamMode, OrbitControls, SceneObjects } from "./tracker/types";
import { OEM, LAUNCH_UTC, SPLASHDOWN_UTC, MISSION_DUR, DATA_START, DATA_END, KM2U, MOON_R, CREW } from "./tracker/data";
import { getMoonPosKm, interpOEM, fmtT } from "./tracker/ephemeris";
import { initScene, setupControls } from "./tracker/scene";
import { GLOBAL_STYLES, Header, Transport, CameraControls, DistancePanels, BottomBar, CrewModal } from "./tracker/ui";

const ArtemisTracker3D: FC = () => {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const scnRef = useRef<THREE.Scene | null>(null);
  const renRef = useRef<THREE.WebGLRenderer | null>(null);
  const objRef = useRef<SceneObjects>({});
  const ctl = useRef<OrbitControls>({ drag: false, right: false, manual: false, lx: 0, ly: 0, theta: Math.PI * 0.5, phi: Math.PI * 0.42, r: 180, rTarget: 180, tgt: new THREE.Vector3(48, 0, 0) });

  const [now, setNow] = useState<number>(Date.now());
  const [tOver, setTOver] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [live, setLive] = useState<boolean>(true);
  const [camMode, setCamMode] = useState<CamMode>("flyby");
  const [showLabels, setShowLabels] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showMoonOrbit, setShowMoonOrbit] = useState(true);
  const [showCrew, setShowCrew] = useState(false);

  const eNow = live ? now : (tOver ?? now);
  const met = eNow - LAUNCH_UTC;
  const mf = Math.max(0, Math.min(1, met / MISSION_DUR));
  const clampedTime = Math.max(DATA_START, Math.min(DATA_END, eNow));

  const orionKm = interpOEM(clampedTime);
  const moonKm = getMoonPosKm(eNow);
  const oV = new THREE.Vector3(orionKm.x * KM2U, orionKm.y * KM2U, orionKm.z * KM2U);
  const mV = new THREE.Vector3(moonKm.x * KM2U, moonKm.y * KM2U, moonKm.z * KM2U);
  const dE = Math.sqrt(orionKm.x ** 2 + orionKm.y ** 2 + orionKm.z ** 2);
  const dM = Math.sqrt((orionKm.x - moonKm.x) ** 2 + (orionKm.y - moonKm.y) ** 2 + (orionKm.z - moonKm.z) ** 2);

  let phase = "Pre-launch";
  if (met > MISSION_DUR) phase = "Splashdown";
  else if (mf >= 0.97) phase = "Re-entry";
  else if (mf >= 0.60) phase = "Return Coast";
  else if (mf >= 0.50) phase = "Lunar Flyby";
  else if (mf >= 0.10) phase = "Translunar Coast";
  else if (mf > 0) phase = "Earth Orbit";
  const day = Math.floor(Math.max(0, met) / 86400000) + 1;

  useEffect(() => {
    if (live) { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }
    if (speed !== 0 && tOver !== null) { const iv = setInterval(() => setTOver(p => Math.max(LAUNCH_UTC - 3600000, Math.min(SPLASHDOWN_UTC + 3600000, (p ?? Date.now()) + speed * 50))), 16); return () => clearInterval(iv); }
  }, [live, speed, tOver]);

  const onSlide = (e: React.ChangeEvent<HTMLInputElement>): void => { setTOver(LAUNCH_UTC + Number(e.target.value)); setLive(false); setSpeed(0); };
  const goLive = (): void => { setLive(true); setTOver(null); setSpeed(0); };
  const onSpeedClick = (s: number): void => { if (live) { setTOver(Date.now()); setLive(false); } setSpeed(s); };

  const updCam = useCallback((): void => {
    const c = ctl.current, cam = camRef.current; if (!cam) return;
    c.phi = Math.max(0.05, Math.min(Math.PI - 0.05, c.phi));
    c.r = Math.max(1.5, Math.min(400, c.r));
    cam.position.set(c.tgt.x + c.r * Math.sin(c.phi) * Math.cos(c.theta), c.tgt.y + c.r * Math.cos(c.phi), c.tgt.z + c.r * Math.sin(c.phi) * Math.sin(c.theta));
    cam.lookAt(c.tgt);
  }, []);

  const fullTrajPts = useRef<THREE.Vector3[]>([]);

  // Scene init
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;

    const { renderer, scene, camera, cleanup: sceneCleanup } = initScene(cv, objRef, fullTrajPts);
    renRef.current = renderer;
    scnRef.current = scene;
    camRef.current = camera;
    updCam();

    const controlsCleanup = setupControls(cv, ctl, camRef, updCam);

    return () => { controlsCleanup(); sceneCleanup(); };
  }, [updCam]);

  // Render loop
  useEffect(() => {
    let raf: number;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const o = objRef.current;
      if (!o.orion || !scnRef.current || !renRef.current || !camRef.current) return;

      o.orion.position.copy(oV);
      o.orion.rotation.y += 0.003;
      o.orion.rotation.z += 0.001;
      o.oGlow!.position.copy(oV);

      const camDist = camRef.current.position.distanceTo(oV);
      const orionScale = Math.max(0.15, Math.min(2.5, camDist * 0.012));
      o.orion.scale.setScalar(orionScale);
      o.oGlow!.scale.setScalar(orionScale * 1.2);
      o.oLbl!.position.set(oV.x, oV.y + orionScale * 2, oV.z);
      o.oLbl!.scale.setScalar(Math.max(0.4, orionScale * 0.6));
      o.oLbl!.visible = showLabels && camDist > 15;

      o.moon!.position.copy(mV);
      o.moonLbl!.position.set(mV.x, mV.y - MOON_R - 1.5, mV.z);

      const camR = ctl.current.r;
      const showBodyLabels = showLabels && camR > 60;
      if (o.earthLbl) o.earthLbl.visible = showBodyLabels;
      if (o.moonLbl) o.moonLbl.visible = showBodyLabels;
      if (o.trajLine) o.trajLine.visible = showTrajectory;
      if (o.cLine) o.cLine.visible = showTrajectory;
      if (o.moonOrbit) o.moonOrbit.visible = showMoonOrbit;

      // Smooth zoom lerp
      const zc = ctl.current;
      zc.r += (zc.rTarget - zc.r) * 0.12;

      // Camera tracking (skip when user has dragged)
      const c = ctl.current;
      if (!c.drag && !c.manual) {
        let goalTgt: THREE.Vector3, goalR: number;
        if (camMode === "orion") {
          const mid = new THREE.Vector3((oV.x + mV.x) / 3, (oV.y + mV.y) / 3, (oV.z + mV.z) / 3);
          goalTgt = mid;
          const maxSpread = Math.max(oV.length(), mV.length(), oV.distanceTo(mV));
          goalR = Math.max(30, maxSpread * 0.75);
        } else if (camMode === "moon") {
          goalTgt = mV.clone();
          goalR = 6;
          const away = mV.clone().sub(oV).normalize();
          const goalTheta = Math.atan2(away.z, away.x);
          const goalPhi = Math.acos(Math.max(-1, Math.min(1, away.y / 1)));
          c.theta += (goalTheta - c.theta) * 0.04;
          c.phi += (goalPhi - c.phi) * 0.04;
        } else if (camMode === "earth") {
          goalTgt = new THREE.Vector3(0, 0, 0);
          goalR = 25;
          const away = new THREE.Vector3().sub(mV).normalize();
          const goalTheta = Math.atan2(away.z, away.x);
          const goalPhi = Math.acos(Math.max(-1, Math.min(1, away.y / 1)));
          c.theta += (goalTheta - c.theta) * 0.04;
          c.phi += (goalPhi - c.phi) * 0.04;
        } else if (camMode === "flyby") {
          goalTgt = oV.clone().lerp(mV, 0.5);
          const halfSpan = oV.distanceTo(mV) * 0.5 + MOON_R;
          const cam = camRef.current!;
          const vFov = cam.fov * Math.PI / 360; // half vertical FOV in radians
          const hFov = Math.atan(Math.tan(vFov) * cam.aspect); // half horizontal FOV
          const fov = Math.min(vFov, hFov) * 0.85; // use narrower axis with margin
          goalR = Math.max(3, halfSpan / Math.tan(fov));
        } else {
          goalTgt = new THREE.Vector3(mV.x * 0.5, mV.y * 0.5, mV.z * 0.5);
          goalR = 140;
        }
        c.tgt.lerp(goalTgt, 0.06);
        c.rTarget += (goalR - c.rTarget) * 0.06;
      }

      // Always update camera position from controls
      const cam = camRef.current;
      if (cam) {
        c.phi = Math.max(0.05, Math.min(Math.PI - 0.05, c.phi));
        cam.position.set(c.tgt.x + c.r * Math.sin(c.phi) * Math.cos(c.theta), c.tgt.y + c.r * Math.cos(c.phi), c.tgt.z + c.r * Math.sin(c.phi) * Math.sin(c.theta));
        cam.lookAt(c.tgt);
      }

      // Completed trail
      const ci = OEM.findIndex(d => d[0] > clampedTime);
      const idx = ci < 0 ? OEM.length : ci;
      if (idx >= 2 && fullTrajPts.current.length > 0) {
        o.cLine!.geometry.dispose();
        o.cLine!.geometry = new THREE.BufferGeometry().setFromPoints(fullTrajPts.current.slice(0, idx));
      }

      // Earth rotation — sidereal
      const SIDEREAL_DAY = 86164.1;
      const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
      const secSinceJ2000 = (eNow - J2000) / 1000;
      const earthAngle = (280.46 + (secSinceJ2000 / SIDEREAL_DAY) * 360) * Math.PI / 180;
      if (o.earth) o.earth.rotation.y = earthAngle;
      if (o.clouds) o.clouds.rotation.y = earthAngle * 0.97;

      renRef.current.render(scnRef.current, camRef.current);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [oV, mV, clampedTime, mf, camMode, eNow, showLabels, showTrajectory, showMoonOrbit]);

  const phaseCol = phase === "Lunar Flyby" ? "#eab308" : phase === "Re-entry" ? "#ef4444" : "#3b82f6";

  const handleCamMode = (mode: CamMode): void => { ctl.current.manual = false; setCamMode(mode); };

  return (
    <div style={{ background: "#030610", height: "100dvh", fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace", color: "#d4dde8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{GLOBAL_STYLES}</style>

      <Header phase={phase} day={day} met={met} phaseCol={phaseCol} />
      <Transport live={live} speed={speed} eNow={eNow} onSpeedClick={onSpeedClick} onLive={goLive} onSlide={onSlide} />

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas ref={cvRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }} />
        <div className="hint-text" style={{ position: "absolute", bottom: 8, left: 14, fontSize: 10, color: "#4a5568", pointerEvents: "none", letterSpacing: ".5px" }}>DRAG ORBIT · SCROLL ZOOM · RIGHT-DRAG PAN</div>

        <CameraControls
          camMode={camMode}
          showLabels={showLabels}
          showTrajectory={showTrajectory}
          showMoonOrbit={showMoonOrbit}
          onCamMode={handleCamMode}
          onToggleLabels={() => setShowLabels(v => !v)}
          onToggleTrajectory={() => setShowTrajectory(v => !v)}
          onToggleMoonOrbit={() => setShowMoonOrbit(v => !v)}
        />

        <DistancePanels dE={dE} dM={dM} />
      </div>

      <BottomBar mf={mf} eNow={eNow} crew={CREW} onCrewClick={() => setShowCrew(true)} />

      {showCrew && <CrewModal crew={CREW} onClose={() => setShowCrew(false)} />}
    </div>
  );
};

export default ArtemisTracker3D;
