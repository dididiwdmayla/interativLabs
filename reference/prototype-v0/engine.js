/* Bancada de Mecanismos — motor (geometria, física em camadas, exemplos) */
(function (root) {
  'use strict';
  var PL = root.planck || (typeof require === 'function' ? require('planck') : null);
  var DECOMP = root.decomp || (typeof require === 'function' ? require('poly-decomp') : null);

  var S = 50; // px por unidade de física
  var PI = Math.PI;

  var MATERIALS = {
    aco:       { name: 'Aço',       density: 7.8, friction: 0.25, restitution: 0.05 },
    aluminio:  { name: 'Alumínio',  density: 2.7, friction: 0.3,  restitution: 0.05 },
    latao:     { name: 'Latão',     density: 8.5, friction: 0.2,  restitution: 0.05 },
    polimero:  { name: 'Polímero',  density: 1.2, friction: 0.4,  restitution: 0.1 },
    borracha:  { name: 'Borracha',  density: 1.1, friction: 0.9,  restitution: 0.5 },
    madeira:   { name: 'Madeira',   density: 0.7, friction: 0.5,  restitution: 0.1 }
  };

  /* ---------- vetores ---------- */
  function rot(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
  function toWorld(pose, p) { var r = rot(p, pose.a); return [pose.x + r[0], pose.y + r[1]]; }
  function toLocal(pose, p) { return rot([p[0] - pose.x, p[1] - pose.y], -pose.a); }
  function partPose(part) { return { x: part.x, y: part.y, a: part.angle || 0 }; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function polar(r, a) { return [r * Math.cos(a), r * Math.sin(a)]; }

  function signedArea(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
    return s / 2;
  }
  function centroid(pts) {
    var A = signedArea(pts), cx = 0, cy = 0;
    if (Math.abs(A) < 1e-6) {
      pts.forEach(function (p) { cx += p[0]; cy += p[1]; });
      return [cx / pts.length, cy / pts.length];
    }
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length], f = p[0] * q[1] - q[0] * p[1];
      cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
    }
    return [cx / (6 * A), cy / (6 * A)];
  }
  function pointInPoly(pt, pts) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function convexHull(pts) {
    var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (p.length < 3) return p;
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    p.forEach(function (q) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (var i = p.length - 1; i >= 0; i--) { var q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  // Ramer–Douglas–Peucker
  function simplify(pts, tol) {
    if (pts.length < 3) return pts.slice();
    function segDist(p, a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      if (L === 0) return dist(p, a);
      var t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
      return dist(p, [a[0] + t * dx, a[1] + t * dy]);
    }
    function rdp(s, e, out) {
      var md = 0, mi = -1;
      for (var i = s + 1; i < e; i++) { var d = segDist(pts[i], pts[s], pts[e]); if (d > md) { md = d; mi = i; } }
      if (md > tol) { rdp(s, mi, out); out.pop(); rdp(mi, e, out); } else { out.push(pts[s], pts[e]); }
      return out;
    }
    return rdp(0, pts.length - 1, []);
  }

  /* ---------- formas ---------- */
  function gearProfile(sh) {
    var n = Math.max(4, Math.round(sh.teeth)), step = 2 * PI / n, d = sh.depth;
    var rr = sh.r - d * 0.6, rt = sh.r + d * 0.4;
    var outline = [], teeth = [];
    for (var i = 0; i < n; i++) {
      var a = i * step;
      if (sh.style === 'serra') {
        var A = polar(rr, a), T = polar(rt, a + step * 0.78), B = polar(rr, a + step * 0.82);
        outline.push(A, T, B);
        teeth.push([polar(rr - 1.5, a), T, polar(rr - 1.5, a + step * 0.82)]);
      } else {
        var c = a + step / 2;
        var rl = polar(rr, c - 0.3 * step), tl = polar(rt, c - 0.15 * step), tr = polar(rt, c + 0.15 * step), rrt = polar(rr, c + 0.3 * step);
        outline.push(rl, tl, tr, rrt);
        teeth.push([polar(rr - 1.5, c - 0.3 * step), tl, tr, polar(rr - 1.5, c + 0.3 * step)]);
      }
    }
    return { outline: outline, teeth: teeth, rr: rr, rt: rt };
  }
  function shapeOutline(sh) {
    if (sh.type === 'poly') return sh.pts;
    if (sh.type === 'circle') { var o = []; for (var i = 0; i < 40; i++) o.push(polar(sh.r, i / 40 * 2 * PI)); return o; }
    if (sh.type === 'gear') return gearProfile(sh).outline;
    return [];
  }
  function shapeRadius(sh) {
    if (sh.type === 'circle') return sh.r;
    if (sh.type === 'gear') return sh.r + sh.depth * 0.4;
    var m = 0; sh.pts.forEach(function (p) { m = Math.max(m, Math.hypot(p[0], p[1])); }); return m;
  }
  function hitShape(sh, lp) {
    if (sh.type === 'circle') return Math.hypot(lp[0], lp[1]) <= sh.r;
    if (sh.type === 'gear') return Math.hypot(lp[0], lp[1]) <= sh.r + sh.depth * 0.2;
    return pointInPoly(lp, sh.pts);
  }
  function splitBig(poly, maxV) {
    if (poly.length <= maxV) return [poly];
    var out = [], i = 1;
    while (i < poly.length - 1) {
      var piece = [poly[0]];
      for (var k = 0; k < maxV - 1 && i + k < poly.length; k++) piece.push(poly[i + k]);
      out.push(piece);
      i += maxV - 2;
    }
    return out;
  }
  function polyPieces(pts) {
    var poly = pts.map(function (p) { return [p[0], p[1]]; });
    if (poly.length < 3) return [];
    var res = null;
    try {
      if (DECOMP) {
        DECOMP.makeCCW(poly);
        DECOMP.removeCollinearPoints(poly, 0.002);
        DECOMP.removeDuplicatePoints(poly, 0.01);
        if (poly.length >= 3 && DECOMP.isSimple(poly)) res = DECOMP.quickDecomp(poly);
      }
    } catch (e) { res = null; }
    if (!res || !res.length) res = [convexHull(poly)];
    var out = [];
    res.forEach(function (p) { splitBig(p, 10).forEach(function (q) { if (q.length >= 3 && Math.abs(signedArea(q)) > 0.6) out.push(q); }); });
    if (!out.length) { var h = convexHull(poly); if (Math.abs(signedArea(h)) > 0.6) out.push(h); }
    return out;
  }
  function shapePieces(sh) {
    if (sh.type === 'circle') return [{ type: 'circle', c: [0, 0], r: sh.r }];
    if (sh.type === 'gear') {
      var g = gearProfile(sh), out = [{ type: 'circle', c: [0, 0], r: g.rr }];
      g.teeth.forEach(function (t) { out.push({ type: 'poly', pts: t }); });
      return out;
    }
    return polyPieces(sh.pts).map(function (p) { return { type: 'poly', pts: p }; });
  }

  /* ---------- cena ---------- */
  function layerOrder(scene) { var m = {}; scene.layers.forEach(function (L, i) { m[L.id] = i; }); return m; }
  function findPart(scene, id) { for (var i = 0; i < scene.parts.length; i++) if (scene.parts[i].id === id) return scene.parts[i]; return null; }
  function findLink(scene, id) { for (var i = 0; i < scene.links.length; i++) if (scene.links[i].id === id) return scene.links[i]; return null; }
  function bitsSpan(order, from, to) {
    var a = order[from], b = order[to];
    if (a === undefined) a = 0; if (b === undefined) b = a;
    var lo = Math.min(a, b), hi = Math.max(a, b), m = 0;
    for (var i = lo; i <= hi; i++) m |= (1 << i);
    return m;
  }

  // pontos de referência de cada ligação no mundo, dado um provedor de pose
  function linkGeom(scene, L, poseOf) {
    function W(partId, p) { if (!partId) return [p[0], p[1]]; var pose = poseOf(partId); return pose ? toWorld(pose, p) : [p[0], p[1]]; }
    function ang(partId, a) { if (!partId) return a; var pose = poseOf(partId); return (pose ? pose.a : 0) + a; }
    switch (L.type) {
      case 'screw': case 'axle': return { p: W(L.b, L.p) };
      case 'pin': case 'sensor': return { p: W(L.host, L.p) };
      case 'slider': {
        var p = W(L.b, L.p), a = ang(L.b, L.dir);
        return { p: p, a: a };
      }
      case 'spring': return { pa: W(L.a, L.pa), pb: W(L.b, L.pb) };
      case 'chamber': return { p: W(L.a, L.p), a: ang(L.a, L.dir) };
    }
    return {};
  }

  /* ---------- simulação ---------- */
  function build(scene) {
    var V = PL.Vec2;
    var st = scene.settings || {};
    var world = new PL.World({ gravity: V(0, st.gravity === false ? 0 : (st.g || 10)) });
    var ground = world.createBody();
    var order = layerOrder(scene);
    var parts = scene.parts.filter(function (p) { return order[p.layer] !== undefined; });
    var byId = {}; parts.forEach(function (p) { byId[p.id] = p; });
    var warnings = [];

    // grupos rígidos (parafusos)
    var parent = {}; parts.forEach(function (p) { parent[p.id] = p.id; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    var fixedRoot = {};
    scene.links.forEach(function (L) {
      if (L.type !== 'screw' || !byId[L.b]) return;
      if (L.a && byId[L.a]) { parent[find(L.a)] = find(L.b); }
      else if (!L.a) { fixedRoot[L.b] = true; }
    });
    var groups = {};
    parts.forEach(function (p) { var r = find(p.id); (groups[r] = groups[r] || []).push(p); });
    var bodyOf = {}, rel = {}, groupFixed = {};
    Object.keys(groups).forEach(function (r) {
      var g = groups[r], fixed = g.some(function (p) { return p.fixed || fixedRoot[p.id]; });
      var o = partPose(g[0]);
      var body = world.createBody({
        type: fixed ? 'static' : 'dynamic',
        position: V(o.x / S, o.y / S), angle: o.a,
        bullet: g.some(function (p) { return p.bullet; }),
        allowSleep: false, angularDamping: 0.02, linearDamping: 0.0
      });
      g.forEach(function (p) {
        var pose = partPose(p), mat = MATERIALS[p.material] || MATERIALS.aco;
        var bit = 1 << order[p.layer];
        var lp = toLocal(o, [pose.x, pose.y]);
        rel[p.id] = { x: lp[0], y: lp[1], a: pose.a - o.a };
        bodyOf[p.id] = body;
        shapePieces(p.shape).forEach(function (pc) {
          var shape;
          if (pc.type === 'circle') {
            var c = toLocal(o, toWorld(pose, pc.c));
            shape = new PL.Circle(V(c[0] / S, c[1] / S), pc.r / S);
          } else {
            shape = new PL.Polygon(pc.pts.map(function (q) { var w = toLocal(o, toWorld(pose, q)); return V(w[0] / S, w[1] / S); }));
          }
          var fx = body.createFixture(shape, { density: mat.density, friction: mat.friction, restitution: mat.restitution, filterCategoryBits: bit, filterMaskBits: bit });
          fx.setUserData({ part: p.id });
        });
      });
      if (!fixed && body.getMass() <= 0) body.setMassData({ mass: 1, center: V(0, 0), I: 1 });
      groupFixed[r] = fixed;
    });

    function poseOf(id) {
      var b = bodyOf[id], r = rel[id]; if (!b) return null;
      var p = b.getWorldPoint(V(r.x / S, r.y / S));
      return { x: p.x * S, y: p.y * S, a: b.getAngle() + r.a };
    }
    function designPose(id) { var p = byId[id]; return p ? partPose(p) : null; }
    function bodyFor(id) { return id && bodyOf[id] ? bodyOf[id] : ground; }

    var torsions = [], sliders = [], springs = [], chambers = [], sensors = {}, joints = {};

    scene.links.forEach(function (L) {
      var g = linkGeom(scene, L, designPose);
      if (L.type === 'axle') {
        if (!byId[L.b]) return;
        var A = bodyFor(L.a), B = bodyFor(L.b);
        if (A === B) { warnings.push('Eixo ligando peças já parafusadas entre si foi ignorado.'); return; }
        var j = world.createJoint(new PL.RevoluteJoint({
          enableLimit: !!L.limitOn, lowerAngle: (L.lower || 0) * PI / 180, upperAngle: (L.upper || 0) * PI / 180,
          enableMotor: !!L.motorOn, motorSpeed: (L.rpm || 0) * 2 * PI / 60, maxMotorTorque: L.torque || 0,
          collideConnected: false
        }, A, B, V(g.p[0] / S, g.p[1] / S)));
        joints[L.id] = j;
        if ((L.tk || 0) > 0 || (L.td || 0) > 0) torsions.push({ j: j, A: A, B: B, k: L.tk || 0, rest: (L.trest || 0) * PI / 180, c: L.td || 0 });
      } else if (L.type === 'slider') {
        if (!byId[L.b]) return;
        var A2 = bodyFor(L.a), B2 = bodyFor(L.b);
        if (A2 === B2) { warnings.push('Trilho entre peças parafusadas foi ignorado.'); return; }
        var ax = [Math.cos(g.a), Math.sin(g.a)];
        var j2 = world.createJoint(new PL.PrismaticJoint({
          enableLimit: true, lowerTranslation: -(L.back || 0) / S, upperTranslation: (L.travel || 0) / S, collideConnected: false
        }, A2, B2, V(g.p[0] / S, g.p[1] / S), V(ax[0], ax[1])));
        joints[L.id] = j2;
        if ((L.k || 0) > 0 || (L.damp || 0) > 0) sliders.push({ j: j2, A: A2, B: B2, axisA: A2.getLocalVector(V(ax[0], ax[1])), k: L.k || 0, rest: (L.rest || 0) / S, c: L.damp || 0 });
      } else if (L.type === 'spring') {
        var Aa = bodyFor(L.a), Bb = bodyFor(L.b);
        if (Aa === Bb) { warnings.push('Mola com as duas pontas na mesma peça foi ignorada.'); return; }
        var la = Aa.getLocalPoint(V(g.pa[0] / S, g.pa[1] / S)), lb = Bb.getLocalPoint(V(g.pb[0] / S, g.pb[1] / S));
        springs.push({ id: L.id, A: Aa, B: Bb, la: la, lb: lb, k: L.k || 0, c: L.damp || 0, L0: dist(g.pa, g.pb) / S * (L.free || 100) / 100 });
      } else if (L.type === 'chamber') {
        var Ac = bodyFor(L.a), Bc = L.b && bodyOf[L.b] ? bodyOf[L.b] : null;
        var axc = [Math.cos(g.a), Math.sin(g.a)];
        var ch = { id: L.id, A: Ac, B: Bc, base: Ac.getLocalPoint(V(g.p[0] / S, g.p[1] / S)), axis: Ac.getLocalVector(V(axc[0], axc[1])),
          vent: (L.vent || 200) / S, width: (L.width || 20) / S, charge: L.charge || 0, burn: (L.burn || 0) / 1000,
          gas: 0, t: 0, burning: false, fired: false, vented: false, P: 0, s: 0, rB: 0, exitSpeed: null, peakP: 0 };
        if (Bc) {
          // distância do centro do projétil até sua face traseira, ao longo do eixo
          var c0 = Bc.getWorldCenter(), mn = Infinity;
          for (var f = Bc.getFixtureList(); f; f = f.getNext()) {
            var sh = f.getShape();
            if (sh.getType() === 'circle') {
              var cc = Bc.getWorldPoint(sh.getCenter()), pr = (cc.x - c0.x) * axc[0] + (cc.y - c0.y) * axc[1] - sh.getRadius();
              mn = Math.min(mn, pr);
            } else {
              var vs = sh.m_vertices;
              for (var vi = 0; vi < sh.m_count; vi++) { var wv = Bc.getWorldPoint(vs[vi]); mn = Math.min(mn, (wv.x - c0.x) * axc[0] + (wv.y - c0.y) * axc[1]); }
            }
          }
          ch.rB = isFinite(mn) ? -mn : 0;
        }
        chambers.push(ch);
      }
    });
    // pinos e sensores (fixtures extras)
    scene.links.forEach(function (L) {
      if ((L.type !== 'pin' && L.type !== 'sensor') || !byId[L.host]) return;
      var host = byId[L.host], b = bodyOf[L.host], r = rel[L.host];
      var lp = rot(L.p, r.a); var c = [r.x + lp[0], r.y + lp[1]];
      var bits = bitsSpan(order, L.from || host.layer, L.to || host.layer);
      var fx = b.createFixture(new PL.Circle(V(c[0] / S, c[1] / S), (L.r || 5) / S), {
        density: L.type === 'pin' ? 7.8 : 0, friction: 0.2, restitution: 0.05,
        isSensor: L.type === 'sensor', filterCategoryBits: bits, filterMaskBits: bits
      });
      fx.setUserData(L.type === 'sensor' ? { sensor: L.id, part: L.host } : { pin: L.id, part: L.host });
      if (L.type === 'sensor') sensors[L.id] = { id: L.id, host: b, c: V(c[0] / S, c[1] / S), target: L.target || '', minSpeed: (L.minSpeed || 0) / S, lit: 0, count: 0 };
    });

    var fx = []; // efeitos visuais
    var pending = [];
    world.on('begin-contact', function (contact) {
      var fa = contact.getFixtureA(), fb = contact.getFixtureB();
      [[fa, fb], [fb, fa]].forEach(function (pair) {
        var u = pair[0].getUserData();
        if (!u || !u.sensor) return;
        var other = pair[1], ou = other.getUserData();
        if (ou && ou.sensor) return;
        var s = sensors[u.sensor]; if (!s) return;
        var wc = s.host.getWorldPoint(s.c);
        var v1 = other.getBody().getLinearVelocityFromWorldPoint(wc), v0 = s.host.getLinearVelocityFromWorldPoint(wc);
        var sp = Math.hypot(v1.x - v0.x, v1.y - v0.y);
        if (sp + 1e-6 >= s.minSpeed) pending.push(s.id);
      });
    });

    function ignite(ch) {
      if (!ch || ch.fired || !ch.B) return false;
      ch.fired = true; ch.burning = true; ch.t = 0;
      if (ch.burn <= 0) { ch.gas = ch.charge; ch.burning = false; }
      var base = ch.A.getWorldPoint(ch.base);
      fx.push({ type: 'ignite', x: base.x * S, y: base.y * S, t: 0 });
      return true;
    }

    var time = 0, mouse = null;

    function applyForces(h) {
      torsions.forEach(function (t) {
        var tau = -t.k * (t.j.getJointAngle() - t.rest) - t.c * t.j.getJointSpeed();
        if (t.B.isDynamic()) t.B.applyTorque(tau, true);
        if (t.A.isDynamic()) t.A.applyTorque(-tau, true);
      });
      sliders.forEach(function (s) {
        var F = -s.k * (s.j.getJointTranslation() - s.rest) - s.c * s.j.getJointSpeed();
        var ax = s.A.getWorldVector(s.axisA), f = V(ax.x * F, ax.y * F);
        if (s.B.isDynamic()) s.B.applyForce(f, s.B.getWorldCenter(), true);
        if (s.A.isDynamic()) s.A.applyForce(V(-f.x, -f.y), s.A.getWorldCenter(), true);
      });
      springs.forEach(function (s) {
        var pa = s.A.getWorldPoint(s.la), pb = s.B.getWorldPoint(s.lb);
        var dx = pb.x - pa.x, dy = pb.y - pa.y, L = Math.hypot(dx, dy) || 1e-6, nx = dx / L, ny = dy / L;
        var va = s.A.getLinearVelocityFromWorldPoint(pa), vb = s.B.getLinearVelocityFromWorldPoint(pb);
        var vr = (vb.x - va.x) * nx + (vb.y - va.y) * ny;
        var F = s.k * (L - s.L0) + s.c * vr;
        if (s.A.isDynamic()) s.A.applyForce(V(nx * F, ny * F), pa, true);
        if (s.B.isDynamic()) s.B.applyForce(V(-nx * F, -ny * F), pb, true);
        s.len = L;
      });
      chambers.forEach(function (ch) {
        if (!ch.B) return;
        var base = ch.A.getWorldPoint(ch.base), u = ch.A.getWorldVector(ch.axis);
        var c = ch.B.getWorldCenter(), rx = c.x - base.x, ry = c.y - base.y;
        var s = rx * u.x + ry * u.y - ch.rB, perp = Math.abs(rx * u.y - ry * u.x);
        ch.s = s;
        if (ch.burning) {
          var dtb = Math.min(h, ch.burn - ch.t);
          if (dtb > 0) ch.gas += ch.charge * dtb / ch.burn;
          ch.t += h; if (ch.t >= ch.burn) ch.burning = false;
        }
        var inBore = perp < ch.width / 2 + 0.15 && s > -0.3 && s < ch.vent;
        if (ch.fired && !ch.vented && !inBore) {
          ch.vented = true;
          var vB = ch.B.getLinearVelocity(); ch.exitSpeed = Math.hypot(vB.x, vB.y) * S;
          if (ch.gas > ch.charge * 0.03) {
            var m = V(base.x + u.x * ch.vent, base.y + u.y * ch.vent);
            fx.push({ type: 'flash', x: m.x * S, y: m.y * S, a: Math.atan2(u.y, u.x), t: 0, k: Math.min(1, ch.gas / Math.max(1, ch.charge)) });
          }
        }
        if (ch.vented) ch.gas *= Math.exp(-h / 0.004);
        ch.gas *= Math.exp(-h / 1.5);
        var Lc = Math.max(s, 0.05);
        ch.P = ch.gas / (Lc * ch.width);
        ch.peakP = Math.max(ch.peakP, ch.P);
        if (!ch.vented && ch.gas > 1e-4) {
          var F = ch.gas / Lc;
          ch.B.applyForce(V(u.x * F, u.y * F), c, true);
          if (ch.A.isDynamic()) ch.A.applyForce(V(-u.x * F, -u.y * F), base, true);
        }
      });
    }

    function step(dt) {
      var n = Math.max(2, Math.ceil(dt / (1 / 240) - 1e-6)), h = dt / n;
      for (var i = 0; i < n; i++) {
        applyForces(h);
        world.step(h, 10, 4);
        time += h;
        while (pending.length) {
          var sid = pending.shift(), s = sensors[sid];
          s.lit = 0.35; s.count++;
          if (s.target) { var ch = chambers.filter(function (c) { return c.id === s.target; })[0]; ignite(ch); }
        }
      }
      Object.keys(sensors).forEach(function (k) { sensors[k].lit = Math.max(0, sensors[k].lit - dt); });
      fx.forEach(function (e) { e.t += dt; });
      for (var k = fx.length - 1; k >= 0; k--) if (fx[k].t > 0.6) fx.splice(k, 1);
    }

    function grab(pt, allow) {
      var P = V(pt[0] / S, pt[1] / S), best = null, bestLayer = -1;
      for (var b = world.getBodyList(); b; b = b.getNext()) {
        if (!b.isDynamic()) continue;
        for (var f = b.getFixtureList(); f; f = f.getNext()) {
          var u = f.getUserData(); if (!u || u.sensor) continue;
          var part = byId[u.part]; if (!part || (allow && !allow(part.id))) continue;
          var lyr = order[part.layer];
          if (f.testPoint(P) && lyr > bestLayer) { best = { body: b, part: part.id }; bestLayer = lyr; }
        }
      }
      if (!best) return null;
      var m = best.body.getMass();
      mouse = world.createJoint(new PL.MouseJoint({ maxForce: 600 * m + 400, frequencyHz: 6, dampingRatio: 0.9 }, ground, best.body, P));
      return best.part;
    }
    function drag(pt) { if (mouse) mouse.setTarget(V(pt[0] / S, pt[1] / S)); }
    function release() { if (mouse) { world.destroyJoint(mouse); mouse = null; } }

    return {
      world: world, poseOf: poseOf, step: step, grab: grab, drag: drag, release: release, warnings: warnings,
      chambers: chambers, sensors: sensors, springs: springs, joints: joints, fx: fx,
      ignite: function (id) { return ignite(chambers.filter(function (c) { return c.id === id; })[0]); },
      time: function () { return time; },
      mouseTarget: function () { if (!mouse) return null; var t = mouse.getTarget(), a = mouse.getAnchorB(); return { t: [t.x * S, t.y * S], a: [a.x * S, a.y * S] }; },
      chamberState: function (id) { return chambers.filter(function (c) { return c.id === id; })[0] || null; },
      bodyOf: bodyOf
    };
  }

  /* ---------- exemplos ---------- */
  function Maker() {
    var sc = { version: 1, nextId: 1, layers: [], parts: [], links: [], settings: { gravity: true, g: 10, snap: true } };
    function id(pfx) { return pfx + (sc.nextId++); }
    return {
      scene: sc,
      layer: function (name) { var L = { id: id('L'), name: name, visible: true }; sc.layers.push(L); return L.id; },
      poly: function (name, layer, pts, o) {
        var c = centroid(pts);
        var p = Object.assign({ id: id('p'), name: name, layer: layer, x: c[0], y: c[1], angle: 0, fixed: false, material: 'aco', bullet: false,
          shape: { type: 'poly', pts: pts.map(function (q) { return [q[0] - c[0], q[1] - c[1]]; }) } }, o || {});
        sc.parts.push(p); return p;
      },
      rect: function (name, layer, x1, y1, x2, y2, o) { return this.poly(name, layer, [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], o); },
      circle: function (name, layer, cx, cy, r, o) {
        var p = Object.assign({ id: id('p'), name: name, layer: layer, x: cx, y: cy, angle: 0, fixed: false, material: 'aco', bullet: false, shape: { type: 'circle', r: r } }, o || {});
        sc.parts.push(p); return p;
      },
      gear: function (name, layer, cx, cy, r, teeth, o, style) {
        var p = Object.assign({ id: id('p'), name: name, layer: layer, x: cx, y: cy, angle: 0, fixed: false, material: 'aco', bullet: false,
          shape: { type: 'gear', r: r, teeth: teeth, depth: 2 * PI * r / teeth * 0.5, style: style || 'reto' } }, o || {});
        sc.parts.push(p); return p;
      },
      link: function (L) { L.id = id('k'); sc.links.push(L); return L; },
      local: function (part, w) { return part ? toLocal(partPose(part), w) : [w[0], w[1]]; }
    };
  }

  function exampleLauncher() {
    var m = Maker();
    var L1 = m.layer('Corpo'), L2 = m.layer('Cano e percussor'), L3 = m.layer('Retém'), L4 = m.layer('Gatilho');
    var frame = m.poly('Corpo', L1, [[70, 192], [720, 192], [720, 268], [296, 268], [292, 300], [272, 300], [282, 440], [206, 440], [192, 268], [70, 268]], { fixed: true, material: 'aluminio' });
    m.poly('Guarda', L1, [[296, 300], [384, 300], [392, 312], [390, 372], [376, 386], [300, 386], [300, 372], [372, 372], [378, 362], [378, 314], [296, 314]], { fixed: true, material: 'aluminio' });
    m.rect('Parede superior', L2, 300, 208, 712, 218, { fixed: true });
    m.rect('Parede inferior', L2, 300, 242, 712, 252, { fixed: true });
    var breech = m.rect('Culatra', L2, 288, 208, 300, 252, { fixed: true });
    var ball = m.circle('Esfera', L2, 313, 231, 10, { bullet: true });
    var striker = m.rect('Percussor', L2, 132, 224, 232, 236, { material: 'aco' });
    var sear = m.poly('Retém', L3, [[229, 233], [241, 233], [241, 250], [318, 250], [318, 270], [229, 270]], { material: 'aco' });
    var trig = m.poly('Gatilho', L4, [[299, 270], [312, 268], [346, 280], [350, 294], [344, 324], [352, 354], [342, 362], [330, 330], [328, 298], [299, 282]], { material: 'polimero' });

    var ch = m.link({ type: 'chamber', a: breech.id, b: ball.id, p: m.local(breech, [300, 230]), dir: 0, vent: 412, width: 24, charge: 150, burn: 2 });
    m.link({ type: 'sensor', host: breech.id, p: m.local(breech, [284, 230]), r: 5, from: L2, to: L2, target: ch.id, minSpeed: 100 });
    m.link({ type: 'slider', a: frame.id, b: striker.id, p: m.local(striker, [182, 230]), dir: 0, travel: 54, back: 2, k: 0, rest: 0, damp: 0 });
    m.link({ type: 'spring', a: frame.id, b: striker.id, pa: m.local(frame, [84, 230]), pb: m.local(striker, [132, 230]), k: 260, damp: 2, free: 260 });
    m.link({ type: 'pin', host: striker.id, p: m.local(striker, [222, 238]), r: 5, from: L2, to: L3 });
    m.link({ type: 'axle', a: frame.id, b: sear.id, p: m.local(sear, [276, 262]), limitOn: true, lower: -24, upper: 0, motorOn: false, rpm: 0, torque: 0, tk: 6, trest: 8, td: 0.05 });
    m.link({ type: 'axle', a: frame.id, b: trig.id, p: m.local(trig, [330, 290]), limitOn: true, lower: -2, upper: 26, motorOn: false, rpm: 0, torque: 0, tk: 5, trest: -8, td: 0.05 });
    m.link({ type: 'pin', host: trig.id, p: m.local(trig, [306, 276]), r: 5, from: L3, to: L4 });
    var sc = m.scene; sc.title = 'Lançador de esfera';
    return sc;
  }

  function exampleLatch() {
    var m = Maker();
    var L1 = m.layer('Porta'), L2 = m.layer('Lingueta e batente'), L3 = m.layer('Maçaneta');
    var door = m.rect('Porta', L1, 90, 150, 470, 350, { fixed: true, material: 'madeira' });
    m.rect('Batente superior', L2, 470, 150, 530, 230, { fixed: true, material: 'madeira' });
    m.rect('Batente inferior', L2, 470, 270, 530, 350, { fixed: true, material: 'madeira' });
    m.rect('Fundo do batente', L2, 512, 230, 530, 270, { fixed: true, material: 'madeira' });
    var bolt = m.poly('Lingueta', L2, [[372, 236], [486, 236], [500, 252], [500, 264], [372, 264]], { material: 'latao' });
    var handle = m.poly('Maçaneta', L3, [[393, 232], [403, 232], [406, 322], [398, 332], [230, 342], [226, 326], [390, 312]], { material: 'polimero' });
    m.link({ type: 'slider', a: door.id, b: bolt.id, p: m.local(bolt, [430, 250]), dir: PI, travel: 70, back: 0, k: 120, rest: -12, damp: 1 });
    m.link({ type: 'pin', host: bolt.id, p: m.local(bolt, [385, 252]), r: 4, from: L2, to: L3 });
    m.link({ type: 'axle', a: door.id, b: handle.id, p: m.local(handle, [398, 318]), limitOn: true, lower: -30, upper: 0, motorOn: false, rpm: 0, torque: 0, tk: 120, trest: 20, td: 0.5 });
    var sc = m.scene; sc.title = 'Trava de porta';
    return sc;
  }

  function exampleGears() {
    var m = Maker();
    var L1 = m.layer('Placa'), L2 = m.layer('Engrenagens'), L3 = m.layer('Catraca');
    var plate = m.rect('Placa', L1, 60, 90, 640, 430, { fixed: true, material: 'aluminio' });
    var pitch = 16;
    var r1 = 24 * pitch / (2 * PI), r2 = 16 * pitch / (2 * PI), r3 = 12 * pitch / (2 * PI);
    var c1 = [170, 260], c2 = [170 + r1 + r2, 260], c3 = [c2[0] + r2 + r3, 260];
    var g1 = m.gear('Motora', L2, c1[0], c1[1], r1, 24, { material: 'latao' });
    var g2 = m.gear('Intermediária', L2, c2[0], c2[1], r2, 16, { material: 'aco' });
    var g3 = m.gear('Pinhão', L2, c3[0], c3[1], r3, 12, { material: 'aco' });
    // alinhar fase: dente de uma no vão da outra
    g2.angle = PI / 16; g3.angle = 0;
    var rat = m.gear('Roda da catraca', L3, c3[0], c3[1], 52, 14, { material: 'aco' }, 'serra');
    var pawlPivot = [c3[0] + 30, c3[1] - 92];
    var pawl = m.poly('Lingueta', L3, [[pawlPivot[0] - 8, pawlPivot[1] - 8], [pawlPivot[0] + 8, pawlPivot[1] - 8], [pawlPivot[0] + 6, pawlPivot[1] + 10], [c3[0] - 4, c3[1] - 52], [c3[0] - 2, c3[1] - 62], [pawlPivot[0] - 8, pawlPivot[1] + 8]], { material: 'aco' });
    m.link({ type: 'axle', a: plate.id, b: g1.id, p: [0, 0], motorOn: true, rpm: -12, torque: 400, limitOn: false, lower: 0, upper: 0, tk: 0, trest: 0, td: 0 });
    m.link({ type: 'axle', a: plate.id, b: g2.id, p: [0, 0], motorOn: false, rpm: 0, torque: 0, limitOn: false, lower: 0, upper: 0, tk: 0, trest: 0, td: 0.02 });
    m.link({ type: 'screw', a: g3.id, b: rat.id, p: [0, 0] });
    m.link({ type: 'axle', a: plate.id, b: rat.id, p: [0, 0], motorOn: false, rpm: 0, torque: 0, limitOn: false, lower: 0, upper: 0, tk: 0, trest: 0, td: 0.02 });
    m.link({ type: 'axle', a: plate.id, b: pawl.id, p: m.local(pawl, pawlPivot), motorOn: false, rpm: 0, torque: 0, limitOn: true, lower: -25, upper: 25, tk: 3, trest: 0, td: 0.02 });
    var sc = m.scene; sc.title = 'Engrenagens e catraca'; sc.settings.gravity = false;
    return sc;
  }

  var Engine = {
    S: S, MATERIALS: MATERIALS, build: build, linkGeom: linkGeom, shapeOutline: shapeOutline, shapeRadius: shapeRadius, hitShape: hitShape,
    gearProfile: gearProfile, toWorld: toWorld, toLocal: toLocal, partPose: partPose, centroid: centroid, signedArea: signedArea, simplify: simplify,
    pointInPoly: pointInPoly, convexHull: convexHull, layerOrder: layerOrder, findPart: findPart, findLink: findLink, dist: dist, rot: rot,
    examples: { lancador: exampleLauncher, trava: exampleLatch, engrenagens: exampleGears }, polyPieces: polyPieces
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine; else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
