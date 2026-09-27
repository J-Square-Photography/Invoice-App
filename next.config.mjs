/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/invoices/[id]/pdf': ['./src/lib/fonts/*.ttf'],
    '/api/quotes/[id]/pdf': ['./src/lib/fonts/*.ttf'],
  },
};

export default nextConfig;
