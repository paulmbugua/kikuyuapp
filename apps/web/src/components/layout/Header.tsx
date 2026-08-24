import { Link, useLocation } from "@/lib/navigation";
import { Bell, MessageCircle, Search, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getMediaUrl } from "@/utils/mediaUrl";

export default function Header() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const avatarFallback = `https://ui-avatars.com/api/?background=0D9488&color=fff&name=${encodeURIComponent(user?.full_name || user?.username || "User")}&length=2`;
  const avatarUrl = getMediaUrl(user?.avatar_url, user?.avatar_key) || avatarFallback;
  const profileLabel = user?.full_name || user?.username || "Your profile";
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-2xl lg:left-[276px]">
      <div className="mx-auto flex h-[68px] w-full max-w-[1380px] items-center gap-3 px-4 lg:px-6">
        <Link to="/feed" className="flex items-center gap-2 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#071a15]"><img src="/dove-logo.png" alt="" className="h-7 w-7 object-contain" /></span><span className="font-heading text-xl font-bold">Thutha</span></Link>
        <label className="mx-auto hidden w-full max-w-md items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-2.5 text-muted-foreground shadow-sm sm:flex lg:mx-0"><Search className="h-4 w-4" /><input aria-label="Search Thutha" placeholder="Search stories, people, places…" className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" /><kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[9px] font-semibold">⌘K</kbd></label>
        <div className="ml-auto flex items-center gap-1.5">
          <Link to="/trending" className="hidden items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition hover:-translate-y-0.5 sm:flex"><Sparkles className="h-4 w-4 text-[#e55d3d]" />Find your people</Link>
          <Link to="/notifications" aria-label="Notifications" className={`relative grid h-10 w-10 place-items-center rounded-xl transition ${pathname === "/notifications" ? "bg-[#071a15] text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}><Bell className="h-[19px] w-[19px]" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#e55d3d] ring-2 ring-card" /></Link>
          <Link to="/messages" aria-label="Messages" className={`grid h-10 w-10 place-items-center rounded-xl transition ${pathname === "/messages" ? "bg-[#071a15] text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}><MessageCircle className="h-[19px] w-[19px]" /></Link>
          <Link to="/profile" className="ml-1"><img src={avatarUrl} alt={profileLabel} className="h-10 w-10 rounded-xl object-cover ring-2 ring-[#f3c969]/55" /></Link>
        </div>
      </div>
    </header>
  );
}
