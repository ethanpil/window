#!/usr/bin/env node
/* Builds index.html from src/. No dependencies: the page ships as one file so
   it opens straight from disk and runs in a sandboxed frame, but it is edited
   as many.

     node build.js              write index.html
     node build.js --check      exit 1 if index.html is not exactly what src/ builds
     node build.js --where N    which source file and line index.html line N came from

   src/shell.html   the page, with @@STYLE@@ and @@APP@@ lines to fill
   src/style.css    the stylesheet
   src/js/NN-*.js   the script, in file-name order, inside one function scope
   src/shaders/*    GLSL (.glsl/.vert/.frag), inlined as the GLSL table just
                    after 00-errors.js, so a failure building it reaches the
                    on-screen error strip. A line  #include "name.glsl"  pulls
                    in another file; a line starting  ///  is a source-only
                    note and is dropped.

   Anything the browser would only reject at run time — an include that isn't
   in the table, a malformed include, a file included twice into one shader, a
   shader nothing reads, a templated shader read without shader() — fails the
   build instead. */
'use strict';
var fs = require('fs'), path = require('path');

var ROOT = __dirname, SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'index.html');
var JS_NAME = /^\d\d-[a-z0-9-]+\.js$/, SHADER_NAME = /^[a-z0-9.-]+\.(glsl|vert|frag)$/;
var INCLUDE = /^[ \t]*#include[ \t]+"([^"]+)"[ \t]*$/;
var LOOKS_LIKE_INCLUDE = /^[ \t]*#[ \t]*include\b/;

/* text with any byte-order mark dropped (Windows editors add one) and LF endings */
function read(p) { return fs.readFileSync(p, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n'); }

/* the files of a folder, sorted; dotfiles (editor locks, AppleDouble) are
   skipped, anything else that doesn't fit the naming rule is an error */
function list(dir, re, what) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (f) { return f[0] !== '.'; }).map(function (f) {
    if (!re.test(f)) throw new Error('unexpected file ' + path.relative(ROOT, path.join(dir, f)) + ' (' + what + ')');
    return f;
  }).sort();
}

/* a shader file as shipped: /// notes dropped, and anything that looks like an
   include but isn't one exactly is refused rather than left for the driver */
function load(name, dir) {
  return read(path.join(dir, name)).replace(/\n$/, '').split('\n').filter(function (line, i) {
    if (LOOKS_LIKE_INCLUDE.test(line) && !INCLUDE.test(line))
      throw new Error('src/shaders/' + name + ':' + (i + 1) + ': write includes as  #include "name.glsl"  on a line of their own');
    return !/^[ \t]*\/\/\//.test(line);
  }).join('\n');
}

/* a shader with its includes expanded, checked against the table the page will
   actually carry; cycles and double inclusion are errors */
function expand(name, dir, names, stack, seen) {
  var by = stack.length ? ' (included by ' + stack[stack.length - 1] + ')' : '';
  if (names.indexOf(name) < 0) throw new Error('missing shader ' + name + by);
  if (stack.indexOf(name) >= 0) throw new Error('shader include cycle: ' + stack.concat(name).join(' -> '));
  if (seen[name]) throw new Error(name + ' is included twice into ' + stack[0]);
  seen[name] = true;
  return load(name, dir).split('\n').map(function (line) {
    var m = INCLUDE.exec(line);
    return m ? expand(m[1], dir, names, stack.concat(name), seen) : line;
  }).join('\n');
}

/* The page carries each file once and expands its includes when it starts, so
   common.glsl is not repeated in every shader that uses it. The pattern is the
   one the build checks against, written out from it. */
var EXPANDER = [
  'var GLSL = (function (src) {',
  '  var out = {}, own = Object.prototype.hasOwnProperty;',
  '  function ex(n) {',
  '    if (!own.call(src, n)) throw new Error("missing shader " + n);',
  '    if (!own.call(out, n)) out[n] = src[n].replace(/' + INCLUDE.source + '/gm, function (l, f) { return ex(f); });',
  '    return out[n];',
  '  }',
  '  for (var n in src) if (own.call(src, n)) ex(n);',
  '  return out;',
  '})({'
].join('\n');

