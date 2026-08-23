import { ReactNode } from "react";

export interface User {
  badge?: any;
  category?: ReactNode;
  id: string;
  username: string;
  handle: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  verified: boolean;
  monthlyEarnings?: number;
  isCreator?: boolean;
}

export interface Post {
  id: string;
  user: User;
  content: string;
  images?: string[];
  videoUrl?: string;
  poll?: { question: string; options: { text: string; votes: number }[] };
  likes: number;
  comments: number;
  shares: number;
  views?: number;
  timeAgo: string;
  pinned?: boolean;
  sponsored?: boolean;
  liked?: boolean;
  bookmarked?: boolean;
}

export interface Comment {
  id: string;
  user: User;
  content: string;
  timeAgo: string;
  likes: number;
  liked: boolean;
  replies: Comment[];
}

export interface Transaction {
  id: string;
  date: string;
  type: 'Ad Revenue' | 'Tips' | 'Subscription' | 'Withdrawal';
  status: 'Completed' | 'Pending' | 'Failed';
  amount: number;
}

export interface TrendingTopic {
  likes?: number;
  views?: number;
  id: string;
  tag: string;
  posts: number;
  category: string;
}