import type * as THREE from "three";

export type Vec3 = { x: number; y: number; z: number };
export type OEMPoint = [number, number, number, number]; // [ms, x_km, y_km, z_km]
export type CamMode = "full" | "orion" | "moon" | "earth" | "flyby";

export interface OrbitControls {
  drag: boolean;
  right: boolean;
  manual: boolean;
  lx: number;
  ly: number;
  theta: number;
  phi: number;
  r: number;
  rTarget: number;
  tgt: THREE.Vector3;
  _lp?: number | null;
}

export interface SceneObjects {
  earth?: THREE.Mesh;
  clouds?: THREE.Mesh;
  cloudsHi?: THREE.Mesh;
  moon?: THREE.Mesh;
  orion?: THREE.Group;
  oGlow?: THREE.Mesh;
  cLine?: THREE.Line;
  trajLine?: THREE.Line;
  moonOrbit?: THREE.Line;
  trajPts?: THREE.Vector3[];
  sun?: THREE.Mesh;
  sunLight?: THREE.DirectionalLight;
  earthshine?: THREE.PointLight;
  moonlight?: THREE.PointLight;
  sceneRoot?: THREE.Group;
  userPin?: THREE.Group;
  corona?: THREE.Mesh;
}

export interface CrewMember {
  n: string;
  r: string;
  full: string;
  title: string;
  age: number;
  img: string;
  rank: string;
  born: string;
  flights: number;
  days: number;
  evas: number;
  bio: string;
  url: string;
}
