/* ---------- the room, the window ---------- */
function openingPoints(P, e, cw) {
  var w = P.win.w, h = P.win.h, cy = P.win.cy;
  var arch = P.win.arch;
  var x0 = -w / 2 - e, x1 = w / 2 + e;
  var y0 = cy - h / 2 - e, y1 = cy + h / 2 + e;
  var r = w / 2 + e;
  var springY = cy + h / 2 - w / 2;
  var pts = [];
  pts.push(new THREE.Vector2(x0, y0));
  if (arch) {
    pts.push(new THREE.Vector2(x0, springY));
    var seg = 26;
    for (var i = 0; i <= seg; i++) {
      var a = Math.PI - Math.PI * (i / seg);
      pts.push(new THREE.Vector2(Math.cos(a) * r, springY + Math.sin(a) * r));
    }
  } else {
    pts.push(new THREE.Vector2(x0, y1));
    pts.push(new THREE.Vector2(x1, y1));
  }
  pts.push(new THREE.Vector2(x1, y0));
  if (!cw) pts.reverse();
  return pts;
}

function buildRoom(scene, P, U) {
  var R = RNG(P.base + '/room');
  var g = new THREE.Group();
  var w = P.win.w, h = P.win.h, cy = P.win.cy;
  var arch = P.win.arch;
  var springY = cy + h / 2 - w / 2;
  var wallW = 40, wallH = 26;

  /* --- wall with the opening cut out, extruded to give the reveal --- */
  var shape = new THREE.Shape([
    new THREE.Vector2(-wallW / 2, cy - wallH / 2),
    new THREE.Vector2(wallW / 2, cy - wallH / 2),
    new THREE.Vector2(wallW / 2, cy + wallH / 2),
    new THREE.Vector2(-wallW / 2, cy + wallH / 2)
  ]);
  shape.holes.push(new THREE.Path(openingPoints(P, 0, true)));
  var wallGeo = new THREE.ExtrudeGeometry(shape, { depth: P.win.wallDepth, bevelEnabled: false, steps: 1, curveSegments: 24 });
  wallGeo.translate(0, 0, -P.win.wallDepth);
  var wallTex = makeWallTexture(P, R, wallW, wallH);
  wallTex.repeat.set(1 / wallW, 1 / wallH);
  wallTex.offset.set(0.5, 0.5 - cy / wallH);
  var wallMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(P.win.wallTint),
    map: wallTex,
    side: THREE.DoubleSide
  });
  var wall = new THREE.Mesh(wallGeo, wallMat);
  g.add(wall);

  /* --- interior casing --- */
  var casingShape = new THREE.Shape(openingPoints(P, P.win.casing, false));
  casingShape.holes.push(new THREE.Path(openingPoints(P, 0.004, true)));
  var casingGeo = new THREE.ExtrudeGeometry(casingShape, { depth: P.win.casingDepth, bevelEnabled: false, steps: 1, curveSegments: 24 });
  var finTex = makeFinishTexture(P.win.finish, R);
  var frameMat = new THREE.MeshLambertMaterial({ map: finTex, side: THREE.DoubleSide });
  var casing = new THREE.Mesh(casingGeo, frameMat);
  g.add(casing);

  /* --- sash frame, set back into the reveal --- */
  var zSash = -P.win.wallDepth * P.win.setback;
  var sashShape = new THREE.Shape(openingPoints(P, -0.012, false));
  sashShape.holes.push(new THREE.Path(openingPoints(P, -0.012 - P.win.frame, true)));
  var sash = new THREE.Group();
  /* hinged on one jamb, so opening it reads at a glance */
  sash.position.set(-w / 2, 0, zSash);
  var sashGeo = new THREE.ExtrudeGeometry(sashShape, { depth: 0.055, bevelEnabled: false, steps: 1, curveSegments: 24 });
  sashGeo.translate(w / 2, 0, 0);
  sash.add(new THREE.Mesh(sashGeo, frameMat));
  g.add(sash);
  App.sash = sash;

  /* --- glazing bars --- */
  var cols = P.win.cols, rows = P.win.rows, bar = P.win.bar, bd = 0.042;
  var innerX0 = -w / 2 + P.win.frame, innerX1 = w / 2 - P.win.frame;
  var innerY0 = cy - h / 2 + P.win.frame;
  var innerY1 = arch ? springY : cy + h / 2 - P.win.frame;
  var barMat = frameMat;
  var i, cnvY;
  for (i = 1; i < cols; i++) {
    var bx = innerX0 + (innerX1 - innerX0) * (i / cols);
    var bh = innerY1 - innerY0;
    var vb = new THREE.Mesh(new THREE.BoxGeometry(bar, bh, bd), barMat);
    vb.position.set(bx + w / 2, (innerY0 + innerY1) / 2, 0.027);
    sash.add(vb);
  }
  for (i = 1; i < rows; i++) {
    cnvY = innerY0 + (innerY1 - innerY0) * (i / rows);
    var thick = (P.win.meetingRow && i === P.win.meetingRow) ? bar * 3.1 : bar;
    var hb = new THREE.Mesh(new THREE.BoxGeometry(innerX1 - innerX0, thick, bd * (thick > bar ? 1.25 : 1)), barMat);
    hb.position.set(w / 2, cnvY, 0.027);
    sash.add(hb);
  }
  if (arch && !P.win.clear) {
    /* transom at the spring line + radial bars in the fan light */
    var tr = new THREE.Mesh(new THREE.BoxGeometry(innerX1 - innerX0, bar * 1.6, bd), barMat);
    tr.position.set(w / 2, springY, 0.027);
    sash.add(tr);
    var rr = w / 2 - P.win.frame;
    var fan = cols > 1 ? 3 : 2;
    for (i = 1; i <= fan; i++) {
      var ang = Math.PI * (i / (fan + 1));
      var rb = new THREE.Mesh(new THREE.BoxGeometry(bar, rr, bd), barMat);
      rb.position.set(w / 2 + Math.cos(ang) * rr / 2, springY + Math.sin(ang) * rr / 2, 0.027);
      rb.rotation.z = ang - Math.PI / 2;
      sash.add(rb);
    }
  }

  /* --- sill + apron --- */
  var sillW = w + P.win.casing * 2 + 0.14;
  var sillGeo = new THREE.BoxGeometry(sillW, 0.055, P.win.wallDepth + P.win.sillDepth);
  var sill = new THREE.Mesh(sillGeo, frameMat);
  sill.position.set(0, cy - h / 2 - 0.027, -P.win.wallDepth / 2 + P.win.sillDepth / 2);
  g.add(sill);
  var apron = new THREE.Mesh(new THREE.BoxGeometry(sillW * 0.86, 0.10, 0.028), frameMat);
  apron.position.set(0, cy - h / 2 - 0.115, 0.014);
  g.add(apron);

  /* --- glass --- */
  var glassGeo = new THREE.PlaneGeometry(w * 1.02, h * 1.02);
  var glassMat = new THREE.MeshBasicMaterial({
    map: makeGlassTexture(R),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  var glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(w / 2, cy, 0.01);
  glass.renderOrder = 6;
  sash.add(glass);
  /* frost forms on the glass itself, so the glazing bars sit in front of it
     and it reads as outside the pane rather than a film over the window */
  if (P.weather.snow > 0 || P.baseSnow > 0.3) {
    var frostMat = new THREE.MeshBasicMaterial({
      map: tex(makeFrostCanvas(P), false), transparent: true, opacity: 0, depthWrite: false
    });
    var frost = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.02, h * 1.02), frostMat);
    frost.position.set(w / 2, cy, 0.014);
    frost.renderOrder = 5;
    sash.add(frost);
    App.frostMat = frostMat;
    App.frostTarget = clamp(0.18 + (P.weather.snow || 0) * 0.28 + (P.baseSnow || 0) * 0.12, 0, 0.55);
  } else { App.frostMat = null; App.frostTarget = 0; }
  App.glass = glass;
  App.glassMat = glassMat;

  g.visible = !App.bare;
  scene.add(g);
  App.room = g;
  App.sashAngle = App.sashAngle || 0;
}


