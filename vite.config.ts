import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // Load Firebase config gracefully from JSON file and/or environment variables
  let fileConfig: any = {};
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.warn('Could not load firebase-applet-config.json:', e);
  }

  const firebaseConfig = {
    projectId: env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId || '',
    appId: env.VITE_FIREBASE_APP_ID || fileConfig.appId || '',
    apiKey: env.VITE_FIREBASE_API_KEY || fileConfig.apiKey || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain || '',
    firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || fileConfig.firestoreDatabaseId || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId || '',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || fileConfig.measurementId || '',
  };

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.FIREBASE_CONFIG': JSON.stringify(firebaseConfig),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
