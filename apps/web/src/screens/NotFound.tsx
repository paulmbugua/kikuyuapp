import { Link, useLocation } from "@/lib/navigation";
import { useEffect } from "react";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-8">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-[#e55d3d]">Lost in the hills</p>
        <h1 className="mt-3 font-heading text-7xl font-bold">404</h1>
        <p className="mb-6 mt-2 text-muted-foreground">This story has wandered off the path.</p>
        <Link to="/feed" className="inline-flex rounded-2xl bg-[#071a15] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5">
          Return to Mũciĩ
        </Link>
      </div>
    </div>
  );
}
