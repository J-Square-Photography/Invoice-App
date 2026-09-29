/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/invoices/[id]/pdf': ['./src/lib/fonts/*.ttf', './src/lib/brand/*.png'],
    '/api/quotes/[id]/pdf': ['./src/lib/fonts/*.ttf', './src/lib/brand/*.png'],
  },
};

export default nextConfig;
