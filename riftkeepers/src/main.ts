import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './ui/styles.css';
import { App } from './ui/app';
import { achievementsScreen, collectionScreen, guardiansScreen, helpScreen, settingsScreen, titleScreen } from './ui/screens/menus';
import { playScreen } from './ui/screens/play';
import { gameScreen } from './game/session';

const root = document.getElementById('app')!;
const app = new App(root);
app.register('title', titleScreen);
app.register('play', playScreen);
app.register('guardians', guardiansScreen);
app.register('collection', collectionScreen);
app.register('achievements', achievementsScreen);
app.register('settings', settingsScreen);
app.register('help', helpScreen);
app.register('game', gameScreen);

// Wait for the bundled font so canvas text renders correctly, but never block for long.
const ready = (document as any).fonts?.ready ?? Promise.resolve();
Promise.race([ready, new Promise((r) => setTimeout(r, 1200))]).then(() => {
  document.getElementById('boot')?.remove();
  app.go('title');
});

// Prevent pinch-zoom / double-tap zoom gestures from scrolling the page during play (iOS Safari).
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.MODE !== 'artifact') {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    } catch {
      /* service workers are unavailable in sandboxed frames; the game still runs online */
    }
  });
}
