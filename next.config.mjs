/** @type {import('next').NextConfig} */
const nextConfig = {
  // Оптимізація для швидкого запуску
  reactStrictMode: false, // Вимкнути подвійний рендер в dev режимі
  
  // Оптимізація зображень
  images: {
    unoptimized: true, // Швидше для локального dev
  },
  
  // Webpack оптимізація
  webpack: (config, { dev, isServer }) => {
    // Прискорення dev збірки
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    
    // Кешування для швидшої компіляції
    config.cache = {
      type: 'filesystem',
    }
    
    return config
  },
  
  // Експериментальні функції для швидкості
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-select'],
  },
  
  // TypeScript перевірки
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint
  eslint: {
    ignoreDuringBuilds: false,
  },
}

export default nextConfig
