import { backendOrigin } from '@/utils/axiosConfig';

export type ImageTarget = 'images' | 'cover';

export const getMediaUrl = (url?: string | null, key?: string | null, target: ImageTarget = 'images') => {
  if (key) return `${backendOrigin}/api/v1/media?target=${target}&key=${encodeURIComponent(key)}`;
  return url || '';
};
