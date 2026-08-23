import { users } from './dummy';

export interface Reel {
  id: string;
  user: typeof users[0];
  videoUrl: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  liked: boolean;
  bookmarked: boolean;
  music?: string;
}

// RELIABLE, WORKING VIDEO URLs - All from trusted sources that support embedding
const WORKING_VIDEOS = [
  // Sample videos from W3Schools (reliable, always work)
  'https://www.w3schools.com/html/mov_bbb.mp4',
  'https://www.w3schools.com/html/movie.mp4',
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/earth.mp4',
  
  // Test videos from MDN (high quality, reliable)
  'https://mdn.github.io/learning-area/html/multimedia-and-embedding/video-and-audio-content/pexels-koolshooters-7324441-snapshots-16x9-2022-03-30T14_23_20.994Z.mp4',
  'https://mdn.github.io/learning-area/html/multimedia-and-embedding/video-and-audio-content/pexels-koolshooters-7324441-snapshots-16x9-2022-03-30T14_23_36.108Z.mp4',
  
  // Sample videos from Big Buck Bunny (high quality)
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
];

export const reels: Reel[] = [
  {
    id: 'r1',
    user: users[3],
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    caption: 'Traditional Kikuyu dance at the annual cultural festival! 🥁 The rhythm of our ancestors lives on. #KikuyuCulture #TraditionalDance #Thutha',
    likes: 12400,
    comments: 1840,
    shares: 2100,
    views: 245000,
    liked: false,
    bookmarked: false,
    music: 'Traditional Drums — Agĩkũyũ Heritage Ensemble',
  },
  {
    id: 'r2',
    user: users[4],
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    caption: 'Modern meets tradition 🔥 Our new collection celebrates African elegance. Which look is your favorite? #AfricanFashion #ModernTraditional #AgikuyuStyle',
    likes: 28900,
    comments: 3420,
    shares: 5600,
    views: 456000,
    liked: true,
    bookmarked: false,
    music: 'Nyimbo cia Tene Remix — DJ Mo Africa',
  },
  {
    id: 'r3',
    user: users[1],
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    caption: 'Golden hour in the Kenyan highlands 🌄 There\'s nothing like a peaceful morning in Murang\'a. #ExploreKenya #MurangaLife #NatureHeals',
    likes: 18300,
    comments: 2450,
    shares: 1890,
    views: 234000,
    liked: false,
    bookmarked: true,
    music: 'Peaceful Morning — Ambient Kenya',
  },
  {
    id: 'r4',
    user: users[0],
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    caption: 'Unity is our greatest strength 💙 Together, we preserve and celebrate our heritage for generations to come. #Thutha #AgĩkũyụPride #CommunityFirst',
    likes: 34500,
    comments: 5210,
    shares: 8900,
    views: 567000,
    liked: false,
    bookmarked: false,
    music: 'Rise Up Anthem — Thutha Original',
  },
  {
    id: 'r5',
    user: users[5],
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    caption: 'Spoken word night was electric! 🎤✨ Celebrating Gĩkũyũ poetry and the power of words. Full performance link in bio! #SpokenWord #GikuyuPoetry #ThuthaArts',
    likes: 15700,
    comments: 2890,
    shares: 3400,
    views: 189000,
    liked: false,
    bookmarked: false,
    music: 'Poetic Souls — Studio Session Live',
  },
  {
    id: 'r6',
    user: users[2],
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
    caption: 'Traditional Gĩtheri cooking with grandmother 👵🏾🍲 The secret ingredient? Love and patience! #KikuyuFood #TraditionalCuisine #Mukimo',
    likes: 22100,
    comments: 3670,
    shares: 2800,
    views: 312000,
    liked: false,
    bookmarked: false,
    music: 'Kitchen Melodies — Traditional Beats',
  },
  {
    id: 'r7',
    user: users[3],
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    caption: 'New single dropping Friday! 🎵 Here\'s a sneak peek of the music video. Who\'s ready? #NewMusic #KenyanMusic #ThuthaRecords',
    likes: 45200,
    comments: 8940,
    shares: 12300,
    views: 789000,
    liked: true,
    bookmarked: false,
    music: 'Coming Soon — Exclusive Preview',
  },
  {
    id: 'r8',
    user: users[4],
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/earth.mp4',
    caption: 'City lights and African nights 🌃 Nairobi never sleeps! Where are my city people at? #NairobiNights #CityVibes #ThuthaLife',
    likes: 19400,
    comments: 3120,
    shares: 2100,
    views: 245000,
    liked: false,
    bookmarked: false,
    music: 'City Lights — Urban Beats',
  },
  {
    id: 'r9',
    user: users[5],
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    caption: 'The art of beadwork 🎨 Each piece tells a story of our rich heritage. Handcrafted with love in Kenya. #Beadwork #AfricanArt #SupportLocal',
    likes: 13500,
    comments: 2340,
    shares: 1870,
    views: 178000,
    liked: false,
    bookmarked: true,
    music: 'Crafting Dreams — Traditional Melodies',
  },
  {
    id: 'r10',
    user: users[2],
    videoUrl: 'https://www.w3schools.com/html/movie.mp4',
    caption: 'Morning workout with a view 💪🏾 Wellness isn\'t just physical—it\'s cultural. Stay active, stay connected. #AfricanFitness #WellnessJourney #ThuthaHealth',
    likes: 27600,
    comments: 4580,
    shares: 3400,
    views: 423000,
    liked: false,
    bookmarked: false,
    music: 'Energy Flow — Fitness Mix',
  },
];

// Helper function to get video by ID
export const getReelById = (id: string): Reel | undefined => {
  return reels.find(reel => reel.id === id);
};

// Helper function to get trending reels
export const getTrendingReels = (limit: number = 5): Reel[] => {
  return [...reels].sort((a, b) => b.views - a.views).slice(0, limit);
};

// Helper function to get reels by user ID
export const getReelsByUserId = (userId: string): Reel[] => {
  return reels.filter(reel => reel.user.id === userId);
};