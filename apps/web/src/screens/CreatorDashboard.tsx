import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Users, Heart, DollarSign, BarChart3 } from 'lucide-react';
import { Link } from '@/lib/navigation';
import axiosInstance from '@/utils/axiosConfig';
import { useUserStore } from '@/stores/userStore';
import { formatCurrency, formatNumber } from '@/utils/format';

type Post = { id: string; content?: string; likes_count: number; comments_count: number; shares_count?: number; views_count?: number };

const CreatorDashboard = () => {
  const { user } = useUserStore();
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    void axiosInstance.get(`/posts/user/${user.id}?limit=50`).then(({ data }) => {
      setPosts(Array.isArray(data.data) ? data.data : data.data?.posts || []);
    }).catch(() => setPosts([]));
  }, [user?.id]);

  const totals = useMemo(() => posts.reduce((summary, post) => ({
    likes: summary.likes + Number(post.likes_count || 0),
    comments: summary.comments + Number(post.comments_count || 0),
    views: summary.views + Number(post.views_count || 0)
  }), { likes: 0, comments: 0, views: 0 }), [posts]);

  const topPost = useMemo(() => [...posts].sort((a, b) =>
    (Number(b.likes_count) + Number(b.comments_count) * 2) - (Number(a.likes_count) + Number(a.comments_count) * 2)
  )[0], [posts]);

  const engagement = totals.views > 0 ? ((totals.likes + totals.comments) / totals.views) * 100 : 0;
  const stats = [
    { icon: Users, label: 'Followers', value: formatNumber(user?.followers_count), color: 'text-primary' },
    { icon: Heart, label: 'Engagement', value: `${engagement.toFixed(1)}%`, color: 'text-destructive' },
    { icon: TrendingUp, label: 'Impressions', value: formatNumber(totals.views), color: 'text-success' },
    { icon: DollarSign, label: 'Lifetime earnings', value: formatCurrency((user as any)?.total_earned || 0), color: 'text-warning' }
  ];

  return (
    <div className="space-y-4 px-4 py-4 md:px-0">
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Creator studio</p><h2 className="font-heading text-xl font-bold">Your real community performance</h2></div>
      <div className="grid grid-cols-2 gap-3">{stats.map((stat) => <div key={stat.label} className="thutha-card p-4"><div className="mb-2 flex items-center gap-2"><stat.icon className={`h-4 w-4 ${stat.color}`} /><span className="text-xs text-muted-foreground">{stat.label}</span></div><p className="font-heading text-lg font-bold">{stat.value}</p></div>)}</div>

      <div className="thutha-card p-4"><div className="mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><h3 className="font-heading text-sm font-semibold">Published content</h3></div><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-muted p-3"><p className="text-lg font-bold">{formatNumber(posts.length)}</p><p className="text-[10px] text-muted-foreground">Posts</p></div><div className="rounded-xl bg-muted p-3"><p className="text-lg font-bold">{formatNumber(totals.likes)}</p><p className="text-[10px] text-muted-foreground">Likes</p></div><div className="rounded-xl bg-muted p-3"><p className="text-lg font-bold">{formatNumber(totals.comments)}</p><p className="text-[10px] text-muted-foreground">Comments</p></div></div></div>

      <div className="thutha-card p-4"><h3 className="mb-2 font-heading text-sm font-semibold">Top performing post</h3>{topPost ? <><p className="text-sm">{topPost.content || 'Media post'}</p><div className="mt-2 flex gap-4 text-xs text-muted-foreground"><span>{formatNumber(topPost.likes_count)} likes</span><span>{formatNumber(topPost.comments_count)} comments</span><span>{formatNumber(topPost.shares_count)} shares</span></div></> : <p className="text-sm text-muted-foreground">Publish your first post to unlock performance insights.</p>}</div>

      <Link to="/wallet" className="block w-full rounded-xl thutha-gradient py-3.5 text-center font-heading font-semibold text-primary-foreground shadow-lg">Manage earnings</Link>
    </div>
  );
};

export default CreatorDashboard;