/* ---------- post ----------
   The scene is drawn to a target, its highlights blurred at quarter size and
   added back, then graded and given grain. One extra full-screen pass. */
function setupPost() {
  var r = App.renderer;
  if (!r) return;
  disposePost();
  if (!Q().post) return;
  var size = new THREE.Vector2();
  r.getDrawingBufferSize(size);
  var w = Math.max(2, size.x | 0), h = Math.max(2, size.y | 0);
  /* The scene is drawn larger than the screen and filtered down, on top of
     4x multisampling: fine moving detail gets ten-odd samples a pixel and
     stops crawling when the view shifts. */
  var ss = Q().ss || 1;
  var sw = Math.min(4096, Math.round(w * ss)), sh = Math.min(4096, Math.round(h * ss));
  /* An offscreen target has no anti-aliasing unless it is multisampled, and
     that needs WebGL2. Without it, bloom is not worth every edge in the scene
     shimmering, so the pass is skipped and the scene draws straight to screen. */
  if (!r.capabilities.isWebGL2 || !THREE.WebGLMultisampleRenderTarget) return;
  /* stencilBuffer:true is what makes three give the target a 24-bit depth
     buffer; without it the depth is 16-bit and the near field z-fights */
  var full = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: true };
  var quarter = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false };
  var qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
  var P = {
    w: w, h: h, qw: qw, qh: qh,
    sw: sw, sh: sh,
    scene: (function () { var t = new THREE.WebGLMultisampleRenderTarget(sw, sh, full); t.samples = 4; return t; })(),
    bright: new THREE.WebGLRenderTarget(qw, qh, quarter),
    blurA: new THREE.WebGLRenderTarget(qw, qh, quarter),
    blurB: new THREE.WebGLRenderTarget(qw, qh, quarter),
    cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    sceneQ: new THREE.Scene()
  };
  var VS = GLSL['post.vert'];
  P.matBright = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, uStep: { value: new THREE.Vector2(1 / (3 * qw), 1 / (3 * qh)) } }, depthTest: false, depthWrite: false,
    vertexShader: VS,
    fragmentShader: GLSL['bright.frag']
  });
  P.matBlur = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2(1, 0) } }, depthTest: false, depthWrite: false,
    vertexShader: VS,
    fragmentShader: GLSL['blur.frag']
  });
  P.matComp = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, bloom: { value: null }, uTime: { value: 0 },
                uRes: { value: new THREE.Vector2(w, h) }, uBloom: { value: 0.22 },
                uTexel: { value: new THREE.Vector2(1 / sw, 1 / sh) } },
    depthTest: false, depthWrite: false,
    vertexShader: VS,
    fragmentShader: GLSL['comp.frag']
  });
  P.matBlit = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null } }, depthTest: false, depthWrite: false,
    vertexShader: VS,
    fragmentShader: GLSL['blit.frag']
  });
  P.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), P.matComp);
  P.quad.frustumCulled = false;
  P.sceneQ.add(P.quad);
  App.post = P;
}
function disposePost() {
  var P = App.post;
  if (!P) return;
  P.scene.dispose(); P.bright.dispose(); P.blurA.dispose(); P.blurB.dispose();
  P.matBright.dispose(); P.matBlur.dispose(); P.matComp.dispose(); P.matBlit.dispose(); P.quad.geometry.dispose();
  App.post = null;
}
function renderFrame() {
  var r = App.renderer, P = App.post;
  if (!P) { r.setRenderTarget(null); r.render(App.scene, App.camera); return; }

  r.setRenderTarget(P.scene); r.render(App.scene, App.camera);
  P.quad.material = P.matBright; P.matBright.uniforms.tex.value = P.scene.texture;
  r.setRenderTarget(P.bright); r.render(P.sceneQ, P.cam);
  P.quad.material = P.matBlur;
  P.matBlur.uniforms.tex.value = P.bright.texture; P.matBlur.uniforms.dir.value.set(1 / P.qw, 0);
  r.setRenderTarget(P.blurA); r.render(P.sceneQ, P.cam);
  P.matBlur.uniforms.tex.value = P.blurA.texture; P.matBlur.uniforms.dir.value.set(0, 1 / P.qh);
  r.setRenderTarget(P.blurB); r.render(P.sceneQ, P.cam);
  P.quad.material = P.matComp;
  P.matComp.uniforms.tex.value = P.scene.texture; P.matComp.uniforms.bloom.value = P.blurB.texture;
  P.matComp.uniforms.uTime.value = App.t || 0;
  r.setRenderTarget(null); r.render(P.sceneQ, P.cam);
}

