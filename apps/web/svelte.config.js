import adapter from '@sveltejs/adapter-cloudflare'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Un worktree peut partager node_modules : le protocole doit rester celui de ses sources.
    alias: {
      '@ecole2recte/protocol': fileURLToPath(new URL('../../packages/protocol/src/index.ts', import.meta.url)),
    },
    adapter: adapter(),
    csrf: { checkOrigin: true },
  },
}
