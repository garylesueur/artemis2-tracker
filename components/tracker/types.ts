import type * as THREE from "three";

// Re-export shared types from lib
export type { Vec3, OEMPoint, CrewMember } from "@/lib/types";

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
  moonPois?: THREE.Group;
  earthPois?: THREE.Group;
}
