import { User, Post, Transaction, TrendingTopic } from '@/types';

export const currentUser: User = {
  id: '1',
  username: 'Wanjiku_Mumbi',
  handle: '@wanjiku_mumbi',
  avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
  bio: 'Mũrũthi wa ciugo | Content Creator | Voice of Agĩkũyũ 💙🕊',
  followers: 24300,
  following: 1200,
  verified: true,
  monthlyEarnings: 45200,
  isCreator: true,
};

export const users: User[] = [
  currentUser,
  {
    id: '2',
    username: 'MainaWaMurang\'a',
    handle: '@maina_muranga',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
    bio: 'Mũhiki wa Mũranga | Stories & Culture',
    followers: 8400,
    following: 650,
    verified: false,
    isCreator: true,
  },
  {
    id: '3',
    username: 'Kamau_254',
    handle: '@kamau_254',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    bio: 'Tech & Culture 🇰🇪',
    followers: 1200,
    following: 340,
    verified: false,
    isCreator: false,
  },
  {
    id: '4',
    username: 'NyambuiKenya',
    handle: '@nyambui_ke',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    bio: 'Traditional cooking & lifestyle 🍳',
    followers: 15600,
    following: 890,
    verified: true,
    isCreator: true,
    monthlyEarnings: 28500,
  },
  {
    id: '5',
    username: 'WaithĩraGĩthũngũrĩ',
    handle: '@waithira_g',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    bio: 'Fashion & Beauty | Agĩkũyũ trends 💅',
    followers: 32100,
    following: 420,
    verified: true,
    isCreator: true,
    monthlyEarnings: 67000,
  },
  {
    id: '6',
    username: 'NjũgũnaThePoet',
    handle: '@njuguna_poet',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    bio: 'Spoken word | Gĩkũyũ poetry 🎤',
    followers: 5600,
    following: 780,
    verified: false,
    isCreator: true,
  },
];

export const posts: Post[] = [
  {
    id: '1',
    user: currentUser,
    content: 'Ndũgũ cia mũciĩ, tũgĩe hamwe twothe. 💙 #Thutha #Agĩkũyũ #Unity',
    likes: 4200,
    comments: 892,
    shares: 230,
    views: 18400,
    timeAgo: '2h',
    pinned: true,
    liked: false,
    bookmarked: false,
  },
  {
    id: '2',
    user: users[1],
    content: 'Mũthenya mwega kũrĩ inyuĩ othe! Nĩ ũndũ wa gũtũũra na mwĩhoko tũkanarega gũkura. 🌱 #MurangaLife #Growth',
    images: [
      'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1523365280197-f1783db9fe62?w=600&h=400&fit=crop',
    ],
    likes: 1850,
    comments: 342,
    shares: 89,
    views: 9200,
    timeAgo: '4h',
  },
  {
    id: '3',
    user: users[3],
    content: 'Nĩ ngũmĩra na gĩkeno! Tũraĩka irio cia gĩthũũngũ rĩũ. Watch this traditional dance from our cultural festival! 🎵🥁 #KikuyuCulture',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    likes: 6700,
    comments: 1204,
    shares: 567,
    views: 34500,
    timeAgo: '6h',
    liked: true,
  },
  {
    id: '4',
    user: users[2],
    content: 'Nĩ kĩĩ kĩrĩa kĩngĩhoota gũtũma Agĩkũyũ mathiĩ na mbere? 🤔',
    poll: {
      question: 'Nĩ kĩĩ kĩrĩa gĩkĩrĩte bata?',
      options: [
        { text: 'Ũhoro wa technology', votes: 45 },
        { text: 'Mĩtũũrĩre ya gĩthũũngũ', votes: 32 },
        { text: 'Ũrĩmĩ wa shamba', votes: 18 },
        { text: 'Biashara', votes: 67 },
      ],
    },
    likes: 890,
    comments: 234,
    shares: 56,
    views: 5600,
    timeAgo: '8h',
  },
  {
    id: '5',
    user: { ...currentUser, id: 'sponsor' },
    content: 'Promote your biashara to 1M+ Agĩkũyũ users on Thutha. Start today and reach your audience! 📈💙',
    images: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=300&fit=crop'],
    likes: 320,
    comments: 45,
    shares: 120,
    views: 42000,
    timeAgo: 'Sponsored',
    sponsored: true,
  },
  {
    id: '6',
    user: users[3],
    content: 'Recipe ya mũthokoi wa nyama! Ĩno nĩ njĩra ya tene ya kũhĩka. Andũ aingĩ maratũũra njĩra ĩno. Nĩ njĩra ĩrĩa ĩngĩ ya gũtũma irio ciaku cĩũmĩre wega. 🍲 #KikuyuFood #TraditionalCooking',
    images: ['https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=400&fit=crop'],
    likes: 3400,
    comments: 567,
    shares: 234,
    views: 21000,
    timeAgo: '12h',
  },
  {
    id: '7',
    user: users[4],
    content: 'New collection dropping this Friday! 🔥 Agĩkũyũ-inspired fashion meets modern streetwear. Stay tuned! #Fashion #AgikuyuStyle',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=400&fit=crop',
    ],
    likes: 8900,
    comments: 1560,
    shares: 890,
    views: 56000,
    timeAgo: '1d',
    liked: false,
  },
  {
    id: '8',
    user: users[5],
    content: 'Gĩthũũngũ kĩrĩ andũ aingĩ makĩrĩĩria. Tũtingĩtigana na ciugo ciĩtũ cia tene. 🎤✨ #SpokenWord #GikuyuPoetry',
    likes: 2100,
    comments: 389,
    shares: 145,
    views: 11200,
    timeAgo: '1d',
  },
  {
    id: '9',
    user: users[1],
    content: 'Morning hikes in the Aberdares never disappoint. Nature heals everything. 🌄🌿 #Outdoors #Kenya',
    images: ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&h=400&fit=crop'],
    likes: 4500,
    comments: 678,
    shares: 312,
    views: 28000,
    timeAgo: '2d',
    liked: true,
  },
];

