import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const productionApiUrl = 'https://server.thutha.co.ke/api/v1';
const localApiUrl = 'http://localhost:5000/api/v1';
const normalizeApiUrl = (value) => {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production' && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(url)) return '';
  return url;
};
const configuredApiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
const apiUrl = configuredApiUrl || (process.env.NODE_ENV === 'production' ? productionApiUrl : localApiUrl);

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://www.thutha.co.ke' : 'http://localhost:8080'),
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
