import { NavLink, useLocation, useNavigate } from "@/lib/navigation";
import { Bell, Clapperboard, Compass, Home, LayoutDashboard, LogOut, MessageCircle, Plus, Settings, UserRound, Wallet } from "lucide-react";

const navItems = [
  { path: "/feed", icon: Home, label: "Mũciĩ", helper: "Your circle" },
  { path: "/trending", icon: Compass, label: "Discover", helper: "What is moving" },
  { path: "/reels", icon: Clapperboard, label: "Magerio", helper: "Watch & listen" },
  { path: "/messages", icon: MessageCircle, label: "Ũhoro", helper: "Conversations" },
  { path: "/notifications", icon: Bell, label: "Signals", helper: "Stay in the loop" },
  { path: "/wallet", icon: Wallet, label: "Kĩgĩna", helper: "Creator wallet" },
  { path: "/dashboard", icon: LayoutDashboard, label: "Studio", helper: "Your impact" },
];

export default function DesktopSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[276px] flex-col border-r border-white/8 bg-[#071a15] text-white lg:flex">
      <div className="px-6 pb-4 pt-6">
        <NavLink to="/feed" className="group flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f3c969] shadow-[0_12px_30px_rgba(243,201,105,.18)] transition-transform group-hover:-rotate-3">
            <img src="/dove-logo.png" alt="" className="h-8 w-8 object-contain mix-blend-multiply" />
          </span>
          <span><span className="block font-heading text-2xl font-bold leading-none tracking-tight">Thutha</span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.24em] text-[#f3c969]/75">Tũgĩe hamwe</span></span>
        </NavLink>
      </div>
      <div className="mx-5 mb-3 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navItems.map(({ path, icon: Icon, label, helper }) => {
          const active = pathname === path || pathname.startsWith(`${path}/`);
          return (
            <NavLink key={path} to={path} className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200 ${active ? "bg-white text-[#071a15] shadow-xl" : "text-white/65 hover:bg-white/7 hover:text-white"}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${active ? "bg-[#e55d3d] text-white" : "bg-white/6 group-hover:bg-white/10"}`}><Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.4 : 1.8} /></span>
              <span className="min-w-0"><span className="block text-sm font-bold leading-tight">{label}</span><span className={`block truncate text-[10px] ${active ? "text-[#071a15]/55" : "text-white/35"}`}>{helper}</span></span>
              {active && <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[#e55d3d]" />}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4">
        <button onClick={() => navigate("/create")} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e55d3d] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(229,93,61,.25)] transition hover:-translate-y-0.5 hover:bg-[#f06a49]"><Plus className="h-5 w-5" />Share a story</button>
        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 p-2">
          <NavLink to="/profile" className="flex min-w-0 items-center gap-2"><img src="https://i.pravatar.cc/96?img=47" alt="" className="h-9 w-9 rounded-xl object-cover" /><span className="min-w-0"><span className="block truncate text-xs font-bold">Wanjikũ</span><span className="block truncate text-[10px] text-white/40">@mũrata</span></span></NavLink>
          <button onClick={() => navigate("/login")} aria-label="Log out" className="rounded-xl p-2 text-white/35 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></button>
        </div>
        <div className="mt-2 flex justify-center gap-1 text-white/25"><NavLink to="/settings" aria-label="Settings" className="p-2 hover:text-white"><Settings className="h-4 w-4" /></NavLink><NavLink to="/profile" aria-label="Profile" className="p-2 hover:text-white"><UserRound className="h-4 w-4" /></NavLink></div>
      </div>
    </aside>
  );
}
