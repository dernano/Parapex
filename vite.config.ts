import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/*
 * One config for the dev server, the production build and the test runner.
 *
 * The legacy game (index.html plus quelle/, built by scripts/baue.mjs) is not
 * part of this build and is not meant to be. It keeps running exactly as it
 * did while the new tree grows next to it; `npm run legacy:*` still drives it.
 */
export default defineConfig({
  /*
   * The new client lives in app/, NOT at the repository root - the root
   * index.html is the legacy game and has to keep working untouched until
   * Phase 10 removes it. One root per client, no shared entry point, no
   * chance of accidentally building the thing we are replacing.
   */
  root: 'app',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    /*
     * Two pages, not one. `/visual-test/` is the workbench, and it is built
     * rather than being a dev-only convenience: a tool that only exists on
     * somebody's machine is a tool the next person has to rebuild.
     */
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./app/index.html', import.meta.url)),
        visualTest: fileURLToPath(new URL('./app/visual-test/index.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    /*
     * `root: 'app'` above is the CLIENT root, not the project root. Vitest
     * inherits it unless told otherwise, and would then look for tests inside
     * app/ and find none - a green run that tested nothing, which is worse
     * than a red one.
     */
    root: fileURLToPath(new URL('.', import.meta.url)),
    // Node only. The point of the new core is that it needs no browser at all;
    // a test that silently pulled in jsdom would hide exactly the coupling
    // this migration exists to remove.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
