import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { SceneObjects } from "./types";
import type { MissionConfig, OEMPoint, POI } from "@/lib/types";
import { EARTH_R, MOON_R, KM2U } from "@/lib/constants";

export interface MissionSceneObjects {
  orion: THREE.Group;
  oGlow: THREE.Mesh;
  trajLine: THREE.Line;
  cLine: THREE.Line;
  trajPts: THREE.Vector3[];
  moonPois: THREE.Group;
  earthPois: THREE.Group;
}

// Add mission-specific objects to an existing world scene
// Returns the created objects and a cleanup function
export function addMissionToScene(
  config: MissionConfig,
  trajectory: OEMPoint[],
  objRef: React.MutableRefObject<SceneObjects>,
  fullTrajPts: React.MutableRefObject<THREE.Vector3[]>,
  moonPois: POI[], // combined world + mission moon POIs
  earthPois: POI[], // mission-specific earth POIs
): { cleanup: () => void } {
  const sceneRoot = objRef.current.sceneRoot!;
  const earth = objRef.current.earth!;

  // Earth POIs — launch site and splashdown zone
  const earthPoiGroup = new THREE.Group();
  const earthPoiMat = new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.7 });
  const ePinHeight = EARTH_R * 0.04;
  const ePinRadius = EARTH_R * 0.003;
  const eTipRadius = EARTH_R * 0.008;
  const ePinGeo = new THREE.CylinderGeometry(ePinRadius, ePinRadius, ePinHeight, 6);
  ePinGeo.translate(0, ePinHeight / 2, 0);
  const eTipGeo = new THREE.SphereGeometry(eTipRadius, 8, 8);
  eTipGeo.translate(0, ePinHeight, 0);
  const eHitGeo = new THREE.CylinderGeometry(EARTH_R * 0.02, EARTH_R * 0.02, ePinHeight * 1.2, 6);
  eHitGeo.translate(0, ePinHeight * 0.5, 0);
  for (const poi of earthPois) {
    const pin = new THREE.Group();
    pin.add(new THREE.Mesh(ePinGeo, earthPoiMat));
    pin.add(new THREE.Mesh(eTipGeo, earthPoiMat));
    pin.add(new THREE.Mesh(eHitGeo, new THREE.MeshBasicMaterial({ visible: false })));
    const latR = poi.lat * Math.PI / 180;
    const lonR = poi.lon * Math.PI / 180;
    const surfaceDir = new THREE.Vector3(
      Math.cos(latR) * Math.cos(lonR),
      Math.cos(latR) * Math.sin(lonR),
      Math.sin(latR),
    ).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    pin.quaternion.setFromUnitVectors(up, surfaceDir);
    pin.position.copy(surfaceDir.clone().multiplyScalar(EARTH_R * 1.001));
    pin.userData.poiName = poi.name;
    earthPoiGroup.add(pin);
  }
  earthPoiGroup.visible = false;
  earth.add(earthPoiGroup);
  objRef.current.earthPois = earthPoiGroup;

  // Moon POIs — small translucent pins at notable locations
  const poiGroup = new THREE.Group();
  const poiMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.7 });
  const pinHeight = MOON_R * 0.06;
  const pinRadius = MOON_R * 0.004;
  const tipRadius = MOON_R * 0.01;
  const pinGeo = new THREE.CylinderGeometry(pinRadius, pinRadius, pinHeight, 6);
  pinGeo.translate(0, pinHeight / 2, 0);
  const tipGeo = new THREE.SphereGeometry(tipRadius, 8, 8);
  tipGeo.translate(0, pinHeight, 0);
  const hitGeo = new THREE.CylinderGeometry(MOON_R * 0.025, MOON_R * 0.025, pinHeight * 1.2, 6);
  hitGeo.translate(0, pinHeight * 0.5, 0);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const poi of moonPois) {
    const pin = new THREE.Group();
    pin.add(new THREE.Mesh(pinGeo, poiMat));
    pin.add(new THREE.Mesh(tipGeo, poiMat));
    pin.add(new THREE.Mesh(hitGeo, hitMat));
    const latR = poi.lat * Math.PI / 180;
    const lonR = poi.lon * Math.PI / 180;
    const r = MOON_R * 1.002;
    const surfaceDir = new THREE.Vector3(
      Math.cos(latR) * Math.cos(lonR),
      Math.sin(latR),
      -Math.cos(latR) * Math.sin(lonR),
    ).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    pin.quaternion.setFromUnitVectors(up, surfaceDir);
    pin.userData.poiName = poi.name;
    pin.userData.localOffset = surfaceDir.clone().multiplyScalar(r);
    pin.userData.localQuat = pin.quaternion.clone();
    poiGroup.add(pin);
  }
  sceneRoot.add(poiGroup);
  poiGroup.visible = false;
  objRef.current.moonPois = poiGroup;

  // Trajectory — smooth with CatmullRom spline, clamp sub-surface points
  const rawPts = trajectory.map(d => {
    const v = new THREE.Vector3(d[1] * KM2U, d[2] * KM2U, d[3] * KM2U);
    const r = v.length();
    if (r > 0 && r < EARTH_R) v.multiplyScalar(EARTH_R / r);
    return v;
  });
  const spline = new THREE.CatmullRomCurve3(rawPts);
  const tPts = spline.getPoints(rawPts.length * 4).map(v => {
    const r = v.length();
    if (r > 0 && r < EARTH_R) v.multiplyScalar(EARTH_R / r);
    return v;
  });
  fullTrajPts.current = tPts;
  const trajLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(tPts), new THREE.LineBasicMaterial({ color: 0x4488bb, transparent: true, opacity: 0.3 }));
  sceneRoot.add(trajLine); objRef.current.trajLine = trajLine;

  const cLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(tPts.slice(0, 2)), new THREE.LineBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.8 }));
  sceneRoot.add(cLine); objRef.current.cLine = cLine;
  objRef.current.trajPts = tPts;

  // Orion spacecraft
  const orionGroup = new THREE.Group();

  // Load STL model for the command module
  const stlLoader = new STLLoader();
  stlLoader.load(config.spacecraft.modelUrl, (geometry) => {
    geometry.computeVertexNormals();
    geometry.center();
    const scale = config.spacecraft.modelScale;
    geometry.scale(scale, scale, scale);

    const capsuleMat = new THREE.MeshPhongMaterial({
      color: 0xf0f0f0, specular: 0xaaaaaa, shininess: 50,
      flatShading: false,
    });
    const capsule = new THREE.Mesh(geometry, capsuleMat);
    orionGroup.add(capsule);
  });

  // European Service Module (procedural)
  const smMat = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, specular: 0xaaaaaa, shininess: 30 });
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.7, 24), smMat);
  sm.position.y = -0.75; orionGroup.add(sm);

  const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.12, 24), new THREE.MeshPhongMaterial({ color: 0xe0e0e0 }));
  adapter.position.y = -0.35; orionGroup.add(adapter);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.18, 12), new THREE.MeshPhongMaterial({ color: 0x444444, specular: 0x888888, shininess: 50 }));
  nozzle.position.y = -1.2; orionGroup.add(nozzle);

  // Solar panels
  const panelMat = new THREE.MeshPhongMaterial({ color: 0x2a4a9a, emissive: 0x1a2a60, emissiveIntensity: 0.4, specular: 0x88aaff, shininess: 80 });
  const panelDarkMat = new THREE.MeshPhongMaterial({ color: 0x1a3577, emissive: 0x0f1a40, emissiveIntensity: 0.3 });
  for (let i = 0; i < 4; i++) {
    const wing = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.01, 0.28), panelMat);
    panel.position.x = 0.8;
    wing.add(panel);
    for (let g = 0; g <= 8; g++) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.012, 0.28), panelDarkMat); gl.position.x = g * 0.18; wing.add(gl); }
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 6), new THREE.MeshPhongMaterial({ color: 0x888888 }));
    strut.rotation.z = Math.PI / 2; strut.position.x = 0.07; wing.add(strut);
    const angles = [Math.PI * 0.15, Math.PI * 0.85, Math.PI * 1.15, Math.PI * 1.85];
    const angle = angles[i];
    wing.position.set(Math.cos(angle) * 0.32, -0.75, Math.sin(angle) * 0.32);
    wing.rotation.y = -angle;
    orionGroup.add(wing);
  }
  sceneRoot.add(orionGroup);

  const oGlow = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.05 }));
  sceneRoot.add(oGlow);

  objRef.current.orion = orionGroup;
  objRef.current.oGlow = oGlow;

  // Cleanup function — removes all mission-specific objects from the scene
  const cleanup = () => {
    sceneRoot.remove(orionGroup);
    sceneRoot.remove(oGlow);
    sceneRoot.remove(trajLine);
    sceneRoot.remove(cLine);
    sceneRoot.remove(poiGroup);
    earth.remove(earthPoiGroup);
    objRef.current.orion = undefined;
    objRef.current.oGlow = undefined;
    objRef.current.trajLine = undefined;
    objRef.current.cLine = undefined;
    objRef.current.trajPts = undefined;
    objRef.current.moonPois = undefined;
    objRef.current.earthPois = undefined;
    fullTrajPts.current = [];
  };

  return { cleanup };
}