/* The page, plus where each part of it came from (for --where). */
function build() {
  var shell = read(path.join(SRC, 'shell.html'));
  var css = read(path.join(SRC, 'style.css'));
  var parts = list(path.join(SRC, 'js'), JS_NAME, 'expected NN-name.js').map(function (f) {
    var text = read(path.join(SRC, 'js', f));
    return { file: 'src/js/' + f, text: /\n$/.test(text) ? text : text + '\n' };
  });

  var sdir = path.join(SRC, 'shaders'), names = list(sdir, SHADER_NAME, 'expected name.glsl, .vert or .frag');
  if (names.length) {
    var script = parts.map(function (p) { return p.text; }).join('');
    var used = {}, included = {}, expanded = {};
    names.forEach(function (n) {
      expanded[n] = expand(n, sdir, names, [], {});
      load(n, sdir).split('\n').forEach(function (line) { var m = INCLUDE.exec(line); if (m) included[m[1]] = true; });
    });
    /* every shader the script asks for exists, and a templated one is filled */
    var re = /\bGLSL\[\s*['"]([^'"]+)['"]\s*\]|\bshader\(\s*['"]([^'"]+)['"]/g, m;
    while ((m = re.exec(script))) {
      var want = m[1] || m[2];
      if (names.indexOf(want) < 0) throw new Error('script refers to missing shader ' + want);
      if (m[1] && /\{\{\w+\}\}/.test(expanded[want])) throw new Error(want + ' has {{KEY}} tokens: read it with shader(), not GLSL[]');
      used[want] = true;
    }
    if (/\bGLSL\[(?!\s*['"]|name\])/.test(script)) throw new Error('read shaders by literal name, GLSL[\'x.frag\'], so the build can check them');
    names.forEach(function (n) { if (!used[n] && !included[n]) throw new Error('src/shaders/' + n + ' is never used'); });

    /* JSON keeps the text a JS string; escaping < keeps "</script" in a
       comment from ending the page's script block */
    var table = names.map(function (n) {
      return '  ' + JSON.stringify(n) + ': ' + JSON.stringify(load(n, sdir)).replace(/</g, '\\u003c');
    });
    var glsl = { file: '(GLSL table, from src/shaders)', text: '/* shaders, inlined from src/shaders by build.js */\n' + EXPANDER + '\n' + table.join(',\n') + '\n});\n' };
    parts.splice(parts.length && /^00-/.test(path.basename(parts[0].file)) ? 1 : 0, 0, glsl);
  }

  var fill = function (text, marker, body) {
    var at = text.indexOf(marker + '\n');
    if (at < 0 || text.indexOf(marker + '\n', at + 1) >= 0) throw new Error('shell must hold exactly one ' + marker + ' line');
    return { before: text.slice(0, at), after: text.slice(at + marker.length + 1) };
  };
  var s = fill(shell, '@@STYLE@@'), page = s.before + css + s.after;
  var a = fill(page, '@@APP@@');
  var lines = function (t) { return t.split('\n').length - 1; };
  var map = [], line = lines(a.before) + 1;
  parts.forEach(function (p) { map.push({ file: p.file, from: line, count: lines(p.text) }); line += lines(p.text); });
  return { html: a.before + parts.map(function (p) { return p.text; }).join('') + a.after, map: map };
}

/* index.html line N → 'src/js/07-world.js:123' (or the shell, or the GLSL table) */
function where(n, map) {
  map = map || build().map;
  for (var i = 0; i < map.length; i++)
    if (n >= map[i].from && n < map[i].from + map[i].count) return map[i].file + ':' + (n - map[i].from + 1);
  return 'src/shell.html or src/style.css (outside the script)';
}

module.exports = { build: build, where: where };

if (require.main === module) {
  var args = process.argv.slice(2), result;
  var usage = function () { console.error('usage: node build.js [--check | --where <line>]'); process.exit(2); };
  if (args.length > 2 || (args.length && ['--check', '--where'].indexOf(args[0]) < 0)) usage();
  if (args[0] === '--where' && !/^\d+$/.test(args[1] || '')) usage();
  if (args[0] === '--check' && args.length > 1) usage();
  try { result = build(); } catch (e) { console.error('build failed: ' + e.message); process.exit(2); }
  if (args[0] === '--where') {
    console.log(where(+args[1], result.map));
  } else if (args[0] === '--check') {
    /* bytes as committed: a CRLF or BOM index.html is not the page the build makes */
    var have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (have !== result.html) { console.error('index.html is out of date: run node build.js'); process.exit(1); }
    console.log('index.html is up to date');
  } else {
    fs.writeFileSync(OUT, result.html);
    console.log('wrote index.html (' + result.html.length + ' chars)');
  }
}
