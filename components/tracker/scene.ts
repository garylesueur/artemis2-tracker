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

  // Sun — shader with granulation, limb darkening, and animated surface
  const sunR = 696000 * KM2U; // ~174 units
  const sunMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;

      // Simplex-style noise for solar granulation
      vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                           -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        // View-dependent limb darkening
        float rim = dot(vNormal, vec3(0.0, 0.0, 1.0));
        float limb = pow(max(rim, 0.0), 0.4);

        // Solar granulation — multi-octave noise on the sphere surface
        vec2 sCoord = vUv * 20.0;
        float t = uTime * 0.03;
        float gran = 0.0;
        gran += snoise(sCoord * 1.0 + t * 0.5) * 0.5;
        gran += snoise(sCoord * 2.0 - t * 0.3) * 0.25;
        gran += snoise(sCoord * 4.0 + t * 0.7) * 0.125;
        gran = gran * 0.5 + 0.5; // normalize to 0-1

        // Sunspots — dark regions that drift slowly
        float spot1 = smoothstep(0.62, 0.58, snoise(sCoord * 0.5 + vec2(t * 0.1, t * 0.05)));
        float spot2 = smoothstep(0.65, 0.60, snoise(sCoord * 0.4 + vec2(-t * 0.08, t * 0.12) + 5.0));
        float spots = min(1.0, spot1 + spot2 * 0.7);

        // Color gradient — center is white-yellow, edges are deep orange-red
        vec3 coreColor = vec3(1.0, 0.98, 0.9);    // white-hot center
        vec3 midColor = vec3(1.0, 0.85, 0.4);      // golden yellow
        vec3 edgeColor = vec3(0.95, 0.4, 0.1);     // deep orange at limb
        float edgeFactor = 1.0 - limb;
        vec3 baseColor = mix(coreColor, midColor, edgeFactor * 0.6);
        baseColor = mix(baseColor, edgeColor, pow(edgeFactor, 2.5));

        // Apply granulation — bright granules with dark intergranular lanes
        vec3 color = baseColor * (0.85 + gran * 0.3);

        // Apply sunspots
        color = mix(color, vec3(0.3, 0.15, 0.05), spots * 0.6);

        // Limb darkening
        color *= (0.5 + limb * 0.5);

        // Bright plage regions near sunspots
        float plage = snoise(sCoord * 1.5 + t * 0.2 + 3.0);
        plage = smoothstep(0.3, 0.6, plage) * spots * 0.3;
        color += vec3(1.0, 0.9, 0.5) * plage;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(sunR, 48, 48),
    sunMat,
  );
  sceneRoot.add(sunMesh);
  objRef.current.sun = sunMesh;

  // Sun atmosphere — layered glow shells
  const sunGlowColors = [0xffaa33, 0xff6611, 0xff3300];
  const sunGlowScales = [1.03, 1.08, 1.15];
  const sunGlowOpacities = [0.12, 0.06, 0.03];
  sunGlowScales.forEach((s, i) => {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(sunR * s, 32, 32),
      new THREE.MeshBasicMaterial({
        color: sunGlowColors[i],
        transparent: true,
        opacity: sunGlowOpacities[i],
        side: THREE.BackSide,
      }),
    );
    sunMesh.add(glow);
  });

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
  texLoader.load("/earth-bump.jpg", (tex) => { earthMat.normalMap = tex; earthMat.normalScale = new THREE.Vector2(4, 4); earthMat.needsUpdate = true; });
  texLoader.load("/earth-lights.jpg", (tex) => { tex.colorSpace = THREE.SRGBColorSpace; earthMat.emissiveMap = tex; earthMat.emissive = new THREE.Color(0xffddaa); earthMat.emissiveIntensity = 0.3; earthMat.needsUpdate = true; });
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

  // Moon — custom shader with parallax occlusion mapping and self-shadowing
  const moonMat = new THREE.ShaderMaterial({
    uniforms: {
      uColorMap: { value: null as THREE.Texture | null },
      uHeightMap: { value: null as THREE.Texture | null },
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uHeightScale: { value: 0.014 },
      uAmbient: { value: 0.15 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying mat3 vTBN;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

        // Tangent frame in world space from geometry normal
        vec3 n = vNormal;
        vec3 t = normalize(cross(n, vec3(0.0, 1.0, 0.0)));
        if (length(cross(n, vec3(0.0, 1.0, 0.0))) < 0.01) {
          t = normalize(cross(n, vec3(1.0, 0.0, 0.0)));
        }
        vec3 b = normalize(cross(n, t));
        vTBN = mat3(t, b, n);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uColorMap;
      uniform sampler2D uHeightMap;
      uniform vec3 uLightDir;    // world-space direction TO the sun
      uniform float uHeightScale;
      uniform float uAmbient;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying mat3 vTBN;

      // World to tangent space
      vec3 toTangentSpace(vec3 dir) {
        return dir * vTBN; // transpose(TBN) * dir
      }

      // Self-shadow — trace toward light in UV space
      float selfShadow(vec2 uv, vec3 lightTS) {
        if (lightTS.z <= 0.0) return 0.0;

        const int steps = 10;
        float stepDepth = 1.0 / float(steps);
        vec2 deltaUV = lightTS.xy / lightTS.z * uHeightScale / float(steps);

        float surfaceH = 1.0 - texture2D(uHeightMap, uv).r;
        float currentDepth = surfaceH;

        for (int i = 0; i < steps; i++) {
          uv += deltaUV;
          currentDepth -= stepDepth;
          float h = 1.0 - texture2D(uHeightMap, uv).r;
          if (h > currentDepth) {
            float block = (h - currentDepth) * 10.0;
            return 1.0 - clamp(block, 0.0, 1.0);
          }
        }
        return 1.0;
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 viewTS = normalize(toTangentSpace(viewDir));
        vec3 lightTS = normalize(toTangentSpace(uLightDir));

        // Parallax occlusion — step through heightmap layers
        const int numLayers = 12;
        float layerD = 1.0 / float(numLayers);
        float depth = 0.0;
        vec2 delta = -viewTS.xy / viewTS.z * uHeightScale / float(numLayers);
        vec2 curUV = vUv;
        float curH = 1.0 - texture2D(uHeightMap, curUV).r;

        for (int i = 0; i < numLayers; i++) {
          if (depth >= curH) break;
          curUV += delta;
          curH = 1.0 - texture2D(uHeightMap, curUV).r;
          depth += layerD;
        }
        // Refine with interpolation
        vec2 prevUV = curUV - delta;
        float prevH = 1.0 - texture2D(uHeightMap, prevUV).r;
        float prevD = depth - layerD;
        float w = (curH - depth) / ((curH - depth) - (prevH - prevD));
        vec2 pUv = mix(curUV, prevUV, w);

        // Colour
        vec4 color = texture2D(uColorMap, pUv);

        // Normal from heightmap (central differences)
        float tx = 1.0 / 2048.0;
        float hL = texture2D(uHeightMap, pUv + vec2(-tx, 0.0)).r;
        float hR = texture2D(uHeightMap, pUv + vec2(tx, 0.0)).r;
        float hD = texture2D(uHeightMap, pUv + vec2(0.0, -tx)).r;
        float hU = texture2D(uHeightMap, pUv + vec2(0.0, tx)).r;
        vec3 bumpN = normalize(vec3((hL - hR) * 5.0, (hD - hU) * 5.0, 1.0));

        // Diffuse in tangent space
        float NdotL = max(dot(bumpN, lightTS), 0.0);

        // Self-shadow
        float shadow = selfShadow(pUv, lightTS);

        // Final lighting — bright on the lit side
        float diffuse = NdotL * shadow;
        float lit = uAmbient + diffuse * 1.4;
        lit = min(lit, 1.3); // allow slight overexposure for bright areas

        // Subtle blue tint in shadow (earthshine)
        vec3 tint = mix(vec3(0.7, 0.75, 0.88), vec3(1.0), smoothstep(0.0, 0.3, diffuse));

        gl_FragColor = vec4(color.rgb * lit * tint, 1.0);
      }
    `,
  });
  const moonTexLoader = new THREE.TextureLoader();
  moonTexLoader.load("/moon-color.jpg", (tex) => { tex.colorSpace = THREE.SRGBColorSpace; moonMat.uniforms.uColorMap.value = tex; moonMat.needsUpdate = true; });
  moonTexLoader.load("/moon-bump.jpg", (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; moonMat.uniforms.uHeightMap.value = tex; moonMat.needsUpdate = true; });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 64, 64), moonMat);
  sceneRoot.add(moon); objRef.current.moon = moon;

  // Solar corona — visible when Moon occults the Sun from camera's perspective
  const coronaMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uAlignment: { value: 0.0 }, // 0 = no eclipse, 1 = perfect alignment
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlignment;
      uniform float uTime;
      varying vec2 vUv;

      // Simple noise for corona streamers
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec2 c = vUv * 2.0 - 1.0;
        float r = length(c);
        float angle = atan(c.y, c.x);

        // Moon disc radius in UV space (~0.22 of the corona quad)
        float moonR = 0.22;

        // Discard inside the Moon silhouette (the Moon mesh itself renders on top)
        if (r < moonR * 0.9) discard;

        // Corona radial falloff — bright inner ring, fading outward
        float inner = smoothstep(moonR * 0.85, moonR * 1.05, r); // fade in at Moon edge
        float outer = 1.0 - smoothstep(moonR, 1.0, r);           // fade out toward edge
        float corona = inner * outer;

        // Asymmetric streamers — different lengths at different angles
        float streamer = 0.0;
        for (float i = 1.0; i <= 4.0; i++) {
          float a = angle * i + uTime * 0.02 * i;
          float n = noise(vec2(a * 2.0 + i * 10.0, r * 8.0 - uTime * 0.01));
          streamer += n * (0.5 / i);
        }
        streamer = streamer * 0.6 + 0.4;

        // Inner corona is white-hot, outer is reddish/gold
        float t = smoothstep(moonR, 0.7, r);
        vec3 innerCol = vec3(1.0, 0.98, 0.95);      // white
        vec3 midCol = vec3(1.0, 0.85, 0.5);          // gold
        vec3 outerCol = vec3(0.9, 0.4, 0.2);         // red
        vec3 col = mix(innerCol, mix(midCol, outerCol, t), t);

        // Prominence spikes — a few bright radial jets
        float spikes = 0.0;
        spikes += pow(max(0.0, cos(angle * 3.0 + 0.5)), 12.0) * 0.4;
        spikes += pow(max(0.0, cos(angle * 5.0 - 1.2)), 16.0) * 0.3;
        spikes += pow(max(0.0, cos(angle * 7.0 + 2.8)), 20.0) * 0.2;

        float brightness = corona * streamer * (1.0 + spikes);

        // Diamond ring effect right at the Moon's edge
        float diamondRing = exp(-pow((r - moonR) * 15.0, 2.0)) * 2.0;
        brightness += diamondRing;

        // Modulate by alignment — fully visible only during eclipse geometry
        float alpha = brightness * uAlignment * 1.2;
        alpha = clamp(alpha, 0.0, 1.0);

        // Boost color brightness for the diamond ring
        col = mix(col, vec3(1.0), diamondRing * 0.5);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  // Quad sized ~4.5x Moon radius so streamers extend well beyond
  const coronaGeo = new THREE.PlaneGeometry(MOON_R * 9, MOON_R * 9);
  const corona = new THREE.Mesh(coronaGeo, coronaMat);
  corona.renderOrder = -1; // render before Moon so Moon silhouette occludes it
  sceneRoot.add(corona);
  objRef.current.corona = corona;

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
