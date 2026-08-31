import { defineConfig } from 'vite';

// Stage 2 of docs/PERFORMANCE_REFACTORING_PLAN.md.
//
// The Vite project source lives entirely under web/ so that the currently
// deployed root index.html (served as-is by GitHub Pages) is never touched
// or at risk while this build pipeline is introduced and verified.
//
// base: './' produces relative asset URLs so the build works whether it's
// eventually served from a repo root or a GitHub Pages project subpath
// (e.g. /thenew-hub/) without any extra configuration.
export default defineConfig({
  root: 'web',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
