import type { ReactNode } from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";
import DesktopSidebar from "./DesktopSidebar";
import RightSidebar from "./RightSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DesktopSidebar />
      <Header />
      <div className="lg:pl-[276px]">
        <div className="mx-auto flex w-full max-w-[1380px] items-start gap-6 px-0 sm:px-4 lg:px-6">
          <main className="min-h-screen min-w-0 flex-1 pb-28 pt-[76px] sm:pb-8 lg:max-w-[720px]">
            <div className="social-canvas overflow-hidden sm:rounded-[28px]">{children}</div>
          </main>
          <RightSidebar />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
