import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@bonded/seam', '@bonded/compiler', '@bonded/enforcer'],

  /**
   * Two Next processes in one checkout both write `.next` and then start
   * throwing missing-chunk errors at each other — which is exactly what happens
   * when you verify a change against a server someone else already has running.
   * Overriding the directory makes a second instance harmless:
   *
   *   NEXT_DIST_DIR=.next-verify pnpm --filter @bonded/console dev -- -p 3100
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default config;
