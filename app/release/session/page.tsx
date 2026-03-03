"use client";

import dynamic from "next/dynamic";

const SessionPage = dynamic(() => import("./session-client"), { ssr: false });

export default function Page() {
  return <SessionPage />;
}