export const transactions: Transaction[] = [
  { id: '1', date: '2026-02-24', type: 'Ad Revenue', status: 'Completed', amount: 5200 },
  { id: '2', date: '2026-02-23', type: 'Tips', status: 'Completed', amount: 1500 },
  { id: '3', date: '2026-02-22', type: 'Subscription', status: 'Completed', amount: 3800 },
  { id: '4', date: '2026-02-21', type: 'Withdrawal', status: 'Pending', amount: -8000 },
  { id: '5', date: '2026-02-20', type: 'Ad Revenue', status: 'Completed', amount: 4700 },
  { id: '6', date: '2026-02-19', type: 'Tips', status: 'Completed', amount: 800 },
  { id: '7', date: '2026-02-18', type: 'Subscription', status: 'Failed', amount: 200 },
];

export const trendingTopics: TrendingTopic[] = [
  { id: '1', tag: '#Agĩkũyũ', posts: 12400, category: 'Culture' },
  { id: '2', tag: '#MũciĩWakwa', posts: 8900, category: 'Lifestyle' },
  { id: '3', tag: '#KikuyuProverbs', posts: 6700, category: 'Education' },
  { id: '4', tag: '#NyeriCounty', posts: 5200, category: 'Location' },
  { id: '5', tag: '#BiasharaYetu', posts: 4800, category: 'Business' },
  { id: '6', tag: '#ThuthaCreators', posts: 3200, category: 'Platform' },
];

export const suggestedCreators = users.filter(u => u.id !== '1');

export const proverbOfTheDay = {
  kikuyu: 'Gũtirĩ ũtukũ ũtakĩa.',
  english: 'No night lasts forever.',
};

export const voiceSpaces = [
  {
    id: '1',
    title: 'Mũthenya wa Agĩkũyũ: Culture & Identity',
    host: users[0],
    listeners: 342,
    speakers: [users[0], users[1], users[3]],
    isLive: true,
    topic: 'Culture',
  },
  {
    id: '2',
    title: 'Biashara Talk: Growing Your Business in 2026',
    host: users[3],
    listeners: 189,
    speakers: [users[3], users[2]],
    isLive: true,
    topic: 'Business',
  },
  {
    id: '3',
    title: 'Nyimbo cia Agĩkũyũ - Music Night 🎵',
    host: users[1],
    listeners: 78,
    speakers: [users[1]],
    isLive: false,
    topic: 'Entertainment',
  },
];

export const sponsoredAds = [
  {
    id: 'ad-1',
    advertiser: { name: 'Safaricom', logo: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100&h=100&fit=crop', verified: true },
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop',
    title: 'M-Pesa Business Solutions',
    description: 'Grow your biashara with M-Pesa. Accept payments, track sales, and manage your business from anywhere.',
    cta: 'Chat Now' as const,
  },
  {
    id: 'ad-2',
    advertiser: { name: 'KCB Bank', logo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop', verified: true },
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop',
    title: 'KCB Stawi Loans',
    description: 'Get instant business loans up to KES 250K. No collateral needed. Apply now!',
    cta: 'Learn More' as const,
  },
  {
    id: 'ad-3',
    advertiser: { name: 'Thutha Ads', logo: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100&h=100&fit=crop', verified: true },
    image: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=600&h=400&fit=crop',
    title: 'Promote Your Story',
    description: 'Reach 1M+ Agĩkũyũ users. Start your ad campaign today on Thutha.',
    cta: 'Learn More' as const,
  },
  {
    id: 'ad-4',
    advertiser: { name: 'Equity Bank', logo: 'https://images.unsplash.com/photo-1556742393-d75f468bfcb0?w=100&h=100&fit=crop', verified: true },
    image: 'https://images.unsplash.com/photo-1553729459-uj6guf9h4bk?w=600&h=400&fit=crop',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    title: 'Equity Wings to Fly',
    description: 'Empowering the next generation. Apply for the Wings to Fly scholarship program.',
    cta: 'Learn More' as const,
  },
];

export const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

export const formatCurrency = (amount: number): string => {
  return `KES ${Math.abs(amount).toLocaleString()}`;
};
