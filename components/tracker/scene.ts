import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { SceneObjects } from "./types";
import { OEM, EARTH_R, MOON_R, KM2U, LAUNCH_UTC } from "./data";
import { getMoonPosKm } from "./ephemeris";

export function initScene(
  canvas: HTMLCanvasElement,
  objRef: React.MutableRefObject<SceneObjects>,
  fullTrajPts: React.MutableRefObject<THREE.Vector3[]>,
): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; cleanup: () => void } {
  const ren = new THREE.WebGLRenderer({ canvas, antialias: true });
  ren.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ren.setClearColor(0x030610);

  const scn = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, 2, 0.1, 50000);

  // Root group — rotates the whole scene so the orbital plane lies flat in XZ
  // Orbital plane normal (from trajectory PCA): (-0.17, 0.52, -0.84)
  const sceneRoot = new THREE.Group();
  const orbitalNormal = new THREE.Vector3(0.1703, -0.5232, 0.8350).normalize();
  sceneRoot.quaternion.setFromUnitVectors(orbitalNormal, new THREE.Vector3(0, 1, 0));
  scn.add(sceneRoot);

  // Lighting
  sceneRoot.add(new THREE.AmbientLight(0x2a3040, 0.6));
  const sunL = new THREE.DirectionalLight(0xfff5e0, 2.0);
  sceneRoot.add(sunL);
  objRef.current.sunLight = sunL;

  // Sun — positioned correctly each frame via render loop
  const sunR = 696000 * KM2U; // ~174 units
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(sunR, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffee }),
  );
  sceneRoot.add(sunMesh);
  objRef.current.sun = sunMesh;

  // Stars — circular dot texture so they don't render as squares
  const starDot = (() => {
    const c = document.createElement("canvas"); c.width = 32; c.height = 32;
    const ctx = c.getContext("2d")!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.8)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  const makeStars = (count: number, size: number, spread: number): void => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let j = 0; j < count * 3; j++) p[j] = (Math.random() - 0.5) * spread;
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    scn.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: false, transparent: true, opacity: 0.9, map: starDot })));
  };
  makeStars(800, 1, 1800); makeStars(300, 1.5, 1800); makeStars(50, 2.5, 1800);

  // Earth — geometry rotated so north (+Y in Three.js) aligns with +Z (celestial north in EME2000)
  // No group tilt needed — EME2000 is already Earth-equatorial
  const earthGroup = new THREE.Group();
  earthGroup.position.set(0, 0, 0);

  const texLoader = new THREE.TextureLoader();
  const earthMat = new THREE.MeshPhongMaterial({ specular: 0x334455, shininess: 25 });
  texLoader.load("/earth-color.jpg", (tex) => { tex.colorSpace = THREE.SRGBColorSpace; earthMat.map = tex; earthMat.needsUpdate = true; });
  texLoader.load("/earth-bump.jpg", (tex) => { earthMat.bumpMap = tex; earthMat.bumpScale = 0.05; earthMat.needsUpdate = true; });
  const earthGeo = new THREE.SphereGeometry(EARTH_R, 64, 64);
  earthGeo.rotateX(Math.PI / 2);
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earthGroup.add(earth); objRef.current.earth = earth;

  // User location pin — positioned when geolocation is available
  const pinGroup = new THREE.Group();
  const pinHead = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 0.02, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  const pinGlow = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 0.04, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.3 }));
  pinGroup.add(pinHead, pinGlow);
  pinGroup.visible = false;
  earth.add(pinGroup);
  objRef.current.userPin = pinGroup;

  // Clouds — two layers at different altitudes for parallax
  // Low clouds — thicker, drift slowly via UV offset
  const cloudMatLo = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.35, depthWrite: false });
  texLoader.load("/earth-clouds.jpg", (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; cloudMatLo.map = tex; cloudMatLo.needsUpdate = true; });
  const cloudGeoLo = new THREE.SphereGeometry(EARTH_R * 1.005, 48, 48);
  cloudGeoLo.rotateX(Math.PI / 2);
  const cloudsLo = new THREE.Mesh(cloudGeoLo, cloudMatLo);
  earthGroup.add(cloudsLo); objRef.current.clouds = cloudsLo;

  // High clouds — thinner, drifts faster and in a different direction
  const cloudMatHi = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.18, depthWrite: false });
  texLoader.load("/earth-clouds.jpg", (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.offset.set(0.4, 0.1); cloudMatHi.map = tex; cloudMatHi.needsUpdate = true; });
  const cloudGeoHi = new THREE.SphereGeometry(EARTH_R * 1.012, 48, 48);
  cloudGeoHi.rotateX(Math.PI / 2);
  const cloudsHi = new THREE.Mesh(cloudGeoHi, cloudMatHi);
  earthGroup.add(cloudsHi); objRef.current.cloudsHi = cloudsHi;

  // Atmosphere
  ([1.05, 1.1, 1.18] as const).forEach((s, i) => earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * s, 48, 48), new THREE.MeshBasicMaterial({ color: [0x4499ff, 0x3377dd, 0x2255aa][i], transparent: true, opacity: [0.07, 0.035, 0.015][i], side: THREE.BackSide }))));
  sceneRoot.add(earthGroup);

  // Moon
  const moonTexLoader = new THREE.TextureLoader();
  const moonMat = new THREE.MeshPhongMaterial({ specular: 0x222222, shininess: 5 });
  moonTexLoader.load("/moon-color.jpg", (tex) => { moonMat.map = tex; moonMat.needsUpdate = true; });
  moonTexLoader.load("/moon-bump.jpg", (tex) => { moonMat.bumpMap = tex; moonMat.bumpScale = 0.06; moonMat.needsUpdate = true; });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 64, 64), moonMat);
  sceneRoot.add(moon); objRef.current.moon = moon;

  // Earthshine — faint blue light from Earth illuminating the Moon's dark side
  const earthshine = new THREE.PointLight(0x4466aa, 0.15, 0, 2);
  sceneRoot.add(earthshine);
  objRef.current.earthshine = earthshine;

  // Moonlight — faint silver light from the Moon illuminating Earth
  const moonlight = new THREE.PointLight(0xaabbcc, 0.08, 0, 2);
  sceneRoot.add(moonlight);
  objRef.current.moonlight = moonlight;

  // Trajectory — smooth with CatmullRom spline, clamp sub-surface points
  const rawPts = OEM.map(d => {
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
  sceneRoot.add(moonOrbit); objRef.current.moonOrbit = moonOrbit;

  // Orion spacecraft
  const orionGroup = new THREE.Group();

  // Load NASA STL model for the command module
  const stlLoader = new STLLoader();
  stlLoader.load("/orion-capsule.stl", (geometry) => {
    geometry.computeVertexNormals();
    geometry.center();
    const scale = 0.09;
    geometry.scale(scale, scale, scale);

    const capsuleMat = new THREE.MeshPhongMaterial({
      color: 0xf0f0f0, specular: 0xaaaaaa, shininess: 50,
      flatShading: false,
    });
    const capsule = new THREE.Mesh(geometry, capsuleMat);
    orionGroup.add(capsule);
  });

  // European Service Module (procedural — not in STL)
  const smMat = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, specular: 0xaaaaaa, shininess: 30 });
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.7, 24), smMat);
  sm.position.y = -0.75; orionGroup.add(sm);

  // SM adapter ring
  const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.12, 24), new THREE.MeshPhongMaterial({ color: 0xe0e0e0 }));
  adapter.position.y = -0.35; orionGroup.add(adapter);

  // Engine nozzle
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.18, 12), new THREE.MeshPhongMaterial({ color: 0x444444, specular: 0x888888, shininess: 50 }));
  nozzle.position.y = -1.2; orionGroup.add(nozzle);

  // Solar panels — 4 wings radiating outward from service module in X pattern
  const panelMat = new THREE.MeshPhongMaterial({ color: 0x2a4a9a, emissive: 0x1a2a60, emissiveIntensity: 0.4, specular: 0x88aaff, shininess: 80 });
  const panelDarkMat = new THREE.MeshPhongMaterial({ color: 0x1a3577, emissive: 0x0f1a40, emissiveIntensity: 0.3 });
  for (let i = 0; i < 4; i++) {
    const wing = new THREE.Group();
    // Panel extends outward (positive X in local space)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.01, 0.28), panelMat);
    panel.position.x = 0.8; // offset so inner edge is at origin
    wing.add(panel);
    for (let g = 0; g <= 8; g++) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.012, 0.28), panelDarkMat); gl.position.x = g * 0.18; wing.add(gl); }
    // Strut connecting SM body to panel
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 6), new THREE.MeshPhongMaterial({ color: 0x888888 }));
    strut.rotation.z = Math.PI / 2; strut.position.x = 0.07; wing.add(strut);
    // Position at SM surface — two pairs, top pair and bottom pair close together
    const angles = [
      Math.PI * 0.15,   // top-right
      Math.PI * 0.85,   // top-left
      Math.PI * 1.15,   // bottom-left
      Math.PI * 1.85,   // bottom-right
    ];
    const angle = angles[i];
    wing.position.set(Math.cos(angle) * 0.32, -0.75, Math.sin(angle) * 0.32);
    wing.rotation.y = -angle;
    orionGroup.add(wing);
  }
  sceneRoot.add(orionGroup);

  const oGlow = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.05 }));
  sceneRoot.add(oGlow);

  objRef.current.orion = orionGroup; objRef.current.oGlow = oGlow; objRef.current.sceneRoot = sceneRoot;

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
  // Mouse controls — turntable camera
  const onD = (e: MouseEvent): void => {
    ctl.current.drag = true; ctl.current.manual = true;
    ctl.current.right = e.button === 2;
    ctl.current.lx = e.clientX; ctl.current.ly = e.clientY;
  };
  const onM = (e: MouseEvent): void => {
    const c = ctl.current; if (!c.drag) return;
    const dx = e.clientX - c.lx, dy = e.clientY - c.ly;
    c.lx = e.clientX; c.ly = e.clientY;
    if (c.right) {
      // Right-drag: pan target on the screen plane
      const cam = camRef.current; if (!cam) return;
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
      const rt = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
      const up = new THREE.Vector3().crossVectors(fwd, rt).normalize();
      const sp = c.r * 0.002;
      c.tgt.add(rt.multiplyScalar(dx * sp)).add(up.multiplyScalar(dy * sp));
    } else {
      // Left-drag: horizontal = rotate around Y, vertical = tilt up/down
      c.theta -= dx * 0.005;
      c.phi -= dy * 0.005;
    }
    updCam();
  };
  const onU = (): void => { ctl.current.drag = false; };
  const onW = (e: WheelEvent): void => {
    e.preventDefault();
    const c = ctl.current;
    const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 60);
    c.rTarget = Math.max(0.3, Math.min(400, c.rTarget * (1 + delta * 0.0006)));
  };

  canvas.addEventListener("mousedown", onD);
  window.addEventListener("mousemove", onM);
  window.addEventListener("mouseup", onU);
  canvas.addEventListener("wheel", onW, { passive: false });
  canvas.addEventListener("contextmenu", (e: Event) => e.preventDefault());

  // Touch controls — 1-finger orbit, 2-finger pinch zoom
  canvas.addEventListener("touchstart", (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      ctl.current.drag = true; ctl.current.manual = true; ctl.current.right = false;
      ctl.current.lx = e.touches[0].clientX; ctl.current.ly = e.touches[0].clientY;
    }
  }, { passive: false });
  canvas.addEventListener("touchmove", (e: TouchEvent) => {
    e.preventDefault();
    const c = ctl.current;
    if (e.touches.length === 1 && c.drag) {
      c.theta -= (e.touches[0].clientX - c.lx) * 0.005;
      c.phi -= (e.touches[0].clientY - c.ly) * 0.005;
      c.lx = e.touches[0].clientX; c.ly = e.touches[0].clientY;
      updCam();
    }
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (c._lp) { c.rTarget = Math.max(0.3, Math.min(400, c.rTarget * (1 + (c._lp - d) * 0.003))); }
      c._lp = d;
    }
  }, { passive: false });
  canvas.addEventListener("touchend", () => { ctl.current.drag = false; ctl.current._lp = null; });

  return () => { window.removeEventListener("mousemove", onM); window.removeEventListener("mouseup", onU); };
}
