import * as THREE from "three";
import type { SceneObjects } from "./types";
import { OEM, EARTH_R, MOON_R, KM2U, LAUNCH_UTC } from "./data";
import { getMoonPosKm } from "./ephemeris";
import { makeEarthTex } from "./textures";

export function initScene(
  canvas: HTMLCanvasElement,
  objRef: React.MutableRefObject<SceneObjects>,
  fullTrajPts: React.MutableRefObject<THREE.Vector3[]>,
): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; cleanup: () => void } {
  const ren = new THREE.WebGLRenderer({ canvas, antialias: true });
  ren.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ren.setClearColor(0x030610);

  const scn = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, 2, 0.01, 5000);

  // Lighting
  const sunPos = new THREE.Vector3(-250, 80, 40);
  scn.add(new THREE.AmbientLight(0x2a3040, 0.6));
  const sunL = new THREE.DirectionalLight(0xfff5e0, 2.0); sunL.position.copy(sunPos); scn.add(sunL);

  // Sun body + corona
  const sunM = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffee }));
  sunM.position.copy(sunPos); scn.add(sunM);
  ([14, 22, 38, 60] as const).forEach((r, i) => {
    const g = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), new THREE.MeshBasicMaterial({ color: [0xffffcc, 0xffdd88, 0xffaa44, 0xff7722][i], transparent: true, opacity: [0.12, 0.05, 0.02, 0.008][i], side: THREE.BackSide }));
    g.position.copy(sunPos); scn.add(g);
  });

  // Lens flare
  const mkFlare = (sz: number, col: string, op: number): void => {
    const c2 = document.createElement("canvas"); c2.width = 128; c2.height = 128;
    const ctx = c2.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, col); g.addColorStop(0.5, col.replace(",1)", ",0.2)")); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c2), transparent: true, opacity: op, depthTest: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(sunPos); sp.scale.set(sz, sz, 1); scn.add(sp);
  };
  mkFlare(40, "rgba(255,255,200,1)", 0.4);
  mkFlare(80, "rgba(255,200,100,1)", 0.1);

  // Stars
  const makeStars = (count: number, size: number, spread: number): void => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let j = 0; j < count * 3; j++) p[j] = (Math.random() - 0.5) * spread;
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    scn.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: true, transparent: true, opacity: 0.9 })));
  };
  makeStars(800, 0.3, 1800); makeStars(300, 0.7, 1800); makeStars(50, 1.2, 1800);

  // Earth — wrapped in group for axial tilt (23.4°)
  const earthGroup = new THREE.Group();
  earthGroup.rotation.z = 23.44 * Math.PI / 180;

  const eTex = makeEarthTex(); eTex.wrapS = THREE.RepeatWrapping;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 64, 64), new THREE.MeshPhongMaterial({ map: eTex, specular: 0x334455, shininess: 20 }));
  earthGroup.add(earth); objRef.current.earth = earth;

  // Clouds
  const cC = document.createElement("canvas"); cC.width = 1024; cC.height = 512;
  const cCtx = cC.getContext("2d")!; cCtx.clearRect(0, 0, 1024, 512);
  for (let i = 0; i < 30; i++) { cCtx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.1})`; cCtx.beginPath(); cCtx.ellipse(Math.random() * 1024, Math.random() * 512, 25 + Math.random() * 70, 8 + Math.random() * 18, Math.random() * Math.PI, 0, Math.PI * 2); cCtx.fill(); }
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.012, 48, 48), new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(cC), transparent: true, opacity: 0.55, depthWrite: false }));
  earthGroup.add(clouds); objRef.current.clouds = clouds;

  // Atmosphere
  ([1.05, 1.1, 1.18] as const).forEach((s, i) => earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * s, 48, 48), new THREE.MeshBasicMaterial({ color: [0x4499ff, 0x3377dd, 0x2255aa][i], transparent: true, opacity: [0.07, 0.035, 0.015][i], side: THREE.BackSide }))));
  scn.add(earthGroup);

  // Moon
  const moonTexLoader = new THREE.TextureLoader();
  const moonMat = new THREE.MeshPhongMaterial({ specular: 0x222222, shininess: 5, emissive: 0x111518, emissiveIntensity: 0.35 });
  moonTexLoader.load("/moon-color.jpg", (tex) => { moonMat.map = tex; moonMat.needsUpdate = true; });
  moonTexLoader.load("/moon-bump.jpg", (tex) => { moonMat.bumpMap = tex; moonMat.bumpScale = 0.015; moonMat.needsUpdate = true; });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 64, 64), moonMat);
  scn.add(moon); objRef.current.moon = moon;

  // Trajectory
  const tPts = OEM.map(d => new THREE.Vector3(d[1] * KM2U, d[2] * KM2U, d[3] * KM2U));
  fullTrajPts.current = tPts;
  const trajLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(tPts), new THREE.LineBasicMaterial({ color: 0x4488bb, transparent: true, opacity: 0.3 }));
  scn.add(trajLine); objRef.current.trajLine = trajLine;

  const cLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(tPts.slice(0, 2)), new THREE.LineBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.8 }));
  scn.add(cLine); objRef.current.cLine = cLine;
  objRef.current.trajPts = tPts;

  // Moon orbit line
  const moonOrbitPts: THREE.Vector3[] = [];
  const orbitStart = LAUNCH_UTC;
  const orbitPeriod = 27.3 * 86400000;
  for (let i = 0; i <= 128; i++) {
    const t = orbitStart + (i / 128) * orbitPeriod;
    const mp = getMoonPosKm(t);
    moonOrbitPts.push(new THREE.Vector3(mp.x * KM2U, mp.y * KM2U, mp.z * KM2U));
  }
  const moonOrbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(moonOrbitPts), new THREE.LineDashedMaterial({ color: 0x6688aa, transparent: true, opacity: 0.5, dashSize: 2, gapSize: 1 }));
  moonOrbit.computeLineDistances();
  scn.add(moonOrbit); objRef.current.moonOrbit = moonOrbit;

  // Orion spacecraft
  const orionGroup = new THREE.Group();
  const cmGeo = new THREE.ConeGeometry(0.28, 0.5, 12);
  const cmMat = new THREE.MeshPhongMaterial({ color: 0xd4d0c8, specular: 0x444444, shininess: 30 });
  const cm = new THREE.Mesh(cmGeo, cmMat); cm.rotation.x = Math.PI; cm.position.y = 0.15; orionGroup.add(cm);

  const shieldGeo = new THREE.CircleGeometry(0.28, 16);
  const shield = new THREE.Mesh(shieldGeo, new THREE.MeshPhongMaterial({ color: 0x2a2520, side: THREE.DoubleSide }));
  shield.rotation.x = Math.PI / 2; shield.position.y = 0.4; orionGroup.add(shield);

  const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 16), new THREE.MeshPhongMaterial({ color: 0x8a8475, specular: 0x333333, shininess: 15 }));
  sm.position.y = -0.2; orionGroup.add(sm);

  const bandGeo = new THREE.CylinderGeometry(0.265, 0.265, 0.08, 16);
  const bandMat = new THREE.MeshPhongMaterial({ color: 0x555045 });
  const b1 = new THREE.Mesh(bandGeo, bandMat); b1.position.y = -0.05; orionGroup.add(b1);
  const b2 = new THREE.Mesh(bandGeo.clone(), bandMat); b2.position.y = -0.35; orionGroup.add(b2);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.15, 12), new THREE.MeshPhongMaterial({ color: 0x444444, specular: 0x666666, shininess: 40 }));
  nozzle.position.y = -0.58; orionGroup.add(nozzle);

  const panelMat = new THREE.MeshPhongMaterial({ color: 0x1a3a7a, emissive: 0x0a1530, specular: 0x4466aa, shininess: 60 });
  const panelDarkMat = new THREE.MeshPhongMaterial({ color: 0x0f2255, emissive: 0x050a18 });
  for (let i = 0; i < 4; i++) {
    const wing = new THREE.Group();
    wing.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.01, 0.22), panelMat));
    for (let g = -3; g <= 3; g++) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.012, 0.22), panelDarkMat); gl.position.x = g * 0.18; wing.add(gl); }
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6), new THREE.MeshPhongMaterial({ color: 0x666666 }));
    strut.rotation.z = Math.PI / 2; strut.position.x = -0.62; wing.add(strut);
    wing.position.y = -0.2;
    wing.rotation.y = (i * Math.PI) / 2;
    wing.position.x = Math.cos(i * Math.PI / 2) * 0.95;
    wing.position.z = Math.sin(i * Math.PI / 2) * 0.95;
    orionGroup.add(wing);
  }
  scn.add(orionGroup);

  const oGlow = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.1 }));
  scn.add(oGlow);

  objRef.current.orion = orionGroup; objRef.current.oGlow = oGlow;

  // Labels
  const mkLbl = (text: string, pos: THREE.Vector3, color: string, sz = 14): THREE.Sprite => {
    const c2 = document.createElement("canvas"); c2.width = 256; c2.height = 64;
    const ctx = c2.getContext("2d")!;
    ctx.font = `bold ${sz * 2}px monospace`; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(text, 128, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c2), transparent: true, depthTest: false }));
    sp.position.copy(pos); sp.scale.set(sz * 0.9, sz * 0.22, 1); scn.add(sp); return sp;
  };
  objRef.current.earthLbl = mkLbl("EARTH", new THREE.Vector3(0, -EARTH_R - 2, 0), "#4499dd", 14);
  objRef.current.moonLbl = mkLbl("MOON", new THREE.Vector3(0, -MOON_R - 1.5, 0), "#999", 11);
  objRef.current.oLbl = mkLbl("ORION", new THREE.Vector3(0, 3, 0), "#ffcc22", 10);

  // Resize
  const resize = (): void => { const p = canvas.parentElement; if (!p) return; ren.setSize(p.clientWidth, p.clientHeight); cam.aspect = p.clientWidth / p.clientHeight; cam.updateProjectionMatrix(); };
  resize(); window.addEventListener("resize", resize);

  const cleanup = () => { window.removeEventListener("resize", resize); ren.dispose(); };

  return { renderer: ren, scene: scn, camera: cam, cleanup };
}

export function setupControls(
  canvas: HTMLCanvasElement,
  ctl: React.MutableRefObject<import("./types").OrbitControls>,
  camRef: React.MutableRefObject<THREE.PerspectiveCamera | null>,
  updCam: () => void,
): () => void {
  const onD = (e: MouseEvent): void => { ctl.current.drag = true; ctl.current.manual = true; ctl.current.right = e.button === 2; ctl.current.lx = e.clientX; ctl.current.ly = e.clientY; };
  const onM = (e: MouseEvent): void => {
    const c = ctl.current; if (!c.drag) return;
    const dx = e.clientX - c.lx, dy = e.clientY - c.ly; c.lx = e.clientX; c.ly = e.clientY;
    if (c.right) {
      const cam = camRef.current; if (!cam) return;
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
      const rt = new THREE.Vector3().crossVectors(cam.up, fwd).normalize();
      const up = new THREE.Vector3().crossVectors(fwd, rt).normalize();
      const sp = c.r * 0.002;
      c.tgt.add(rt.multiplyScalar(dx * sp)).add(up.multiplyScalar(dy * sp));
    } else { c.theta -= dx * 0.005; c.phi -= dy * 0.005; }
    updCam();
  };
  const onU = (): void => { ctl.current.drag = false; };
  const onW = (e: WheelEvent): void => {
    e.preventDefault();
    const c = ctl.current;
    const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 60);
    c.rTarget = Math.max(1.5, Math.min(400, c.rTarget * (1 + delta * 0.0006)));
  };

  canvas.addEventListener("mousedown", onD);
  window.addEventListener("mousemove", onM);
  window.addEventListener("mouseup", onU);
  canvas.addEventListener("wheel", onW, { passive: false });
  canvas.addEventListener("contextmenu", (e: Event) => e.preventDefault());

  canvas.addEventListener("touchstart", (e: TouchEvent) => { e.preventDefault(); if (e.touches.length === 1) { ctl.current.drag = true; ctl.current.manual = true; ctl.current.right = false; ctl.current.lx = e.touches[0].clientX; ctl.current.ly = e.touches[0].clientY; } }, { passive: false });
  canvas.addEventListener("touchmove", (e: TouchEvent) => {
    e.preventDefault();
    const c = ctl.current;
    if (e.touches.length === 1 && c.drag) { c.theta -= (e.touches[0].clientX - c.lx) * 0.005; c.phi -= (e.touches[0].clientY - c.ly) * 0.005; c.lx = e.touches[0].clientX; c.ly = e.touches[0].clientY; updCam(); }
    if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (c._lp) { c.rTarget = Math.max(1.5, Math.min(400, c.rTarget * (1 + (c._lp - d) * 0.003))); } c._lp = d; }
  }, { passive: false });
  canvas.addEventListener("touchend", () => { ctl.current.drag = false; ctl.current._lp = null; });

  return () => { window.removeEventListener("mousemove", onM); window.removeEventListener("mouseup", onU); };
}
