"use client";

import { useEffect, useState } from "react";
import ClientApp from "@/ClientApp";

export default function ClientOnly() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#071a15] grid place-items-center">
        <div className="h-10 w-10 rounded-full border-2 border-[#f3c969]/30 border-t-[#f3c969] animate-spin" />
      </div>
    );
  }

  return <ClientApp />;
}
