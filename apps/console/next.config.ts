import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@bonded/seam', '@bonded/compiler'],
};

export default config;
