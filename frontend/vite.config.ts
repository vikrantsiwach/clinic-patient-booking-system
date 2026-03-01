import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Clinic Appointment Booking',
        short_name: 'ClinicBook',
        description: 'Book your clinic appointment online',
        theme_color: '#0A7B6C',
        background_color: '#EEF2EF',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/clinic\/info/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'clinic-info', expiration: { maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
