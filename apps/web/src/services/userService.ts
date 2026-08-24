import axiosInstance from '@/utils/axiosConfig';

export interface UserProfile {
  location?: string;
  website?: string;
  id: string;
  username: string;
  email: string;
  full_name: string;
  bio: string;
  avatar_url: string;
  cover_url: string;
  is_verified: boolean;
  is_private: boolean;
  is_creator: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  token_balance: number;
  monthly_earnings?: number;
  is_following?: boolean;
  is_followed_by?: boolean;
  follow_request_pending?: boolean;
}

export interface UpdateProfileData {
  full_name?: string;
  bio?: string;
  username?: string;
  is_private?: boolean;
  is_creator?: boolean;
  website?: string;
  location?: string;
  country?: string;
}

const userService = {
  // Get user profile by username
  getProfile: async (username: string): Promise<UserProfile> => {
    const normalizedUsername = username.trim().replace(/^@+/, '');
    if (!normalizedUsername || normalizedUsername === 'undefined') throw new Error('A valid username is required');
    const response = await axiosInstance.get(`/users/${encodeURIComponent(normalizedUsername)}`);
    return response.data.data.profile;
  },

  // Get current user profile
  getMyProfile: async (): Promise<UserProfile> => {
    const response = await axiosInstance.get('/users/me');
    return response.data.data.user;
  },

  // Update profile
  updateProfile: async (data: UpdateProfileData): Promise<UserProfile> => {
    const response = await axiosInstance.put('/users/profile', data);
    return response.data.data.user;
  },

  // Upload avatar
  uploadAvatar: async (file: File): Promise<{ avatar_url: string; user: UserProfile }> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await axiosInstance.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  // Upload cover photo
  uploadCover: async (file: File): Promise<{ cover_url: string; user: UserProfile }> => {
    const formData = new FormData();
    formData.append('cover', file);
    const response = await axiosInstance.post('/users/cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  // Update privacy settings
  updatePrivacy: async (isPrivate: boolean): Promise<{ is_private: boolean }> => {
    const response = await axiosInstance.put('/users/privacy', { is_private: isPrivate });
    return response.data.data;
  },

  // Search users
  searchUsers: async (query: string, limit = 20): Promise<UserProfile[]> => {
    const response = await axiosInstance.get(`/users/search?q=${query}&limit=${limit}`);
    return response.data.data.users;
  },

  // Get user suggestions
  getSuggestions: async (limit = 20): Promise<UserProfile[]> => {
    const response = await axiosInstance.get(`/users/suggestions?limit=${limit}`);
    return response.data.data.suggestions;
  },
};

export default userService;