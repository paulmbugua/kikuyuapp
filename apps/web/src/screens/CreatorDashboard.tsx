import { currentUser, formatNumber, formatCurrency } from '@/data/dummy';
import { TrendingUp, Users, Heart, DollarSign, ArrowUp, BarChart3 } from 'lucide-react';
import { Link } from '@/lib/navigation';

const stats = [
  { icon: Users, label: 'Followers', value: formatNumber(currentUser.followers), change: '+12%', color: 'text-primary' },
  { icon: Heart, label: 'Engagement', value: '8.4%', change: '+3%', color: 'text-destructive' },
  { icon: TrendingUp, label: 'Impressions', value: '245K', change: '+18%', color: 'text-success' },
  { icon: DollarSign, label: 'Revenue', value: formatCurrency(currentUser.monthlyEarnings!), change: '+24%', color: 'text-warning' },
];

const revenueBreakdown = [
  { label: 'Ad Revenue', amount: 22600, pct: 50 },
  { label: 'Subscriptions', amount: 13560, pct: 30 },
  { label: 'Tips', amount: 6780, pct: 15 },
  { label: 'Paid Posts', amount: 2260, pct: 5 },
];

const CreatorDashboard = () => {
  return (
    <div className="py-4 px-4 md:px-0 space-y-4">
      <h2 className="font-heading font-bold text-xl text-foreground">📊 Creator Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="thutha-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-lg font-heading font-bold text-foreground">{stat.value}</p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUp className="w-3 h-3 text-success" />
              <span className="text-xs text-success font-medium">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Growth Chart Placeholder */}
      <div className="thutha-card p-4">
        <h3 className="font-heading font-semibold text-sm text-foreground mb-3">Followers Growth</h3>
        <div className="flex items-end gap-1 h-32">
          {[30, 45, 38, 55, 48, 62, 58, 70, 65, 78, 85, 92].map((h, i) => (
            <div key={i} className="flex-1 thutha-gradient rounded-t opacity-70 hover:opacity-100 transition-opacity cursor-pointer" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Jan</span><span>Mar</span><span>Jun</span><span>Sep</span><span>Dec</span>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="thutha-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-semibold text-sm text-foreground">Revenue Breakdown</h3>
        </div>
        <div className="space-y-3">
          {revenueBreakdown.map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">{item.label}</span>
                <span className="text-muted-foreground">{formatCurrency(item.amount)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full thutha-gradient rounded-full transition-all duration-500" style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Post */}
      <div className="thutha-card p-4">
        <h3 className="font-heading font-semibold text-sm text-foreground mb-2">🏆 Top Performing Post</h3>
        <p className="text-sm text-foreground">"Ndũgũ cia mũciĩ, tũgĩe hamwe twothe. 💙"</p>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>4.2K likes</span>
          <span>892 comments</span>
          <span>230 shares</span>
        </div>
      </div>

      <Link to="/wallet" className="block w-full thutha-gradient text-primary-foreground font-heading font-semibold py-3.5 rounded-xl text-center shadow-lg hover:opacity-90 transition-opacity">
        Withdraw Earnings
      </Link>
    </div>
  );
};

export default CreatorDashboard;
