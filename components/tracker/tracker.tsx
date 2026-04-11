"use client";

import { useState, useEffect, useRef, useCallback, type FC } from "react";
import * as THREE from "three";
import type { OrbitControls, SceneObjects } from "./types";
import type { MissionConfig, OEMPoint, POI } from "@/lib/types";
import { KM2U, MOON_R, EARTH_R } from "@/lib/constants";
import { getMoonPosKm, getSunPosKm, interpOEM, fmtT, getSpeedKmS } from "./ephemeris";
import { getVisiblePois } from "@/lib/world";
import { getMission } from "@/lib/missions";
import { initScene, setupControls } from "./scene";
import { addMissionToScene } from "./scene-mission";
import { GLOBAL_STYLES, Header, Transport, CameraControls, DistancePanels, BottomBar, CrewModal, ObjectInfoPanel, PoiInfoPanel } from "./ui";

interface TrackerProps {
  missionId: string;
}

const Tracker: FC<TrackerProps> = ({ missionId }) => {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const scnRef = useRef<THREE.Scene | null>(null);
  const renRef = useRef<THREE.WebGLRenderer | null>(null);
  const objRef = useRef<SceneObjects>({});
  const ctl = useRef<OrbitControls>({ drag: false, right: false, manual: false, lx: 0, ly: 0, theta: Math.PI * 0.5, phi: Math.PI * 0.15, r: 180, rTarget: 180, tgt: new THREE.Vector3(48, 0, 0) });

  // Mission data — loaded async
  const [config, setConfig] = useState<MissionConfig | null>(null);
  const [trajectory, setTrajectory] = useState<OEMPoint[] | null>(null);
  const [allPois, setAllPois] = useState<POI[]>([]);

  const [now, setNow] = useState<number>(Date.now());
  const [tOver, setTOver] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [live, setLive] = useState<boolean>(true);
  const [camMode, setCamMode] = useState<string>("flyby");
  const [showLabels, setShowLabels] = useState(true);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showMoonOrbit, setShowMoonOrbit] = useState(true);
  const [showCrew, setShowCrew] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedObj, setSelectedObj] = useState<string | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<string | null>(null);
  const selBoxRef = useRef<HTMLDivElement>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const poiPanelRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGLineElement>(null);
  const connectorDotRef = useRef<SVGCircleElement>(null);
  const raycaster = useRef(new THREE.Raycaster());

  // Load mission config and trajectory
  useEffect(() => {
    const mission = getMission(missionId);
    if (!mission) return;
    setConfig(mission);
    setCamMode(mission.cameraPresets[0]?.id ?? "full");
    // Past mission — start at beginning, no live mode
    if (Date.now() > mission.endUtc) {
      setLive(false);
      setTOver(mission.launchUtc);
    }
    mission.loadTrajectory().then(t => {
      setTrajectory(t);
      // Combine world POIs (filtered by mission date) + mission-specific POIs
      const worldPois = getVisiblePois(mission.launchUtc);
      setAllPois([...worldPois, ...mission.pois]);
    });
  }, [missionId]);

  // Request geolocation once on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {},
      );
    }
  }, []);

  // Derived values — only compute when we have config + trajectory
  const launchUtc = config?.launchUtc ?? 0;
  const endUtc = config?.endUtc ?? 0;
  const missionDur = endUtc - launchUtc;
  const dataStart = trajectory ? trajectory[0]?.[0] ?? 0 : 0;
  const dataEnd = trajectory ? trajectory[trajectory.length - 1]?.[0] ?? 0 : 0;

  const eNow = live ? now : (tOver ?? now);
  const met = eNow - launchUtc;
  const mf = missionDur > 0 ? Math.max(0, Math.min(1, met / missionDur)) : 0;
  const clampedTime = Math.max(dataStart, Math.min(dataEnd, eNow));

  const orionKm = trajectory ? interpOEM(trajectory, clampedTime) : { x: 0, y: 0, z: 0 };
  const orionKmAhead = trajectory ? interpOEM(trajectory, clampedTime + 1000) : { x: 0, y: 0, z: 0 };
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
  const dE = Math.max(0, Math.sqrt(orionKm.x ** 2 + orionKm.y ** 2 + orionKm.z ** 2) - 6371);
  const dM = Math.sqrt((orionKm.x - moonKm.x) ** 2 + (orionKm.y - moonKm.y) ** 2 + (orionKm.z - moonKm.z) ** 2);
  const spd = trajectory ? getSpeedKmS(trajectory, clampedTime) : 0;

  // Phase calculation from config
  let phase = "Pre-launch";
  let phaseCol = "#3b82f6";
  if (config) {
    if (met > missionDur) {
      const lastPhase = config.phases[config.phases.length - 1];
      phase = lastPhase?.name ?? "Complete";
      phaseCol = lastPhase?.color ?? "#22c55e";
    } else {
      for (let i = config.phases.length - 1; i >= 0; i--) {
        if (mf >= config.phases[i].startFraction) {
          phase = config.phases[i].name;
          phaseCol = config.phases[i].color;
          break;
        }
      }
    }
  }
  const day = Math.floor(Math.max(0, met) / 86400000) + 1;

  useEffect(() => {
    if (live) { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }
    if (speed !== 0 && tOver !== null) { const iv = setInterval(() => setTOver(p => Math.max(launchUtc - 3600000, Math.min(endUtc + 3600000, (p ?? Date.now()) + speed * 16))), 16); return () => clearInterval(iv); }
  }, [live, speed, tOver, launchUtc, endUtc]);

  const isPast = config ? Date.now() > config.endUtc : false;
  const launchConfirmed = config?.launchConfirmed !== false;

  const onSlide = (e: React.ChangeEvent<HTMLInputElement>): void => { setTOver(launchUtc + Number(e.target.value)); setLive(false); setSpeed(0); };
  const goLive = (): void => { if (isPast) { setLive(false); setTOver(launchUtc); setSpeed(0); } else { setLive(true); setTOver(null); setSpeed(0); } };
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

  const projectToScreen = useCallback((worldPos: THREE.Vector3, worldRadius: number, cam: THREE.PerspectiveCamera, container: HTMLElement): { x: number; y: number; visible: boolean } => {
    const v = worldPos.clone().project(cam);
    const hw = container.clientWidth / 2;
    const hh = container.clientHeight / 2;
    const x = v.x * hw + hw;
    const y = -v.y * hh + hh;
    const bottomPos = worldPos.clone();
    bottomPos.y -= worldRadius;
    const vb = bottomPos.project(cam);
    const yBottom = -vb.y * hh + hh;
    return { x, y: yBottom, visible: v.z < 1 };
  }, []);

  // Scene init — creates world scene, then adds mission objects once trajectory is loaded
  const missionCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const cv = cvRef.current; if (!cv || !config) return;

    const { renderer, scene, camera, cleanup: sceneCleanup } = initScene(cv, objRef, config.launchUtc);
    renRef.current = renderer;
    scnRef.current = scene;
    camRef.current = camera;
    updCam();

    const controlsCleanup = setupControls(cv, ctl, camRef, updCam);

    // Click-to-select
    let clickStart = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { clickStart = { x: e.clientX, y: e.clientY }; };
    cv.addEventListener("pointerdown", onDown);
    const onCanvasClick = (e: PointerEvent) => {
      if (Math.abs(e.clientX - clickStart.x) > 5 || Math.abs(e.clientY - clickStart.y) > 5) return;
      const cam = camRef.current;
      if (!cam || !scnRef.current) return;
      const rect = cv.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.current.setFromCamera(mouse, cam);
      const o = objRef.current;

      const poiGroups = [o.moonPois, o.earthPois].filter(g => g && g.visible && g.children.length > 0);
      for (const group of poiGroups) {
        const poiHits = raycaster.current.intersectObjects(group!.children, true);
        if (poiHits.length > 0) {
          let hit = poiHits[0].object as THREE.Object3D;
          while (hit && !hit.userData.poiName && hit.parent) hit = hit.parent;
          const poiName = hit?.userData?.poiName as string;
          if (poiName) {
            setSelectedPoi(prev => prev === poiName ? null : poiName);
            return;
          }
        }
      }

      const targets: { name: string; obj: THREE.Object3D }[] = [];
      if (o.earth) targets.push({ name: "earth", obj: o.earth });
      if (o.moon) targets.push({ name: "moon", obj: o.moon });
      if (o.sun) targets.push({ name: "sun", obj: o.sun });
      if (o.orion) targets.push({ name: config.spacecraft.id, obj: o.orion });
      const meshes = targets.map(t => t.obj);
      const hits = raycaster.current.intersectObjects(meshes, true);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const match = targets.find(t => t.obj === hitObj || hitObj.parent === t.obj || hitObj.parent?.parent === t.obj);
        if (match) {
          setSelectedPoi(null);
          setSelectedObj(prev => prev === match.name ? null : match.name);
          return;
        }
      }
      setSelectedPoi(null);
      setSelectedObj(null);
    };
    cv.addEventListener("pointerup", onCanvasClick);

    return () => {
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointerup", onCanvasClick);
      controlsCleanup();
      if (missionCleanupRef.current) missionCleanupRef.current();
      sceneCleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, updCam]);

  // Add mission objects when trajectory loads
  useEffect(() => {
    if (!config || !trajectory || !objRef.current.sceneRoot) return;

    // Clean up previous mission objects if any
    if (missionCleanupRef.current) missionCleanupRef.current();

    const moonPois = allPois.filter(p => p.body === "moon");
    const earthPois = allPois.filter(p => p.body === "earth");

    const { cleanup } = addMissionToScene(config, trajectory, objRef, fullTrajPts, moonPois, earthPois);
    missionCleanupRef.current = cleanup;
  }, [config, trajectory, allPois]);

  // Render loop
  useEffect(() => {
    let raf: number;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const o = objRef.current;
      if (!o.sceneRoot || !scnRef.current || !renRef.current || !camRef.current) return;

      // Only update spacecraft if it exists (mission objects loaded)
      if (o.orion) {
        o.orion.position.copy(oV);
        const up = new THREE.Vector3(0, 1, 0);
        const orientQ = new THREE.Quaternion().setFromUnitVectors(up, velDir);
        o.orion.quaternion.copy(orientQ);
      }
      if (o.oGlow) o.oGlow.position.copy(oV);

      if (o.orion) {
        o.orion.scale.setScalar(0.01);
        if (o.oGlow) o.oGlow.scale.setScalar(0.03);
      }

      // Sun position, lighting direction, and surface animation
      if (o.sun) {
        o.sun.position.copy(sV);
        const sunMat = o.sun.material;
        if (sunMat && 'uniforms' in sunMat) {
          (sunMat as THREE.ShaderMaterial).uniforms.uTime.value = performance.now() / 1000;
        }
      }
      if (o.sunLight) o.sunLight.position.copy(sV.clone().normalize().multiplyScalar(1000));

      o.moon!.position.copy(mV);
      o.moon!.lookAt(0, 0, 0);
      o.moon!.rotateY(-Math.PI / 2);

      const moonShader = o.moon!.material;
      if (moonShader && 'uniforms' in moonShader) {
        const sunDir = sV.clone().sub(mV).normalize();
        sunDir.applyQuaternion(o.sceneRoot!.quaternion);
        (moonShader as THREE.ShaderMaterial).uniforms.uLightDir.value.copy(sunDir);
      }

      if (o.corona) {
        o.corona.position.copy(mV);
        const camWorld = camRef.current.position.clone();
        o.corona.lookAt(camWorld);
        const camLocal = o.sceneRoot!.worldToLocal(camWorld.clone());
        const camToMoon = mV.clone().sub(camLocal).normalize();
        const camToSun = sV.clone().sub(camLocal).normalize();
        const dot = camToMoon.dot(camToSun);
        const tightAlign = Math.pow(Math.max(0, (dot - 0.98) / 0.02), 2.0);
        const wideGlow = Math.pow(Math.max(0, (dot - 0.90) / 0.10), 4.0) * 0.15;
        const alignment = Math.min(1, tightAlign + wideGlow);
        const mat = o.corona.material as THREE.ShaderMaterial;
        mat.uniforms.uAlignment.value = alignment;
        mat.uniforms.uTime.value = performance.now() / 1000;
        o.corona.visible = alignment > 0.001;
      }

      if (o.earthshine) {
        const toEarth = mV.clone().negate().normalize();
        o.earthshine.position.copy(mV).add(toEarth.multiplyScalar(MOON_R * 3));
      }
      if (o.moonlight) {
        const toMoon = mV.clone().normalize();
        const EARTH_R_L = 6371 * KM2U;
        o.moonlight.position.copy(toMoon.multiplyScalar(EARTH_R_L * 3));
      }

      if (o.trajLine) o.trajLine.visible = showTrajectory;
      if (o.cLine) o.cLine.visible = showTrajectory;
      if (o.moonOrbit) o.moonOrbit.visible = showMoonOrbit;
      if (o.earthPois) o.earthPois.visible = selectedObj === "earth";

      if (o.moonPois) {
        o.moonPois.visible = selectedObj === "moon";
        if (o.moonPois.visible) {
          const moonQ = o.moon!.quaternion;
          for (const pin of o.moonPois.children) {
            const offset = pin.userData.localOffset as THREE.Vector3;
            const localQ = pin.userData.localQuat as THREE.Quaternion;
            if (offset && localQ) {
              pin.position.copy(offset.clone().applyQuaternion(moonQ).add(mV));
              pin.quaternion.copy(moonQ).multiply(localQ);
            }
          }
        }
      }

      // Smooth zoom lerp
      const zc = ctl.current;
      zc.r += (zc.rTarget - zc.r) * 0.12;

      const c = ctl.current;
      const spacecraftId = config?.spacecraft.id;

      if (selectedObj) {
        let selPos: THREE.Vector3 | null = null;
        let selR = 0;
        if (selectedObj === "earth" && o.earth) { selPos = o.earth.getWorldPosition(new THREE.Vector3()); selR = EARTH_R; }
        else if (selectedObj === "moon" && o.moon) { selPos = o.moon.getWorldPosition(new THREE.Vector3()); selR = MOON_R; }
        else if (selectedObj === spacecraftId && o.orion) { selPos = o.orion.getWorldPosition(new THREE.Vector3()); selR = 0.02; }
        if (selPos) {
          // Snap hard to avoid judder on fast-moving objects
          c.tgt.copy(selPos);
          const goalR = Math.max(0.1, selR * 5);
          c.rTarget += (goalR - c.rTarget) * 0.15;
        }
      } else if (!c.drag && !c.manual) {
        const oWorld = o.orion ? o.orion.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        let goalTgt: THREE.Vector3, goalR: number;
        const earthW = o.earth ? o.earth.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const moonW = o.moon!.getWorldPosition(new THREE.Vector3());

        // Find the current camera preset's behavior
        const preset = config?.cameraPresets.find(p => p.id === camMode);
        const behavior = preset?.behavior;

        if (behavior?.type === "follow-craft") {
          goalTgt = oWorld.clone();
          goalR = behavior.defaultR;
        } else if (behavior?.type === "follow-body" && behavior.body === "moon") {
          goalTgt = moonW.clone();
          goalR = behavior.defaultR;
          const away = moonW.clone().sub(oWorld).normalize();
          const goalTheta = Math.atan2(away.z, away.x);
          const goalPhi = Math.acos(Math.max(-1, Math.min(1, away.y / 1)));
          c.theta += (goalTheta - c.theta) * 0.04;
          c.phi += (goalPhi - c.phi) * 0.04;
        } else if (behavior?.type === "follow-body" && behavior.body === "earth") {
          goalTgt = earthW.clone();
          goalR = behavior.defaultR;
          const away = earthW.clone().sub(moonW).normalize();
          const goalTheta = Math.atan2(away.z, away.x);
          const goalPhi = Math.acos(Math.max(-1, Math.min(1, away.y / 1)));
          c.theta += (goalTheta - c.theta) * 0.04;
          c.phi += (goalPhi - c.phi) * 0.04;
        } else if (behavior?.type === "flyby") {
          goalTgt = oWorld.clone().lerp(moonW, 0.5);
          const halfSpan = oWorld.distanceTo(moonW) * 0.5 + MOON_R;
          const cam = camRef.current!;
          const vFov = cam.fov * Math.PI / 360;
          const hFov = Math.atan(Math.tan(vFov) * cam.aspect);
          const fov = Math.min(vFov, hFov) * 0.85;
          goalR = Math.max(3, halfSpan / Math.tan(fov));
        } else {
          // "full" or default
          goalTgt = new THREE.Vector3(moonW.x * 0.5, moonW.y * 0.5, moonW.z * 0.5);
          goalR = behavior?.type === "full" ? (behavior.defaultR ?? 140) : 140;
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
        // Dynamic near plane — prevent clipping when zoomed close to Orion
        const nearPlane = Math.max(0.001, c.r * 0.01);
        if (Math.abs(cam.near - nearPlane) > 0.0001) {
          cam.near = nearPlane;
          cam.updateProjectionMatrix();
        }
      }

      // Completed trail
      if (trajectory && o.cLine && fullTrajPts.current.length > 0) {
        const ci = trajectory.findIndex(d => d[0] > clampedTime);
        const rawIdx = ci < 0 ? trajectory.length : ci;
        const splineIdx = Math.min(rawIdx * 4, fullTrajPts.current.length);
        if (splineIdx >= 2) {
          o.cLine.geometry.dispose();
          o.cLine.geometry = new THREE.BufferGeometry().setFromPoints(fullTrajPts.current.slice(0, splineIdx));
        }
      }

      // Earth rotation — sidereal
      const SIDEREAL_DAY = 86164.1;
      const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
      const secSinceJ2000 = (eNow - J2000) / 1000;
      const earthAngle = (280.46 + (secSinceJ2000 / SIDEREAL_DAY) * 360) * Math.PI / 180;
      if (o.earth) o.earth.rotation.z = earthAngle;
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
        const orionWorld = o.orion ? o.orion.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const sunWorld = o.sun ? o.sun.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
        const scLabel = config?.spacecraft.name.split(" ")[0] ?? "CRAFT";
        const labels: [string, THREE.Vector3, number, string][] = [
          ["EARTH", earthWorld, EARTH_R_U, "#4499dd"],
          ["MOON", moonWorld, MOON_R_U, "#999999"],
          [scLabel, orionWorld, 0.03, "#ffcc22"],
          ["SUN", sunWorld, SUN_R_U, "#ffdd44"],
        ];
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

      // Selection box around selected object
      const selBox = selBoxRef.current;
      if (selBox && selectedObj) {
        const cam = camRef.current;
        const canvasParent = cvRef.current?.parentElement;
        if (cam && canvasParent) {
          let worldPos: THREE.Vector3 | null = null;
          let worldRadius = 0;
          if (selectedObj === "earth" && o.earth) { worldPos = o.earth.getWorldPosition(new THREE.Vector3()); worldRadius = EARTH_R; }
          else if (selectedObj === "moon" && o.moon) { worldPos = o.moon.getWorldPosition(new THREE.Vector3()); worldRadius = MOON_R; }
          else if (selectedObj === "sun" && o.sun) { worldPos = o.sun.getWorldPosition(new THREE.Vector3()); worldRadius = 696000 * KM2U; }
          else if (selectedObj === spacecraftId && o.orion) { worldPos = o.orion.getWorldPosition(new THREE.Vector3()); worldRadius = 0.03; }

          if (worldPos) {
            const hw = canvasParent.clientWidth / 2;
            const hh = canvasParent.clientHeight / 2;
            const vc = worldPos.clone().project(cam);
            const cx = vc.x * hw + hw;
            const cy = -vc.y * hh + hh;

            const camRight = new THREE.Vector3(); cam.getWorldDirection(camRight);
            const upDir = new THREE.Vector3(0, 1, 0);
            const rightDir = new THREE.Vector3().crossVectors(camRight, upDir).normalize();
            const upPerp = new THREE.Vector3().crossVectors(rightDir, camRight).normalize();

            const rProj = worldPos.clone().add(rightDir.clone().multiplyScalar(worldRadius)).project(cam);
            const tProj = worldPos.clone().add(upPerp.clone().multiplyScalar(worldRadius)).project(cam);
            const rScreen = Math.abs((rProj.x * hw + hw) - cx);
            const tScreen = Math.abs((-tProj.y * hh + hh) - cy);
            const pad = 12;
            const halfW = Math.max(rScreen, 20) + pad;
            const halfH = Math.max(tScreen, 20) + pad;

            selBox.style.left = `${cx - halfW}px`;
            selBox.style.top = `${cy - halfH}px`;
            selBox.style.width = `${halfW * 2}px`;
            selBox.style.height = `${halfH * 2}px`;
            selBox.style.display = vc.z < 1 ? "" : "none";

            const panel = infoPanelRef.current;
            if (panel && vc.z < 1) {
              const pw = panel.offsetWidth;
              const ph = panel.offsetHeight;
              const vw = canvasParent.clientWidth;
              const vh = canvasParent.clientHeight;
              const gap = 14;

              let pl = cx + halfW + gap;
              let pt = cy - ph / 2;
              let anchorX = cx + halfW;
              let anchorY = cy;
              if (pl + pw > vw - 10) { pl = cx - halfW - gap - pw; anchorX = cx - halfW; }
              if (pl < 10) { pl = cx - pw / 2; pt = cy + halfH + gap; anchorX = cx; anchorY = cy + halfH; }
              pl = Math.max(10, Math.min(vw - pw - 10, pl));
              pt = Math.max(10, Math.min(vh - ph - 10, pt));

              panel.style.left = `${pl}px`;
              panel.style.top = `${pt}px`;

              const line = connectorRef.current;
              const dot = connectorDotRef.current;
              if (line && dot) {
                const pcx = pl + pw / 2, pcy = pt + ph / 2;
                const dx = anchorX - pcx, dy = anchorY - pcy;
                const angle = Math.atan2(dy, dx);
                const cosA = Math.cos(angle), sinA = Math.sin(angle);
                const ex = pcx + cosA * Math.min(pw / 2, Math.abs(cosA) > 0.001 ? Math.abs(pw / 2 / cosA) : pw / 2);
                const ey = pcy + sinA * Math.min(ph / 2, Math.abs(sinA) > 0.001 ? Math.abs(ph / 2 / sinA) : ph / 2);
                line.setAttribute("x1", String(anchorX));
                line.setAttribute("y1", String(anchorY));
                line.setAttribute("x2", String(ex));
                line.setAttribute("y2", String(ey));
                dot.setAttribute("cx", String(anchorX));
                dot.setAttribute("cy", String(anchorY));
                line.style.display = "";
                dot.style.display = "";
              }
            }
          }
        }
      } else if (selBox) {
        selBox.style.display = "none";
        if (connectorRef.current) connectorRef.current.style.display = "none";
        if (connectorDotRef.current) connectorDotRef.current.style.display = "none";
      }

      // POI info panel positioning
      const poiPanel = poiPanelRef.current;
      if (poiPanel && selectedPoi) {
        const cam = camRef.current;
        const canvasParent = cvRef.current?.parentElement;
        if (cam && canvasParent) {
          let poiDot: THREE.Object3D | undefined;
          if (o.moonPois?.visible) poiDot = o.moonPois.children.find(c => c.userData.poiName === selectedPoi);
          if (!poiDot && o.earthPois?.visible) { poiDot = o.earthPois.children.find(c => c.userData.poiName === selectedPoi); }
          if (poiDot) {
            const hw = canvasParent.clientWidth / 2;
            const hh = canvasParent.clientHeight / 2;
            const vc = new THREE.Vector3();
            poiDot.getWorldPosition(vc);
            const projected = vc.project(cam);
            const sx = projected.x * hw + hw;
            const sy = -projected.y * hh + hh;
            if (projected.z < 1) {
              const pw = poiPanel.offsetWidth;
              const ph = poiPanel.offsetHeight;
              const vw = canvasParent.clientWidth;
              const vh = canvasParent.clientHeight;
              let pl = sx + 16;
              let pt = sy - ph / 2;
              if (pl + pw > vw - 10) pl = sx - 16 - pw;
              pl = Math.max(10, Math.min(vw - pw - 10, pl));
              pt = Math.max(10, Math.min(vh - ph - 10, pt));
              poiPanel.style.left = `${pl}px`;
              poiPanel.style.top = `${pt}px`;
            } else {
              poiPanel.style.left = "-9999px";
            }
          }
        }
      }

      renRef.current.render(scnRef.current, camRef.current);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oV, mV, sV, clampedTime, mf, camMode, eNow, showLabels, showTrajectory, showMoonOrbit, projectToScreen, selectedObj, selectedPoi, trajectory, config]);

  const handleCamMode = (mode: string): void => {
    ctl.current.manual = false;
    setCamMode(mode);
    // Camera presets drive following via camMode, not selectedObj
    // Clear selection UI so the info panel doesn't block the view
    setSelectedPoi(null);
    setSelectedObj(null);
  };

  if (!config) {
    return (
      <div style={{ background: "#030610", height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: "#7b8da4", fontFamily: "'IBM Plex Mono',monospace" }}>
        Loading mission...
      </div>
    );
  }

  const spacecraftInfo = config ? { id: config.spacecraft.id, name: config.spacecraft.name, icon: config.spacecraft.icon, color: config.spacecraft.color, type: config.spacecraft.type, facts: config.spacecraft.facts } : undefined;

  return (
    <div style={{ background: "#030610", height: "100dvh", fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace", color: "#d4dde8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{GLOBAL_STYLES}</style>

      <Header missionName={config.name} phase={phase} day={day} met={met} phaseCol={phaseCol} launchConfirmed={launchConfirmed} />
      <Transport live={live} speed={speed} eNow={eNow} launchUtc={launchUtc} missionDur={missionDur} isPast={isPast} onSpeedClick={onSpeedClick} onLive={goLive} onSlide={onSlide} />

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas ref={cvRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }} />
        <div ref={lblRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "hidden" }} />
        <div ref={selBoxRef} style={{ position: "absolute", display: "none", pointerEvents: "none", border: "1px solid rgba(234,179,8,0.5)", borderRadius: 4, animation: "sel-pulse 2s ease-in-out infinite" }} />
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9 }}>
          <line ref={connectorRef} style={{ display: "none" }} stroke="#eab308" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="4 3" />
          <circle ref={connectorDotRef} style={{ display: "none" }} r={3} fill="#eab308" fillOpacity={0.5} />
        </svg>
        {selectedObj && <ObjectInfoPanel ref={infoPanelRef} name={selectedObj} spacecraft={spacecraftInfo} dE={dE} dM={dM} speed={spd} eNow={eNow} onClose={() => { setSelectedObj(null); }} />}
        {selectedPoi && (() => { const poi = allPois.find(p => p.name === selectedPoi); return poi ? <PoiInfoPanel ref={poiPanelRef} poi={poi} onClose={() => setSelectedPoi(null)} /> : null; })()}
        <div className="hint-text" style={{ position: "absolute", bottom: 8, left: 14, fontSize: 10, color: "#4a5568", pointerEvents: "none", letterSpacing: ".5px" }}>DRAG ORBIT · SCROLL ZOOM · RIGHT-DRAG PAN · CLICK SELECT</div>

        <CameraControls
          camMode={camMode}
          presets={config.cameraPresets}
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

      <BottomBar mf={mf} eNow={eNow} countdowns={config.countdowns} crew={config.crew} crewLabel={`CREW — ${config.spacecraft.name.split(" ")[0]} "${config.name}"`} onCrewClick={() => setShowCrew(true)} />

      {showCrew && config.crew.length > 0 && <CrewModal crew={config.crew} onClose={() => setShowCrew(false)} />}
    </div>
  );
};

export default Tracker;
