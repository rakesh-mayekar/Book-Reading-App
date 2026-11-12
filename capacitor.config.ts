import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bookreading.prototype',
  appName: 'Book Reading',
  webDir: 'dist', // Vite build output (contains index.html); bundled into the APK
  backgroundColor: '#F3EFE0',
  plugins: {
    SystemBars: {
      // Webview is edge-to-edge; the app applies env(safe-area-inset-*) exactly once (header, footer bar, bottom nav).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
