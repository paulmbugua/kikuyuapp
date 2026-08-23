import { Link } from "@/lib/navigation";
import { ArrowUpRight, Radio, Sparkles, UserPlus } from "lucide-react";
import { formatNumber, proverbOfTheDay, suggestedCreators, trendingTopics } from "@/data/dummy";

export default function RightSidebar() {
  return (
    <aside className="no-scrollbar sticky top-[68px] hidden h-[calc(100vh-68px)] w-[340px] shrink-0 space-y-4 overflow-y-auto py-4 xl:block">
      <section className="overflow-hidden rounded-[26px] bg-[#071a15] p-5 text-white shadow-[0_18px_50px_rgba(7,26,21,.16)]">
        <div className="mb-8 flex items-center justify-between"><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-[#f3c969]">Kĩrĩkanĩro</span><Sparkles className="h-4 w-4 text-[#f3c969]" /></div>
        <blockquote className="font-heading text-[21px] font-semibold leading-snug">“{proverbOfTheDay.kikuyu}”</blockquote><p className="mt-3 text-xs leading-relaxed text-white/50">{proverbOfTheDay.english}</p><div className="mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-[#e55d3d] to-[#f3c969]" />
      </section>
      <section className="rounded-[26px] border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#e55d3d]">Community pulse</p><h2 className="mt-1 font-heading text-lg font-bold">What people are saying</h2></div><span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700"><Radio className="h-3 w-3" /> Live</span></div>
        <div className="space-y-1">{trendingTopics.slice(0, 5).map((topic, index) => (<Link key={topic.id} to="/trending" className="group flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-muted/70"><span className="grid h-8 w-8 place-items-center rounded-xl bg-muted font-heading text-sm font-bold text-muted-foreground group-hover:bg-[#071a15] group-hover:text-white">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{topic.tag}</span><span className="block text-[10px] text-muted-foreground">{formatNumber(topic.posts)} conversations · {topic.category}</span></span><ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-[#e55d3d]" /></Link>))}</div>
      </section>
      <section className="rounded-[26px] border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#e55d3d]">Fresh voices</p><h2 className="mt-1 font-heading text-lg font-bold">Mũrata suggestions</h2></div><Link to="/trending" className="text-[10px] font-bold text-muted-foreground hover:text-foreground">See all</Link></div>
        <div className="space-y-3">{suggestedCreators.slice(0, 4).map((creator) => (<div key={creator.id} className="flex items-center gap-3"><img src={creator.avatar} alt="" className="h-11 w-11 rounded-2xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{creator.username}</p><p className="text-[10px] text-muted-foreground">{formatNumber(creator.followers)} people</p></div><button aria-label={`Follow ${creator.username}`} className="grid h-9 w-9 place-items-center rounded-xl bg-[#f3c969]/25 text-[#8b5c08] transition hover:bg-[#f3c969]"><UserPlus className="h-4 w-4" /></button></div>))}</div>
      </section>
      <section className="rounded-[26px] border border-[#e55d3d]/15 bg-[#e55d3d]/8 p-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#e55d3d]">Creator opportunity</p><h3 className="mt-2 font-heading text-lg font-bold">Turn your story into a movement.</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Promote to a community that understands the context.</p><Link to="/promote" className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-[#e55d3d]">Build a campaign <ArrowUpRight className="h-3.5 w-3.5" /></Link></section>
      <p className="px-3 pb-5 text-center text-[10px] leading-relaxed text-muted-foreground/60">Thutha · Built for belonging<br />Privacy · Community guide · © 2026</p>
    </aside>
  );
}
