/* Bundle the game into one self-contained HTML body for hosting: node tools/bundle.js out.html */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src='));
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => {
  const js = fs.readFileSync(path.join(root, m[1]), 'utf8');
  if (/<\/script/i.test(js)) throw new Error('closing script tag in ' + m[1]);
  return `<script>/* ${m[1]} */\n${js}\n</script>`;
});
const out = `<title>Circuit Siege</title>
<meta name="theme-color" content="#070a10">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Rajdhani:wght@500;600;700&display=swap">
<style>:root{color-scheme:dark;padding:0!important}html,body{height:100%;background:#070a10}\n${css}</style>
${body}
<script>window.CS_EMBEDDED = true;</script>
${scripts.join('\n')}
`;
fs.writeFileSync(process.argv[2], out);
console.log('wrote', process.argv[2], (out.length / 1024).toFixed(0) + 'KB');
