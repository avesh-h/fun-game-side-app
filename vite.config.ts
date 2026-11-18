import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app + offline cache. The whole app is static with no network
    // calls, so precaching the build is all it needs to run with no signal.
    VitePWA({
      // Ask before switching to a new version (see UpdatePrompt.tsx) so an
      // update never reloads the page mid-hand.
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Game Night',
        short_name: 'Game Night',
        description: 'Poker chip ledger and Undercover, for playing at the table.',
        id: './',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a1020',
        theme_color: '#0a1020',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // Relative base so the built app also works when opened from a file path
  // or served from a sub-folder, not just from a domain root.
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
