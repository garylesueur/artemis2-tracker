"use client";

import { useState, useEffect, useRef, useCallback, type FC } from "react";
import * as THREE from "three";
import type { CamMode, OrbitControls, SceneObjects } from "./tracker/types";
import { OEM, LAUNCH_UTC, SPLASHDOWN_UTC, MISSION_DUR, DATA_START, DATA_END, KM2U, MOON_R, CREW } from "./tracker/data";
import { getMoonPosKm, getSunPosKm, interpOEM, fmtT, getSpeedKmS } from "./tracker/ephemeris";
import { initScene, setupControls } from "./tracker/scene";
import { GLOBAL_STYLES, Header, Transport, CameraControls, DistancePanels, BottomBar, CrewModal } from "./tracker/ui";

const ArtemisTracker3D: FC = () => {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const scnRef = useRef<THREE.Scene | null>(null);
  const renRef = useRef<THREE.WebGLRenderer | null>(null);
  const objRef = useRef<SceneObjects>({});
  const ctl = useRef<OrbitControls>({ drag: false, right: false, manual: false, lx: 0, ly: 0, theta: Math.PI * 0.5, phi: Math.PI * 0.15, r: 180, rTarget: 180, tgt: new THREE.Vector3(48, 0, 0) });

  const [now, setNow] = useState<number>(Date.now());
  const [tOver, setTOver] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [live, setLive] = useState<boolean>(true);
  const [camMode, setCamMode] = useState<CamMode>("flyby");
  const [showLabels, setShowLabels] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showMoonOrbit, setShowMoonOrbit] = useState(true);
  const [showCrew, setShowCrew] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);

  // Request geolocation once on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {}, // silently ignore denial
      );
    }
  }, []);

  const eNow = live ? now : (tOver ?? now);
  const met = eNow - LAUNCH_UTC;
  const mf = Math.max(0, Math.min(1, met / MISSION_DUR));
  const clampedTime = Math.max(DATA_START, Math.min(DATA_END, eNow));

  const orionKm = interpOEM(clampedTime);
  const orionKmAhead = interpOEM(clampedTime + 1000);
  const moonKm = getMoonPosKm(eNow);
  const oV = new THREE.Vector3(orionKm.x * KM2U, orionKm.y * KM2U, orionKm.z * KM2U);
  const velDir = new THREE.Vector3(
    (orionKmAhead.x - orionKm.x) * KM2U,
    (orionKmAhead.y - orionKm.y) * KM2U,
    (orionKmAhead.z - orionKm.z) * KM2U,
  ).normalize();
  const mV = new THREE.Vector3(moonKm.x * KM2U, moonKm.y * KM2U, moonKm.z * KM2U);
  const sunKm = getSunPosKm(eNow);
  const sV = new THREE.Vector3(sunKm.x * KM2U, sunKm.y * KM2U, sunKm.z * KM2U);
  const dE = Math.sqrt(orionKm.x ** 2 + orionKm.y ** 2 + orionKm.z ** 2);
  const dM = Math.sqrt((orionKm.x - moonKm.x) ** 2 + (orionKm.y - moonKm.y) ** 2 + (orionKm.z - moonKm.z) ** 2);
  const spd = getSpeedKmS(clampedTime);

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
    if (speed !== 0 && tOver !== null) { const iv = setInterval(() => setTOver(p => Math.max(LAUNCH_UTC - 3600000, Math.min(SPLASHDOWN_UTC + 3600000, (p ?? Date.now()) + speed * 16))), 16); return () => clearInterval(iv); }
  }, [live, speed, tOver]);

  const onSlide = (e: React.ChangeEvent<HTMLInputElement>): void => { setTOver(LAUNCH_UTC + Number(e.target.value)); setLive(false); setSpeed(0); };
  const goLive = (): void => { setLive(true); setTOver(null); setSpeed(0); };
  const onSpeedClick = (s: number): void => { if (live) { setTOver(Date.now()); setLive(false); } setSpeed(s); };

  const updCam = useCallback((): void => {
    const c = ctl.current, cam = camRef.current; if (!cam) return;
    c.r = Math.max(0.3, Math.min(400, c.r));
    c.phi = Math.max(0.1, Math.min(Math.PI - 0.1, c.phi));
    cam.position.set(
      c.tgt.x + c.r * Math.sin(c.phi) * Math.cos(c.theta),
      c.tgt.y + c.r * Math.cos(c.phi),
      c.tgt.z + c.r * Math.sin(c.phi) * Math.sin(c.theta),
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(c.tgt);
  }, []);

  const fullTrajPts = useRef<THREE.Vector3[]>([]);
  const lblRef = useRef<HTMLDivElement>(null);

  // Project a world-space position to screen coords, with a world-space radius for bottom offset
  const projectToScreen = useCallback((worldPos: THREE.Vector3, worldRadius: number, cam: THREE.PerspectiveCamera, container: HTMLElement): { x: number; y: number; visible: boolean } => {
    const v = worldPos.clone().project(cam);
    const hw = container.clientWidth / 2;
    const hh = container.clientHeight / 2;
    const x = v.x * hw + hw;
    const y = -v.y * hh + hh;
    // Project a point at the bottom of the object to get screen-space offset
    const bottomPos = worldPos.clone();
    bottomPos.y -= worldRadius;
    const vb = bottomPos.project(cam);
    const yBottom = -vb.y * hh + hh;
    return { x, y: yBottom, visible: v.z < 1 };
  }, []);

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
      if (!o.orion || !o.sceneRoot || !scnRef.current || !renRef.current || !camRef.current) return;

      // Positions are in OEM coords — sceneRoot rotates them to align the orbital plane
      o.orion.position.copy(oV);
      const up = new THREE.Vector3(0, 1, 0);
      const orientQ = new THREE.Quaternion().setFromUnitVectors(up, velDir);
      o.orion.quaternion.copy(orientQ);
      o.oGlow!.position.copy(oV);

      const oWorld = o.orion.getWorldPosition(new THREE.Vector3());
      const camDist = camRef.current.position.distanceTo(oWorld);
      const orionScale = Math.max(0.15, Math.min(2.5, camDist * 0.012));
      o.orion.scale.setScalar(orionScale);
      o.oGlow!.scale.setScalar(orionScale * 1.2);

      // Sun position and lighting direction
      if (o.sun) o.sun.position.copy(sV);
      if (o.sunLight) o.sunLight.position.copy(sV.clone().normalize().multiplyScalar(1000));

      o.moon!.position.copy(mV);
      // Tidal locking — near side always faces Earth (at origin)
      o.moon!.lookAt(0, 0, 0);
      o.moon!.rotateY(-Math.PI / 2);

      // Earthshine — position light near Moon, offset toward Earth
      if (o.earthshine) {
        const toEarth = mV.clone().negate().normalize();
        o.earthshine.position.copy(mV).add(toEarth.multiplyScalar(MOON_R * 3));
      }
      // Moonlight — position light near Earth, offset toward Moon
      if (o.moonlight) {
        const toMoon = mV.clone().normalize();
        const EARTH_R_L = 6371 * KM2U;
        o.moonlight.position.copy(toMoon.multiplyScalar(EARTH_R_L * 3));
      }

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
        const earthW = o.earth ? o.earth.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const moonW = o.moon!.getWorldPosition(new THREE.Vector3());
        if (camMode === "orion") {
          goalTgt = oWorld.clone();
          goalR = 3;
        } else if (camMode === "moon") {
          goalTgt = moonW.clone();
          goalR = 6;
          const away = moonW.clone().sub(oWorld).normalize();
          const goalTheta = Math.atan2(away.z, away.x);
          const goalPhi = Math.acos(Math.max(-1, Math.min(1, away.y / 1)));
          c.theta += (goalTheta - c.theta) * 0.04;
          c.phi += (goalPhi - c.phi) * 0.04;
        } else if (camMode === "earth") {
          goalTgt = earthW.clone();
          goalR = 25;
          const away = earthW.clone().sub(moonW).normalize();
          const goalTheta = Math.atan2(away.z, away.x);
          const goalPhi = Math.acos(Math.max(-1, Math.min(1, away.y / 1)));
          c.theta += (goalTheta - c.theta) * 0.04;
          c.phi += (goalPhi - c.phi) * 0.04;
        } else if (camMode === "flyby") {
          goalTgt = oWorld.clone().lerp(moonW, 0.5);
          const halfSpan = oWorld.distanceTo(moonW) * 0.5 + MOON_R;
          const cam = camRef.current!;
          const vFov = cam.fov * Math.PI / 360; // half vertical FOV in radians
          const hFov = Math.atan(Math.tan(vFov) * cam.aspect); // half horizontal FOV
          const fov = Math.min(vFov, hFov) * 0.85; // use narrower axis with margin
          goalR = Math.max(3, halfSpan / Math.tan(fov));
        } else {
          goalTgt = new THREE.Vector3(moonW.x * 0.5, moonW.y * 0.5, moonW.z * 0.5);
          goalR = 140;
        }
        c.tgt.lerp(goalTgt, 0.06);
        c.rTarget += (goalR - c.rTarget) * 0.06;
      }

      // Always update camera position from controls
      const cam = camRef.current;
      if (cam) {
        c.phi = Math.max(0.1, Math.min(Math.PI - 0.1, c.phi));
        cam.position.set(
          c.tgt.x + c.r * Math.sin(c.phi) * Math.cos(c.theta),
          c.tgt.y + c.r * Math.cos(c.phi),
          c.tgt.z + c.r * Math.sin(c.phi) * Math.sin(c.theta),
        );
        cam.up.set(0, 1, 0);
        cam.lookAt(c.tgt);
      }

      // Completed trail — spline has 4x more points than OEM
      const ci = OEM.findIndex(d => d[0] > clampedTime);
      const rawIdx = ci < 0 ? OEM.length : ci;
      const splineIdx = Math.min(rawIdx * 4, fullTrajPts.current.length);
      if (splineIdx >= 2 && fullTrajPts.current.length > 0) {
        o.cLine!.geometry.dispose();
        o.cLine!.geometry = new THREE.BufferGeometry().setFromPoints(fullTrajPts.current.slice(0, splineIdx));
      }

      // Earth rotation — sidereal
      const SIDEREAL_DAY = 86164.1;
      const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
      const secSinceJ2000 = (eNow - J2000) / 1000;
      const earthAngle = (280.46 + (secSinceJ2000 / SIDEREAL_DAY) * 360) * Math.PI / 180;
      if (o.earth) o.earth.rotation.z = earthAngle;
      // Cloud layers spin with Earth but drift visibly via UV offset
      const t = performance.now() / 1000;
      if (o.clouds) {
        o.clouds.rotation.z = earthAngle;
        const m = (o.clouds as THREE.Mesh).material as THREE.MeshPhongMaterial;
        if (m.map) { m.map.offset.x = t * 0.0012; m.map.offset.y = Math.sin(t * 0.06) * 0.006; }
      }
      if (o.cloudsHi) {
        o.cloudsHi.rotation.z = earthAngle;
        const m = (o.cloudsHi as THREE.Mesh).material as THREE.MeshPhongMaterial;
        if (m.map) { m.map.offset.x = 0.4 - t * 0.002; m.map.offset.y = 0.1 + Math.sin(t * 0.08 + 1) * 0.008; }
      }

      // User location pin on Earth
      if (o.userPin && userLoc && !o.userPin.visible) {
        const EARTH_R_L = 6371 * KM2U;
        const latR = userLoc.lat * Math.PI / 180;
        const lonR = userLoc.lon * Math.PI / 180;
        o.userPin.position.set(
          EARTH_R_L * Math.cos(latR) * Math.cos(lonR),
          EARTH_R_L * Math.cos(latR) * Math.sin(lonR),
          EARTH_R_L * Math.sin(latR),
        );
        o.userPin.visible = true;
      }

      // Screen-space labels
      const container = lblRef.current;
      if (container && showLabels) {
        const cam = camRef.current;
        const EARTH_R_U = 6371 * KM2U;
        const MOON_R_U = MOON_R;
        const SUN_R_U = 696000 * KM2U;
        const earthWorld = o.earth ? o.earth.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const moonWorld = o.moon ? o.moon.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const orionWorld = oWorld;
        const sunWorld = o.sun ? o.sun.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const labels: [string, THREE.Vector3, number, string][] = [
          ["EARTH", earthWorld, EARTH_R_U, "#4499dd"],
          ["MOON", moonWorld, MOON_R_U, "#999999"],
          ["ORION", orionWorld, orionScale * 1.5, "#ffcc22"],
          ["SUN", sunWorld, SUN_R_U, "#ffdd44"],
        ];
        // Ensure label elements exist
        while (container.children.length < labels.length) {
          const el = document.createElement("div");
          el.style.cssText = "position:absolute;font:bold 10px monospace;letter-spacing:1.5px;pointer-events:none;text-align:center;transform:translateX(-50%);white-space:nowrap;padding:2px 6px;";
          container.appendChild(el);
        }
        for (let i = 0; i < labels.length; i++) {
          const [text, pos, radius, color] = labels[i];
          const el = container.children[i] as HTMLElement;
          const sc = projectToScreen(pos, radius, cam, container);
          el.textContent = text;
          el.style.color = color;
          el.style.left = `${sc.x}px`;
          el.style.top = `${sc.y + 6}px`;
          el.style.display = sc.visible ? "" : "none";
        }
        container.style.display = "";
      } else if (container) {
        container.style.display = "none";
      }

      renRef.current.render(scnRef.current, camRef.current);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oV, mV, sV, clampedTime, mf, camMode, eNow, showLabels, showTrajectory, showMoonOrbit, projectToScreen]);

  const phaseCol = phase === "Lunar Flyby" ? "#eab308" : phase === "Re-entry" ? "#ef4444" : "#3b82f6";

  const handleCamMode = (mode: CamMode): void => { ctl.current.manual = false; setCamMode(mode); };

  return (
    <div style={{ background: "#030610", height: "100dvh", fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace", color: "#d4dde8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{GLOBAL_STYLES}</style>

      <Header phase={phase} day={day} met={met} phaseCol={phaseCol} />
      <Transport live={live} speed={speed} eNow={eNow} onSpeedClick={onSpeedClick} onLive={goLive} onSlide={onSlide} />

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas ref={cvRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }} />
        <div ref={lblRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "hidden" }} />
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

        <DistancePanels dE={dE} dM={dM} eNow={eNow} speed={spd} />
      </div>

      <BottomBar mf={mf} eNow={eNow} crew={CREW} onCrewClick={() => setShowCrew(true)} />

      {showCrew && <CrewModal crew={CREW} onClose={() => setShowCrew(false)} />}
    </div>
  );
};

export default ArtemisTracker3D;
