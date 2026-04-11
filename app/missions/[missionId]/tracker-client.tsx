"use client";

import dynamic from "next/dynamic";

const Tracker = dynamic(() => import("@/components/tracker/tracker"), {
  ssr: false,
});

export default function TrackerClient({ missionId }: { missionId: string }) {
  return <Tracker missionId={missionId} />;
}
