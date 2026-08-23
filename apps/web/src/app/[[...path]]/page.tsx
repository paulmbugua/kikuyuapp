import { Suspense } from "react";
import ClientOnly from "@/components/ClientOnly";

export default function ApplicationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ClientOnly />
    </Suspense>
  );
}
