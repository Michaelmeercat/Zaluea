#!/usr/bin/env node
/*
 * Builds one self-contained HTML file of the game (scripts, styles, font and
 * icon inlined) that runs from disk with no internet, e.g. opened from a
 * Chromebook's Files app.
 *   node tools/build-offline.js [output.html]
 */
'use strict';
var fs = require('fs');
var path = require('path');

var dir = path.join(__dirname, '..');
var out = process.argv[2] || path.join(dir, 'wind-up-escape-offline.html');
function read(f) { return fs.readFileSync(path.join(dir, f), 'utf8'); }
function dataUri(f, type) { return 'data:' + type + ';base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'); }

var html = read('index.html');
var css = read('style.css').replace("url('fonts/fredoka-latin.woff2')", "url('" + dataUri('fonts/fredoka-latin.woff2', 'font/woff2') + "')");

html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="' + dataUri('icon.svg', 'image/svg+xml') + '">')
  .replace('<link rel="stylesheet" href="style.css">', function () { return '<style>\n' + css + '</style>'; })
  .replace(/<script src="([^"]+)"><\/script>/g, function (m, src) {
    var js = read(src).replace(/<\/script/gi, '<\\/script');
    return '<script>/* ' + src + ' */\n' + js + '</script>';
  });

if (/src="[^"]+\.js"|href="[^"]+\.css"|url\('fonts\//.test(html)) throw new Error('an external file was not inlined');
fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
