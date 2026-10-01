// Builds a single self-contained HTML page (body content only) for publishing as a claude.ai Artifact.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
execSync('npx vite build --mode artifact', { cwd: root, stdio: 'inherit' });
const dist = resolve(root, 'dist-artifact');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
const cssHref = /<link rel="stylesheet"[^>]*href="\.\/([^"]+\.css)"/.exec(html)?.[1];
const jsSrc = /<script type="module"[^>]*src="\.\/([^"]+\.js)"/.exec(html)?.[1];
if (!cssHref || !jsSrc) throw new Error('Could not find built CSS/JS references');
const css = readFileSync(resolve(dist, cssHref), 'utf8').replace(/<\/style/gi, '<\\/style');
const js = readFileSync(resolve(dist, jsSrc), 'utf8').replace(/<\/script/gi, '<\\/script');
const bootStyle = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
const page = `<title>Riftkeepers</title>
<meta name="description" content="Riftkeepers — guard the floating isles from rift creatures in this colourful tower defense game.">
<style>${bootStyle}</style>
<style>${css}</style>
<div id="boot">Riftkeepers…</div>
<div id="app"></div>
<noscript>Riftkeepers needs JavaScript to run.</noscript>
<script type="module">${js}</script>
`;
const out = resolve(dist, 'riftkeepers.html');
writeFileSync(out, page);
console.log('Wrote', out, (page.length / 1024).toFixed(0) + ' KB');
