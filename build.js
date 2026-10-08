#!/usr/bin/env node
/* Builds index.html from src/. No dependencies: the page ships as one file so
   it opens straight from disk and runs in a sandboxed frame, but it is edited
   as many.

     node build.js            write index.html
     node build.js --check    exit 1 if index.html is not what src/ builds

   src/shell.html   the page, with @@STYLE@@ and @@APP@@ lines to fill
   src/style.css    the stylesheet
   src/js/*.js      the script, in file-name order, inside one function scope
   src/shaders/*    GLSL, inlined as the GLSL table at the top of the script.
                    A line  #include "name.glsl"  pulls in another file. */
'use strict';
var fs = require('fs'), path = require('path');

var ROOT = __dirname, SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'index.html');

function read(p) { return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'); }
function list(dir, re) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(function (f) { return re.test(f); }).sort() : [];
}

/* a shader file with its includes expanded; a cycle or a missing file is an error */
function expand(name, dir, stack) {
  if (stack.indexOf(name) >= 0) throw new Error('shader include cycle: ' + stack.concat(name).join(' -> '));
  var file = path.join(dir, name);
  if (!fs.existsSync(file)) throw new Error('missing shader ' + name + (stack.length ? ' (included by ' + stack[stack.length - 1] + ')' : ''));
  var text = read(file).replace(/\n$/, '');
  return text.split('\n').map(function (line) {
    var m = /^\s*#include\s+"([^"]+)"\s*$/.exec(line);
    return m ? expand(m[1], dir, stack.concat(name)) : line;
  }).join('\n');
}

function build() {
  var shell = read(path.join(SRC, 'shell.html'));
  var css = read(path.join(SRC, 'style.css'));
  var js = list(path.join(SRC, 'js'), /\.js$/).map(function (f) { return read(path.join(SRC, 'js', f)); }).join('');

  var sdir = path.join(SRC, 'shaders'), names = list(sdir, /\.(glsl|vert|frag)$/);
  if (names.length) {
    var table = names.map(function (n) { return '  ' + JSON.stringify(n) + ': ' + JSON.stringify(expand(n, sdir, [])); });
    js = '/* shaders, inlined from src/shaders by build.js */\nvar GLSL = {\n' + table.join(',\n') + '\n};\n' + js;
    /* every shader the script asks for must exist */
    var re = /GLSL\[\s*['"]([^'"]+)['"]\s*\]|shader\(\s*['"]([^'"]+)['"]/g, m;
    while ((m = re.exec(js))) {
      var want = m[1] || m[2];
      if (names.indexOf(want) < 0) throw new Error('script refers to missing shader ' + want);
    }
  }

  var fill = function (text, marker, body) {
    var at = text.indexOf(marker + '\n');
    if (at < 0 || text.indexOf(marker + '\n', at + 1) >= 0) throw new Error('shell must hold exactly one ' + marker + ' line');
    return text.slice(0, at) + body + text.slice(at + marker.length + 1);
  };
  return fill(fill(shell, '@@STYLE@@', css), '@@APP@@', js);
}

var out;
try { out = build(); } catch (e) { console.error('build failed: ' + e.message); process.exit(2); }
if (process.argv.indexOf('--check') >= 0) {
  var have = fs.existsSync(OUT) ? read(OUT) : '';
  if (have !== out) { console.error('index.html is out of date: run node build.js'); process.exit(1); }
  console.log('index.html is up to date');
} else {
  fs.writeFileSync(OUT, out);
  console.log('wrote index.html (' + out.length + ' chars)');
}
