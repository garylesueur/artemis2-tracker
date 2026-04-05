"use client";

import dynamic from "next/dynamic";

const ArtemisTracker3D = dynamic(
  () => import("../components/artemis2-tracker"),
  { ssr: false }
);

export default function Home() {
  return <ArtemisTracker3D />;
}
