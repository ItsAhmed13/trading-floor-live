/* The Trading Floor as a starship (owner, 2026-10-12). Every agent is a superhero footballer with a home room:
   one pod per swing pair on the FX Orbital Ring around the Swing Judge's Tribunal, one pod per EGX sector on the
   Nile Ring around the High Court pyramid, plus the Bridge, Macro Core, Comms Array, Order Bay, Strategy Lab,
   the Reactor (the AI budget) and the Engines (the 15-minute heartbeat: they go cold when the laptop stops).
   Agents walk the corridors to visit related rooms, and to their judge's chamber when their desk meets.
   Pure canvas, no libraries, no assets.
   API: Office.init(canvas, onSelect), setData(F), replay(kind), busy(), advance(seconds, dt),
        view(target), zoomBy(factor), rooms(), tour(on), attachFullscreen(stage, button). */
(function () {
  "use strict";

  // ------------------------------------------------------------------ palette and helpers
  const NEON = { cyan: "#19e6ff", magenta: "#ff2bd6", violet: "#9b5cff", mint: "#2ff3d0", pink: "#ff4f9a",
                 amber: "#ffd166", ink: "#e2f7ff", dim: "#7f8bb3", void: "#02030a", gold: "#ffd34d", line: "#05070f" };
  const FONT = "ui-monospace, 'Cascadia Mono', Consolas, monospace";
  const DISPLAY = "'Orbitron', 'Segoe UI', system-ui, sans-serif";
  const TAU = Math.PI * 2, D2R = Math.PI / 180;

  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function rgbOf(hex) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.replace(/./g, "$&$&");
    const n = parseInt(h, 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function hexA(hex, a) { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; }
  function shade(hex, f) {               // f < 0 darkens, f > 0 blends toward white
    const [r, g, b] = rgbOf(hex), k = f < 0 ? 1 + f : 1 - f, add = f < 0 ? 0 : 255 * f;
    return `rgb(${(r * k + add) | 0},${(g * k + add) | 0},${(b * k + add) | 0})`;
  }
  function segDist(cx, cy, p, q) {
    const dx = q[0] - p[0], dy = q[1] - p[1], L = dx * dx + dy * dy || 1;
    const t = clamp(((cx - p[0]) * dx + (cy - p[1]) * dy) / L, 0, 1);
    return Math.hypot(p[0] + t * dx - cx, p[1] + t * dy - cy);
  }

  // ------------------------------------------------------------------ the ship's layout (world units)
  const FXR = { cx: 1420, cy: 880, hub: 230, r0: 400, r1: 460, R: 640, pw: 200, ph: 156, seat: 150, disc: 770 };
  const NIL = { cx: 3000, cy: 880, island: 250, r0: 340, r1: 412, R: 560, pw: 250, ph: 180, seat: 168, disc: 745 };
  const SPINE_Y = 880;
  const BOUNDS = { x: -80, y: 80, w: 4500, h: 1600 };
  const CS = 0.62;              // people are drawn at 62% of the furniture's scale: big rooms, people-sized people
  const PEOPLE_PX = 46;         // how tall a person stands on screen at the normal (tour) zoom: rooms as big as the old office's

  const CCY = {
    USD: { a: "#1f3f99", b: "#d22d3d", c: "#ffffff", g: "$" },
    EUR: { a: "#123fae", b: "#ffcc00", c: "#ffffff", g: "€" },
    GBP: { a: "#c8102e", b: "#1d2f8f", c: "#ffffff", g: "£" },
    JPY: { a: "#f2f2f2", b: "#bc002d", c: "#bc002d", g: "¥" },
    AUD: { a: "#00843d", b: "#ffcd00", c: "#012169", g: "A$" },
    NZD: { a: "#111111", b: "#c0c0c0", c: "#00247d", g: "NZ$" },
    CAD: { a: "#d52b1e", b: "#ffffff", c: "#d52b1e", g: "C$" },
    CHF: { a: "#d52b1e", b: "#ffffff", c: "#ffffff", g: "Fr" },
    BTC: { a: "#f7931a", b: "#1a1a1a", c: "#ffffff", g: "₿" },
    XAU: { a: "#d4af37", b: "#5c3d0a", c: "#fff3c4", g: "Au" },
  };
  const PAIRS = {
    EURUSD: ["EUR", "USD"], GBPUSD: ["GBP", "USD"], USDJPY: ["USD", "JPY"], AUDUSD: ["AUD", "USD"], NZDUSD: ["NZD", "USD"],
    USDCAD: ["USD", "CAD"], EURGBP: ["EUR", "GBP"], EURJPY: ["EUR", "JPY"], GBPJPY: ["GBP", "JPY"],
    AUDJPY: ["AUD", "JPY"], BTCUSD: ["BTC", "USD"], GOLD: ["XAU", "USD"],
  };
  const PAIR_GLOW = {
    EURUSD: "#4d84ff", GBPUSD: "#ff4d6a", USDJPY: "#ff3f8e", AUDUSD: "#2fe08a", NZDUSD: "#c9d4e6", USDCAD: "#ff6a3d",
    EURGBP: "#8a7bff", EURJPY: "#5ab0ff", GBPJPY: "#ff5fc8", AUDJPY: "#3ff0c0", BTCUSD: "#ffa31a", GOLD: "#ffd34d",
  };
  const FX_UPPER = ["GOLD", "BTCUSD", "EURUSD", "GBPUSD", "USDJPY", "USDCAD"];   // -166 to -14 degrees (USDCHF removed 18 Oct)
  const FX_LOWER = ["AUDUSD", "NZDUSD", "AUDJPY", "EURJPY", "GBPJPY", "EURGBP"];           // 18 to 162 degrees
  // [angle, room id, analyst, label, short label, glow, kit, kit 2]
  const SECTORS = [
    [247.5, "banks", "egx_banks", "BANKS", "BANKS", "#19d48f", "#0f6b4f", "#d4af37"],
    [292.5, "nbfi", "egx_nbfi", "NON-BANK FINANCE", "NBFI", "#a07bff", "#4b2a7b", "#c0c0c0"],
    [337.5, "realestate", "egx_realestate", "REAL ESTATE", "PROPERTY", "#e8a85c", "#c9a26b", "#7a3b22"],
    [22.5, "materials", "egx_materials", "MATERIALS & ENERGY", "MATERIALS", "#ff8a3d", "#5a6270", "#ff7a1a"],
    [67.5, "industrials", "egx_industrials", "INDUSTRIALS", "INDUSTRY", "#ffd21f", "#ffcc00", "#111111"],
    [112.5, "consumer", "egx_consumer", "CONSUMER", "CONSUMER", "#ff5fa2", "#ff4f9a", "#2ff3d0"],
    [157.5, "tmt", "egx_tmt", "TECH, MEDIA & TELECOM", "TMT", "#4d8bff", "#0047ff", "#b6ff00"],
    [202.5, "observatory", null, "NILE OBSERVATORY", "OBSERVATORY", "#3fb6ff", "#0b2a4a", "#ffd34d"],
  ];

  const ROOMS = {}, ROOM_LIST = [];
  function addRoom(r) { r.doors = r.doors || []; ROOMS[r.id] = r; ROOM_LIST.push(r); return r; }
  function podRect(cx, cy, R, deg, pw, ph) {
    const a = deg * D2R, px = cx + R * Math.cos(a), py = cy + R * Math.sin(a);
    return { x: px - pw / 2, y: py - ph / 2, w: pw, h: ph, px, py };
  }
  // The pod's door: where the line from the ring's centre to the pod's centre crosses the pod's wall.
  function podDoor(p, cx, cy) {
    const dx = cx - p.px, dy = cy - p.py, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const tx = Math.abs(ux) > 1e-6 ? (p.w / 2) / Math.abs(ux) : 1e9, ty = Math.abs(uy) > 1e-6 ? (p.h / 2) / Math.abs(uy) : 1e9;
    const t = Math.min(tx, ty);
    return { x: p.px + ux * t, y: p.py + uy * t, side: tx < ty ? (ux < 0 ? "left" : "right") : (uy < 0 ? "top" : "bottom") };
  }
  function podWalk(r) {
    const m = { left: [40, 46, 20, 18], right: [20, 46, 40, 18], top: [22, 52, 22, 18], bottom: [22, 46, 22, 30] }[r.door.side];
    return [r.x + m[0], r.y + m[1], r.x + r.w - m[2], r.y + r.h - m[3]];
  }

  const fxAngle = {};
  FX_UPPER.forEach((p, k) => { fxAngle[p] = -166 + k * 152 / (FX_UPPER.length - 1); });
  FX_LOWER.forEach((p, k) => { fxAngle[p] = 18 + k * 144 / (FX_LOWER.length - 1); });
  for (const [p, deg] of Object.entries(fxAngle)) {
    const [b, q] = PAIRS[p], r = podRect(FXR.cx, FXR.cy, FXR.R, deg, FXR.pw, FXR.ph);
    const room = addRoom({ id: p, kind: "pair", ring: "fx", deg, ...r, base: b, quote: q, accent: PAIR_GLOW[p],
      label: p === "GOLD" ? "GOLD / USD" : p.slice(0, 3) + " / " + p.slice(3), short: p === "GOLD" ? "GOLD" : p.slice(0, 3) + "/" + p.slice(3) });
    room.door = podDoor(r, FXR.cx, FXR.cy);
    room.walk = podWalk(room);
  }
  for (const [deg, id, analyst, label, short, glow, k1, k2] of SECTORS) {
    const r = podRect(NIL.cx, NIL.cy, NIL.R, deg, NIL.pw, NIL.ph);
    const room = addRoom({ id, kind: id === "observatory" ? "observatory" : "sector", ring: "nile", deg, ...r, analyst,
      label, short, accent: glow, kit: k1, kit2: k2 });
    room.door = podDoor(r, NIL.cx, NIL.cy);
    room.walk = podWalk(room);
  }
  addRoom({ id: "tribunal", kind: "tribunal", label: "FX TRIBUNAL · SWING JUDGE", short: "TRIBUNAL", shape: "circle",
            cx: FXR.cx, cy: FXR.cy, r: FXR.hub, x: FXR.cx - FXR.hub, y: FXR.cy - FXR.hub, w: 2 * FXR.hub, h: 2 * FXR.hub, accent: NEON.violet });
  addRoom({ id: "court", kind: "court", label: "EGX HIGH COURT · PORTFOLIO JUDGE", short: "HIGH COURT", shape: "circle",
            cx: NIL.cx, cy: NIL.cy, r: NIL.island, x: NIL.cx - NIL.island, y: NIL.cy - NIL.island, w: 2 * NIL.island, h: 2 * NIL.island, accent: NEON.gold });
  addRoom({ id: "macro", kind: "macro", label: "MACRO CORE · DOLLAR, CHARTS, RISK", short: "MACRO", x: 2060, y: 150, w: 420, h: 320,
            accent: NEON.mint, door: { x: 2270, y: 470, side: "bottom" }, walk: [2090, 200, 2450, 445] });
  addRoom({ id: "comms", kind: "comms", label: "COMMS ARRAY · NEWS DESK", short: "COMMS", x: 2060, y: 1290, w: 420, h: 320,
            accent: NEON.cyan, door: { x: 2270, y: 1290, side: "top" }, walk: [2090, 1325, 2450, 1585] });
  addRoom({ id: "bridge", kind: "bridge", label: "BRIDGE · DIRECTOR", short: "BRIDGE", shape: "poly",
            pts: [[3760, 660], [4080, 660], [4330, 880], [4080, 1100], [3760, 1100]], x: 3760, y: 660, w: 570, h: 440,
            accent: "#7aa2ff", door: { x: 3760, y: 880, side: "left" }, walk: [3800, 840, 4030, 1060] });
  const TAIL = [["engineA", "engine", "ENGINE · PORT", "ENGINE", 150, 230, "#ff7a3d"],
                ["orders", "orders", "ORDER BAY · EGX CARGO", "CARGO", 410, 290, "#ffb020"],
                ["reactor", "reactor", "REACTOR · AI BUDGET", "REACTOR", 730, 300, NEON.cyan],
                ["lab", "lab", "STRATEGY LAB", "LAB", 1060, 290, NEON.violet],
                ["engineB", "engine", "ENGINE · STARBOARD", "ENGINE", 1380, 230, "#ff7a3d"]];
  for (const [id, kind, label, short, y, h, accent] of TAIL) {
    addRoom({ id, kind, label, short, x: 110, y, w: 450, h, accent, door: { x: 560, y: y + h / 2, side: "right" },
              walk: [150, y + 44, 520, y + h - 26] });
  }

  // ------------------------------------------------------------------ corridors: a small graph walked with Dijkstra
  const NODES = {}, ADJ = {};
  function node(id, x, y) { NODES[id] = { id, x, y }; ADJ[id] = ADJ[id] || []; return id; }
  function link(a, b, arc) {
    const A = NODES[a], B = NODES[b];
    const len = arc ? arc.r * Math.abs(arc.a1 - arc.a0) : Math.hypot(A.x - B.x, A.y - B.y);
    ADJ[a].push({ to: b, len, arc });
    ADJ[b].push({ to: a, len, arc: arc && { ...arc, a0: arc.a1, a1: arc.a0 } });
  }
  const norm = d => Math.round((((d % 360) + 360) % 360) * 1000) / 1000;
  function ring(prefix, cx, cy, rm, degs) {
    const list = [...new Set(degs.map(norm))].sort((a, b) => a - b);
    list.forEach(d => node(`${prefix}@${d}`, cx + rm * Math.cos(d * D2R), cy + rm * Math.sin(d * D2R)));
    list.forEach((d, i) => {
      const e = list[(i + 1) % list.length], e2 = i === list.length - 1 ? e + 360 : e;
      link(`${prefix}@${d}`, `${prefix}@${e}`, { cx, cy, r: rm, a0: d * D2R, a1: e2 * D2R });
    });
    return d => `${prefix}@${norm(d)}`;
  }
  const fxAt = ring("fx", FXR.cx, FXR.cy, (FXR.r0 + FXR.r1) / 2, [...Object.values(fxAngle), 0, 90, 180, 270]);
  const nileAt = ring("nile", NIL.cx, NIL.cy, (NIL.r0 + NIL.r1) / 2, [...SECTORS.map(s => s[0]), 0, 90, 180]);
  for (const d of [0, 90, 180, 270]) {                                  // the Tribunal's four spokes
    const id = node(`tribunal@${d}`, FXR.cx + FXR.hub * Math.cos(d * D2R), FXR.cy + FXR.hub * Math.sin(d * D2R));
    link(fxAt(d), id); ROOMS.tribunal.doors.push(id);
  }
  for (const d of [0, 90, 180]) {                                       // three bridges over the moat (the pyramid is north)
    const id = node(`court@${d}`, NIL.cx + NIL.island * Math.cos(d * D2R), NIL.cy + NIL.island * Math.sin(d * D2R));
    link(nileAt(d), id); ROOMS.court.doors.push(id);
  }
  for (const r of ROOM_LIST) {
    if (r.kind !== "pair" && r.kind !== "sector" && r.kind !== "observatory") continue;
    const id = node(`door:${r.id}`, r.door.x, r.door.y);
    link(r.ring === "fx" ? fxAt(r.deg) : nileAt(r.deg), id);
    r.doors.push(id);
  }
  node("tail@880", 620, SPINE_Y);
  link("tail@880", fxAt(180));
  node("mid", 2270, SPINE_Y);
  link(fxAt(0), "mid"); link("mid", nileAt(180));
  for (const id of ["macro", "comms", "bridge"]) {
    const r = ROOMS[id], n = node(`door:${id}`, r.door.x, r.door.y);
    link(id === "bridge" ? nileAt(0) : "mid", n); r.doors.push(n);
  }
  let prevTail = null;
  for (const [id] of TAIL) {
    const r = ROOMS[id], y = r.door.y, t = y === SPINE_Y ? "tail@880" : node(`tail@${y}`, 620, y), n = node(`door:${id}`, r.door.x, y);
    link(t, n); r.doors.push(n);
    if (prevTail) link(prevTail, t);
    prevTail = t;
  }

  const DIJ = {};
  function dijkstra(src) {
    if (DIJ[src]) return DIJ[src];
    const dist = {}, prev = {}, done = new Set();
    for (const k in NODES) dist[k] = Infinity;
    dist[src] = 0;
    for (;;) {
      let u = null, best = Infinity;
      for (const k in dist) if (!done.has(k) && dist[k] < best) { best = dist[k]; u = k; }
      if (u === null) break;
      done.add(u);
      for (const e of ADJ[u]) {
        const nd = best + e.len;
        if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = { from: u, edge: e }; }
      }
    }
    return (DIJ[src] = { dist, prev });
  }
  function expandEdge(e, out) {
    if (!e.arc) { const B = NODES[e.to]; out.push([B.x, B.y]); return; }
    const { cx, cy, r, a0, a1 } = e.arc, n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (7 * D2R)));
    for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  }
  const PYRAMID = { l: NIL.cx - 150, r: NIL.cx + 150, base: NIL.cy + 6, apex: NIL.cy - 196 };
  function inPyramid(x, y) {
    if (y > PYRAMID.base + 6 || y < PYRAMID.apex) return false;
    const half = 156 * (y - PYRAMID.apex) / (PYRAMID.base - PYRAMID.apex);
    return Math.abs(x - NIL.cx) < half;
  }
  // A walk inside one room. The Tribunal's podium and the court's pyramid are walked around, never through.
  function inner(roomId, p, q) {
    const r = ROOMS[roomId];
    if (r.kind === "tribunal" && segDist(r.cx, r.cy, p, q) < 82) return viaArc(r, p, q, FXR.seat, false);
    if (r.kind === "court") {
      for (let i = 1; i < 10; i++) {
        const t = i / 10;
        if (inPyramid(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)) return viaArc(r, p, q, NIL.seat, true);
      }
    }
    return [q];
  }
  function viaArc(r, p, q, rad, front) {
    let a = Math.atan2(p[1] - r.cy, p[0] - r.cx), b = Math.atan2(q[1] - r.cy, q[0] - r.cx);
    if (front) {                                   // the court's front half: angles 12 to 168 degrees (south)
      const fix = x => { x = (x + TAU) % TAU; return x > Math.PI * 1.5 ? 12 * D2R : clamp(x, 12 * D2R, 168 * D2R); };
      a = fix(a); b = fix(b);
    } else {
      let d = b - a;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      b = a + d;
    }
    const pts = [[r.cx + rad * Math.cos(a), r.cy + rad * Math.sin(a)]], n = Math.ceil(Math.abs(b - a) / (9 * D2R));
    for (let i = 1; i <= n; i++) { const t = a + (b - a) * i / n; pts.push([r.cx + rad * Math.cos(t), r.cy + rad * Math.sin(t)]); }
    pts.push(q);
    return pts;
  }
  // From a point in one room to a point in another: the cheapest door pair, then the corridors in between.
  function route(fromRoom, p, toRoom, q) {
    if (fromRoom === toRoom) return inner(fromRoom, p, q);
    const A = ROOMS[fromRoom], B = ROOMS[toRoom];
    let best = null;
    for (const da of A.doors) {
      const D = dijkstra(da), pa = NODES[da];
      for (const db of B.doors) {
        const pb = NODES[db], cost = Math.hypot(p[0] - pa.x, p[1] - pa.y) + D.dist[db] + Math.hypot(q[0] - pb.x, q[1] - pb.y);
        if (!best || cost < best.cost) best = { cost, da, db, D };
      }
    }
    if (!best || !isFinite(best.cost)) return [q];
    const edges = [];
    for (let n = best.db; n !== best.da; n = best.D.prev[n].from) edges.unshift(best.D.prev[n].edge);
    const pa = NODES[best.da], pts = inner(fromRoom, p, [pa.x, pa.y]);
    for (const e of edges) expandEdge(e, pts);
    const pb = NODES[best.db];
    return pts.concat(inner(toRoom, [pb.x, pb.y], q));
  }
  function randomPoint(roomId) {
    const r = ROOMS[roomId];
    if (r.kind === "tribunal") { const a = rnd(0, TAU), d = rnd(92, 196); return [r.cx + d * Math.cos(a), r.cy + d * Math.sin(a)]; }
    if (r.kind === "court") { const a = rnd(16, 164) * D2R, d = rnd(70, 206); return [r.cx + d * Math.cos(a), r.cy + 16 + d * Math.sin(a)]; }
    const w = r.walk;
    return [rnd(w[0], w[2]), rnd(w[1], w[3])];
  }
  function roomAt(x, y) {
    for (const r of ROOM_LIST) {
      if (r.shape === "circle") { if (Math.hypot(x - r.cx, y - r.cy) <= r.r) return r; }
      else if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  }

  // ------------------------------------------------------------------ the cast: superhero footballers
  // kit/kit2 shirt colours, pat shirt pattern, cape/cloak behind, head = hair style or headgear, emblem on the chest.
  const SKIN = ["#f6d2b3", "#e8b896", "#c99470", "#a8714a", "#7d4f32", "#5c3a24"];
  const SPEC = {
    sw_usd: { kit: "#1f3f99", kit2: "#ffffff", pat: "stars", shorts: "#f2f2f2", socks: "#d22d3d", boots: "#ffd34d", cape: "#d22d3d", lining: "#1f3f99", emblem: "$", head: "winged", hair: "short", hairC: "#3b2618", skin: 2, num: 10 },
    sw_eur: { kit: "#123fae", kit2: "#ffcc00", pat: "ringstars", shorts: "#0b2a7a", socks: "#ffcc00", boots: "#19e6ff", cape: "#ffcc00", lining: "#123fae", emblem: "€", head: "mask", maskC: "#ffcc00", hair: "quiff", hairC: "#d9a441", skin: 0, num: 7 },
    sw_gbp: { kit: "#ffffff", kit2: "#c8102e", pat: "cross", shorts: "#1d2f8f", socks: "#c8102e", boots: "#ff2bd6", cape: "#c8102e", lining: "#1d2f8f", emblem: "£", head: "circlet", hair: "long", hairC: "#a0522d", skin: 4, num: 9 },
    sw_jpy: { kit: "#f4f4f4", kit2: "#bc002d", pat: "sun", shorts: "#1a1a1a", socks: "#bc002d", boots: "#ffffff", scarf: "#bc002d", emblem: "¥", emblemC: "#ffffff", hair: "topknot", hairC: "#111111", katana: true, skin: 1, num: 11 },
    sw_anz: { kit: "#00843d", kit2: "#ffcd00", pat: "hoops", shorts: "#111111", socks: "#ffcd00", boots: "#2ff3d0", cape: "#111111", lining: "#c0c0c0", emblem: "cross5", head: "headband", headC: "#ffcd00", hair: "curly", hairC: "#2b1d14", skin: 3, num: 8 },
    sw_cad: { kit: "#d52b1e", kit2: "#ffffff", pat: "panel", shorts: "#ffffff", socks: "#d52b1e", boots: "#111111", emblem: "leaf", head: "hockey", hair: "fade", hairC: "#5a3a22", skin: 0, num: 19 },
    sw_chf: { kit: "#d52b1e", kit2: "#ffd34d", pat: "guard", shorts: "#1b3a8a", socks: "#ffd34d", boots: "#111111", shield: "cross", head: "knight", plume: "#d52b1e", skin: 0, num: 4 },
    sw_btc: { kit: "#151515", kit2: "#f7931a", pat: "solid", shorts: "#151515", socks: "#f7931a", boots: "#f7931a", cloak: "#0d0d0d", lining: "#f7931a", emblem: "₿", emblemC: "#f7931a", head: "hood", eyes: "#f7931a", sparks: "#f7931a", skin: 2, num: 21 },
    sw_xau: { kit: "#d4af37", kit2: "#fff3c4", pat: "armor", shorts: "#8a6a1a", socks: "#d4af37", boots: "#fff3c4", cape: "#5c0f1a", lining: "#d4af37", emblem: "Au", emblemC: "#5c0f1a", head: "crown", hair: "short", hairC: "#111111", skin: 3, num: 79 },
    sw_tv: { kit: "#131722", kit2: "#2962ff", pat: "chart", shorts: "#131722", socks: "#2962ff", boots: "#ffffff", head: "goggles", headC: "#2962ff", hair: "spiky", hairC: "#ff2bd6", tablet: true, skin: 1, num: 12 },
    sw_macro: { kit: "#2b2f78", kit2: "#9b5cff", pat: "solid", shorts: "#1b1e50", socks: "#9b5cff", boots: "#9b5cff", cape: "#9b5cff", lining: "#2b2f78", emblem: "globe", hair: "bald", beard: "#d9d9d9", globe: true, skin: 4, num: 10 },
    sw_news: { coat: "#8a6d3b", kit: "#e9e2d0", kit2: "#3b2f1e", pat: "solid", shorts: "#3b2f1e", socks: "#3b2f1e", boots: "#2a1d10", head: "fedora", headC: "#3b2f1e", hair: "short", hairC: "#3d2b1f", mic: true, badge: true, skin: 1 },
    sw_risk: { kit: "#3a4256", kit2: "#ff4f9a", pat: "armor", shorts: "#2a3040", socks: "#ff4f9a", boots: "#ff4f9a", shield: "plain", head: "helmet", visor: "#ff4f9a", skin: 3, num: 5, bulky: true },
    sw_geo: { robe: "#10233f", robe2: "#ff6b35", kit: "#10233f", kit2: "#ff6b35", head: "headset", headC: "#ff6b35", globe: true, scroll: true, scale: 1.05, skin: 2 },
    news_fx: { kit: "#0d3b4c", kit2: "#19e6ff", pat: "sash", shorts: "#0d3b4c", socks: "#19e6ff", boots: "#19e6ff", head: "headset", headC: "#19e6ff", hair: "ponytail", hairC: "#ff4f9a", antenna: "#19e6ff", skin: 2, num: 3 },
    sw_judge: { robe: "#2a1257", robe2: "#c9a7ff", kit: "#2a1257", kit2: "#c9a7ff", head: "wig", halo: "#c9a7ff", gavel: true, scale: 1.2, float: true, skin: 4, judge: true },
    egx_banks: { kit: "#0f6b4f", kit2: "#d4af37", pat: "stripes", shorts: "#0b3d2e", socks: "#d4af37", boots: "#d4af37", cape: "#d4af37", lining: "#0f6b4f", emblem: "vault", head: "helmet", visor: "#7fffd4", skin: 3, num: 6 },
    egx_nbfi: { kit: "#4b2a7b", kit2: "#c0c0c0", pat: "hoops", shorts: "#2a1745", socks: "#c0c0c0", boots: "#c0c0c0", emblem: "%", head: "ninja", headC: "#2a1745", scarf: "#c0c0c0", skin: 2, num: 14 },
    egx_realestate: { kit: "#c9a26b", kit2: "#7a3b22", pat: "blocks", shorts: "#7a3b22", socks: "#c9a26b", boots: "#ffb000", cape: "#7a3b22", lining: "#c9a26b", head: "hardhat", headC: "#ffb000", hair: "short", hairC: "#2b1d14", blueprint: true, skin: 3, num: 16 },
    egx_materials: { kit: "#5a6270", kit2: "#ff7a1a", pat: "armor", shorts: "#3a404a", socks: "#ff7a1a", boots: "#ff7a1a", head: "titan", headC: "#7d8794", bulky: true, emblem: "bolt", skin: 4, num: 3 },
    egx_industrials: { kit: "#ffcc00", kit2: "#111111", pat: "hazard", shorts: "#111111", socks: "#ffcc00", boots: "#111111", head: "welder", headC: "#333333", mech: true, emblem: "gear", skin: 1, num: 2 },
    egx_consumer: { kit: "#ff4f9a", kit2: "#2ff3d0", pat: "halves", shorts: "#2ff3d0", socks: "#ff4f9a", boots: "#ffffff", head: "cap", headC: "#2ff3d0", hair: "afro", hairC: "#1a1a1a", bag: true, skin: 5, num: 17 },
    egx_tmt: { kit: "#0047ff", kit2: "#b6ff00", pat: "circuit", shorts: "#002080", socks: "#b6ff00", boots: "#b6ff00", head: "antenna", headC: "#b6ff00", hair: "mohawk", hairC: "#b6ff00", emblem: "signal", skin: 2, num: 5 },
    egx_macro: { robe: "#0b2a4a", robe2: "#ffd34d", kit: "#0b2a4a", kit2: "#ffd34d", head: "falcon", staff: "sun", float: true, scale: 1.08 },
    egx_politics: { robe: "#3a1020", robe2: "#d4af37", kit: "#3a1020", kit2: "#d4af37", head: "nemes", scroll: true, staff: "sun", scale: 1.04, skin: 3 },
    egx_quant: { kit: "#2a2f45", kit2: "#19e6ff", pat: "circuit", shorts: "#1b1f30", socks: "#19e6ff", boots: "#19e6ff", head: "robot", visor: "#19e6ff", robot: true, num: 0 },
    egx_risk: { kit: "#2b2418", kit2: "#d4af37", pat: "armor", shorts: "#1a160e", socks: "#d4af37", boots: "#d4af37", head: "anubis", shield: "ankh", bulky: true, num: 5 },
    egx_newscheck: { robe: "#e8e1cf", robe2: "#1b6fa8", kit: "#e8e1cf", kit2: "#1b6fa8", head: "ibis", scroll: true },
    news_egx: { kit: "#20305a", kit2: "#ffd34d", pat: "sash", shorts: "#20305a", socks: "#ffd34d", boots: "#ffd34d", head: "headset", headC: "#ffd34d", hair: "braids", hairC: "#2b1d14", antenna: "#ffd34d", skin: 4, num: 20 },
    egx_orders: { kit: "#ff8c00", kit2: "#222222", pat: "hazard", shorts: "#222222", socks: "#ff8c00", boots: "#222222", head: "helmet", visor: "#ffd34d", exo: true, skin: 2, num: 88 },
    egx_judge: { robe: "#f0e2b6", robe2: "#1b4fa8", kit: "#f0e2b6", kit2: "#1b4fa8", head: "nemes", crook: true, scale: 1.24, skin: 3, judge: true },
    director: { coat: "#141a3c", coat2: "#d4af37", kit: "#e8ecff", kit2: "#d4af37", pat: "solid", shorts: "#141a3c", socks: "#141a3c", boots: "#0a0a0a", head: "captain", hair: "short", hairC: "#4a4a4a", beard: "#9a9a9a", armband: true, scale: 1.1, skin: 1 },
    // The terminal desk (owner 2026-10-13): the crew that works DFN PRO12 sits at the Comms Array's terminal.
    tm_operator: { kit: "#07110d", kit2: "#00ff9c", pat: "circuit", shorts: "#07110d", socks: "#00ff9c", boots: "#00ff9c", head: "headset", headC: "#00ff9c", hair: "short", hairC: "#1a1a1a", tablet: true, skin: 3, num: 12 },
    tm_watcher: { kit: "#1a1a2e", kit2: "#ffd34d", pat: "sash", shorts: "#1a1a2e", socks: "#ffd34d", boots: "#ffd34d", head: "goggles", headC: "#ffd34d", hair: "curly", hairC: "#2b1d14", antenna: "#ffd34d", skin: 2, num: 7 },
    tm_spreader: { kit: "#0e3b2e", kit2: "#7fffd4", pat: "chart", shorts: "#0e3b2e", socks: "#7fffd4", boots: "#7fffd4", head: "cap", headC: "#7fffd4", hair: "braids", hairC: "#1a1a1a", scroll: true, skin: 4, num: 24 },
    tm_listings: { kit: "#3a2a12", kit2: "#ffb020", pat: "stripes", shorts: "#3a2a12", socks: "#ffb020", boots: "#3a2a12", head: "headband", headC: "#ffb020", hair: "fade", hairC: "#111111", badge: true, skin: 1, num: 40 },
    tm_prices: { kit: "#3a2a12", kit2: "#2ff3d0", pat: "stripes", shorts: "#3a2a12", socks: "#2ff3d0", boots: "#3a2a12", head: "headband", headC: "#2ff3d0", hair: "fade", hairC: "#111111", badge: true, skin: 1, num: 40 },
  };
  // The valuation desk (owner 2026-10-12): in every sector pod an Earnings Tracker (a quick winger with goggles or a cap
  // and a results tablet) and a Valuation Analyst (a playmaker in the sector's colours with a cape and the model scroll).
  const VAL_LOOK = {
    banks: [{ head: "goggles", hair: "short", hairC: "#1a1a1a", skin: 1, num: 31 }, { head: "circlet", hair: "long", hairC: "#5a3a22", skin: 4, num: 32 }],
    nbfi: [{ head: "headband", hair: "curly", hairC: "#2b1d14", skin: 3, num: 41 }, { head: "mask", hair: "quiff", hairC: "#d9a441", skin: 0, num: 42 }],
    realestate: [{ head: "cap", hair: "afro", hairC: "#1a1a1a", skin: 5, num: 51 }, { head: "crown", hair: "short", hairC: "#3b2618", skin: 2, num: 52 }],
    materials: [{ head: "goggles", hair: "mohawk", hairC: "#ff7a1a", skin: 2, num: 61 }, { head: "knight", plume: "#ff7a1a", skin: 3, num: 62 }],
    industrials: [{ head: "headband", hair: "fade", hairC: "#111111", skin: 4, num: 71 }, { head: "winged", hair: "spiky", hairC: "#ffcc00", skin: 1, num: 72 }],
    consumer: [{ head: "cap", hair: "ponytail", hairC: "#ff4f9a", skin: 0, num: 81 }, { head: "circlet", hair: "braids", hairC: "#2b1d14", skin: 5, num: 82 }],
    tmt: [{ head: "goggles", hair: "spiky", hairC: "#b6ff00", skin: 2, num: 91 }, { head: "mask", hair: "topknot", hairC: "#111111", skin: 1, num: 92 }],
  };
  for (const [, id, , , , glow, k1, k2] of SECTORS) {
    const look = VAL_LOOK[id];
    if (!look) continue;
    SPEC["et_" + id] = { kit: k2, kit2: k1, pat: "chevron", shorts: k1, socks: k2, boots: glow, headC: glow, maskC: glow, tablet: true, ...look[0] };
    SPEC["va_" + id] = { kit: k1, kit2: k2, pat: "chart", shorts: k2, socks: k1, boots: k2, cape: k2, lining: k1, scroll: true,
                         emblem: "%", headC: k2, maskC: k2, ...look[1] };
  }
  const KEEPER = ["#39ff14", "#ff2bd6", "#19e6ff", "#ffd166", "#ff6b35", "#b388ff", "#00ffa3", "#ff4f9a", "#7df9ff", "#c6ff00", "#ff9100", "#e040fb", "#40c4ff"];
  const PATTERNS = ["solid", "hoops", "stripes", "sash", "halves", "chevron"];
  const HAIRS = ["short", "spiky", "afro", "mohawk", "long", "quiff", "curly", "fade", "ponytail", "braids", "bald", "topknot"];
  const HAIR_C = ["#2b1d14", "#5a3a22", "#1a1a1a", "#7a4e2a", "#d9a441", "#a0522d", "#e8e8e8", "#ff4f9a", "#19e6ff"];

  function specFor(a) {
    if (SPEC[a.id]) return SPEC[a.id];
    const h = hash(a.id), r = seeded(h), k = KEEPER[h % KEEPER.length];
    if (a.quant || /^sq_/.test(a.id)) {        // the quants are android goalkeepers: number 1, big gloves, regime visor
      return { kit: k, kit2: "#111111", pat: PATTERNS[(h >> 4) % PATTERNS.length], shorts: "#111111", socks: k, boots: "#ffffff",
               gloves: k, head: "keeperbot", fin: (h >> 8) % 3, num: 1, regime: a.id.slice(3).toUpperCase() };
    }
    const kits = ["#c62828", "#1565c0", "#2e7d32", "#6a1b9a", "#ef6c00", "#00838f", "#ad1457", "#37474f"];
    return { kit: kits[h % kits.length], kit2: k, pat: PATTERNS[(h >> 3) % PATTERNS.length], shorts: "#1b1f44", socks: k, boots: "#ffffff",
             hair: HAIRS[(h >> 5) % HAIRS.length], hairC: HAIR_C[(h >> 9) % HAIR_C.length], skin: (h >> 12) % SKIN.length,
             head: r() < 0.3 ? "mask" : null, maskC: k, cape: r() < 0.4 ? k : null, lining: "#1b1f44", num: 2 + (h % 30) };
  }

  let ctx = null;       // set by init
  const OUT = "#0a0c18";

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function circle(x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function ell(x, y, rx, ry, fill, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function poly(pts, fill, stroke, lw) {
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function star(x, y, r, n, fill) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n, rr2 = i % 2 ? r * 0.45 : r;
      i ? ctx.lineTo(x + rr2 * Math.cos(a), y + rr2 * Math.sin(a)) : ctx.moveTo(x + rr2 * Math.cos(a), y + rr2 * Math.sin(a));
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }

  // Shirt patterns, drawn inside the torso clip.
  function pattern(s, x, y, w, h) {
    const c2 = s.kit2;
    ctx.fillStyle = c2;
    switch (s.pat) {
      case "stripes": for (let i = x + 2; i < x + w; i += 6) ctx.fillRect(i, y, 2.6, h); break;
      case "hoops": for (let i = y + 2; i < y + h; i += 6) ctx.fillRect(x, i, w, 2.6); break;
      case "sash": ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + 5, y); ctx.lineTo(x + w, y + h - 3); ctx.lineTo(x + w - 5, y + h); ctx.closePath(); ctx.fill(); break;
      case "halves": ctx.fillRect(x + w / 2, y, w / 2, h); break;
      case "chevron": ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x + w / 2, y + 9); ctx.lineTo(x + w, y + 3); ctx.lineTo(x + w, y + 7); ctx.lineTo(x + w / 2, y + 13); ctx.lineTo(x, y + 7); ctx.fill(); break;
      case "cross": ctx.fillRect(x + w / 2 - 1.8, y, 3.6, h); ctx.fillRect(x, y + h / 2 - 1.8, w, 3.6); break;
      case "sun": circle(x + w / 2, y + h / 2, 5.2, c2); break;
      case "ringstars": for (let i = 0; i < 12; i++) { const a = i * TAU / 12; circle(x + w / 2 + 5.6 * Math.cos(a), y + h / 2 + 5.6 * Math.sin(a), 0.75, c2); } break;
      case "stars": ctx.fillStyle = "#d22d3d"; for (let i = y + h / 2; i < y + h; i += 4) ctx.fillRect(x, i, w, 2);
        for (let i = 0; i < 5; i++) circle(x + 2 + i * 3.2, y + 2.4, 0.7, "#ffffff"); break;
      case "panel": ctx.fillRect(x + w / 2 - 4, y, 8, h); break;
      case "guard": { const cols = ["#1b3a8a", "#ffd34d", "#d52b1e"]; for (let i = 0, j = 0; i < w; i += 3, j++) { ctx.fillStyle = cols[j % 3]; ctx.fillRect(x + i, y, 3, h); } break; }
      case "armor": ctx.strokeStyle = hexA("#000000", 0.35); ctx.lineWidth = 0.8;
        for (let i = y + 4; i < y + h; i += 4.5) { ctx.beginPath(); ctx.moveTo(x, i); ctx.quadraticCurveTo(x + w / 2, i + 2, x + w, i); ctx.stroke(); }
        ctx.fillStyle = hexA("#ffffff", 0.22); ctx.fillRect(x + 2, y + 1, 3, h - 2); break;
      case "chart": ctx.strokeStyle = c2; ctx.lineWidth = 1;
        [[3, 6, 4], [7, 3, 6], [11, 5, 5]].forEach(([dx, dy, hh]) => { ctx.fillStyle = dx === 7 ? "#2ff3d0" : "#ff4f9a"; ctx.fillRect(x + dx, y + dy, 2, hh); }); break;
      case "blocks": ctx.strokeStyle = hexA(c2, 0.6); ctx.lineWidth = 0.7;
        for (let i = 0, yy = y + 3; yy < y + h; yy += 4, i++) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
          for (let xx = x + (i % 2 ? 2 : 5); xx < x + w; xx += 6) { ctx.beginPath(); ctx.moveTo(xx, yy - 4); ctx.lineTo(xx, yy); ctx.stroke(); } } break;
      case "hazard": for (let i = -h; i < w; i += 6) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + 3, y + h); ctx.lineTo(x + i + 3 + h, y); ctx.lineTo(x + i + h, y); ctx.fill(); } break;
      case "circuit": ctx.strokeStyle = c2; ctx.lineWidth = 0.8; ctx.beginPath();
        ctx.moveTo(x + 2, y + 3); ctx.lineTo(x + 6, y + 3); ctx.lineTo(x + 6, y + 9); ctx.lineTo(x + 12, y + 9);
        ctx.moveTo(x + 10, y + 2); ctx.lineTo(x + 10, y + 6); ctx.lineTo(x + 15, y + 6); ctx.stroke();
        circle(x + 12, y + 9, 1, c2); circle(x + 2, y + 3, 1, c2); break;
      default: break;
    }
  }

  function emblem(e, x, y, col, sc) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc || 1, sc || 1);
    switch (e) {
      case "leaf": poly([[0, -4.5], [1.2, -2], [3.6, -2.8], [2.6, 0], [4, 0.6], [1, 1.6], [0.6, 4], [-0.6, 4], [-1, 1.6], [-4, 0.6], [-2.6, 0], [-3.6, -2.8], [-1.2, -2]], "#d52b1e"); break;
      case "cross5": [[0, -3.6], [0, 3.4], [-2.8, -0.6], [2.6, 0.4], [1.4, 1.8]].forEach(([a, b], i) => star(a, b, i === 4 ? 0.9 : 1.4, 5, "#ffffff")); break;
      case "vault": circle(0, 0, 4, null, col, 1.2); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4 * Math.cos(a), 4 * Math.sin(a)); ctx.stroke(); } circle(0, 0, 1.2, col); break;
      case "gear": for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i * TAU / 8); ctx.fillStyle = col; ctx.fillRect(-0.9, -4.6, 1.8, 2); ctx.restore(); } circle(0, 0, 3.4, col); circle(0, 0, 1.3, "#111111"); break;
      case "bolt": poly([[1, -5], [-3, 0.6], [-0.2, 0.6], [-1.2, 5], [3, -1], [0.2, -1]], col); break;
      case "signal": ctx.strokeStyle = col; ctx.lineWidth = 1.1; for (const r of [1.8, 3.4, 5]) { ctx.beginPath(); ctx.arc(0, 2.5, r, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke(); } circle(0, 2.5, 0.9, col); break;
      case "globe": circle(0, 0, 4.2, null, col, 1); ctx.beginPath(); ctx.ellipse(0, 0, 1.8, 4.2, 0, 0, TAU); ctx.moveTo(-4.2, 0); ctx.lineTo(4.2, 0); ctx.stroke(); break;
      default: ctx.fillStyle = col; ctx.font = `bold ${String(e).length > 1 ? 6 : 8.5}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(e, 0, 0.4); ctx.textAlign = "left";
    }
    ctx.restore();
  }

  function arm(x, y, ang, len, sleeve, hand, handR) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    rr(-2.3, -1, 4.6, len, 2.2); ctx.fillStyle = sleeve; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
    circle(0, len, handR || 2.4, hand, OUT, 0.8);
    ctx.restore();
  }

  // The head: hair and headgear (back layer before the face, front layer after).
  function headBack(s, skin) {
    const hc = s.hairC || "#2b1d14";
    switch (s.hair) {
      case "afro": circle(-1, -41, 13.5, hc); break;
      case "long": rr(-11, -42, 13, 18, 5); ctx.fillStyle = hc; ctx.fill(); break;
      case "ponytail": ell(-12, -36, 4, 7, hc, 0.5); break;
      case "braids": rr(-11, -38, 3, 14, 1.5); ctx.fillStyle = hc; ctx.fill(); rr(-7, -36, 3, 13, 1.5); ctx.fill(); break;
      default: break;
    }
    if (s.head === "nemes") {                                   // the pharaoh's striped cloth falls behind the shoulders
      poly([[-10, -46], [8, -47], [12, -38], [11, -27], [-14, -24], [-13, -36]], "#1b4fa8");
      ctx.fillStyle = "#ffd34d"; for (let i = 0; i < 5; i++) ctx.fillRect(-14, -44 + i * 4.2, 26, 1.6);
    }
    if (s.head === "hood") circle(-1, -38, 12.5, s.cloak || "#111111");
    if (s.head === "wig") { for (let i = 0; i < 3; i++) { circle(-9.5, -40 + i * 4.4, 3.6, "#f2f2f2", "#b8b8b8", 0.6); } }
  }

  function headFront(s, t, c) {
    const hc = s.hairC || "#2b1d14";
    const cap = () => { ctx.beginPath(); ctx.arc(0, -38, 10, Math.PI * 1.04, Math.PI * 1.96); ctx.quadraticCurveTo(5, -44, -9.8, -36); ctx.closePath(); };
    if (!s.head || ["mask", "goggles", "headset", "headband", "circlet", "crown", "antenna", "winged"].includes(s.head)) {
      switch (s.hair) {
        case "short": case "long": case "ponytail": case "braids": cap(); ctx.fillStyle = hc; ctx.fill(); break;
        case "quiff": cap(); ctx.fillStyle = hc; ctx.fill(); circle(5.5, -47, 3.8, hc); break;
        case "spiky": cap(); ctx.fillStyle = hc; ctx.fill(); poly([[-8, -43], [-6, -52], [-3, -45], [0, -54], [2, -46], [6, -52], [7, -43]], hc); break;
        case "afro": ctx.beginPath(); ctx.arc(0, -40, 10.5, Math.PI * 1.02, Math.PI * 1.98); ctx.fillStyle = hc; ctx.fill(); break;
        case "mohawk": poly([[-7, -44], [-4, -54], [0, -55.5], [4, -54], [7, -44]], hc); break;
        case "curly": for (let i = 0; i < 6; i++) circle(-8 + i * 3.2, -45 + Math.abs(i - 2.5) * 0.9, 3.4, hc); break;
        case "fade": cap(); ctx.fillStyle = hexA(hc, 0.55); ctx.fill(); break;
        case "topknot": cap(); ctx.fillStyle = hc; ctx.fill(); circle(-1, -50, 3.4, hc); ctx.fillStyle = "#bc002d"; ctx.fillRect(-3.4, -47.6, 4.8, 1.6); break;
        case "bald": ell(-3, -44, 3.4, 1.8, hexA("#ffffff", 0.35)); break;
        default: break;
      }
    }
    switch (s.head) {
      case "mask": rr(-8, -41.6, 17.5, 5.2, 2.4); ctx.fillStyle = s.maskC; ctx.fill(); ell(2.6, -39, 1.9, 1.5, "#ffffff"); ell(6.2, -39, 1.7, 1.4, "#ffffff"); break;
      case "winged": ctx.beginPath(); ctx.arc(0, -38, 10.4, Math.PI * 1.02, Math.PI * 1.98); ctx.fillStyle = "#d8dee9"; ctx.fill();
        for (let i = 0; i < 3; i++) poly([[-7, -43 + i * 2.5], [-16 - i, -50 + i * 3], [-8, -40 + i * 2.5]], "#ffffff", "#9aa4b8", 0.5);
        ctx.fillStyle = "#d22d3d"; ctx.fillRect(-1, -48.2, 2, 4); break;
      case "circlet": ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -38, 9.8, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); circle(0, -47.6, 1.5, "#ff2bd6"); break;
      case "crown": poly([[-7, -45], [-7, -52], [-3.5, -48], [0, -54], [3.5, -48], [7, -52], [7, -45]], "#ffd700", "#a07c00", 0.6); circle(0, -50, 1.1, "#ff2b5c"); break;
      case "headband": ctx.fillStyle = s.headC; ctx.fillRect(-9.6, -45, 19.2, 2.6); poly([[-9, -45], [-15, -47], [-14, -42]], s.headC); break;
      case "hockey": ell(4, -37.5, 7.4, 8.8, "#f2f2f2"); ctx.fillStyle = "#111111"; ctx.fillRect(1.4, -41, 2.6, 1.8); ctx.fillRect(5.6, -41, 2.6, 1.8);
        for (const [hx, hy] of [[3, -35], [6, -35], [4.5, -32.5]]) circle(hx, hy, 0.6, "#555555"); ctx.fillStyle = "#d52b1e"; ctx.fillRect(3.6, -46, 1.2, 4); break;
      case "knight": circle(0, -38, 10.6, "#c9ced8", OUT, 1); ctx.fillStyle = "#1a1a1a"; ctx.fillRect(-2, -40, 12, 2.4);
        ctx.beginPath(); ctx.moveTo(-2, -48); ctx.quadraticCurveTo(-14, -60, -19, -44); ctx.quadraticCurveTo(-10, -52, -2, -46); ctx.fillStyle = s.plume; ctx.fill(); break;
      case "hood": ctx.beginPath(); ctx.arc(1, -38, 11.5, Math.PI * 0.7, Math.PI * 2.3); ctx.fillStyle = s.cloak || "#111111"; ctx.fill();
        ell(3.2, -37, 6.8, 7.6, "#050505");
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3); ell(1.4, -38, 1.5, 1.1, s.eyes); ell(5.6, -38, 1.5, 1.1, s.eyes); ctx.globalAlpha = 1; break;
      case "goggles": ctx.fillStyle = "#222222"; ctx.fillRect(-9.8, -41, 19.6, 2.6); circle(2.2, -39.6, 3.2, s.headC, "#ffffff", 0.8); circle(7, -39.6, 2.8, s.headC, "#ffffff", 0.8); break;
      case "headset": ctx.strokeStyle = "#222222"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -38, 10.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        circle(-2, -37, 3.4, s.headC, OUT, 0.8); ctx.strokeStyle = s.headC; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, -35); ctx.quadraticCurveTo(3, -31, 7, -32.5); ctx.stroke(); break;
      case "fedora": ell(1, -45, 13.5, 3, s.headC); rr(-7, -54, 14, 10, 4); ctx.fillStyle = s.headC; ctx.fill(); ctx.fillStyle = "#c9a227"; ctx.fillRect(-7, -47.5, 14, 2); break;
      case "captain": ell(0, -47, 11, 4.4, "#f4f4f4"); ctx.fillStyle = "#141a3c"; ctx.fillRect(-9, -46, 18, 3.6); ell(6, -42.5, 6, 2, "#0a0a0a"); star(0, -47.6, 2.2, 5, "#ffd34d"); break;
      case "wig": circle(0, -43, 8.5, "#f2f2f2", "#b8b8b8", 0.6); for (let i = 0; i < 3; i++) circle(9.2, -40 + i * 4.2, 3.2, "#f2f2f2", "#b8b8b8", 0.6); break;
      case "nemes": ctx.beginPath(); ctx.arc(0, -39, 10.6, Math.PI * 1.05, Math.PI * 1.95); ctx.fillStyle = "#1b4fa8"; ctx.fill();
        ctx.fillStyle = "#ffd34d"; for (let i = 0; i < 3; i++) ctx.fillRect(-9, -47.5 + i * 3.2, 18, 1.4);
        ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, -47); ctx.quadraticCurveTo(7, -51, 5, -53); ctx.stroke();
        ctx.fillStyle = "#1b4fa8"; ctx.fillRect(3, -29.5, 3, 4); break;
      case "falcon": circle(0, -38, 10, "#1b3a6b", OUT, 1); poly([[7, -41], [15, -38], [8, -35]], "#ffd34d", OUT, 0.6);
        ell(3.6, -40, 2.4, 1.8, "#ffffff"); circle(4, -40, 1.1, "#000000"); ctx.strokeStyle = "#000000"; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(2, -38.4); ctx.lineTo(2.4, -34.5); ctx.stroke();
        circle(0, -54, 5, "#ff6b1a", "#ffd34d", 1.2); break;
      case "anubis": circle(0, -38, 9.6, "#151515", OUT, 1); poly([[3, -40], [15, -37], [14, -34.5], [3, -34]], "#151515");
        poly([[-6, -44], [-4, -58], [0, -45]], "#151515"); poly([[-1, -45], [2, -57], [4, -44]], "#202020");
        ell(5, -40.5, 1.8, 1, "#ffd34d"); ctx.fillStyle = "#ffd34d"; ctx.fillRect(-8, -30.5, 16, 2.2); break;
      case "ibis": circle(0, -38, 9.6, "#f4efe2", OUT, 1); ctx.strokeStyle = "#151515"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(7, -38); ctx.quadraticCurveTo(15, -36, 17, -27); ctx.stroke(); ctx.lineCap = "butt";
        circle(3.8, -40, 1.4, "#000000"); ctx.fillStyle = "#1b6fa8"; ctx.fillRect(-9, -46, 18, 2.4); break;
      case "robot": rr(-9, -48, 18, 18, 4); ctx.fillStyle = "#3a4058"; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
        rr(-6, -43, 14, 5, 2.4); ctx.fillStyle = s.visor; ctx.fill(); ctx.strokeStyle = "#8a92b2"; ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(0, -54); ctx.stroke();
        circle(0, -55, 1.8, Math.sin(t * 4) > 0 ? "#ff2bd6" : "#5a1050"); break;
      case "keeperbot": {
        const reg = c && c.regime, vc = reg === "BULL" ? "#2ff3d0" : reg === "BEAR" ? "#ff4f6a" : "#ffd166";
        circle(0, -38, 10.6, "#2a3048", OUT, 1); ell(3.4, -38.5, 7.2, 4.6, vc);
        ell(1.6, -39.8, 2.4, 1.1, hexA("#ffffff", 0.7));
        if (s.fin === 1) poly([[-4, -47], [-1, -55], [3, -48]], s.kit);
        else if (s.fin === 2) { ctx.strokeStyle = "#8a92b2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -45); ctx.lineTo(-10, -53); ctx.stroke(); circle(-10, -53, 1.4, s.kit); }
        else { ctx.fillStyle = s.kit; ctx.fillRect(-10.6, -40, 3, 5); }
        break;
      }
      case "hardhat": ctx.beginPath(); ctx.arc(0, -40, 10.4, Math.PI, TAU); ctx.fillStyle = s.headC; ctx.fill(); ell(2, -40, 13, 2.2, s.headC); ctx.fillStyle = hexA("#ffffff", 0.4); ctx.fillRect(-1, -49, 2, 8); break;
      case "welder": rr(-1, -46, 11, 15, 2); ctx.fillStyle = s.headC; ctx.fill(); ctx.fillStyle = "#39ff14"; ctx.globalAlpha = 0.8; ctx.fillRect(1.6, -41.5, 7, 2.6); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(0, -38, 10.2, Math.PI * 1.0, Math.PI * 1.9); ctx.fillStyle = "#4a4a4a"; ctx.fill(); break;
      case "titan": poly([[-10, -34], [-11, -44], [-5, -50], [5, -50], [11, -44], [11, -33], [6, -30], [-6, -30]], s.headC, OUT, 1);
        ctx.fillStyle = "#ff7a1a"; ctx.fillRect(-1, -43, 11, 2.4); ctx.fillRect(3.5, -43, 2.4, 9); break;
      case "ninja": circle(0, -38, 10.2, s.headC, OUT, 1); rr(-3, -41.5, 13, 5, 2.2); ctx.fillStyle = SKIN[s.skin || 2]; ctx.fill();
        circle(2.6, -39, 1, "#000000"); circle(6.4, -39, 1, "#000000"); poly([[-9, -40], [-17, -36], [-16, -33], [-9, -37]], s.headC); break;
      case "cap": ctx.beginPath(); ctx.arc(0, -40, 10.2, Math.PI, TAU); ctx.fillStyle = s.headC; ctx.fill(); ell(9, -40, 7, 2, s.headC); break;
      case "antenna": ctx.fillStyle = "#222222"; ctx.fillRect(-9.6, -45, 19.2, 2.4); ctx.strokeStyle = "#cccccc"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-6, -45); ctx.lineTo(-9, -55); ctx.stroke(); circle(-9, -55 + Math.sin(t * 5) * 0.8, 2, s.headC); break;
      case "helmet": ctx.beginPath(); ctx.arc(0, -38, 10.8, Math.PI * 0.85, Math.PI * 2.15); ctx.fillStyle = s.kit === "#ff8c00" ? "#ffb020" : shade(s.kit, -0.25); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke(); rr(-2, -41.5, 12.5, 4.8, 2.2); ctx.fillStyle = s.visor; ctx.fill(); break;
      default: break;
    }
    if (s.beard) { ctx.beginPath(); ctx.arc(2, -34, 7, 0.1, Math.PI - 0.3); ctx.fillStyle = s.beard; ctx.fill(); }
  }

  function face(s, t, c) {
    if (["hood", "falcon", "anubis", "ibis", "robot", "keeperbot", "knight", "welder", "titan", "ninja"].includes(s.head)) return;
    const blink = ((t + (c ? c.seed : 0)) % 4.2) < 0.12;
    if (s.head === "mask") { circle(3, -39, 0.9, "#0a0a14"); circle(6.4, -39, 0.85, "#0a0a14"); }
    else if (s.head !== "hockey" && s.head !== "goggles") {
      if (blink) { ctx.fillStyle = "#0a0a14"; ctx.fillRect(1.6, -39, 2.4, 0.7); ctx.fillRect(5.2, -39, 2.2, 0.7); }
      else { ell(2.8, -38.8, 1.1, 1.6, "#0a0a14"); ell(6.3, -38.8, 1, 1.5, "#0a0a14"); circle(3.1, -39.4, 0.35, "#ffffff"); }
    }
    if (s.head !== "hockey") { ctx.strokeStyle = hexA("#3a1a10", 0.8); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(5, -34.6, 1.8, 0.2, Math.PI - 0.4); ctx.stroke(); }
  }

  // One character, drawn at its feet. lod 0 = a coloured token (far away), 1 = no fine details, 2 = everything.
  function drawHero(c, t, lod) {
    const s = c.spec, sc = s.scale || 1, moving = c.path.length > 0;
    const ph = c.walk * 10, sw = moving ? Math.sin(ph) : 0;
    const bob = moving ? Math.abs(Math.cos(ph)) * 1.3 : Math.sin(t * 2 + c.seed) * 0.35;
    const fl = s.float ? 6 + Math.sin(t * 1.7 + c.seed) * 2.2 : 0;
    const skin = SKIN[s.skin || 0];
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(CS, CS);
    if (c.beam) ctx.globalAlpha = c.beam.alpha;
    ell(0, 1, 11 * sc, 3.6 * sc, "rgba(0,0,0,.38)");
    if (lod === 0) {
      ctx.scale(sc, sc);
      rr(-7, -27, 14, 22, 6); ctx.fillStyle = s.robe || s.kit; ctx.fill();
      circle(0, -32, 7.5, s.head === "hood" ? "#111111" : s.head === "falcon" ? "#1b3a6b" : s.head === "anubis" ? "#151515" : skin);
      ctx.restore();
      return;
    }
    if (s.sparks && lod === 2) {
      for (let i = 0; i < 4; i++) {
        const a = t * 1.5 + i * 1.57 + c.seed, y = -18 - ((t * 14 + i * 9) % 30);
        circle(Math.cos(a) * 11, y, 1, hexA(s.sparks, 0.5 + 0.5 * Math.sin(a * 2)));
      }
    }
    ctx.translate(0, -fl - bob);
    ctx.scale(sc * c.facing, sc);
    const sway = moving ? 3 + Math.sin(ph * 0.5) * 1.6 : Math.sin(t * 1.3 + c.seed) * 1.1;
    if (s.halo) { ctx.strokeStyle = hexA(s.halo, 0.85); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, -53, 9, 2.6, 0, 0, TAU); ctx.stroke(); }
    // cape or cloak, behind everything
    if (s.cape || s.cloak) {
      const col = s.cape || s.cloak;
      ctx.beginPath(); ctx.moveTo(-7, -28);
      ctx.quadraticCurveTo(-13 - sway, -14, -12 - sway * 1.6, s.cloak ? 0 : -3);
      ctx.lineTo(7 - sway, s.cloak ? 0 : -3); ctx.quadraticCurveTo(9, -16, 7, -28); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
      if (s.lining) { ctx.strokeStyle = s.lining; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-12 - sway * 1.6, s.cloak ? 0 : -3); ctx.lineTo(7 - sway, s.cloak ? 0 : -3); ctx.stroke(); }
    }
    if (s.katana) { ctx.save(); ctx.rotate(-0.7); ctx.fillStyle = "#222222"; ctx.fillRect(-2, -40, 2.6, 26); ctx.fillStyle = "#bc002d"; ctx.fillRect(-2.4, -44, 3.4, 5); ctx.restore(); }
    headBack(s, skin);
    const robe = !!s.robe;
    if (robe) {
      // a long robe: no legs, the hem sways
      ctx.beginPath(); ctx.moveTo(-8, -30); ctx.lineTo(8, -30); ctx.lineTo(13 + sway * 0.3, 0); ctx.lineTo(-13 + sway * 0.3, 0); ctx.closePath();
      ctx.fillStyle = s.robe; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.fillStyle = s.robe2; ctx.fillRect(-1.6, -29, 3.2, 28.5); ctx.fillRect(-13 + sway * 0.3, -2.6, 26, 2.6);
      if (s.judge && s.head === "wig") { for (let i = 0; i < 9; i++) circle(-10 + (i % 3) * 3 + Math.floor(i / 3) * 6.5, -14 - (i % 2) * 6, 0.8, hexA("#ffffff", 0.7)); }
      if (s.head === "nemes") { ctx.fillStyle = "#ffd34d"; ctx.fillRect(-8, -29, 16, 3.4); ctx.fillStyle = "#1b4fa8"; ctx.fillRect(-8, -26.4, 16, 1.4); }
    } else {
      // legs: socks to the knee, boots
      const legW = s.bulky ? 6 : 5;
      for (const side of [-1, 1]) {
        ctx.save(); ctx.translate(side * 3.6, -13); ctx.rotate(sw * 0.55 * side);
        ctx.fillStyle = s.robot ? "#3a4058" : skin; ctx.fillRect(-legW / 2, 0, legW, 4);
        ctx.fillStyle = s.socks; ctx.fillRect(-legW / 2, 3.5, legW, 8.5);
        ell(1.6, 12.4, 4.2, 2.5, s.boots); ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.restore();
      }
      rr(-7.8, -16.5, 15.6, 6.5, 2.4); ctx.fillStyle = s.shorts; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = s.kit2; ctx.fillRect(6.2, -16, 1.4, 5.5);
    }
    // back arm, behind the body
    const armSw = -sw * 0.65, idleArm = moving ? 0 : Math.sin(t * 1.4 + c.seed) * 0.08;
    const sleeve = s.coat || (robe ? s.robe : s.kit), hand = s.gloves || (s.robot ? "#8a92b2" : skin);
    arm(-8, -27, -armSw + 0.15 + idleArm, s.bulky ? 12 : 11, sleeve, hand, s.gloves ? 3.6 : 2.4);
    if (s.shield) {
      circle(-10, -19, 7.2, s.shield === "cross" ? "#d52b1e" : s.shield === "ankh" ? "#2b2418" : "#3a4256", OUT, 1.2);
      circle(-10, -19, 5.6, null, s.shield === "ankh" ? "#d4af37" : "#ffffff", 0.8);
      if (s.shield === "cross") { ctx.fillStyle = "#ffffff"; ctx.fillRect(-11.4, -23, 2.8, 8); ctx.fillRect(-14, -20.4, 8, 2.8); }
      else if (s.shield === "ankh") { ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(-10, -22, 1.8, 2.2, 0, 0, TAU); ctx.moveTo(-10, -20); ctx.lineTo(-10, -14.5); ctx.moveTo(-13, -19); ctx.lineTo(-7, -19); ctx.stroke(); }
      else { ctx.fillStyle = s.kit2; ctx.fillRect(-11, -23.5, 2, 9); }
    }
    // torso
    if (!robe) {
      const tw = s.bulky ? 20 : 16, tx = -tw / 2;
      rr(tx, -30, tw, 16.5, 5); ctx.fillStyle = s.kit; ctx.fill();
      if (lod === 2) {
        ctx.save(); ctx.clip(); pattern(s, tx, -30, tw, 16.5);
        ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(tx, -30, 3, 16.5); ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(tx + tw - 4, -30, 2, 16.5);
        ctx.restore();
        rr(tx, -30, tw, 16.5, 5); ctx.strokeStyle = OUT; ctx.lineWidth = 1.1; ctx.stroke();
      } else if (s.pat && s.pat !== "solid") { ctx.fillStyle = s.kit2; ctx.fillRect(tx + tw / 2 - 2, -29, 4, 15); }
      ctx.fillStyle = s.kit2; ctx.beginPath(); ctx.moveTo(-3, -30); ctx.lineTo(0, -26.5); ctx.lineTo(3, -30); ctx.fill();   // V collar
      if (s.coat) {                                         // an open coat over the shirt
        ctx.fillStyle = s.coat; rr(tx - 1, -30.5, 6, 25, 2.5); ctx.fill(); rr(tx + tw - 5, -30.5, 6, 25, 2.5); ctx.fill();
        if (s.coat2) { ctx.fillStyle = s.coat2; ctx.fillRect(tx - 1, -31, 6, 2); ctx.fillRect(tx + tw - 5, -31, 6, 2); circle(tx + tw - 2, -20, 0.9, s.coat2); circle(tx + tw - 2, -16, 0.9, s.coat2); }
        if (s.badge) { ctx.fillStyle = "#f2f2f2"; ctx.fillRect(tx + tw - 4.6, -26, 4.4, 3); }
      }
      if (s.robot) { circle(0, -22, 2.6, hexA(s.kit2, 0.9)); circle(0, -22, 4.2, null, hexA(s.kit2, 0.5), 1); }
      if (s.exo) {                                          // the Order Desk's power-loader frame
        ctx.strokeStyle = "#ffb020"; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-13, -34); ctx.lineTo(-13, -2); ctx.moveTo(13, -34); ctx.lineTo(13, -2); ctx.moveTo(-13, -34); ctx.lineTo(13, -34); ctx.moveTo(-13, -12); ctx.lineTo(13, -12); ctx.stroke();
        ctx.fillStyle = "#222222"; ctx.fillRect(-14.5, -3, 4, 3); ctx.fillRect(10.5, -3, 4, 3);
      }
      if (lod === 2) {
        if (s.emblem) emblem(s.emblem, 0, -22, s.emblemC || s.kit2, 1);
        else if (s.num) { ctx.save(); ctx.scale(c.facing, 1); ctx.fillStyle = s.kit2 === s.kit ? "#ffffff" : s.kit2; ctx.font = `bold 7.5px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(s.num), 0, -21.4); ctx.restore(); ctx.textAlign = "left"; }
        if (s.armband) { ctx.fillStyle = "#ffd34d"; ctx.fillRect(5.2, -26.6, 3.4, 2.6); }
      }
      if (s.scarf) { rr(-7, -31.5, 14, 3.4, 1.6); ctx.fillStyle = s.scarf; ctx.fill(); poly([[-6, -30], [-11 - sway, -24], [-9 - sway, -22], [-4, -28.5]], s.scarf); }
    }
    // the head
    circle(0, -38, 9.5, s.head === "robot" || s.head === "keeperbot" ? "#2a3048" : skin, OUT, 1.1);
    if (lod === 2) face(s, t, c);
    headFront(s, t, c);
    // front arm and what it holds
    const holdUp = c.card ? -2.6 : null;
    arm(8, -27, holdUp != null ? holdUp : armSw - 0.1 + idleArm, s.bulky ? 12 : 11, s.mech ? "#7d8794" : sleeve, s.mech ? "#7d8794" : hand, s.mech ? 3.6 : s.gloves ? 3.6 : 2.4);
    if (s.mech && lod === 2) { ctx.save(); ctx.translate(8, -27); ctx.rotate(armSw - 0.1); ctx.fillStyle = "#ffcc00"; ctx.fillRect(-3, 4, 6, 3); ctx.strokeStyle = "#333333"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2.5, 13); ctx.lineTo(-4, 17); ctx.moveTo(2.5, 13); ctx.lineTo(4, 17); ctx.stroke(); ctx.restore(); }
    if (c.card) {                                           // the referee's card at the verdict
      ctx.save(); ctx.translate(8, -27); ctx.rotate(-2.6); ctx.translate(0, 13);
      ctx.rotate(2.6); rr(-3.4, -12, 7, 10, 1.2); ctx.fillStyle = c.card; ctx.fill(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
    } else if (lod === 2) {
      ctx.save(); ctx.translate(8, -27); ctx.rotate(armSw - 0.1 + idleArm); ctx.translate(0, 11);
      if (s.gavel) { ctx.rotate(-0.6); ctx.fillStyle = "#6b3f1e"; ctx.fillRect(-0.8, -9, 1.6, 9); rr(-4, -12, 8, 4, 1.2); ctx.fillStyle = "#c9a7ff"; ctx.fill(); }
      if (s.tablet) { rr(-1, -3, 9, 6.5, 1); ctx.fillStyle = "#0b0f22"; ctx.fill(); ctx.strokeStyle = "#2962ff"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0.5, 1.5); ctx.lineTo(3, -0.5); ctx.lineTo(5, 0.8); ctx.lineTo(7, -1.8); ctx.stroke(); }
      if (s.mic) { ctx.fillStyle = "#222222"; ctx.fillRect(-0.8, -7, 1.6, 6); circle(0, -8, 2, "#555555"); }
      if (s.staff) { ctx.fillStyle = "#c9a227"; ctx.fillRect(-0.9, -34, 1.8, 40); circle(0, -36, 3.6, "#ff6b1a", "#ffd34d", 1); }
      if (s.crook) { ctx.strokeStyle = "#1b4fa8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -22); ctx.arc(-3, -22, 3, 0, Math.PI, true); ctx.stroke(); ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 0.8; for (let i = -18; i < 6; i += 4) { ctx.beginPath(); ctx.moveTo(-1, i); ctx.lineTo(1, i); ctx.stroke(); } }
      if (s.scroll) { rr(-1, -2, 10, 5, 2); ctx.fillStyle = "#f4e3b0"; ctx.fill(); circle(-1, 0.5, 2.4, "#d8c088"); }
      if (s.bag) { rr(-3, 0, 8, 8, 1.5); ctx.fillStyle = "#2ff3d0"; ctx.fill(); ctx.strokeStyle = "#0a0c18"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(1, 0, 2.4, Math.PI, TAU); ctx.stroke(); }
      if (s.blueprint) { ctx.rotate(0.5); rr(-1.5, -9, 3.4, 14, 1.6); ctx.fillStyle = "#3d7bff"; ctx.fill(); }
      ctx.restore();
    }
    if (s.globe && lod === 2) {                             // the macro strategist's floating globe
      const gx = 12, gy = -46 + Math.sin(t * 2) * 1.5;
      circle(gx, gy, 5, "#1b3a8a", "#9b5cff", 1); ctx.strokeStyle = hexA("#2ff3d0", 0.8); ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.ellipse(gx, gy, 2.5 * Math.abs(Math.cos(t)), 5, 0, 0, TAU); ctx.moveTo(gx - 5, gy); ctx.lineTo(gx + 5, gy); ctx.stroke();
    }
    if (s.antenna && lod === 2) { ctx.strokeStyle = "#cfd6ea"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-3, -47); ctx.lineTo(-6, -57); ctx.stroke(); circle(-6, -57, 1.6, (t * 2) % 1 < 0.5 ? s.antenna : "#ffffff"); }
    ctx.restore();
  }

  // News scouts are flying football drones: the lens shows the latest read (mint = good news, pink = bad).
  function sentCol(v) { return v == null ? "#7f8bb3" : v > 0.15 ? "#2ff3d0" : v < -0.15 ? "#ff4f9a" : "#c9d0e6"; }
  function drawDrone(d, t, lod) {
    const bob = Math.sin(t * 3 + d.seed) * 2, x = d.x, y = d.y - d.h + bob, r = d.r, col = sentCol(d.sent);
    ell(x, d.y, r * 0.9, r * 0.32, "rgba(0,0,0,.32)");
    if (lod === 0) { circle(x, y, r * 0.9, col); return; }
    if (d.hot) { circle(x, y, r + 4 + Math.sin(t * 5) * 1.2, hexA(col, 0.18)); }
    ctx.strokeStyle = "#9aa6c8"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y - r - 3); ctx.stroke();
    const blade = r * 1.4 * Math.abs(Math.cos(t * 30 + d.seed));
    ctx.strokeStyle = hexA("#e2f7ff", 0.75); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x - blade, y - r - 3); ctx.lineTo(x + blade, y - r - 3); ctx.stroke();
    circle(x, y, r, "#f4f6fb", OUT, 0.9);
    if (lod === 2) {
      poly([0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + i * TAU / 5; return [x - r * 0.15 + r * 0.38 * Math.cos(a), y + r * 0.38 * Math.sin(a)]; }), "#1a1d2e");
      for (const a of [2.4, 3.9, 0.7]) circle(x + r * 0.72 * Math.cos(a), y + r * 0.72 * Math.sin(a), r * 0.2, "#1a1d2e");
    }
    circle(x + d.dir * r * 0.5, y + r * 0.12, r * 0.36, col, "#0a0c18", 0.8);
    circle(x + d.dir * r * 0.58, y, r * 0.11, "#ffffff");
  }

  function drawBall(b) {
    ell(b.x, b.y + 1, 3, 1.2, "rgba(0,0,0,.35)");
    circle(b.x, b.y - b.h - 3, 3, "#f4f6fb", OUT, 0.6);
    poly([0, 1, 2, 3, 4].map(i => { const a = b.spin + i * TAU / 5; return [b.x + 1.15 * Math.cos(a), b.y - b.h - 3 + 1.15 * Math.sin(a)]; }), "#1a1d2e");
  }

  // ------------------------------------------------------------------ the ship: hull, corridors, rooms
  const HULL = [
    { t: "rr", x: 70, y: 110, w: 620, h: 1540, r: 70 },
    { t: "c", x: FXR.cx, y: FXR.cy, r: FXR.disc },
    { t: "c", x: NIL.cx, y: NIL.cy, r: NIL.disc },
    { t: "rr", x: 600, y: 770, w: 3200, h: 220, r: 40 },
    { t: "rr", x: 2020, y: 110, w: 500, h: 400, r: 50 },
    { t: "rr", x: 2215, y: 470, w: 110, h: 340, r: 20 },
    { t: "rr", x: 2020, y: 1250, w: 500, h: 400, r: 50 },
    { t: "rr", x: 2215, y: 950, w: 110, h: 340, r: 20 },
    { t: "p", pts: [[3700, 610], [4110, 610], [4400, 880], [4110, 1150], [3700, 1150]] },
    { t: "rr", x: 20, y: 165, w: 110, h: 200, r: 28 },
    { t: "rr", x: 20, y: 1395, w: 110, h: 200, r: 28 },
  ];
  function hullShape(h) {
    if (h.t === "c") { ctx.moveTo(h.x + h.r, h.y); ctx.arc(h.x, h.y, h.r, 0, TAU); }
    else if (h.t === "rr") { const { x, y, w, r } = h, hh = h.h; ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    else { h.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
  }

  function drawHull(t, lod) {
    ctx.lineJoin = "round";
    for (const [w, col] of [[48, "rgba(155,92,255,.10)"], [30, "#04030c"], [18, "#2f2378"], [7, "#8f72ff"]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      for (const h of HULL) { ctx.beginPath(); hullShape(h); ctx.stroke(); }
    }
    ctx.fillStyle = "#0a0c26";
    for (const h of HULL) { ctx.beginPath(); hullShape(h); ctx.fill(); }
    ctx.save();                                         // the deck is glass: deep space shows through it, dimmed
    ctx.beginPath(); for (const h of HULL) hullShape(h); ctx.clip();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 0.4;
    spaceLayers(t, true);
    ctx.restore();
    if (lod > 0) {                                     // hull plating
      ctx.save();
      ctx.beginPath(); for (const h of HULL) hullShape(h); ctx.clip();
      ctx.strokeStyle = "rgba(150,130,255,.08)"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x < 4420; x += 90) { ctx.moveTo(x, 80); ctx.lineTo(x, 1680); }
      for (let y = 110; y < 1680; y += 90) { ctx.moveTo(0, y); ctx.lineTo(4420, y); }
      ctx.stroke();
      ctx.fillStyle = "rgba(160,180,255,.08)";
      for (let x = 45; x < 4420; x += 180) for (let y = 155; y < 1680; y += 180) ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.restore();
      // portholes along the keel, some lit
      for (let x = 720; x < 3700; x += 70) {
        const lit = (hash(x) % 5) > 1 ? 0.55 + 0.25 * Math.sin(t * 0.8 + x) : 0.12;
        for (const y of [784, 976]) {
          if ((x > FXR.cx - FXR.disc && x < FXR.cx + FXR.disc) || (x > NIL.cx - NIL.disc && x < NIL.cx + NIL.disc)) continue;
          circle(x, y, 6, "#050816", "#3a4a8a", 2); circle(x, y, 3.4, hexA("#ffe7a8", lit));
        }
      }
      // disc rims: a ring of lights
      for (const [cx, cy, R, col] of [[FXR.cx, FXR.cy, FXR.disc - 16, NEON.cyan], [NIL.cx, NIL.cy, NIL.disc - 16, NEON.gold]]) {
        for (let i = 0; i < 72; i++) {
          const a = i * TAU / 72, on = (Math.floor(t * 6) + i) % 12 === 0;
          circle(cx + R * Math.cos(a), cy + R * Math.sin(a), on ? 4 : 2.4, hexA(col, on ? 0.95 : 0.35));
        }
      }
    }
    // navigation lights: red to port (top), green to starboard (bottom), a white strobe on the nose
    const blink = (t % 1.6) < 0.18;
    circle(380, 118, blink ? 9 : 5, blink ? "#ff3355" : "#661122");
    circle(380, 1642, blink ? 9 : 5, blink ? "#33ff88" : "#115533");
    circle(4392, 880, (t % 1.1) < 0.1 ? 11 : 4, (t % 1.1) < 0.1 ? "#ffffff" : "#556");
    // the comms dish and the observatory telescope stick out of the hull
    ctx.save(); ctx.translate(2420, 1668); const sc = Math.cos(t * 0.4);
    ctx.fillStyle = "#1a2350"; ctx.fillRect(-6, -30, 12, 30);
    ctx.beginPath(); ctx.ellipse(0, 6, 46 * Math.max(0.25, Math.abs(sc)), 22, 0, Math.PI, TAU); ctx.fillStyle = "#c9d3f5"; ctx.fill();
    ctx.strokeStyle = "#5b6bb8"; ctx.lineWidth = 3; ctx.stroke(); circle(0, -12, 4, (t % 2) < 1 ? NEON.cyan : "#0b3a4a");
    ctx.restore();
  }

  function thrusters(t, fresh) {
    for (const y of [265, 1495]) {
      poly([[60, y - 70], [20, y - 92], [20, y + 92], [60, y + 70]], "#1a2350", "#5b6bb8", 4);
      ctx.fillStyle = "#05070f"; ctx.fillRect(16, y - 88, 10, 176);
      if (fresh <= 0) continue;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 3; k++) {
        const len = (210 + 90 * k) * fresh * (0.85 + 0.15 * Math.sin(t * 22 + k * 2 + y));
        const g = ctx.createLinearGradient(20, 0, 20 - len, 0);
        g.addColorStop(0, k === 0 ? "rgba(230,250,255,.9)" : k === 1 ? "rgba(25,230,255,.55)" : "rgba(155,92,255,.35)");
        g.addColorStop(1, "rgba(155,92,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(20, y - 70 + k * 12); ctx.quadraticCurveTo(20 - len * 0.6, y, 20, y + 70 - k * 12);
        ctx.lineTo(20 - len, y); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  // Corridors: walls first, then floors, then the running lights.
  const SEGS = [
    [[620, 265], [620, 1495]], [[620, SPINE_Y], [FXR.cx - FXR.r1 + 6, SPINE_Y]], [[FXR.cx + FXR.r1 - 6, SPINE_Y], [NIL.cx - NIL.r1 + 6, SPINE_Y]],
    [[NIL.cx + NIL.r1 - 6, SPINE_Y], [3760, SPINE_Y]], [[2270, 470], [2270, SPINE_Y]], [[2270, SPINE_Y], [2270, 1290]],
  ];
  const AIRLOCKS = ROOM_LIST.filter(r => r.ring).map(r => {
    const cx = r.ring === "fx" ? FXR.cx : NIL.cx, cy = r.ring === "fx" ? FXR.cy : NIL.cy, R = r.ring === "fx" ? FXR.r1 : NIL.r1;
    const a = r.deg * D2R;
    return [[cx + (R - 6) * Math.cos(a), cy + (R - 6) * Math.sin(a)], [r.door.x, r.door.y], r];
  });
  const SPOKES = [0, 90, 180, 270].map(d => [[FXR.cx + (FXR.hub - 6) * Math.cos(d * D2R), FXR.cy + (FXR.hub - 6) * Math.sin(d * D2R)],
                                            [FXR.cx + (FXR.r0 + 6) * Math.cos(d * D2R), FXR.cy + (FXR.r0 + 6) * Math.sin(d * D2R)]]);
  const BRIDGES = [0, 90, 180].map(d => [[NIL.cx + (NIL.island - 8) * Math.cos(d * D2R), NIL.cy + (NIL.island - 8) * Math.sin(d * D2R)],
                                         [NIL.cx + (NIL.r0 + 6) * Math.cos(d * D2R), NIL.cy + (NIL.r0 + 6) * Math.sin(d * D2R)]]);
  function seg(list, w, col, cap) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = cap || "butt"; ctx.beginPath();
    for (const [a, b] of list) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke(); ctx.lineCap = "butt";
  }
  function drawCorridors(t, lod) {
    // walls
    seg(SEGS, 74, "#05070f", "square"); seg(AIRLOCKS, 56, "#05070f"); seg(SPOKES, 66, "#05070f");
    for (const [cx, cy, r0, r1] of [[FXR.cx, FXR.cy, FXR.r0, FXR.r1], [NIL.cx, NIL.cy, NIL.r0, NIL.r1]]) {
      ctx.strokeStyle = "#05070f"; ctx.lineWidth = r1 - r0 + 14; ctx.beginPath(); ctx.arc(cx, cy, (r0 + r1) / 2, 0, TAU); ctx.stroke();
    }
    // the Nile: a moat of moving water around the High Court's island
    const wg = ctx.createRadialGradient(NIL.cx, NIL.cy, NIL.island, NIL.cx, NIL.cy, NIL.r0);
    wg.addColorStop(0, "#0d5fa8"); wg.addColorStop(1, "#073a6e");
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(NIL.cx, NIL.cy, NIL.r0, 0, TAU); ctx.arc(NIL.cx, NIL.cy, NIL.island, 0, TAU, true); ctx.fill();
    if (lod > 0) {
      ctx.strokeStyle = "rgba(170,225,255,.22)"; ctx.lineWidth = 2.2;
      for (let k = 0; k < 7; k++) {
        const r = NIL.island + 8 + ((t * 7 + k * 11) % 76), a0 = (t * 0.12 + k * 0.9) % TAU;
        ctx.beginPath(); ctx.arc(NIL.cx, NIL.cy, r, a0, a0 + 0.5 + (k % 3) * 0.25); ctx.stroke();
      }
      for (let k = 0; k < 6; k++) {                     // lotus pads drift around the moat
        const a = t * 0.03 + k * 1.05, r = NIL.island + 26 + (k % 3) * 22;
        const x = NIL.cx + r * Math.cos(a), y = NIL.cy + r * Math.sin(a);
        ell(x, y, 9, 6, "#1f7a4a"); if (k % 2 === 0) { circle(x + 2, y - 2, 3.2, "#ff9ad5"); circle(x + 2, y - 2, 1.4, "#ffe3f2"); }
      }
    }
    // floors
    seg(SEGS, 58, "#161d3f", "square"); seg(AIRLOCKS, 42, "#1a2148"); seg(SPOKES, 50, "#1a1640");
    ctx.strokeStyle = "#161d3f"; ctx.lineWidth = FXR.r1 - FXR.r0; ctx.beginPath(); ctx.arc(FXR.cx, FXR.cy, (FXR.r0 + FXR.r1) / 2, 0, TAU); ctx.stroke();
    ctx.strokeStyle = "#2a2418"; ctx.lineWidth = NIL.r1 - NIL.r0; ctx.beginPath(); ctx.arc(NIL.cx, NIL.cy, (NIL.r0 + NIL.r1) / 2, 0, TAU); ctx.stroke();
    // bridges over the moat: sandstone planks with rails
    for (const [a, b] of BRIDGES) {
      seg([[a, b]], 50, "#3b301d"); seg([[a, b]], 46, "#5a4a2c");
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 2;
      for (const s of [-23, 23]) { ctx.beginPath(); ctx.moveTo(a[0] + nx * s, a[1] + ny * s); ctx.lineTo(b[0] + nx * s, b[1] + ny * s); ctx.stroke(); }
      if (lod > 0) { ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.5; for (let i = 6; i < L; i += 9) { const x = a[0] + dx * i / L, y = a[1] + dy * i / L; ctx.beginPath(); ctx.moveTo(x + nx * 22, y + ny * 22); ctx.lineTo(x - nx * 22, y - ny * 22); ctx.stroke(); } }
    }
    if (lod === 0) return;
    // edge trims and running lights
    ctx.lineWidth = 2;
    for (const [cx, cy, r0, r1, col] of [[FXR.cx, FXR.cy, FXR.r0, FXR.r1, NEON.cyan], [NIL.cx, NIL.cy, NIL.r0, NIL.r1, NEON.gold]]) {
      ctx.strokeStyle = hexA(col, 0.45);
      for (const r of [r0 + 2, r1 - 2]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); }
      ctx.setLineDash([10, 26]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = hexA(col, 0.55); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, (r0 + r1) / 2, 0, TAU); ctx.stroke(); ctx.lineWidth = 2;
    }
    ctx.setLineDash([12, 30]); ctx.lineDashOffset = -t * 55; seg(SEGS, 3, hexA(NEON.cyan, 0.5));
    ctx.lineDashOffset = t * 55; seg(SPOKES, 3, hexA(NEON.violet, 0.65));
    ctx.setLineDash([]);
    for (const [a, b] of SEGS) {                       // hazard chevrons where corridors meet
      for (const p of [a, b]) { ctx.fillStyle = "rgba(255,209,102,.18)"; ctx.fillRect(p[0] - 6, p[1] - 6, 12, 12); }
    }
  }

  function roomPath(r) {
    ctx.beginPath();
    if (r.shape === "circle") ctx.arc(r.cx, r.cy, r.r, 0, TAU);
    else if (r.shape === "poly") { r.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
    else { const k = 16, { x, y, w, h } = r; ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k); ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath(); }
  }
  const FLOOR = { pair: "#081a1b", sector: "#17130d", observatory: "#0a1426", tribunal: "#140b2e", court: "#3a2f1d", macro: "#06181a",
                  comms: "#061325", bridge: "#0b1230", orders: "#15130c", lab: "#0f0d24", reactor: "#071419", engine: "#120c0a" };

  function doorGap(r) {
    const d = r.door; if (!d) return;
    ctx.fillStyle = r.kind === "sector" || r.kind === "observatory" ? "#1a2148" : "#1a2148";
    const vert = d.side === "left" || d.side === "right";
    if (vert) ctx.fillRect(d.x - 8, d.y - 21, 16, 42); else ctx.fillRect(d.x - 21, d.y - 8, 42, 16);
    ctx.fillStyle = r.accent;
    if (vert) { ctx.fillRect(d.x - 7, d.y - 25, 14, 4); ctx.fillRect(d.x - 7, d.y + 21, 14, 4); }
    else { ctx.fillRect(d.x - 25, d.y - 7, 4, 14); ctx.fillRect(d.x + 21, d.y - 7, 4, 14); }
  }

  function drawRoomShell(r, t, lod) {
    roomPath(r); ctx.fillStyle = FLOOR[r.kind] || "#0b1028"; ctx.fill();
    if (r.kind === "pair" || r.kind === "sector" || r.kind === "observatory") { roomPath(r); ctx.fillStyle = hexA(r.accent, 0.06); ctx.fill(); }
    if (lod > 0) floorArt(r, t);
    roomPath(r); ctx.strokeStyle = "#05070f"; ctx.lineWidth = 12; ctx.stroke();
    const pulse = r.live ? 0.55 + 0.45 * Math.sin(t * 3) : 1;
    roomPath(r); ctx.strokeStyle = hexA(r.accent, 0.14 * pulse); ctx.lineWidth = 10; ctx.stroke();
    roomPath(r); ctx.strokeStyle = hexA(r.accent, 0.9 * pulse); ctx.lineWidth = 2.4; ctx.stroke();
    if (r.shape === "circle") {
      for (const id of r.doors) {
        const n = NODES[id], a = Math.atan2(n.y - r.cy, n.x - r.cx);
        ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(a); ctx.fillStyle = r.kind === "court" ? "#5a4a2c" : "#1a1640"; ctx.fillRect(-8, -22, 16, 44);
        ctx.fillStyle = r.accent; ctx.fillRect(-7, -26, 14, 4); ctx.fillRect(-7, 22, 14, 4); ctx.restore();
      }
    } else doorGap(r);
  }

  function pitchLines(r) {
    const x = r.x + 14, y = r.y + 14, w = r.w - 28, h = r.h - 28;
    ctx.strokeStyle = "rgba(220,255,240,.11)"; ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 20, 0, TAU); ctx.stroke();
    ctx.strokeRect(x, y + h / 2 - 32, 24, 64); ctx.strokeRect(x + w - 24, y + h / 2 - 32, 24, 64);
    ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 2;
    ctx.strokeRect(x - 5, y + h / 2 - 14, 5, 28); ctx.strokeRect(x + w, y + h / 2 - 14, 5, 28);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? "rgba(255,255,255,.015)" : "rgba(0,0,0,.05)"; ctx.fillRect(x + i * w / 6, y, w / 6, h); }
  }

  function floorArt(r, t) {
    const { x, y, w, h } = r;
    switch (r.kind) {
      case "pair": pitchLines(r); break;
      case "sector": case "observatory": {
        ctx.strokeStyle = hexA(r.accent, 0.22); ctx.lineWidth = 1.4; ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
        ctx.fillStyle = hexA(r.accent, 0.2);
        for (let i = x + 22; i < x + w - 16; i += 22) {               // a band of little glyphs, temple style
          for (const yy of [y + 15, y + h - 15]) { if (((i - x) / 22) % 2 < 1) { ctx.fillRect(i - 1, yy - 3, 2, 6); ctx.fillRect(i - 3, yy - 1, 6, 2); } else { ctx.beginPath(); ctx.arc(i, yy, 2.4, 0, TAU); ctx.fill(); } }
        }
        break;
      }
      case "tribunal": {
        const g = ctx.createRadialGradient(r.cx, r.cy, 20, r.cx, r.cy, r.r); g.addColorStop(0, "#2a1660"); g.addColorStop(1, "#0e0724");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.cx, r.cy, r.r - 2, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(201,167,255,.14)"; ctx.lineWidth = 1.4;
        for (const rr2 of [70, 112, 150, 192]) { ctx.beginPath(); ctx.arc(r.cx, r.cy, rr2, 0, TAU); ctx.stroke(); }
        const R = seeded(77); let px = null, py = null;
        ctx.strokeStyle = "rgba(201,167,255,.22)";
        for (let i = 0; i < 18; i++) {                  // a constellation in the marble
          const a = R() * TAU, d = 60 + R() * 160, sx = r.cx + d * Math.cos(a), sy = r.cy + d * Math.sin(a);
          circle(sx, sy, 1.8 + R() * 1.6, hexA("#ffffff", 0.4 + 0.3 * Math.sin(t * 2 + i)));
          if (px != null && i % 3) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke(); }
          px = sx; py = sy;
        }
        break;
      }
      case "court": {
        const g = ctx.createRadialGradient(r.cx, r.cy, 30, r.cx, r.cy, r.r); g.addColorStop(0, "#5c4a2a"); g.addColorStop(1, "#33291a");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.cx, r.cy, r.r - 2, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(255,211,77,.07)"; ctx.lineWidth = 10;
        for (let i = 0; i < 24; i++) { const a = i * TAU / 24; ctx.beginPath(); ctx.moveTo(r.cx, r.cy); ctx.lineTo(r.cx + r.r * Math.cos(a), r.cy + r.r * Math.sin(a)); ctx.stroke(); }
        ctx.strokeStyle = "rgba(255,211,77,.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.cx, r.cy, r.r - 14, 0, TAU); ctx.stroke();
        break;
      }
      case "bridge": case "macro": case "comms": case "lab": {
        ctx.save(); roomPath(r); ctx.clip();
        ctx.strokeStyle = hexA(r.accent, 0.08); ctx.lineWidth = 1.2; ctx.beginPath();
        if (r.kind === "macro") {                       // hex deck
          for (let yy = y; yy < y + h + 30; yy += 26) for (let xx = x + ((yy / 26) % 2 ? 15 : 0); xx < x + w + 30; xx += 30) {
            for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; k ? ctx.lineTo(xx + 14 * Math.cos(a), yy + 14 * Math.sin(a)) : ctx.moveTo(xx + 14, yy); }
            ctx.closePath();
          }
        } else { for (let xx = x; xx < x + w; xx += 28) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); } for (let yy = y; yy < y + h; yy += 28) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); } }
        ctx.stroke(); ctx.restore();
        break;
      }
      case "orders": case "reactor": case "engine": {
        ctx.save(); roomPath(r); ctx.clip();
        ctx.fillStyle = "rgba(255,209,102,.13)";
        for (let i = x - h; i < x + w; i += 28) { ctx.beginPath(); ctx.moveTo(i, y + 14); ctx.lineTo(i + 14, y + 14); ctx.lineTo(i + 28, y); ctx.lineTo(i + 14, y); ctx.fill(); ctx.beginPath(); ctx.moveTo(i, y + h); ctx.lineTo(i + 14, y + h); ctx.lineTo(i + 28, y + h - 14); ctx.lineTo(i + 14, y + h - 14); ctx.fill(); }
        ctx.strokeStyle = "rgba(255,255,255,.035)"; ctx.lineWidth = 1; ctx.beginPath();
        for (let xx = x; xx < x + w; xx += 12) { ctx.moveTo(xx, y + 16); ctx.lineTo(xx, y + h - 16); }
        ctx.stroke(); ctx.restore();
        break;
      }
      default: break;
    }
  }

  function holoText(txt, x, y, size, col, align, bold) {
    ctx.font = `${bold ? "bold " : ""}${size}px ${FONT}`; ctx.textAlign = align || "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = col; ctx.fillText(txt, x, y); ctx.textAlign = "left";
  }
  function panel(x, y, w, h, col) {
    rr(x, y, w, h, 5); ctx.fillStyle = "rgba(3,6,18,.92)"; ctx.fill(); ctx.strokeStyle = hexA(col, 0.75); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = hexA(col, 0.06); for (let yy = y + 3; yy < y + h; yy += 4) ctx.fillRect(x + 2, yy, w - 4, 1);
  }
  const RATE_COL = { "STRONG BUY": "#2ff3d0", BUY: "#56d39a", NEUTRAL: "#7f8bb3", SELL: "#ff7a9a", "STRONG SELL": "#ff2b5c" };

  function flag(ccy, x, y, w, h) {
    switch (ccy) {
      case "USD": ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#b22234"; for (let i = 0; i < 7; i++) ctx.fillRect(x, y + i * h / 6.5, w, h / 13); ctx.fillStyle = "#3c3b6e"; ctx.fillRect(x, y, w * 0.42, h * 0.54); break;
      case "EUR": ctx.fillStyle = "#003399"; ctx.fillRect(x, y, w, h); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; circle(x + w / 2 + h * 0.3 * Math.cos(a), y + h / 2 + h * 0.3 * Math.sin(a), 0.9, "#ffcc00"); } break;
      case "GBP": ctx.fillStyle = "#012169"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.fillRect(x + w / 2 - 2.5, y, 5, h); ctx.fillRect(x, y + h / 2 - 2.5, w, 5); ctx.fillStyle = "#c8102e"; ctx.fillRect(x + w / 2 - 1.4, y, 2.8, h); ctx.fillRect(x, y + h / 2 - 1.4, w, 2.8); break;
      case "JPY": ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, w, h); circle(x + w / 2, y + h / 2, h * 0.3, "#bc002d"); break;
      case "AUD": case "NZD": ctx.fillStyle = "#012169"; ctx.fillRect(x, y, w, h); for (const [a, b] of [[0.7, 0.25], [0.6, 0.55], [0.8, 0.5], [0.72, 0.8]]) star(x + w * a, y + h * b, 1.6, 5, ccy === "NZD" ? "#cc142b" : "#ffffff"); ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y + h * 0.22, w * 0.42, 1.2); ctx.fillRect(x + w * 0.2, y, 1.2, h * 0.5); break;
      case "CAD": ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#d52b1e"; ctx.fillRect(x, y, w * 0.26, h); ctx.fillRect(x + w * 0.74, y, w * 0.26, h); emblem("leaf", x + w / 2, y + h / 2, "#d52b1e", h / 11); break;
      case "CHF": ctx.fillStyle = "#d52b1e"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#ffffff"; ctx.fillRect(x + w / 2 - 1.6, y + h * 0.2, 3.2, h * 0.6); ctx.fillRect(x + w / 2 - h * 0.3, y + h / 2 - 1.6, h * 0.6, 3.2); break;
      case "BTC": ctx.fillStyle = "#1a1a1a"; ctx.fillRect(x, y, w, h); circle(x + w / 2, y + h / 2, h * 0.38, "#f7931a"); holoText("₿", x + w / 2, y + h / 2 + 0.5, h * 0.55, "#ffffff", "center", true); break;
      case "XAU": { const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#fff3c4"); g.addColorStop(0.5, "#d4af37"); g.addColorStop(1, "#8a6a1a"); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); holoText("Au", x + w / 2, y + h / 2 + 0.5, h * 0.5, "#5c3d0a", "center", true); break; }
      default: break;
    }
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 0.8; ctx.strokeRect(x, y, w, h);
  }

  // ---- room furniture and live displays ------------------------------------------------------------------
  function drawPairRoom(r, t, lod) {
    const I = r.info || {}, top = r.door.side !== "top", sy = top ? r.y - 24 : r.y + r.h + 24;
    flag(r.base, r.x + 18, top ? r.y + 14 : r.y + r.h - 30, 26, 16);
    flag(r.quote, r.x + r.w - 44, top ? r.y + 14 : r.y + r.h - 30, 26, 16);
    if (lod > 0) {
    // the sign outside the pod: the pair, its live price and TradingView's five ratings (1h to 1M)
    const sx = r.x + r.w / 2;
    panel(sx - 84, sy - 17, 168, 34, r.accent);
    const cells = ["1h", "4h", "1D", "1W", "1M"];
    cells.forEach((k, i) => { const v = (I.ratings || {})[k]; ctx.fillStyle = RATE_COL[v] || "#2a3150"; ctx.fillRect(sx - 80 + i * 32.4, sy + 9, 30, 4.5); });
    if (lod === 2) {
      holoText(r.short, sx - 79, sy - 4, 10, r.accent, "left", true);
      holoText(I.price != null ? fmtPrice(I.price) : "--", sx + 22, sy - 4, 11, "#e2f7ff", "right", true);
      if (I.chg != null) holoText((I.chg >= 0 ? "+" : "") + I.chg.toFixed(2) + "%", sx + 80, sy - 4, 10, I.chg >= 0 ? "#2ff3d0" : "#ff4f9a", "right", true);
    }
    }
    // the quant's regime orb and the analyst's console
    const yy = top ? r.y + r.h * 0.6 : r.y + r.h * 0.42, ox = r.x + r.w * 0.72, cx2 = r.x + r.w * 0.28;
    ell(ox, yy + 6, 18, 7, "#141a36"); ctx.strokeStyle = hexA(r.accent, 0.6); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(ox, yy + 6, 18, 7, 0, 0, TAU); ctx.stroke();
    const rc = I.regime === "BULL" ? "#2ff3d0" : I.regime === "BEAR" ? "#ff4f6a" : "#ffd166";
    circle(ox, yy - 8, 13 + Math.sin(t * 2.4) * 1.2, hexA(rc, 0.12));
    circle(ox, yy - 8, 8, hexA(rc, 0.55), rc, 1.4);
    if (I.pBull != null) { ctx.strokeStyle = rc; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(ox, yy - 8, 11.5, -Math.PI / 2, -Math.PI / 2 + TAU * I.pBull); ctx.stroke(); }
    if (lod === 0) return;
    if (lod === 2 && I.regime) holoText(I.regime + (I.pBull != null ? " " + I.pBull.toFixed(2) : ""), ox, yy + 20, 7.5, rc, "center", true);
    rr(cx2 - 18, yy, 36, 9, 2); ctx.fillStyle = "#1a2148"; ctx.fill();
    rr(cx2 - 13, yy - 16, 26, 15, 2); ctx.fillStyle = "#04081a"; ctx.fill(); ctx.strokeStyle = r.accent; ctx.lineWidth = 1; ctx.stroke();
    const fv = I.fund;
    if (fv != null) {                                    // the fundamental view as an arrow
      const up = fv > 0, col = fv > 0 ? "#2ff3d0" : fv < 0 ? "#ff4f9a" : "#7f8bb3";
      ctx.fillStyle = col; ctx.beginPath();
      if (fv === 0) ctx.fillRect(cx2 - 6, yy - 9.5, 12, 2.2);
      else { ctx.moveTo(cx2, yy - (up ? 14 : 3)); ctx.lineTo(cx2 - 5, yy - (up ? 8 : 9)); ctx.lineTo(cx2 + 5, yy - (up ? 8 : 9)); ctx.closePath(); ctx.fill(); }
    }
    // a live trade: the room pulses and a banner shows the side and the profit
    if (I.pos && lod > 0) {
      const by = top ? r.y + r.h - 26 : r.y + 10, pnl = I.pos.upnl;
      panel(r.x + 30, by, r.w - 60, 17, pnl >= 0 ? "#2ff3d0" : "#ff4f9a");
      if (lod === 2) holoText(`LIVE ${I.pos.dir}  ${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`, r.x + r.w / 2, by + 8.8, 9, pnl >= 0 ? "#2ff3d0" : "#ff4f9a", "center", true);
    }
  }
  function fmtPrice(p) { return p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 0 }) : p >= 100 ? p.toFixed(2) : p.toFixed(p >= 10 ? 3 : 5); }

  function sectorDecor(r, t, lod) {
    const g = podGeo(r), [dx, dy] = g.decor, a = r.accent;
    switch (r.id) {
      case "banks":                                      // a vault door and stacks of coins
        circle(dx, dy, 30, "#2a2f45", "#d4af37", 3); circle(dx, dy, 20, "#1b1f30", "#8a6a1a", 2);
        ctx.save(); ctx.translate(dx, dy); ctx.rotate(t * 0.3);
        ctx.strokeStyle = "#d4af37"; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -17); ctx.stroke(); }
        ctx.restore(); circle(dx, dy, 4, "#d4af37");
        for (let k = 0; k < 3; k++) for (let i = 0; i < 4 + k; i++) ell(dx + 46 - k * 9, dy + 22 - i * 3.4, 7, 2.6, i % 2 ? "#ffd34d" : "#d4af37");
        break;
      case "nbfi":                                       // holographic ledgers
        for (let i = 0; i < 5; i++) { const hh = 14 + ((i * 37 + Math.floor(t)) % 5) * 7; ctx.fillStyle = hexA(a, 0.55); ctx.fillRect(dx - 40 + i * 17, dy + 22 - hh, 11, hh); }
        holoText("%", dx + 48, dy - 4, 26, hexA(a, 0.8), "center", true);
        break;
      case "realestate":                                 // a hologram skyline with a pyramid
        poly([[dx - 50, dy + 24], [dx - 32, dy - 8], [dx - 14, dy + 24]], hexA("#ffd34d", 0.5));
        [[-8, 40], [6, 56], [20, 34], [34, 48]].forEach(([ox, hh], i) => { ctx.fillStyle = hexA(a, 0.35 + 0.1 * i); ctx.fillRect(dx + ox, dy + 24 - hh, 12, hh);
          ctx.fillStyle = hexA("#fff3c4", 0.6); for (let w = 0; w < hh - 6; w += 7) if ((w + i) % 14 < 7) ctx.fillRect(dx + ox + 3, dy + 20 - w, 2.4, 2.4); });
        ctx.strokeStyle = hexA(a, 0.4); ctx.beginPath(); ctx.ellipse(dx, dy + 26, 58, 8, 0, 0, TAU); ctx.stroke();
        break;
      case "materials":                                  // ore crystals and a silo
        [[-30, 0, 18], [-14, 6, 26], [4, 2, 16], [-22, 14, 12]].forEach(([ox, oy, hh], i) =>
          poly([[dx + ox - 6, dy + oy + 12], [dx + ox, dy + oy + 12 - hh], [dx + ox + 6, dy + oy + 12]], hexA(i % 2 ? "#ff7a1a" : "#ffb070", 0.75), "#ffd8b0", 0.8));
        rr(dx + 24, dy - 26, 26, 46, 10); ctx.fillStyle = "#3a404a"; ctx.fill(); ctx.strokeStyle = "#ff7a1a"; ctx.lineWidth = 1.5; ctx.stroke();
        break;
      case "industrials":                                // a turning gear and a robot arm
        ctx.save(); ctx.translate(dx - 16, dy); ctx.rotate(t * 0.8); ctx.fillStyle = "#ffd21f";
        for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.fillRect(-4, -28, 8, 9); } circle(0, 0, 21, "#ffd21f"); circle(0, 0, 8, "#17130d"); ctx.restore();
        ctx.strokeStyle = "#7d8794"; ctx.lineWidth = 6; ctx.lineCap = "round"; const sw2 = Math.sin(t * 1.2) * 0.4;
        ctx.beginPath(); ctx.moveTo(dx + 40, dy + 22); ctx.lineTo(dx + 34 + 14 * Math.sin(sw2), dy - 4); ctx.lineTo(dx + 20 + 18 * Math.sin(sw2 + 0.8), dy - 16); ctx.stroke(); ctx.lineCap = "butt";
        break;
      case "consumer":                                   // a market stall with a striped awning
        ctx.fillStyle = "#2a1d2e"; ctx.fillRect(dx - 42, dy - 6, 84, 30);
        for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? "#2ff3d0" : "#ff4f9a"; ctx.fillRect(dx - 46 + i * 13.2, dy - 20, 13.2, 14); }
        for (let i = 0; i < 6; i++) circle(dx - 32 + i * 13, dy + 8, 4.2, ["#ffd34d", "#ff6b35", "#39ff14", "#ff4f9a", "#19e6ff", "#ffffff"][i]);
        break;
      case "tmt":                                        // server racks with blinking lights
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = "#0b1230"; ctx.fillRect(dx - 48 + k * 25, dy - 28, 20, 54); ctx.strokeStyle = hexA(a, 0.6); ctx.lineWidth = 1; ctx.strokeRect(dx - 48 + k * 25, dy - 28, 20, 54);
          for (let i = 0; i < 8; i++) { const on = (hash(k * 31 + i) + Math.floor(t * 4)) % 3 === 0; circle(dx - 43 + k * 25 + (i % 2) * 9, dy - 22 + Math.floor(i / 2) * 12, 1.6, on ? "#b6ff00" : "#1d3a10"); }
        }
        break;
      case "observatory": {                              // a telescope and a map of the Nile
        ctx.save(); ctx.translate(dx + 20, dy + 10); ctx.rotate(-0.7 + Math.sin(t * 0.2) * 0.1);
        rr(-8, -46, 16, 52, 6); ctx.fillStyle = "#c9d3f5"; ctx.fill(); ctx.strokeStyle = "#3fb6ff"; ctx.lineWidth = 1.5; ctx.stroke(); circle(0, -46, 7, "#0b2a4a", "#3fb6ff", 1.2);
        ctx.restore();
        ctx.strokeStyle = hexA("#3fb6ff", 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dx - 40, dy + 30); ctx.bezierCurveTo(dx - 30, dy + 6, dx - 50, dy - 6, dx - 36, dy - 28); ctx.stroke();
        [[-36, -28], [-43, -4], [-35, 18]].forEach(([ox, oy]) => circle(dx + ox, dy + oy, 2.6, "#ffd34d"));
        break;
      }
      default: break;
    }
    // sector view lamp
    const I = r.info || {};
    if (I.view) {
      const col = /BULL|POSITIVE|BUY/.test(I.view) ? "#2ff3d0" : /BEAR|NEGATIVE|SELL/.test(I.view) ? "#ff4f9a" : "#ffd166";
      const lx = r.x + 16, ly = r.door.side === "top" ? r.y + r.h - 26 : r.y + 12;
      panel(lx, ly, 78, 15, col);
      if (lod === 2) holoText(I.view, lx + 39, ly + 7.8, 8.5, col, "center", true);
    }
    // holdings in this sector: gold crates with the ticker and the profit
    (I.holdings || []).forEach((h, i) => {
      const hx = r.x + r.w - 58 - i * 46, hy = r.door.side === "top" ? r.y + r.h - 30 : r.y + 12;
      rr(hx, hy, 42, 17, 3); ctx.fillStyle = "#5c4614"; ctx.fill(); ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 1.4; ctx.stroke();
      if (lod === 2) holoText(`${h.ticker} ${h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(1)}%`, hx + 21, hy + 9, 7.2, h.pnl >= 0 ? "#2ff3d0" : "#ff9ab8", "center", true);
    });
    // the analyst's desk
    const [ax, ay] = g.desk;
    rr(ax - 20, ay - 4, 40, 10, 2); ctx.fillStyle = "#2a2418"; ctx.fill(); ctx.strokeStyle = hexA(a, 0.7); ctx.lineWidth = 1; ctx.stroke();
    rr(ax - 12, ay - 18, 24, 13, 2); ctx.fillStyle = "#04081a"; ctx.fill(); ctx.strokeStyle = a; ctx.stroke();
    ctx.strokeStyle = hexA(a, 0.9); ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const px = ax - 10 + i * 4, py = ay - 11 + Math.sin(t * 2 + i + r.deg) * 3; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  }

  function drawTribunal(r, t, lod) {
    const { cx, cy } = r, I = r.info || {};
    for (let k = 0; k < 12; k++) {                      // the jurors' floating stools
      const a = (15 + 30 * k) * D2R; ell(cx + FXR.seat * Math.cos(a), cy + FXR.seat * Math.sin(a) + 8, 9, 4, hexA("#c9a7ff", 0.3));
    }
    circle(cx, cy, 52, "#1e1048", "#c9a7ff", 2.6);
    circle(cx, cy, 44 + Math.sin(t * 2) * 2, null, hexA("#ff2bd6", 0.5), 1.4);
    // a hologram of the scales of justice above the podium
    ctx.save(); ctx.translate(cx, cy - 64); ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "#c9a7ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(0, -4); ctx.stroke();
    const tilt = Math.sin(t * 0.9) * 0.12 + (I.tilt || 0);
    ctx.rotate(tilt); ctx.beginPath(); ctx.moveTo(-26, -4); ctx.lineTo(26, -4); ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 26, -4); ctx.lineTo(s * 20, 8); ctx.moveTo(s * 26, -4); ctx.lineTo(s * 32, 8); ctx.stroke(); ctx.beginPath(); ctx.ellipse(s * 26, 9, 8, 2.6, 0, 0, TAU); ctx.fillStyle = hexA("#c9a7ff", 0.5); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1;
    if (lod === 2 && I.headline && !(meeting && meeting.chamber === "tribunal")) {
      panel(cx - 190, cy + 96, 380, 54, "#c9a7ff");
      holoText("LAST REVIEW · " + I.when, cx, cy + 112, 11, "#c9a7ff", "center", true);
      holoText(clip(I.headline, 52), cx, cy + 134, 12, "#e2f7ff", "center");
    }
  }
  function clip(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  function drawCourt(r, t, lod) {
    const { cx, cy } = r, I = r.info || {};
    for (let k = 0; k < 12; k++) { const a = (15 + 150 * k / 11) * D2R; rr(cx + NIL.seat * Math.cos(a) - 9, cy + NIL.seat * Math.sin(a) + 2, 18, 7, 2); ctx.fillStyle = "#8a6a3a"; ctx.fill(); }
    // palms at the island's edge
    for (const a of [200, 232, 308, 340]) {
      const px = cx + 205 * Math.cos(a * D2R), py = cy + 205 * Math.sin(a * D2R);
      ctx.strokeStyle = "#7a5a2a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px, py + 18); ctx.quadraticCurveTo(px + 6, py, px + 2, py - 14); ctx.stroke();
      for (let i = 0; i < 5; i++) { const fa = -Math.PI / 2 + (i - 2) * 0.55 + Math.sin(t + i + a) * 0.05; ctx.strokeStyle = "#2f9a5a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + 2, py - 14); ctx.quadraticCurveTo(px + 2 + 12 * Math.cos(fa), py - 14 + 12 * Math.sin(fa) - 4, px + 2 + 20 * Math.cos(fa), py - 14 + 20 * Math.sin(fa) + 6); ctx.stroke(); }
    }
    // the pyramid: two lit faces, brick courses, a glowing capstone
    const P = PYRAMID;
    poly([[P.l, P.base], [cx, P.apex], [cx, P.base]], "#e2c27a"); poly([[cx, P.base], [cx, P.apex], [P.r, P.base]], "#b8954a");
    if (lod > 0) {
      ctx.strokeStyle = "rgba(90,60,20,.28)"; ctx.lineWidth = 1.2;
      for (let y = P.base - 16; y > P.apex + 30; y -= 16) { const hw = 150 * (y - P.apex) / (P.base - P.apex); ctx.beginPath(); ctx.moveTo(cx - hw, y); ctx.lineTo(cx + hw, y); ctx.stroke(); }
    }
    const cap = 34, capY = P.apex + cap, chw = 150 * cap / (P.base - P.apex);
    circle(cx, P.apex + 12, 26 + Math.sin(t * 2) * 3, hexA("#ffd34d", 0.18));
    poly([[cx - chw, capY], [cx, P.apex], [cx + chw, capY]], "#ffd34d", "#fff3c4", 1.4);
    // the eye on the front face
    if (lod > 0) {
      ctx.save(); ctx.translate(cx - 34, P.base - 70);
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(0, -10, 14, 0); ctx.quadraticCurveTo(0, 10, -14, 0); ctx.fillStyle = "rgba(20,30,60,.75)"; ctx.fill();
      circle(0, 0, 4.4, "#19e6ff"); ctx.strokeStyle = "#1b2a4a"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(-4, 13); ctx.stroke(); ctx.restore();
    }
    rr(cx - 10, P.base - 22, 20, 22, 3); ctx.fillStyle = "#2a1d0e"; ctx.fill();
    // the throne
    rr(cx - 18, cy + 18, 36, 22, 4); ctx.fillStyle = "#d4af37"; ctx.fill(); rr(cx - 14, cy + 8, 28, 14, 4); ctx.fillStyle = "#1b4fa8"; ctx.fill();
    // the scales of Ma'at: approved against held back
    ctx.save(); ctx.translate(cx + 96, cy + 52);
    ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(0, -10); ctx.stroke();
    ctx.rotate((I.tilt || 0) + Math.sin(t) * 0.04); ctx.beginPath(); ctx.moveTo(-22, -10); ctx.lineTo(22, -10); ctx.stroke();
    ell(-22, 0, 8, 2.6, "#ffd34d"); ell(22, 0, 8, 2.6, "#ffd34d");
    ctx.strokeStyle = "#f4f4f4"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-22, -1); ctx.quadraticCurveTo(-18, -9, -23, -15); ctx.stroke();
    circle(22, -4, 3.4, "#ff4f6a");
    ctx.restore();
    if (lod === 2 && I.headline && !(meeting && meeting.chamber === "court")) {
      panel(cx - 210, cy - 326, 420, 56, "#ffd34d");
      holoText(I.stamp || "", cx, cy - 310, 11, "#ffd34d", "center", true);
      holoText(clip(I.headline, 58), cx, cy - 288, 12, "#fff3c4", "center");
    }
  }

  function drawBridge(r, t, lod) {
    const I = r.info || {};
    // the window at the nose: space rushing past
    ctx.save(); ctx.beginPath(); ctx.moveTo(4090, 700); ctx.lineTo(4300, 880); ctx.lineTo(4090, 1060); ctx.closePath(); ctx.clip();
    ctx.fillStyle = "#01020a"; ctx.fillRect(4080, 690, 230, 380);
    for (let i = 0; i < 26; i++) { const yy = 700 + (hash(i * 7) % 360), sp = 120 + (hash(i) % 160), xx = 4310 - ((t * sp + hash(i * 3) % 400) % 240); ctx.fillStyle = hexA("#cfe8ff", 0.4 + (i % 3) * 0.2); ctx.fillRect(xx, yy, 6 + (i % 4) * 5, 1.6); }
    ctx.restore();
    ctx.strokeStyle = "#7aa2ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4090, 700); ctx.lineTo(4300, 880); ctx.lineTo(4090, 1060); ctx.stroke();
    // consoles in an arc in front of the captain's chair, a navigation hologram, the status screen
    for (let k = 0; k < 6; k++) {
      const a = (-50 + k * 20) * D2R, x = 3900 + 128 * Math.cos(a), y = 902 + 128 * Math.sin(a);
      rr(x - 15, y - 10, 30, 20, 3); ctx.fillStyle = "#141c46"; ctx.fill(); ctx.strokeStyle = "#7aa2ff"; ctx.lineWidth = 1.2; ctx.stroke();
      for (let i = 0; i < 3; i++) circle(x - 8 + i * 8, y, 2, ((Math.floor(t * 3) + k + i) % 4) ? "#19e6ff" : "#ff2bd6");
    }
    rr(3878, 902, 48, 32, 9); ctx.fillStyle = "#2a3a8a"; ctx.fill(); rr(3888, 880, 28, 26, 7); ctx.fillStyle = "#3a4ab0"; ctx.fill();
    const hx = 3842, hy = 1030;
    ell(hx, hy + 14, 34, 9, "#141c46"); circle(hx, hy - 6, 22, hexA("#7aa2ff", 0.12), "#7aa2ff", 1.2);
    ctx.strokeStyle = hexA("#7aa2ff", 0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(hx, hy - 6, 22 * Math.abs(Math.cos(t * 0.8)), 22, 0, 0, TAU); ctx.moveTo(hx - 22, hy - 6); ctx.lineTo(hx + 22, hy - 6); ctx.stroke();
    circle(hx + 16 * Math.cos(t * 1.3), hy - 6 + 8 * Math.sin(t * 1.3), 2.6, "#ffd34d");
    panel(3782, 682, 300, 140, "#7aa2ff");
    if (lod === 2) {
      holoText("SHIP STATUS", 3796, 700, 12, "#7aa2ff", "left", true);
      holoText("Swing $100  " + (I.eq != null ? "$" + I.eq.toFixed(2) : "-"), 3796, 724, 15, I.eq != null && I.eq >= 100 ? "#2ff3d0" : "#ff9ab8", "left", true);
      holoText("EGX  " + (I.egx != null ? Math.round(I.egx).toLocaleString("en-US") + " EGP " + (I.egxPct >= 0 ? "+" : "") + I.egxPct.toFixed(2) + "%" : "-"), 3796, 748, 15, I.egxPct >= 0 ? "#2ff3d0" : "#ff9ab8", "left", true);
      holoText("AI  $" + (I.spent || 0).toFixed(2) + " of $" + (I.cap || 19).toFixed(0) + " this month", 3796, 772, 13, "#e2f7ff", "left");
      holoText(I.fresh || "", 3796, 800, 10.5, "#9aa6c8", "left");
    }
  }

  function drawMacro(r, t, lod) {
    const I = r.info || {}, gx = 2270, gy = 300;
    circle(gx, gy, 66, hexA("#2ff3d0", 0.07));
    circle(gx, gy, 52, "#062a2a", "#2ff3d0", 2);
    ctx.strokeStyle = hexA("#2ff3d0", 0.55); ctx.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) { const ph = (t * 0.5 + k * Math.PI / 4) % Math.PI, rx = Math.abs(Math.cos(ph)) * 52; ctx.beginPath(); ctx.ellipse(gx, gy, rx, 52, 0, 0, TAU); ctx.stroke(); }
    for (const yy of [-30, -12, 12, 30]) { const rx = Math.sqrt(52 * 52 - yy * yy); ctx.beginPath(); ctx.ellipse(gx, gy + yy, rx, 3, 0, 0, TAU); ctx.stroke(); }
    // currency strength bars along the top wall
    const order = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "BTC", "XAU"], S = { STRONG_BUY: 2, BUY: 1, HOLD: 0, SELL: -1, STRONG_SELL: -2 };
    order.forEach((k, i) => {
      const v = S[(I.views || {})[k]] || 0, x = 2088 + i * 37, base = 196;
      ctx.fillStyle = "#0b2226"; ctx.fillRect(x, base - 26, 22, 52);
      ctx.fillStyle = v > 0 ? "#2ff3d0" : v < 0 ? "#ff4f9a" : "#7f8bb3";
      if (v) ctx.fillRect(x + 3, v > 0 ? base - v * 11 : base, 16, Math.abs(v) * 11); else ctx.fillRect(x + 3, base - 1, 16, 2);
      if (lod === 2) holoText(k, x + 11, base + 35, 10, "#9fe8dc", "center", true);
    });
    if (lod === 2 && I.mood) { panel(2084, 414, 176, 28, "#2ff3d0"); holoText("RISK MOOD " + I.mood, 2172, 428.5, 11, "#2ff3d0", "center", true); }
  }

  function drawComms(r, t, lod) {
    const I = r.info || {}, rx = 2270, ry = 1470;
    circle(rx, ry, 70, "#031a24", "#19e6ff", 2);
    for (const k of [24, 47]) circle(rx, ry, k, null, hexA("#19e6ff", 0.25), 1);
    const a = t * 1.4;
    ctx.save(); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.arc(rx, ry, 68, a - 0.7, a); ctx.closePath(); ctx.fillStyle = hexA("#19e6ff", 0.16); ctx.fill(); ctx.restore();
    ctx.strokeStyle = "#19e6ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 68 * Math.cos(a), ry + 68 * Math.sin(a)); ctx.stroke();
    (I.blips || []).forEach((b, i) => {
      const ba = b.a, bd = b.d, age = ((a - ba) % TAU + TAU) % TAU, al = Math.max(0.15, 1 - age / 4);
      circle(rx + bd * Math.cos(ba), ry + bd * Math.sin(ba), 3, hexA(b.col, al));
    });
    for (const [x, y, col] of [[2120, 1360, "#19e6ff"], [2120, 1480, "#19e6ff"], [2420, 1360, "#ffd34d"], [2420, 1480, "#ffd34d"]]) {
      rr(x - 22, y - 12, 44, 22, 3); ctx.fillStyle = "#08142e"; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.fillStyle = hexA(col, 0.5 + 0.5 * Math.sin(t * 3 + i + x)); ctx.fillRect(x - 16, y - 6 + i * 5, 20 + (hash(x + i) % 10), 2); }
    }
    if (lod === 2) {
      holoText("FX, GOLD, BTC", 2120, 1326, 11, "#19e6ff", "center", true);
      holoText("EGX STOCKS", 2420, 1326, 11, "#ffd34d", "center", true);
      if (I.ticker) {
        panel(2076, 1566, 388, 30, "#19e6ff");
        ctx.save(); ctx.beginPath(); ctx.rect(2080, 1568, 380, 26); ctx.clip();
        ctx.font = `12px ${FONT}`; const tw = ctx.measureText(I.ticker).width + 80, off = (t * 40) % tw;
        holoText(I.ticker, 2460 - off, 1581.5, 12, "#e2f7ff"); holoText(I.ticker, 2460 - off + tw, 1581.5, 12, "#e2f7ff");
        ctx.restore();
      }
    }
  }

  // The tail's rooms carry a big title and their live number, readable from across the ship.
  let curLod = 2;
  function titlePlate(r, title, sub, col) {
    if (curLod < 2) return;                               // from far away the screen label says it instead (with the number)
    ctx.font = `bold 22px ${DISPLAY}`; const w1 = ctx.measureText(title).width;
    ctx.font = `bold 14px ${FONT}`; const w2 = ctx.measureText(sub).width;
    const w = Math.min(r.w - 24, Math.max(w1, w2) + 28), x = r.x + 12, y = r.y + 12;
    panel(x, y, w, 54, col);
    holoText(title, x + 14, y + 18, 22, col, "left", true);
    holoText(clip(sub, 52), x + 14, y + 40, 14, "#e9f2ff", "left", true);
  }
  function drawOrders(r, t, lod) {
    const I = r.info || {}, nh = (I.holdings || []).length, nb = (I.book || []).length;
    titlePlate(r, "ORDER BAY", `${nh} EGX holding${nh === 1 ? "" : "s"} · ${nb} working order${nb === 1 ? "" : "s"}`, "#ffb020");
    // a conveyor running to the airlock
    ctx.fillStyle = "#1d1a10"; ctx.fillRect(150, 540, 400, 30);
    ctx.strokeStyle = "rgba(255,176,32,.45)"; ctx.lineWidth = 2;
    for (let x = 150 + ((t * 30) % 20); x < 545; x += 20) { ctx.beginPath(); ctx.moveTo(x, 545); ctx.lineTo(x + 6, 555); ctx.lineTo(x, 565); ctx.stroke(); }
    const crates = [...(I.holdings || []).map(h => ({ t: h.ticker, s: `${h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(1)}%`, c: h.pnl >= 0 ? "#2ff3d0" : "#ff9ab8", gold: true })),
                    ...(I.book || []).map(o => ({ t: o.ticker, s: `${o.action} @${o.limit}`, c: o.action === "BUY" ? "#2ff3d0" : "#ff9ab8", gold: false }))];
    crates.slice(0, 8).forEach((k, i) => {
      const x = 150 + (i % 4) * 74, y = i < 4 ? 482 : 600;
      rr(x, y, 66, 36, 4); ctx.fillStyle = k.gold ? "#5c4614" : "#14305c"; ctx.fill(); ctx.strokeStyle = k.gold ? "#ffd34d" : "#19e6ff"; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 66, y + 36); ctx.moveTo(x + 66, y); ctx.lineTo(x, y + 36); ctx.stroke();
      if (lod === 2) { holoText(k.t, x + 33, y + 12, 10, "#fff3c4", "center", true); holoText(k.s, x + 33, y + 26, 8.5, k.c, "center", true); }
    });
    if (!crates.length) holoText("NO HOLDINGS OR ORDERS", 330, 500, 12, "#7f8bb3", "center", true);
    if (lod === 2 && I.status) holoText(clip(I.status, 58), 335, 684, 11, "#ffb020", "center");
  }

  function drawReactor(r, t, lod) {
    const I = r.info || {}, cx = 335, cy = 905, f = clamp((I.spent || 0) / (I.cap || 19), 0, 1);
    const col = f > 0.85 ? "#ff4f9a" : f > 0.6 ? "#ffd166" : "#19e6ff";
    titlePlate(r, "REACTOR · AI BUDGET", `$${(I.spent || 0).toFixed(2)} of $${(I.cap || 19).toFixed(0)} this month` + (I.proj != null ? ` · pace $${I.proj.toFixed(2)}` : ""), col);
    for (let k = 3; k > 0; k--) circle(cx, cy, 40 + k * 16 + Math.sin(t * 3 + k) * 3, hexA(col, 0.05 * k));
    circle(cx, cy, 58, "#06131c", col, 3);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.7);
    for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillStyle = hexA(col, 0.4); ctx.fillRect(-4, -54, 8, 16); }
    ctx.restore();
    circle(cx, cy, 30 + Math.sin(t * 4) * 2, hexA(col, 0.75));
    circle(cx, cy, 16, "#ffffff");
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 70, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
    ctx.strokeStyle = hexA(col, 0.2); ctx.beginPath(); ctx.arc(cx, cy, 70, -Math.PI / 2 + TAU * f, Math.PI * 1.5); ctx.stroke();
    for (const s of [-1, 1]) { ctx.strokeStyle = "#2a3a5a"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(cx + s * 76, cy); ctx.lineTo(cx + s * 170, cy + s * 0); ctx.stroke(); }
    holoText(Math.round(f * 100) + "%", cx, cy + 1, 15, "#06131c", "center", true);
  }

  function drawLab(r, t, lod) {
    const I = r.info || {}, c0 = I.counts || {};
    titlePlate(r, "STRATEGY LAB", `${c0.PASS || 0} pass · ${c0.PROMISING || 0} promising · ${c0.FAIL || 0} fail`, NEON.violet);
    [[200, "#9b5cff"], [280, "#19e6ff"], [360, "#2ff3d0"], [440, "#ff2bd6"]].forEach(([x, col], i) => {
      const y = 1250;
      ctx.beginPath(); ctx.moveTo(x - 8, y - 46); ctx.lineTo(x - 8, y - 22); ctx.lineTo(x - 24, y + 14); ctx.quadraticCurveTo(x, y + 24, x + 24, y + 14); ctx.lineTo(x + 8, y - 22); ctx.lineTo(x + 8, y - 46); ctx.closePath();
      ctx.fillStyle = "rgba(200,220,255,.08)"; ctx.fill(); ctx.strokeStyle = "rgba(200,220,255,.6)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.clip(); ctx.fillStyle = hexA(col, 0.6); ctx.fillRect(x - 26, y - 6 + Math.sin(t * 2 + i) * 2, 52, 40); ctx.restore();
      for (let b = 0; b < 3; b++) { const by = y + 10 - ((t * 18 + b * 13 + i * 7) % 52); circle(x - 6 + b * 6, by, 2, hexA(col, 0.8)); }
    });

  }

  function drawEngine(r, t, lod, fresh) {
    const cy = r.y + r.h / 2 + 22;
    titlePlate(r, r.id === "engineA" ? "ENGINE · PORT" : "ENGINE · STARBOARD", fresh > 0 ? (r.info || {}).fresh || "" : "ENGINES COLD: NO UPDATE",
               fresh > 0 ? "#ff7a3d" : "#ff4f9a");
    for (const cx of [230, 400]) {
      circle(cx, cy, 56, "#1a1210", "#ff7a3d", 2.4);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * (fresh > 0 ? 6 * fresh : 0.15));
      for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(13, -22, 4, -49); ctx.lineTo(-6, -45); ctx.closePath(); ctx.fillStyle = "#5a3a2a"; ctx.fill(); }
      ctx.restore(); circle(cx, cy, 12, fresh > 0 ? "#ffb070" : "#3a2a20");
    }
  }

  // ------------------------------------------------------------------ who lives where
  const HOME = {
    sw_eur: "EURUSD", sw_gbp: "GBPUSD", sw_jpy: "USDJPY", sw_anz: "AUDUSD", sw_cad: "USDCAD", sw_btc: "BTCUSD", sw_xau: "GOLD",
    sw_usd: "macro", sw_macro: "macro", sw_tv: "macro", sw_risk: "macro", sw_geo: "macro",
    sw_news: "comms", news_fx: "comms", egx_newscheck: "comms", news_egx: "comms",
    tm_operator: "comms", tm_watcher: "comms", tm_spreader: "comms", tm_listings: "comms", tm_prices: "comms",
    sw_judge: "tribunal", egx_judge: "court", director: "bridge", egx_orders: "orders",
    egx_macro: "observatory", egx_quant: "observatory", egx_risk: "observatory", egx_politics: "observatory",
  };
  const SECTOR_ROOM = {};
  SECTORS.forEach(s => { if (s[2]) { HOME[s[2]] = s[1]; SECTOR_ROOM[s[2]] = s[1]; HOME["et_" + s[1]] = s[1]; HOME["va_" + s[1]] = s[1]; } });
  const PAIR_IDS = Object.keys(PAIRS), SECTOR_IDS = Object.values(SECTOR_ROOM);
  const STATION = { sw_macro: [2270, 394], sw_usd: [2128, 302], sw_tv: [2412, 302], sw_risk: [2405, 428], sw_geo: [2135, 428],
                    sw_news: [2120, 1400], news_fx: [2120, 1520], egx_newscheck: [2420, 1400], news_egx: [2420, 1520],
                    tm_operator: [2270, 1360], tm_watcher: [2210, 1470], tm_spreader: [2330, 1470], tm_listings: [2270, 1565], tm_prices: [2160, 1565],
                    director: [3902, 934], egx_orders: [505, 614] };
  const MAT = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };

  function homeRoom(a) {
    if (HOME[a.id]) return HOME[a.id];
    if (/^sq_/.test(a.id)) { const p = a.id.slice(3).toUpperCase(); return ROOMS[p] ? p : "macro"; }
    if (/^sn_/.test(a.id)) { const p = a.id.slice(3).toUpperCase(); return ROOMS[p] ? p : "comms"; }   // News Sentinels
    if (a.desk === "gold") return a.judge ? "tribunal" : "GOLD";
    if (a.judge) return a.desk === "egx" ? "court" : "tribunal";
    return a.desk === "egx" ? "observatory" : "macro";
  }
  function visitsFor(c) {
    switch (c.id) {
      case "sw_eur": return ["EURGBP", "EURJPY"];
      case "sw_gbp": return ["EURGBP", "GBPJPY"];
      case "sw_jpy": return ["EURJPY", "GBPJPY", "AUDJPY"];
      case "sw_anz": return ["NZDUSD", "AUDJPY"];
      case "sw_usd": return ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "NZDUSD", "USDCAD"];
      case "sw_tv": case "sw_news": case "news_fx": return PAIR_IDS;
      case "sw_geo": return [...PAIR_IDS, "tribunal"];               // hands its read to every pair and the Judge
      case "egx_politics": return [...SECTOR_IDS, "court"];          // and Egypt's read to the sectors and the Judge
      case "sw_risk": { const open = PAIR_IDS.filter(p => ROOMS[p].live); return open.length ? open : PAIR_IDS; }
      case "news_egx": case "egx_newscheck": return SECTOR_IDS;
      case "egx_risk": { const h = SECTOR_IDS.filter(id => ROOMS[id].live); return h.length ? h : SECTOR_IDS; }
      case "director": return ["macro", "comms", "reactor", "tribunal", "court"];
      case "tm_watcher": return SECTOR_IDS;                       // tells the sector pods their results are out
      case "tm_spreader": return [...SECTOR_IDS, "observatory"];   // hands the new figures to the analysts
      case "tm_listings": return ["orders", "court"];             // tells the Order Desk and the Judge what stopped trading
      case "tm_prices": return ["orders", "observatory"];          // hands the closing prices to the Order Desk and the quants
      case "tm_operator": return ["bridge"];
      default:
        if (/^et_/.test(c.id)) return ["comms", "orders"];
        if (/^va_/.test(c.id)) return ["observatory", "court"];
        return [];
    }
  }
  function podGeo(r) {
    if (r.geo) return r.geo;
    const u = { left: [1, 0], right: [-1, 0], top: [0, 1], bottom: [0, -1] }[r.door.side];
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, span = u[0] ? r.w : r.h;
    const decor = [cx + u[0] * (span / 2 - 46), cy + u[1] * (span / 2 - 46)];
    const desk = [cx - u[0] * 18, cy - u[1] * 18 + (u[0] ? 22 : 0)];
    return (r.geo = { u, decor, desk, station: [desk[0], desk[1] + 18] });
  }

  // ------------------------------------------------------------------ state
  let canvas = null, dpr = 1, cw = 960, ch = 540, onSelect = null, inited = false;
  let chars = [], byId = {}, drones = [], data = null, notes = {}, meeting = null, hover = null;
  let ambientT = 0, ambientIdx = 0, onScreen = true, lastDraw = 0, simT = 0, lastUserCam = 0, toast = null, shoot = null;
  const played = new Set(), balls = {};
  const cam = { x: BOUNDS.x + BOUNDS.w / 2, y: BOUNDS.y + BOUNDS.h / 2, z: 0.25 }, goal = { x: 0, y: 0, z: 1, on: false };
  const Z_MAX = 3.2;

  function makeChar(a) {
    const home = homeRoom(a);
    return { a, id: a.id, home, room: home, dest: null, x: 0, y: 0, path: [], wait: rnd(0.5, 4), walk: 0, facing: 1,
             seed: (hash(a.id) % 1000) / 100, speed: rnd(30, 40), locked: false, bubble: null, spec: specFor(a), station: null,
             visitLeft: 0, pending: null, beam: null, card: null, regime: null, hurry: false, placed: false };
  }
  function layoutStations() {
    for (const c of chars) {
      const r = ROOMS[c.home];
      let st = STATION[c.id];
      if (!st) {
        if (r.kind === "pair") {
          const yy = r.door.side !== "top" ? r.y + r.h * 0.6 : r.y + r.h * 0.42;
          st = c.a.quant || /^sq_/.test(c.id) ? [r.x + r.w * 0.72 + 2, yy + 26] : [r.x + r.w * 0.28, yy + 24];
        } else if (r.kind === "sector") {
          const g = podGeo(r), k = /^va_/.test(c.id) ? -78 : /^et_/.test(c.id) ? 78 : 0;
          st = [g.station[0] + g.u[1] * k, g.station[1] + g.u[0] * k];   // beside the desk, across the pod
        }
        else if (r.kind === "observatory") {
          const k = { egx_macro: [0.46, 0.7], egx_quant: [0.7, 0.88], egx_risk: [0.72, 0.52], egx_politics: [0.26, 0.56] }[c.id] || [0.5, 0.7];
          st = [r.x + r.w * k[0], r.y + r.h * k[1]];
        } else if (r.kind === "tribunal") st = [r.cx, r.cy + 4];
        else if (r.kind === "court") st = [r.cx, r.cy + 46];
        else st = randomPoint(c.home);
      }
      if (r.walk) st = [clamp(st[0], r.walk[0], r.walk[2]), clamp(st[1], r.walk[1], r.walk[3])];
      c.station = st;
    }
  }
  function goTo(c, room, x, y) { c.path = route(c.room, [c.x, c.y], room, [x, y]); c.dest = room; }

  function chooseNext(c) {
    const roll = Math.random(), judge = !!c.a.judge;
    if (c.room !== c.home) {
      if (c.visitLeft > 0) { c.visitLeft--; const p = randomPoint(c.room); goTo(c, c.room, p[0], p[1]); c.wait = rnd(2, 5); return; }
      const s = c.station || randomPoint(c.home); goTo(c, c.home, s[0], s[1]); c.wait = rnd(4, 8); return;
    }
    const vis = visitsFor(c).filter(v => v !== c.home && ROOMS[v]);
    if (!judge && vis.length && roll < (c.id === "director" ? 0.04 : 0.11)) {
      const dest = pickOne(vis), p = randomPoint(dest);
      goTo(c, dest, p[0], p[1]); c.visitLeft = 1 + Math.floor(rnd(0, 3)); c.wait = rnd(3, 6); return;
    }
    if (c.station && roll < (judge ? 0.8 : 0.58)) { goTo(c, c.home, c.station[0], c.station[1]); c.wait = rnd(5, 10); return; }
    const p = randomPoint(c.home); goTo(c, c.home, p[0], p[1]); c.wait = rnd(1.2, 3.5);
  }

  function step(c, dt) {
    if (c.beam) {                                         // the transporter: fade out, move, fade in
      const b = c.beam; b.t += dt;
      if (b.t >= 0.55 && !b.moved) { c.x = b.to[0]; c.y = b.to[1]; c.room = b.room; c.dest = null; b.moved = true; }
      b.alpha = b.t < 0.55 ? 1 - b.t / 0.55 : Math.min(1, (b.t - 0.55) / 0.55);
      if (b.t >= 1.1) c.beam = null;
      return;
    }
    if (c.path.length) {
      const [tx, ty] = c.path[0], dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy), s = (c.hurry ? 115 : c.speed) * dt;
      if (d <= s) { c.x = tx; c.y = ty; c.path.shift(); }
      else { c.x += dx / d * s; c.y += dy / d * s; if (Math.abs(dx) > 0.3) c.facing = dx < 0 ? -1 : 1; }
      c.walk += dt * (c.hurry ? 1.5 : 1);
      if (!c.path.length) {
        if (c.dest) { c.room = c.dest; c.dest = null; }
        const r = ROOMS[c.room];
        if (c.station && Math.hypot(c.x - c.station[0], c.y - c.station[1]) < 3 && r) c.facing = c.x < (r.cx || r.x + r.w / 2) ? 1 : -1;
      }
      return;
    }
    c.walk = 0;
    if (c.pending) { const p = c.pending; c.pending = null; goTo(c, p.room, p.x, p.y); return; }
    if (c.locked) return;
    c.wait -= dt;
    if (c.wait <= 0) chooseNext(c);
  }
  function beamTo(c, room, pt) { c.path = []; c.pending = null; c.beam = { t: 0, to: pt, room, alpha: 1, moved: false }; }

  // ------------------------------------------------------------------ news scout drones
  function droneTarget(r) {                            // they hover over the back half of the room, never through a wall
    if (r.kind === "pair") return randomPoint(r.id);
    const g = podGeo(r), px = -g.u[1], py = g.u[0], span = g.u[0] ? r.h : r.w, k = rnd(-1, 1), m = rnd(-0.2, 0.9);
    const x = g.decor[0] + px * k * (span / 2 - 28) - g.u[0] * m * 40, y = g.decor[1] + py * k * (span / 2 - 28) - g.u[1] * m * 40;
    return [clamp(x, r.x + 18, r.x + r.w - 18), clamp(y, r.y + 60, r.y + r.h - 14)];
  }
  function makeDrone(id, roomId, size, label) {
    const p = droneTarget(ROOMS[roomId]);
    return { id, room: roomId, label, x: p[0], y: p[1], tx: p[0], ty: p[1], h: 15 + rnd(0, 9), r: size, seed: rnd(0, 10), dir: 1,
             wait: rnd(0, 3), read: null, sent: null, hot: false, bubble: null };
  }
  function buildDrones() {
    const keep = {}, out = [], N = (data && data.news) || {};
    drones.forEach(d => { keep[d.id] = d; });
    const put = (id, room, size, label, read) => {
      const d = keep[id] || makeDrone(id, room, size, label);
      d.read = read; d.sent = read ? read.sentiment : null; d.hot = !!read && read.materiality === "HIGH"; out.push(d);
    };
    for (const p of PAIR_IDS) put(`scout:fx:${p}`, p, 5.6, p === "GOLD" ? "GOLD" : p, (N.fx || {})[p] || null);
    const ratings = (data && data.egx && data.egx.ratings) || {}, per = {};
    for (const [tk, read] of Object.entries(N.egx || {})) {
      const room = SECTOR_ROOM[(ratings[tk] || {}).analyst];
      if (room && read) (per[room] = per[room] || []).push([tk, read]);
    }
    for (const [room, list] of Object.entries(per)) {
      list.sort((a, b) => (MAT[b[1].materiality] || 0) - (MAT[a[1].materiality] || 0) || Math.abs(b[1].sentiment || 0) - Math.abs(a[1].sentiment || 0));
      list.slice(0, 16).forEach(([tk, read]) => put(`scout:egx:${tk}`, room, 4.2, tk, read));
    }
    drones = out;
  }
  function stepDrone(d, dt) {
    const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy);
    if (dist < 2) {
      d.wait -= dt;
      if (d.wait <= 0) { const p = droneTarget(ROOMS[d.room]); d.tx = p[0]; d.ty = p[1]; d.wait = rnd(0.8, 3.5); }
      return;
    }
    const s = Math.min(dist, (d.r > 5 ? 22 : 15) * dt);
    d.x += dx / dist * s; d.y += dy / dist * s;
    if (Math.abs(dx) > 0.5) d.dir = dx < 0 ? -1 : 1;
  }

  // ------------------------------------------------------------------ the pair rooms' football
  function updateBalls(dt) {
    for (const p of PAIR_IDS) {
      const r = ROOMS[p];
      const b = balls[p] || (balls[p] = { x: r.x + r.w / 2, y: r.y + r.h / 2 + 12, h: 0, spin: 0, fly: null, timer: rnd(2, 8), juggler: null, jt: 0 });
      if (b.fly) {
        const f = b.fly; f.t += dt;
        const k = Math.min(1, f.t / f.d);
        b.x = f.x0 + (f.x1 - f.x0) * k; b.y = f.y0 + (f.y1 - f.y0) * k; b.h = Math.sin(k * Math.PI) * f.hm; b.spin += dt * 12;
        if (k >= 1) { b.fly = null; b.h = 0; b.timer = rnd(2.5, 7); }
        continue;
      }
      if (b.juggler) {
        const A = b.juggler; b.jt -= dt;
        if (b.jt <= 0 || A.path.length || A.room !== p || A.locked) { b.juggler = null; b.h = 0; }
        else { b.x = A.x + A.facing * 4.5; b.y = A.y + 1; b.h = Math.abs(Math.sin(simT * 5.5)) * 10; b.spin += dt * 8; }
        continue;
      }
      b.timer -= dt;
      if (b.timer > 0) continue;
      const idle = chars.filter(c => c.room === p && !c.path.length && !c.locked && !c.beam && !c.pending);
      if (idle.length >= 2) {
        const A = idle[Math.floor(Math.random() * idle.length)], others = idle.filter(c => c !== A), B = pickOne(others);
        A.facing = B.x >= A.x ? 1 : -1; B.facing = A.x >= B.x ? 1 : -1;
        const x0 = b.x, y0 = b.y, x1 = B.x + B.facing * 4.5, y1 = B.y + 1, dist = Math.hypot(x1 - x0, y1 - y0);
        b.fly = { x0, y0, x1, y1, t: 0, d: 0.45 + dist / 150, hm: 5 + dist * 0.09 };
      } else if (idle.length === 1) { b.juggler = idle[0]; b.jt = rnd(3, 6); b.timer = rnd(4, 8); }
      else b.timer = rnd(3, 6);
    }
  }

  // ------------------------------------------------------------------ what the rooms show (from the data)
  function cairo(ts) {
    try { return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" }); }
    catch (e) { return String(ts || "").slice(11, 16); }
  }
  function ageMin() { return data && data.generated_at ? (Date.now() - Date.parse(data.generated_at)) / 60000 : null; }
  function freshness() { const a = ageMin(); return a == null ? 1 : a < 25 ? 1 : a < 60 ? 0.55 : 0; }
  function agoTxt(m) { return m < 90 ? Math.round(m) + " min ago" : m < 48 * 60 ? (m / 60).toFixed(1) + " h ago" : Math.round(m / 1440) + " days ago"; }

  function buildRoomInfo() {
    const F = data || {}, sw = (F.swing && F.swing.state) || {}, tv = sw.tv || {}, pos = sw.positions || {};
    for (const p of PAIR_IDS) {
      const r = ROOMS[p], ps = (sw.pairs || {})[p] || {}, q = ps.quant || {}, f = ps.fund || {}, tp = tv[p] || {}, po = pos[p];
      r.info = { price: tp.price, chg: tp.change_pct, ratings: tp.ratings || {}, regime: q.regime, pBull: q.p_bull, fund: f.view,
                 pos: po ? { dir: po.direction, upnl: Number(po.upnl_usd || 0) } : null };
      r.live = !!po;
    }
    const E = F.egx || {}, EO = F.egx_orders || {}, live = EO.live || null, ratings = E.ratings || {};
    const holds = ((live && live.holdings) || E.holdings || []).map(h => ({ ticker: h.ticker, pnl: Number(h.pnl_pct || 0) }));
    for (const [id, an] of SECTORS.filter(s => s[2]).map(s => [s[1], s[2]])) {
      const v = (E.sector_views || {})[an];
      ROOMS[id].info = { view: v && v.view ? String(v.view).toUpperCase() : null, holdings: holds.filter(h => (ratings[h.ticker] || {}).analyst === an).slice(0, 4) };
      ROOMS[id].live = ROOMS[id].info.holdings.length > 0;
    }
    ROOMS.observatory.info = {};
    const m = ((F.swing && F.swing.meetings) || []).slice(-1)[0];
    const opened = m ? (m.opened || []).filter(o => o.direction).length : 0;
    ROOMS.tribunal.info = m ? { headline: m.judge ? m.judge.headline : "Judge unavailable. No trade.", when: cairo(m.ts) + " CAIRO", tilt: opened ? -0.18 : 0.18 } : {};
    const no = (E.orders || []).length, nv = (E.vetoed || []).length;
    ROOMS.court.info = E.judge ? { headline: E.judge.headline || E.judge.bubble, stamp: `${E.session || ""} · ${no} APPROVED · ${nv} HELD BACK`, tilt: no >= nv ? -0.22 : 0.22 } : {};
    const acct = sw.account || {}, pf = live || E.portfolio || {}, B = F.budget || {};
    const a = ageMin();
    ROOMS.bridge.info = { eq: acct.equity_usd != null ? Number(acct.equity_usd) : null, egx: pf.total != null ? Number(pf.total) : null,
                          egxPct: Number(pf.pnl_vs_start_pct || 0), spent: Number(B.spent || 0), cap: Number(B.cap || 19),
                          fresh: a == null ? "" : `UPDATED ${cairo(F.generated_at)} CAIRO (${agoTxt(a)})` };
    ROOMS.macro.info = { views: Object.fromEntries(Object.entries(sw.ccy_views || {}).map(([k, v]) => [k, v && v.rating])), mood: (sw.macro || {}).risk_mood };
    const N = F.news || {}, blips = [], heads = [];
    for (const kind of ["fx", "egx"]) {
      for (const [k, r] of Object.entries(N[kind] || {})) {
        if (!r || !(MAT[r.materiality] >= 2)) continue;
        const h = hash(kind + k);
        if (blips.length < 40) blips.push({ a: (h % 360) * D2R, d: 14 + (h >> 9) % 52, col: sentCol(r.sentiment) });
        const it = (r.items || [])[0];
        if (it && it.headline) heads.push([MAT[r.materiality] * 10 + Math.abs(r.sentiment || 0), `${k}: ${it.headline}`]);
      }
    }
    heads.sort((x, y) => y[0] - x[0]);
    ROOMS.comms.info = { blips, ticker: heads.slice(0, 8).map(h => h[1]).join("     ·     ") };
    ROOMS.orders.info = { holdings: holds, book: (EO.book || []).map(o => ({ ticker: o.ticker, action: o.action, limit: o.limit })), status: EO.status || "" };
    ROOMS.reactor.info = { spent: Number(B.spent || 0), cap: Number(B.cap || 19), proj: B.projected != null ? Number(B.projected) : null };
    ROOMS.lab.info = { counts: (F.lab || {}).counts || {} };
    ROOMS.engineA.info = ROOMS.engineB.info = { fresh: a == null ? "" : `LAST CYCLE ${cairo(F.generated_at)} CAIRO` };
    // the tail's numbers, also shown on its labels when the camera is far away
    ROOMS.engineA.stat = ROOMS.engineB.stat = a == null ? "" : (freshness() > 0 ? "last cycle " : "COLD since ") + cairo(F.generated_at);
    ROOMS.orders.stat = `${holds.length} holding${holds.length === 1 ? "" : "s"} · ${(EO.book || []).length} order${(EO.book || []).length === 1 ? "" : "s"}`;
    ROOMS.reactor.stat = `$${Number(B.spent || 0).toFixed(2)} of $${Number(B.cap || 19).toFixed(0)}`;
    const lc = (F.lab || {}).counts || {};
    ROOMS.lab.stat = `${lc.PASS || 0} pass of ${(lc.PASS || 0) + (lc.PROMISING || 0) + (lc.FAIL || 0)}`;
  }

  // ------------------------------------------------------------------ meetings
  function chamberSeats(id, n) {
    const out = [];
    if (id === "tribunal") for (let i = 0; i < n; i++) { const ring = i < 12 ? FXR.seat : 196, a = (i < 12 ? 15 + 30 * i : 30 * (i - 12)) * D2R; out.push([FXR.cx + ring * Math.cos(a), FXR.cy + ring * Math.sin(a)]); }
    else for (let i = 0; i < n; i++) { const ring = i < 12 ? NIL.seat : 214, a = (15 + 150 * (i % 12) / 11 + (i < 12 ? 0 : 6)) * D2R; out.push([NIL.cx + ring * Math.cos(a), NIL.cy + ring * Math.sin(a)]); }
    return out;
  }
  function startMeeting(kind) {
    if (!data || meeting) return false;
    let lines = [], title = "", stamp = "", card = "#2ff3d0", chamber = "tribunal", judgeId = "sw_judge";
    if (kind === "fx") {
      const m = ((data.swing && data.swing.meetings) || []).slice(-1)[0];
      if (!m) return false;
      ["sw_usd", "sw_eur", "sw_gbp", "sw_jpy", "sw_anz", "sw_cad", "sw_btc", "sw_xau", "sw_macro", "sw_tv", "sw_risk", "sw_news"]
        .forEach(id => { if (notes[id] && notes[id].bubble) lines.push({ agent: id, line: notes[id].bubble }); });
      (m.candidates || []).forEach(c => { const q = "sq_" + c.pair.toLowerCase(); if (notes[q]) lines.push({ agent: q, line: notes[q].bubble }); });
      lines.push({ agent: "sw_judge", line: m.judge ? m.judge.headline : "Judge unavailable. No trade." });
      title = "Swing review: " + (m.candidates || []).map(c => c.pair + " " + c.direction).join(", ");
      const n = (m.opened || []).filter(o => o.direction).length;
      stamp = n ? n + " OPENED" : m.judge ? "VETOED" : "NO TRADE"; card = n ? "#2ff3d0" : m.judge ? "#ff2b5c" : "#ffd166";
    } else if (kind === "gold") {
      const m = ((data.gold && data.gold.meetings) || []).slice(-1)[0];
      if (!m) return false;
      lines = (m.transcript || []).slice();
      judgeId = byId.gold_judge ? "gold_judge" : "sw_judge";
      title = "Gold pitch: " + m.direction;
      stamp = m.final === "APPROVE" ? "APPROVED" : m.final === "APPROVED_TOO_SMALL" ? "APPROVED, TOO SMALL" : "REJECTED";
      card = m.final === "APPROVE" ? "#2ff3d0" : m.final === "APPROVED_TOO_SMALL" ? "#ffd166" : "#ff2b5c";
    } else {
      const e = data.egx;
      if (!e) return false;
      chamber = "court"; judgeId = "egx_judge";
      ["egx_banks", "egx_nbfi", "egx_realestate", "egx_materials", "egx_industrials", "egx_consumer", "egx_tmt", "egx_macro", "egx_quant", "egx_risk", "egx_newscheck"]
        .forEach(id => { if (notes[id] && notes[id].bubble) lines.push({ agent: id, line: notes[id].bubble }); });
      const j = e.judge;
      lines.push({ agent: "egx_judge", line: j ? (j.headline || j.bubble) : "No review today (budget or API)." });
      title = "EGX review " + (e.session || "");
      const no = (e.orders || []).length, nv = (e.vetoed || []).length;
      stamp = no + " APPROVED · " + nv + " HELD BACK"; card = no ? "#2ff3d0" : nv ? "#ff2b5c" : "#ffd166";
    }
    const ids = [...new Set(lines.map(l => l.agent))].filter(id => byId[id] && id !== judgeId);
    if (!ids.length) return false;
    const seats = chamberSeats(chamber, ids.length);
    ids.forEach((id, i) => {
      const c = byId[id], s = seats[i];
      c.locked = true; c.hurry = true; c.bubble = null; c.visitLeft = 0; c.seatPt = s;
      if (c.beam) c.beam = null;
      if (c.path.length) c.pending = { room: chamber, x: s[0], y: s[1] }; else goTo(c, chamber, s[0], s[1]);
    });
    const J = byId[judgeId];
    if (J) {
      const s = J.home === chamber && J.station ? J.station : chamber === "court" ? [NIL.cx, NIL.cy + 46] : [FXR.cx, FXR.cy + 4];
      J.locked = true; J.hurry = true; J.seatPt = s;
      if (J.path.length) J.pending = { room: chamber, x: s[0], y: s[1] }; else goTo(J, chamber, s[0], s[1]);
    }
    meeting = { kind, ids, judgeId, lines, title, stamp, card, chamber, stage: "gather", t: 0, idx: 0 };
    if (Date.now() - lastUserCam > 8000) flyTo(viewFor(chamber, 2.3));
    return true;
  }
  function updateMeeting(dt) {
    if (!meeting) return;
    const m = meeting, all = [...m.ids, m.judgeId].map(id => byId[id]).filter(Boolean), J = byId[m.judgeId];
    m.t += dt;
    if (m.stage === "gather") {
      if (all.every(c => !c.path.length && !c.pending && !c.beam && c.room === m.chamber)) { m.stage = "talk"; m.t = 3.6; }
      else if (m.t > 16) {
        all.forEach(c => { if (c.path.length || c.pending || c.room !== m.chamber) beamTo(c, m.chamber, c.seatPt || c.station); });
        m.stage = "beam"; m.t = 0;
      }
    } else if (m.stage === "beam") {
      if (m.t > 1.2) { m.stage = "talk"; m.t = 3.6; }
    } else if (m.stage === "talk") {
      if (m.t >= 3.6) {
        m.t = 0;
        if (m.idx >= m.lines.length) { m.stage = "verdict"; if (J) J.card = m.card; return; }
        const l = m.lines[m.idx++], c = byId[l.agent];
        if (c) { say(c, l.line, 3.5); if (J && c !== J) c.facing = J.x >= c.x ? 1 : -1; }
      }
    } else if (m.stage === "verdict") {
      if (m.t > 4.5) {
        if (J) J.card = null;
        m.ids.forEach(id => { const c = byId[id]; c.hurry = false; const s = c.station || randomPoint(c.home); goTo(c, c.home, s[0], s[1]); c.wait = rnd(2, 4); });
        m.stage = "leave"; m.t = 0;
      }
    } else if (m.stage === "leave") {
      if (m.ids.every(id => !byId[id].path.length && byId[id].room === byId[id].home) || m.t > 24) {
        all.forEach(c => { c.locked = false; c.hurry = false; });
        if (J && J.home !== m.chamber) { const s = J.station || randomPoint(J.home); goTo(J, J.home, s[0], s[1]); }
        meeting = null;
      }
    }
  }

  function say(o, text, secs) { if (text) o.bubble = { text: String(text), until: simT + secs }; }
  function ambient(dt) {
    ambientT += dt;
    if (ambientT < 2.2) return;
    ambientT = 0;
    const live = o => o.bubble && o.bubble.until > simT;
    if (chars.filter(live).length + drones.filter(live).length >= (cw < 500 ? 1 : cam.z < 0.35 ? 2 : 3)) return;
    const v = viewRect(0), pool = chars.filter(c => inView(c.x, c.y, v));
    for (let k = 0; k < pool.length; k++) {
      const c = pool[(ambientIdx++) % pool.length];
      if (meeting && (meeting.ids.includes(c.id) || c.id === meeting.judgeId)) continue;
      const n = notes[c.id];
      if (n && n.bubble && !live(c)) { say(c, n.bubble, 6.5); break; }
    }
    if (Math.random() < 0.45) {                           // now and then a scout drone reads out a headline
      const hot = drones.filter(d => d.read && MAT[d.read.materiality] >= 2 && d.read.key_point && inView(d.x, d.y, v) && !live(d));
      if (hot.length) { const d = pickOne(hot); say(d, `${d.label}: ${d.read.key_point}`, 6); }
    }
  }

  // ------------------------------------------------------------------ camera
  function fitView() { const b = BOUNDS; return { x: b.x + b.w / 2, y: b.y + b.h / 2, z: Math.min(cw / b.w, ch / b.h) }; }
  function zMin() { return fitView().z * 0.85; }
  function box(x, y, w, h, pad) { return { x: x + w / 2, y: y + h / 2, z: clamp(Math.min(cw / (w * pad), ch / (h * pad)), zMin(), Z_MAX) }; }
  function viewFor(id, pad) {
    if (id === "ship") return fitView();
    if (id === "fx") return box(FXR.cx - FXR.disc, FXR.cy - FXR.disc, 2 * FXR.disc, 2 * FXR.disc, 1.03);
    if (id === "egx") return box(NIL.cx - NIL.disc, NIL.cy - NIL.disc, 2 * NIL.disc, 2 * NIL.disc, 1.03);
    if (id === "tail") return box(20, 110, 700, 1540, 1.04);
    const r = ROOMS[id];
    if (!r) return fitView();
    if (r.kind === "pair") {                              // include the price sign hanging outside the pod
      const top = r.door.side !== "top";
      return box(r.x - 8, top ? r.y - 46 : r.y, r.w + 16, r.h + 46, pad || 1.45);
    }
    return box(r.x, r.y, r.w, r.h, pad || (r.shape === "circle" ? 1.35 : 1.6));
  }
  function flyTo(v, speed) { goal.x = v.x; goal.y = v.y; goal.z = v.z; goal.on = true; goal.k = speed || 4.2; }
  const TOUR = ["GBPUSD", "EURUSD", "tribunal", "BTCUSD", "GOLD", "macro", "banks", "court", "nbfi", "realestate", "bridge",
                "materials", "industrials", "comms", "consumer", "tmt", "observatory", "USDJPY", "USDCAD", "AUDUSD",
                "NZDUSD", "AUDJPY", "EURJPY", "GBPJPY", "EURGBP", "reactor", "orders", "lab", "engineA"];
  const tour = { on: true, i: 0, t: 1.6 };
  function zPeople() { return clamp(PEOPLE_PX / (52 * CS), zMin(), Z_MAX); }
  function focus(id) {                                // a room at people size: the camera does not shrink to fit it
    const r = ROOMS[id];
    if (!r) return fitView();
    let x = r.cx != null ? r.cx : r.x + r.w / 2, y = r.cy != null ? r.cy : r.y + r.h / 2;
    if (r.kind === "pair") y += r.door.side !== "top" ? -20 : 20;
    if (r.kind === "court") y -= 30;
    return { x, y, z: zPeople() };
  }
  function tourStep(dt) {
    if (!tour.on || (meeting && meeting.stage !== "leave")) return;
    tour.t -= dt;
    if (tour.t > 0) return;
    flyTo(focus(TOUR[tour.i % TOUR.length]), 1.7);
    tour.i++; tour.t = 9.5;
  }
  let fitLock = false;                                // "show the whole ship" holds through resizes (full screen) until the viewer moves
  function stopTour() { tour.on = false; fitLock = false; }
  function fitAll() { stopTour(); fitLock = true; flyTo(fitView(), 3.2); }
  function camStep(dt) {
    if (fitLock) { const v = fitView(); goal.x = v.x; goal.y = v.y; goal.z = v.z; goal.on = true; }
    if (!goal.on) return;
    const k = 1 - Math.exp(-dt * (goal.k || 4.2));
    cam.x += (goal.x - cam.x) * k; cam.y += (goal.y - cam.y) * k;
    cam.z = Math.exp(Math.log(cam.z) + (Math.log(goal.z) - Math.log(cam.z)) * k);
    if (Math.abs(goal.x - cam.x) < 0.5 && Math.abs(goal.y - cam.y) < 0.5 && Math.abs(goal.z / cam.z - 1) < 0.002) {
      cam.x = goal.x; cam.y = goal.y; cam.z = goal.z; goal.on = false;
    }
  }
  function clampCam() {                                // the view's centre stays over the ship
    cam.z = clamp(cam.z, zMin(), Z_MAX);
    cam.x = clamp(cam.x, BOUNDS.x, BOUNDS.x + BOUNDS.w);
    cam.y = clamp(cam.y, BOUNDS.y, BOUNDS.y + BOUNDS.h);
  }
  const toWorld = (sx, sy) => [cam.x + (sx - cw / 2) / cam.z, cam.y + (sy - ch / 2) / cam.z];
  const toScreen = (wx, wy) => [(wx - cam.x) * cam.z + cw / 2, (wy - cam.y) * cam.z + ch / 2];
  function zoomAt(sx, sy, f) {
    fitLock = false;
    const [wx, wy] = toWorld(sx, sy);
    cam.z = clamp(cam.z * f, zMin(), Z_MAX);
    cam.x = wx - (sx - cw / 2) / cam.z; cam.y = wy - (sy - ch / 2) / cam.z;
    goal.on = false; lastUserCam = Date.now(); clampCam();
  }
  function viewRect(m) { const hw = cw / 2 / cam.z + m, hh = ch / 2 / cam.z + m; return [cam.x - hw, cam.y - hh, cam.x + hw, cam.y + hh]; }
  const inView = (x, y, v) => x > v[0] && x < v[2] && y > v[1] && y < v[3];
  const boxInView = (r, v) => r.x < v[2] && r.x + r.w > v[0] && r.y < v[3] && r.y + r.h > v[1];
  // ------------------------------------------------------------------ space
  let stars = [], nebula = null, bh = null, mini = null;
  function makeBackground() {
    const R = seeded(1234);
    stars = [];
    for (const [n, sz, p, v] of [[190, 1, 0.012, 2.5], [90, 1.6, 0.03, 6], [34, 2.3, 0.06, 12]]) {
      for (let i = 0; i < n; i++) {
        const k = R();
        stars.push({ x: R() * 1600, y: R() * 1000, s: sz, p, v, tw: R() * TAU, c: k < 0.18 ? "#ff9cf0" : k < 0.38 ? "#9fe6ff" : k < 0.5 ? "#c4b0ff" : "#ffffff" });
      }
    }
    // deep space: purple to blue to black, neon clouds, and faint aurora ribbons
    nebula = document.createElement("canvas"); nebula.width = 800; nebula.height = 500;
    const n = nebula.getContext("2d");
    const base = n.createLinearGradient(0, 0, 800, 500);
    base.addColorStop(0, "#14022e"); base.addColorStop(0.45, "#070b33"); base.addColorStop(1, "#010008");
    n.fillStyle = base; n.fillRect(0, 0, 800, 500);
    for (const [x, y, r, col] of [[140, 90, 320, "rgba(120,30,230,.42)"], [660, 430, 340, "rgba(25,60,255,.30)"], [560, 110, 250, "rgba(255,43,214,.15)"],
                                  [90, 440, 270, "rgba(25,200,255,.13)"], [380, 270, 400, "rgba(60,15,150,.25)"]]) {
      const g = n.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); n.fillStyle = g; n.fillRect(0, 0, 800, 500);
    }
    for (let i = 0; i < 110; i++) {                       // dust: many small faint clouds give it texture
      const x = R() * 800, y = R() * 500, r = 18 + R() * 70, k = R(), c = k < 0.45 ? "155,92,255" : k < 0.8 ? "50,110,255" : "255,60,220";
      const g = n.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${c},${0.03 + R() * 0.06})`); g.addColorStop(1, "rgba(0,0,0,0)");
      n.fillStyle = g; n.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    n.globalCompositeOperation = "lighter";
    for (const [y0, col] of [[95, "25,230,255"], [125, "155,92,255"], [410, "255,43,214"]]) {
      for (let k = 0; k < 12; k++) {
        n.strokeStyle = `rgba(${col},${0.018 + 0.01 * (k % 3)})`; n.lineWidth = 8 + k * 2.5;
        n.beginPath();
        for (let x = -20; x <= 820; x += 20) { const y = y0 + Math.sin(x / 95 + k * 0.25) * 24 + Math.sin(x / 41 + y0) * 7 + k * 2; x === -20 ? n.moveTo(x, y) : n.lineTo(x, y); }
        n.stroke();
      }
    }
    n.globalCompositeOperation = "source-over";
    // the black hole's accretion disk, drawn once and spun every frame
    const Rh = Math.min(125, Math.max(36, Math.min(cw, ch) * 0.14)), Rout = Rh * 3.5, size = Math.ceil(Rout * 2 * dpr);
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d"); g.scale(dpr, dpr); g.translate(Rout, Rout);
    const rg = g.createRadialGradient(0, 0, Rh * 1.12, 0, 0, Rout);
    rg.addColorStop(0, "rgba(255,255,255,0)"); rg.addColorStop(0.03, "rgba(235,250,255,.96)"); rg.addColorStop(0.13, "rgba(120,225,255,.88)");
    rg.addColorStop(0.34, "rgba(155,92,255,.66)"); rg.addColorStop(0.6, "rgba(255,43,214,.34)"); rg.addColorStop(0.84, "rgba(70,40,210,.13)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, Rout, 0, TAU); g.arc(0, 0, Rh * 1.1, 0, TAU, true); g.fill();
    g.globalCompositeOperation = "lighter";
    const S = seeded(99);
    for (let i = 0; i < 190; i++) {                       // hot streaks swirling in the disk
      const r0 = Rh * (1.2 + S() * 2.15), a0 = S() * TAU, len = 0.25 + S() * 1.2;
      g.strokeStyle = `rgba(${S() < 0.5 ? "130,220,255" : "225,140,255"},${0.05 + S() * 0.16})`; g.lineWidth = 0.6 + S() * 2.4;
      g.beginPath(); g.arc(0, 0, r0, a0, a0 + len); g.stroke();
    }
    bh = { tex: c, R: Rh, Rout };
  }
  // Interstellar-style: the far half of the disk behind the hole, its light bent into a halo over and under the
  // hole, the photon ring, the black horizon, then the near half of the disk crossing in front.
  function drawBlackHole(t, ox, oy) {
    if (!bh) return;
    const { tex, R, Rout } = bh, cx = cw * 0.76 + ox, cy = ch * 0.27 + oy, tilt = 0.2, rot = t * 0.05;
    const gl = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, Rout * 1.5);
    gl.addColorStop(0, "rgba(155,92,255,.38)"); gl.addColorStop(0.35, "rgba(50,40,210,.14)"); gl.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gl; ctx.fillRect(cx - Rout * 1.5, cy - Rout * 1.5, Rout * 3, Rout * 3);
    const disk = front => {
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - Rout - 2, front ? cy : cy - Rout, Rout * 2 + 4, Rout); ctx.clip();
      ctx.translate(cx, cy); ctx.scale(1, tilt); ctx.rotate(rot);
      ctx.drawImage(tex, -Rout, -Rout, Rout * 2, Rout * 2);
      ctx.restore();
    };
    disk(false);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const [w, al] of [[R * 0.55, 0.07], [R * 0.3, 0.13], [R * 0.13, 0.3]]) {
      ctx.strokeStyle = `rgba(175,145,255,${al})`; ctx.lineWidth = w;
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.42, R * 1.24, 0, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(205,248,255,${0.72 + 0.2 * Math.sin(t * 1.3)})`; ctx.lineWidth = Math.max(1.5, R * 0.035);
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.06, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#000000"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    disk(true);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const dop = ctx.createRadialGradient(cx - Rout * 0.55, cy, 0, cx - Rout * 0.55, cy, Rout * 0.8);   // the side spinning toward us glows
    dop.addColorStop(0, "rgba(140,220,255,.22)"); dop.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dop; ctx.fillRect(cx - Rout * 1.4, cy - Rout * 0.5, Rout * 1.7, Rout);
    for (const s2 of [-1, 1]) {                           // faint jets from the poles
      const jg = ctx.createLinearGradient(cx, cy, cx, cy + s2 * Rout * 0.85);
      jg.addColorStop(0, `rgba(120,220,255,${0.12 + 0.04 * Math.sin(t * 2.2)})`); jg.addColorStop(1, "rgba(120,220,255,0)");
      ctx.fillStyle = jg; ctx.fillRect(cx - R * 0.06, s2 < 0 ? cy - Rout * 0.85 : cy, R * 0.12, Rout * 0.85);
    }
    for (let i = 0; i < 26; i++) {                        // sparks orbiting in the disk
      const rr2 = R * (1.4 + (i % 9) * 0.22), a = t * (0.9 / Math.pow(rr2 / R, 1.5)) + i * 2.399;
      const x = cx + rr2 * Math.cos(a), y = cy + rr2 * Math.sin(a) * tilt;
      if (Math.sin(a) < 0 && Math.hypot(x - cx, (y - cy) / 1) < R * 1.1) continue;
      ctx.fillStyle = i % 3 ? "rgba(200,240,255,.8)" : "rgba(255,150,240,.8)"; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.restore();
  }
  function spaceLayers(t, glass) {
    const ox = clamp(-(cam.x - 2200) * cam.z * 0.012, -cw * 0.07, cw * 0.07), oy = clamp(-(cam.y - 880) * cam.z * 0.012, -ch * 0.07, ch * 0.07);
    ctx.drawImage(nebula, -cw * 0.09 + ox, -ch * 0.09 + oy, cw * 1.18, ch * 1.18);
    if (!glass) {
      for (const st of stars) {
        const x = ((st.x - cam.x * cam.z * st.p - t * st.v) % 1600 + 1600) % 1600, y = ((st.y - cam.y * cam.z * st.p) % 1000 + 1000) % 1000;
        ctx.fillStyle = st.c; ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + st.tw));
        for (let xx = x; xx < cw; xx += 1600) for (let yy = y; yy < ch; yy += 1000) ctx.fillRect(xx, yy, st.s, st.s);
      }
      ctx.globalAlpha = 1;
    }
    drawBlackHole(t, ox * 1.6, oy * 1.6);
  }
  function drawSpace(t) {
    ctx.fillStyle = "#010008"; ctx.fillRect(0, 0, cw, ch);
    spaceLayers(t, false);
    if (!shoot && Math.random() < 0.004) shoot = { x: rnd(0.2, 1) * cw, y: rnd(0, 0.4) * ch, t: 0, c: Math.random() < 0.5 ? "120,230,255" : "255,120,240" };
    if (shoot) {
      shoot.t += 0.016;
      const k = shoot.t / 0.9, x = shoot.x - k * cw * 0.5, y = shoot.y + k * ch * 0.25;
      const gr = ctx.createLinearGradient(x, y, x + 110, y - 55); gr.addColorStop(0, `rgba(${shoot.c},.95)`); gr.addColorStop(1, `rgba(${shoot.c},0)`);
      ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 110, y - 55); ctx.stroke();
      if (k >= 1) shoot = null;
    }
  }
  function makeMini() {
    const w = Math.round(clamp(cw * (cw < 500 ? 0.3 : 0.17), 96, 200)), s = w / BOUNDS.w, h = Math.round(BOUNDS.h * s);
    const c = document.createElement("canvas"); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const save = ctx; ctx = c.getContext("2d");
    ctx.setTransform(dpr * s, 0, 0, dpr * s, -BOUNDS.x * s * dpr, -BOUNDS.y * s * dpr);
    ctx.fillStyle = "#1a2252"; for (const hh of HULL) { ctx.beginPath(); hullShape(hh); ctx.fill(); }
    for (const r of ROOM_LIST) { roomPath(r); ctx.fillStyle = hexA(r.accent, 0.6); ctx.fill(); }
    ctx = save;
    mini = { c, w, h, s };
  }

  // ------------------------------------------------------------------ drawing
  function drawBeam(c) {
    const b = c.beam, a = b ? 1 - Math.abs(b.t - 0.55) / 0.55 : 0;
    if (a <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(c.x, c.y - 60, c.x, c.y);
    g.addColorStop(0, "rgba(25,230,255,0)"); g.addColorStop(1, `rgba(25,230,255,${0.7 * a})`);
    ctx.fillStyle = g; ctx.fillRect(c.x - 8, c.y - 60, 16, 62);
    ell(c.x, c.y, 11, 3.5, `rgba(180,250,255,${0.6 * a})`);
    ctx.restore();
  }
  function drawRoomDecor(r, t, lod, fresh) {
    switch (r.kind) {
      case "pair": drawPairRoom(r, t, lod); break;
      case "sector": case "observatory": if (lod > 0) sectorDecor(r, t, lod); break;
      case "tribunal": drawTribunal(r, t, lod); break;
      case "court": drawCourt(r, t, lod); break;
      case "bridge": drawBridge(r, t, lod); break;
      case "macro": drawMacro(r, t, lod); break;
      case "comms": drawComms(r, t, lod); break;
      case "orders": drawOrders(r, t, lod); break;
      case "reactor": drawReactor(r, t, lod); break;
      case "lab": drawLab(r, t, lod); break;
      case "engine": drawEngine(r, t, lod, fresh); break;
      default: break;
    }
  }
  function labelTag(txt, x, y, col, fs) {
    ctx.font = `bold ${fs}px ${FONT}`;
    const tw = ctx.measureText(txt).width + 12, h = fs + 7;
    const lx = clamp(x - tw / 2, 2, cw - tw - 2);
    rr(lx, y, tw, h, 4); ctx.fillStyle = "rgba(3,5,16,.86)"; ctx.fill(); ctx.strokeStyle = hexA(col, 0.8); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = col; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillText(txt, lx + 6, y + h / 2 + 0.5);
  }
  function drawLabels(lod) {
    const v = viewRect(40);
    for (const r of ROOM_LIST) {
      if (!boxInView(r, v)) continue;
      const [x0, y0] = toScreen(r.x, r.y), w = r.w * cam.z, h = r.h * cam.z;
      if (w < 30) continue;
      const big = w > 170, fs = big ? 11 : w > 70 ? 9.5 : 8.5, col = r.accent;
      const txt = big ? r.label + (r.stat ? "  ·  " + r.stat : "") : r.short + (r.stat && w > 70 ? " · " + r.stat : "");
      let y;
      if (r.kind === "tribunal") y = y0 + h * 0.06;
      else if (r.kind === "court") y = y0 + h + 6;
      else if (lod === 0) y = y0 + h / 2 - (fs + 7) / 2;
      else if (r.kind === "pair" && lod === 2) continue;           // its sign outside the pod names it
      else if (!r.ring && r.x < 700 && lod === 2) continue;            // the tail's rooms carry big title plates
      else if (r.ring) y = r.door.side === "top" ? y0 + h + 5 : y0 - fs - 12;
      else y = y0 + 5;
      labelTag(txt, x0 + w / 2, y, col, fs);
    }
    if (lod === 0) {                                     // district names on the far view
      ctx.font = `bold 12px ${DISPLAY}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const [txt, x, y, col] of [["FX ORBITAL RING", FXR.cx, FXR.cy - FXR.disc - 34, NEON.cyan], ["NILE RING · EGX", NIL.cx, NIL.cy - NIL.disc - 34, NEON.gold], ["TAIL: ENGINES · CARGO · REACTOR · LAB", 380, 1690, "#ff7a3d"]]) {
        const [sx, sy] = toScreen(x, y), hw = ctx.measureText(txt).width / 2 + 6;
        ctx.fillStyle = hexA(col, 0.9); ctx.fillText(txt, clamp(sx, hw, cw - hw), Math.max(10, sy));
      }
      ctx.textAlign = "left";
    }
  }
  const TAG = { sw_usd: "Fed & Dollar Analyst", sw_eur: "ECB & Euro Analyst", sw_gbp: "BoE & Sterling Analyst", sw_jpy: "BoJ & Yen Analyst",
    sw_anz: "AUD & NZD Analyst", sw_cad: "BoC & Loonie Analyst", sw_chf: "SNB & Franc Analyst", sw_btc: "Crypto Analyst", sw_xau: "Gold Analyst",
    sw_tv: "TradingView Technician", sw_macro: "Global Macro Strategist", sw_news: "FX News Checker", sw_risk: "FX Risk Officer",
    news_fx: "FX News Scouts", sw_judge: "Swing Judge", egx_banks: "Banks Analyst", egx_nbfi: "Non-Bank Finance Analyst",
    egx_realestate: "Real Estate Analyst", egx_materials: "Materials & Energy Analyst", egx_industrials: "Industrials Analyst",
    egx_consumer: "Consumer & Health Analyst", egx_tmt: "Telecom & Tech Analyst", egx_macro: "Macro & Pound Strategist",
    egx_quant: "CCAPM Quant", egx_risk: "EGX Risk Officer", egx_newscheck: "EGX News Checker", news_egx: "EGX News Scouts",
    egx_orders: "Order Desk", egx_judge: "Portfolio Judge", director: "Director",
    et_banks: "Banks Earnings Tracker", va_banks: "Banks Valuation Analyst", et_nbfi: "NBFI Earnings Tracker",
    va_nbfi: "NBFI Valuation Analyst", et_realestate: "Property Earnings Tracker", va_realestate: "Property Valuation Analyst",
    et_materials: "Materials Earnings Tracker", va_materials: "Materials Valuation Analyst",
    et_industrials: "Industrials Earnings Tracker", va_industrials: "Industrials Valuation Analyst",
    et_consumer: "Consumer Earnings Tracker", va_consumer: "Consumer Valuation Analyst", et_tmt: "TMT Earnings Tracker",
    va_tmt: "TMT Valuation Analyst", tm_operator: "PRO12 Terminal Operator", tm_watcher: "Results Watcher",
    tm_spreader: "Terminal Spreader", tm_listings: "Listings Clerk", tm_prices: "Closing Price Clerk",
    sw_geo: "Geopolitics & Conflicts Analyst", egx_politics: "Political & Economic Factors Analyst" };
  const ALIAS = { sw_usd: "Eagle", sw_eur: "Captain Euro", sw_gbp: "Lionheart", sw_jpy: "Ronin", sw_anz: "Southern Cross", sw_cad: "Maple",
    sw_chf: "Alpine Knight", sw_btc: "Phantom", sw_xau: "Midas", sw_tv: "Chartist", sw_macro: "Atlas", sw_news: "Herald", sw_risk: "Sentinel",
    news_fx: "Echo", sw_judge: "The Arbiter", egx_banks: "Vault", egx_nbfi: "Ledger", egx_realestate: "Architect", egx_materials: "Titan",
    egx_industrials: "Gearsmith", egx_consumer: "Maven", egx_tmt: "Signal", egx_macro: "Horus", egx_quant: "Cipher", egx_risk: "Anubis",
    egx_newscheck: "Thoth", news_egx: "Scribe", egx_orders: "Dock Master", egx_judge: "The Pharaoh", director: "The Captain",
    et_banks: "Clerk", va_banks: "Oracle", et_nbfi: "Tally", va_nbfi: "Compass", et_realestate: "Surveyor", va_realestate: "Keystone",
    et_materials: "Assayer", va_materials: "Forge", et_industrials: "Stopwatch", va_industrials: "Blueprint",
    et_consumer: "Receipt", va_consumer: "Tastemaker", et_tmt: "Ping", va_tmt: "Bandwidth",
    tm_operator: "Ghost", tm_watcher: "Lookout", tm_spreader: "Abacus", tm_listings: "Roll Call", tm_prices: "Ticker Tape",
    sw_geo: "Cartographer", egx_politics: "Vizier" };
  function drawNames() {
    const px = 52 * CS * cam.z;
    if (px < 10) return;
    const v = viewRect(30), placed = [], alias = px >= 30, compact = px < 17;
    const list = chars.filter(c => !c.beam && inView(c.x, c.y, v)).sort((a, b) => a.y - b.y);
    ctx.textBaseline = "middle";
    for (const c of list) {
      const [sx, sy] = toScreen(c.x, c.y), name = TAG[c.id] || c.a.name, nick = ALIAS[c.id] || (c.spec.regime ? "keeper bot" : "");
      const acc = (ROOMS[c.home] || {}).accent || NEON.cyan;
      if (compact) {                                      // far away: just who it is, small
        const t2 = ALIAS[c.id] || (c.spec.regime ? c.spec.regime + " quant" : name);
        ctx.font = `bold 9px ${FONT}`;
        const w2 = ctx.measureText(t2).width + 10;
        let q = { x: sx - w2 / 2, y: sy + 2, w: w2, h: 13 };
        if (placed.some(p => overlaps(p, q))) q = { ...q, y: q.y + 14 };
        if (placed.some(p => overlaps(p, q)) || q.x > cw || q.x + w2 < 0 || q.y > ch || q.y + 13 < 0) continue;
        placed.push(q);
        rr(q.x, q.y, w2, 13, 6); ctx.fillStyle = "rgba(3,4,16,.8)"; ctx.fill();
        ctx.fillStyle = acc; ctx.textAlign = "center"; ctx.fillText(t2, sx, q.y + 7); ctx.textAlign = "left";
        continue;
      }
      ctx.font = `bold 10.5px ${FONT}`;
      let w = ctx.measureText(name).width + 14, h = 16;
      if (alias && nick) { ctx.font = `10px ${FONT}`; w = Math.max(w, ctx.measureText(nick).width + 14); h = 28; }
      let r = { x: sx - w / 2, y: sy + 4, w, h };
      for (let k = 0; k < 3 && placed.some(p => overlaps(p, r)); k++) r = { ...r, y: r.y + h + 2 };
      if (placed.some(p => overlaps(p, r)) || r.x > cw || r.x + w < 0 || r.y > ch || r.y + h < 0) continue;
      placed.push(r);
      rr(r.x, r.y, w, h, 7); ctx.fillStyle = "rgba(3,4,16,.84)"; ctx.fill(); ctx.strokeStyle = hexA(acc, 0.85); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.textAlign = "center";
      if (alias && nick) {
        ctx.fillStyle = acc; ctx.font = `bold 10px ${FONT}`; ctx.fillText(nick, sx, r.y + 8.5);
        ctx.fillStyle = "#e9f2ff"; ctx.font = `10px ${FONT}`; ctx.fillText(name, sx, r.y + 20.5);
      } else { ctx.fillStyle = "#e9f2ff"; ctx.font = `bold 10.5px ${FONT}`; ctx.fillText(name, sx, r.y + 8.5); }
      ctx.textAlign = "left";
    }
    if (cam.z >= 1.3) {                                   // which stock each EGX news drone covers
      ctx.font = `bold 9px ${FONT}`; ctx.textAlign = "center";
      for (const d of drones) {
        if (!inView(d.x, d.y, v) || d.room === d.label) continue;
        const [sx, sy] = toScreen(d.x, d.y);
        ctx.fillStyle = "rgba(3,4,16,.7)"; ctx.fillRect(sx - 15, sy + 2, 30, 11);
        ctx.fillStyle = sentCol(d.sent); ctx.fillText(d.label, sx, sy + 8);
      }
      ctx.textAlign = "left";
    }
  }
  function wrap(text, maxW, maxLines) {
    const words = String(text).split(/\s+/), lines = [];
    let cur = "";
    for (const w of words) {
      const tt = cur ? cur + " " + w : w;
      if (ctx.measureText(tt).width > maxW && cur) { lines.push(cur); cur = w; if (lines.length === maxLines) break; }
      else cur = tt;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length + 1) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "...";
    return lines;
  }
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  function bubbleColor(o) { return o.spec ? (ROOMS[o.room] || ROOMS[o.home]).accent : sentCol(o.sent); }
  function drawBubbles() {
    const list = [...chars, ...drones].filter(o => o.bubble && o.bubble.until > simT);
    if (meeting) list.sort((a, b) => (meeting.ids.includes(a.id) ? 1 : 0) - (meeting.ids.includes(b.id) ? 1 : 0));
    const placed = [];
    const small = cw < 500, maxW = small ? 150 : 200, lh = small ? 13 : 14;
    ctx.font = `${small ? 10.5 : 11.5}px ${FONT}`; ctx.textBaseline = "top";
    for (const o of list) {
      const head = o.spec ? (58 * (o.spec.scale || 1) + (o.spec.float ? 8 : 0)) * CS : o.h + 10;
      const [sx, sy0] = toScreen(o.x, o.y), sy = sy0 - head * cam.z;
      if (sx < -40 || sx > cw + 40 || sy < -40 || sy > ch + 80) continue;
      const lines = wrap(o.bubble.text, maxW, meeting && meeting.ids.includes(o.id) ? 4 : 3), acc = bubbleColor(o);
      const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16, h = lines.length * lh + 10;
      let bx = clamp(sx - w / 2, 4, cw - w - 4), by = sy - h - 8;
      if (by < 2) by = sy0 + 10;
      for (const [ox, oy] of [[0, 0], [w * 0.6, 0], [-w * 0.6, 0], [0, -(h + 6)], [w * 0.6, -(h + 6)], [-w * 0.6, -(h + 6)], [0, h + 30]]) {
        const r = { x: clamp(bx + ox, 4, cw - w - 4), y: clamp(by + oy, 2, ch - h - 2), w, h };
        if (!placed.some(p => overlaps(p, r))) { bx = r.x; by = r.y; break; }
      }
      placed.push({ x: bx, y: by, w, h });
      rr(bx, by, w, h, 7); ctx.fillStyle = "rgba(5,8,24,.95)"; ctx.fill();
      ctx.strokeStyle = hexA(acc, 0.25); ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = acc; ctx.lineWidth = 1.5; ctx.stroke();
      if (by + h < sy0 && sx > bx + 6 && sx < bx + w - 6) { ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(sx - 5, by + h); ctx.lineTo(sx + 5, by + h); ctx.lineTo(sx, by + h + 7); ctx.fill(); }
      ctx.fillStyle = NEON.ink;
      lines.forEach((l, i) => ctx.fillText(l, bx + 8, by + 6 + i * lh));
    }
  }
  function drawHover() {
    if (!hover) return;
    const o = hover, [sx, sy] = toScreen(o.x, o.y);
    let name, sub;
    if (o.spec) { name = o.a.name; sub = clip(o.a.role || "", 70); }
    else {
      name = `${o.label} news scout`;
      const r = o.read;
      sub = r ? `${r.materiality || "?"} · ${(r.sentiment > 0 ? "+" : "") + Number(r.sentiment || 0).toFixed(2)} · ${clip(r.key_point || "", 60)}` : "No read yet";
    }
    ctx.font = `bold 11px ${FONT}`; const w1 = ctx.measureText(name).width;
    ctx.font = `10px ${FONT}`; const w2 = ctx.measureText(sub).width;
    const w = Math.max(w1, w2) + 16, x = clamp(sx - w / 2, 4, cw - w - 4), y = clamp(sy + 8, 4, ch - 40);
    const acc = bubbleColor(o);
    rr(x, y, w, 34, 6); ctx.fillStyle = "rgba(3,5,16,.95)"; ctx.fill(); ctx.strokeStyle = acc; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.textBaseline = "top"; ctx.fillStyle = acc; ctx.font = `bold 11px ${FONT}`; ctx.fillText(name, x + 8, y + 5);
    ctx.fillStyle = "#b9c4e6"; ctx.font = `10px ${FONT}`; ctx.fillText(sub, x + 8, y + 19);
  }
  function drawMeetingHud() {
    if (!meeting) return;
    const m = meeting, col = m.chamber === "court" ? NEON.gold : NEON.violet;
    const txt = m.title + (m.stage === "gather" ? "  ·  walking to the " + (m.chamber === "court" ? "High Court" : "Tribunal") : m.stage === "beam" ? "  ·  beaming in" : "");
    ctx.font = `bold 12px ${FONT}`;
    const tw = Math.min(cw - 20, ctx.measureText(txt).width + 22), x = cw / 2 - tw / 2;
    rr(x, 10, tw, 26, 7); ctx.fillStyle = "rgba(4,6,20,.92)"; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(x + 6, 10, tw - 12, 26); ctx.clip();
    ctx.fillStyle = col; ctx.textBaseline = "middle"; ctx.fillText(txt, x + 11, 23.5); ctx.restore();
    if (m.stage === "verdict") {
      const r = ROOMS[m.chamber], [sx, sy] = toScreen(r.cx, r.cy + (m.chamber === "court" ? -230 : -120));
      ctx.save(); ctx.translate(clamp(sx, 120, cw - 120), clamp(sy, 60, ch - 40)); ctx.rotate(-0.06);
      ctx.font = `bold 22px ${FONT}`;
      const sw = ctx.measureText(m.stamp).width + 30;
      rr(-sw / 2, -21, sw, 42, 7); ctx.fillStyle = "rgba(4,6,20,.95)"; ctx.fill();
      ctx.strokeStyle = hexA(m.card, 0.3); ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = m.card; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = m.card; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(m.stamp, 0, 1.5); ctx.textAlign = "left";
      ctx.restore();
    }
  }
  function drawHud(t) {
    const a = ageMin(), ok = a != null && a < 45;
    const txt = a == null ? "NO DATA YET" : ok ? `LIVE · UPDATED ${cairo(data.generated_at)} CAIRO` : `NOT UPDATING · LAST ${cairo(data.generated_at)} CAIRO, ${agoTxt(a).toUpperCase()}`;
    ctx.font = `bold 10px ${FONT}`;
    const w = ctx.measureText(txt).width + 30, x = 10, y = ch - 30;
    rr(x, y, w, 20, 10); ctx.fillStyle = "rgba(3,5,16,.85)"; ctx.fill(); ctx.strokeStyle = ok ? hexA(NEON.mint, 0.6) : NEON.pink; ctx.lineWidth = 1; ctx.stroke();
    circle(x + 11, y + 10, 3.6, ok ? (Math.sin(t * 4) > 0 ? NEON.mint : "#0f6b5a") : NEON.pink);
    ctx.fillStyle = ok ? "#bff7ec" : NEON.pink; ctx.textBaseline = "middle"; ctx.fillText(txt, x + 20, y + 10.5);
  }
  function drawTourTag(t) {
    if (!tour.on || meeting) return;
    const txt = cw < 500 ? "AUTO TOUR · TOUCH TO EXPLORE" : "AUTO TOUR · DRAG, ZOOM OR CLICK TO EXPLORE";
    ctx.font = `bold 10px ${FONT}`;
    const w = ctx.measureText(txt).width + 30;
    rr(10, 10, w, 20, 10); ctx.fillStyle = "rgba(3,5,16,.85)"; ctx.fill(); ctx.strokeStyle = hexA(NEON.violet, 0.8); ctx.lineWidth = 1; ctx.stroke();
    circle(21, 20, 3.6, Math.sin(t * 3) > 0 ? NEON.violet : NEON.magenta);
    ctx.fillStyle = "#d9ccff"; ctx.textBaseline = "middle"; ctx.fillText(txt, 30, 20.5);
  }
  function drawMini() {
    if (!mini || cam.z < fitView().z * 1.45 || cw < 300) return;
    const x = cw - mini.w - 10, y = ch - mini.h - 10;
    rr(x - 4, y - 4, mini.w + 8, mini.h + 8, 6); ctx.fillStyle = "rgba(3,5,16,.82)"; ctx.fill(); ctx.strokeStyle = "rgba(25,230,255,.35)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.drawImage(mini.c, x, y, mini.w, mini.h);
    const v = viewRect(0), s = mini.s;
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.3;
    ctx.strokeRect(x + (v[0] - BOUNDS.x) * s, y + (v[1] - BOUNDS.y) * s, (v[2] - v[0]) * s, (v[3] - v[1]) * s);
    if (meeting) { const r = ROOMS[meeting.chamber]; circle(x + (r.cx - BOUNDS.x) * s, y + (r.cy - BOUNDS.y) * s, 3 + Math.sin(simT * 6), NEON.pink); }
    mini.at = [x, y];
  }
  function showToast(txt) { toast = { txt, until: simT + 1.8 }; }
  function drawToast() {
    if (!toast || toast.until < simT) return;
    ctx.font = `12px ${FONT}`;
    const w = ctx.measureText(toast.txt).width + 24, x = cw / 2 - w / 2, y = ch - 64;
    rr(x, y, w, 26, 13); ctx.fillStyle = "rgba(3,5,16,.92)"; ctx.fill(); ctx.strokeStyle = NEON.cyan; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = NEON.ink; ctx.textBaseline = "middle"; ctx.fillText(toast.txt, x + 12, y + 13.5);
  }

  function draw() {
    const t = simT, z = cam.z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = "round";
    drawSpace(t);
    const lod = curLod = z < 0.3 ? 0 : z < 0.55 ? 1 : 2, clod = z * 52 * CS < 8 ? 0 : z * 52 * CS < 21 ? 1 : 2, fresh = freshness();
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cw / 2 - cam.x * z), dpr * (ch / 2 - cam.y * z));
    drawHull(t, lod);
    thrusters(t, fresh);
    drawCorridors(t, lod);
    const v = viewRect(80);
    for (const r of ROOM_LIST) {
      if (!boxInView(r, v)) continue;
      drawRoomShell(r, t, lod);
      drawRoomDecor(r, t, lod, fresh);
    }
    const items = [];
    for (const c of chars) if (inView(c.x, c.y, v)) items.push([c.y, 0, c]);
    for (const d of drones) if (inView(d.x, d.y, v)) items.push([d.y + 0.5, 1, d]);
    if (lod > 0) for (const p of PAIR_IDS) { const b = balls[p]; if (b && inView(b.x, b.y, v)) items.push([b.y + 0.2, 2, b]); }
    items.sort((a, b) => a[0] - b[0]);
    for (const [, k, o] of items) {
      if (k === 0) { drawHero(o, t, clod); if (o.beam) drawBeam(o); }
      else if (k === 1) drawDrone(o, t, clod);
      else drawBall(o);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLabels(lod);
    drawNames();
    drawMeetingHud();
    drawBubbles();
    drawHover();
    drawHud(t);
    drawTourTag(t);
    drawMini();
    drawToast();
  }

  function tick(dt) {
    simT += dt;
    chars.forEach(c => step(c, dt));
    drones.forEach(d => stepDrone(d, dt));
    updateBalls(dt);
    updateMeeting(dt);
    ambient(dt);
    tourStep(dt);
    camStep(dt);
  }
  let lastTs = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    if (document.hidden || !onScreen || !inited) return;
    tick(dt);
    if (ts - lastDraw < 31) return;                     // about 30 frames a second at most: easy on the laptop
    lastDraw = ts;
    draw();
  }

  // ------------------------------------------------------------------ input
  function pick(sx, sy) {
    const [wx, wy] = toWorld(sx, sy), rad = Math.max(13, 11 / cam.z);
    let best = null, bd = rad;
    for (const c of chars) { const d = Math.hypot(c.x - wx, c.y - 22 * CS * (c.spec.scale || 1) - wy); if (d < bd) { bd = d; best = c; } }
    for (const d0 of drones) { const d = Math.hypot(d0.x - wx, d0.y - d0.h - wy); if (d < bd * 0.75) { bd = d; best = d0; } }
    return best;
  }
  function click(sx, sy) {
    if (mini && mini.at && cam.z >= fitView().z * 1.45 && sx >= mini.at[0] && sx <= mini.at[0] + mini.w && sy >= mini.at[1] && sy <= mini.at[1] + mini.h) {
      flyTo({ x: BOUNDS.x + (sx - mini.at[0]) / mini.s, y: BOUNDS.y + (sy - mini.at[1]) / mini.s, z: cam.z }); lastUserCam = Date.now(); return;
    }
    const o = pick(sx, sy);
    if (o) { if (onSelect) onSelect(o.id); return; }
    const [wx, wy] = toWorld(sx, sy), r = roomAt(wx, wy);
    if (r) { flyTo(cam.z < zPeople() * 0.9 ? focus(r.id) : viewFor(r.id)); lastUserCam = Date.now(); }
  }
  function attachInput(cv) {
    const pts = new Map();
    let drag = null, pinch = null, focused = false;
    const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.addEventListener("pointerdown", e => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      const p = pos(e); pts.set(e.pointerId, p); focused = true; stopTour();
      if (pts.size === 1) drag = { sx: p[0], sy: p[1], cx: cam.x, cy: cam.y, moved: false };
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: cam.z, w: toWorld(mid[0], mid[1]) }; drag = null;
      }
    });
    cv.addEventListener("pointermove", e => {
      const p = pos(e);
      if (pts.has(e.pointerId)) pts.set(e.pointerId, p);
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        cam.z = clamp(pinch.z * d / pinch.d, zMin(), Z_MAX);
        cam.x = pinch.w[0] - (mid[0] - cw / 2) / cam.z; cam.y = pinch.w[1] - (mid[1] - ch / 2) / cam.z;
        goal.on = false; lastUserCam = Date.now(); clampCam(); return;
      }
      if (drag) {
        const dx = p[0] - drag.sx, dy = p[1] - drag.sy;
        if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; cv.style.cursor = "grabbing"; hover = null; }
        if (drag.moved) { cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; goal.on = false; lastUserCam = Date.now(); clampCam(); }
        return;
      }
      hover = pick(p[0], p[1]); cv.style.cursor = hover ? "pointer" : "grab";
    });
    const end = e => {
      const tap = drag && !drag.moved && pts.size === 1 && e.type === "pointerup", p = pos(e);
      pts.delete(e.pointerId);
      if (tap) click(p[0], p[1]);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const [q] = [...pts.values()]; drag = { sx: q[0], sy: q[1], cx: cam.x, cy: cam.y, moved: true }; }
      if (!pts.size) { drag = null; cv.style.cursor = "grab"; }
    };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("pointerleave", () => { if (!pts.size) { hover = null; focused = false; } });
    cv.addEventListener("wheel", e => {
      if (!(e.ctrlKey || e.metaKey || focused)) { showToast("Click the ship first (or hold Ctrl) to zoom with the wheel"); return; }
      e.preventDefault(); stopTour();
      const p = pos(e);
      zoomAt(p[0], p[1], Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0016)));
    }, { passive: false });
    cv.addEventListener("dblclick", e => { const p = pos(e); zoomAt(p[0], p[1], 1.8); });
    cv.addEventListener("keydown", e => {
      const k = e.key, step2 = 120 / cam.z;
      if (k === "+" || k === "=") zoomAt(cw / 2, ch / 2, 1.3);
      else if (k === "-" || k === "_") zoomAt(cw / 2, ch / 2, 1 / 1.3);
      else if (k === "0") flyTo(fitView());
      else if (k === "ArrowLeft") cam.x -= step2; else if (k === "ArrowRight") cam.x += step2;
      else if (k === "ArrowUp") cam.y -= step2; else if (k === "ArrowDown") cam.y += step2;
      else return;
      e.preventDefault(); stopTour(); goal.on = goal.on && (k === "0"); lastUserCam = Date.now(); clampCam();
    });
  }

  function resize() {
    if (!canvas) return;
    const b = canvas.getBoundingClientRect();
    if (b.width < 10 || b.height < 10) return;
    const w = Math.round(b.width), h = Math.round(b.height), nd = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    if (inited && w === cw && h === ch && nd === dpr) return;
    const wasFit = inited && Math.abs(cam.z - fitView().z) < 1e-4;
    cw = w; ch = h; dpr = nd;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    makeBackground(); makeMini();
    if (!inited) {                                       // start on the whole ship, then the tour flies in
      const v = fitView();
      cam.x = v.x; cam.y = v.y; cam.z = v.z; inited = true;
    } else if (fitLock || wasFit) { const v = fitView(); cam.x = v.x; cam.y = v.y; cam.z = v.z; }
    clampCam();
    if (!lastDraw) draw();
  }

  // ------------------------------------------------------------------ API
  window.Office = {
    init(cv, selectCb) {
      canvas = cv; ctx = cv.getContext("2d"); onSelect = selectCb;
      if (!cv.hasAttribute("tabindex")) cv.setAttribute("tabindex", "0");
      cv.style.cursor = "grab";
      attachInput(cv);
      resize();
      window.addEventListener("resize", resize);
      if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);
      if (window.IntersectionObserver) new IntersectionObserver(es => { onScreen = es.some(e => e.isIntersecting); }).observe(cv);
      requestAnimationFrame(frame);
    },
    setData(F) {
      data = F; notes = F.notes || {};
      const ids = new Set((F.roster || []).map(a => a.id));
      chars = chars.filter(c => ids.has(c.id));
      byId = {}; chars.forEach(c => { byId[c.id] = c; });
      buildRoomInfo();
      let added = false;
      for (const a of F.roster || []) {
        if (byId[a.id]) { byId[a.id].a = a; continue; }
        const c = makeChar(a); chars.push(c); byId[a.id] = c; added = true;
      }
      if (added) layoutStations();
      chars.forEach(c => {
        if (c.spec.regime) c.regime = ((ROOMS[c.spec.regime] || {}).info || {}).regime;
        if (!c.placed) { const p = c.station || randomPoint(c.home); c.x = p[0] + rnd(-5, 5); c.y = p[1]; c.room = c.home; c.placed = true; }
      });
      buildDrones();
      for (const kind of ["fx", "gold"]) {                // a fresh meeting plays once per page load
        const src = kind === "fx" ? "swing" : kind, m = ((F[src] && F[src].meetings) || []).slice(-1)[0];
        if (m && !played.has(kind + m.ts) && Date.now() - Date.parse(m.ts) < 30 * 60 * 1000) {
          if (startMeeting(kind)) { played.add(kind + m.ts); break; }
        }
      }
    },
    replay(kind) { return startMeeting(kind); },
    busy() { return !!meeting; },
    // Advance the simulation by hand (tests, or a hidden tab where animation frames are paused).
    advance(seconds, dt = 0.05) {
      for (let t = 0; t < seconds; t += dt) tick(dt);
      if (inited) draw();
      return { stage: meeting ? meeting.stage : "none", talking: chars.filter(c => c.bubble && c.bubble.until > simT).map(c => c.id) };
    },
    view(target) { lastUserCam = Date.now(); if (target === "ship") return fitAll(); stopTour(); flyTo(viewFor(target)); },
    zoomBy(f) { stopTour(); zoomAt(cw / 2, ch / 2, f); },
    // the slow tour of the ship at people size (on when the page opens; any touch, drag or zoom stops it)
    tour(on) { tour.on = on !== false; tour.t = 0; if (tour.on) { lastUserCam = 0; fitLock = false; } return tour.on; },
    // Full screen: the stage (the canvas and its slim bar) fills the screen and shows the whole ship, so every
    // character is in view at once. Uses the browser's Fullscreen API where there is one, and a fixed full-window
    // layer everywhere (iPhone Safari has no Fullscreen API for pages, so the layer is what it gets).
    attachFullscreen(stage, button) {
      if (!stage) return null;
      const native = () => document.fullscreenElement || document.webkitFullscreenElement;
      const isOn = () => stage.classList.contains("full");
      const set = on => {
        if (on === isOn()) return;
        stage.classList.toggle("full", on);
        document.documentElement.classList.toggle("ship-full-open", on);
        if (button) { button.textContent = on ? "Exit full screen" : "Full screen"; button.setAttribute("aria-pressed", String(on)); }
        if (on) {
          const rq = stage.requestFullscreen || stage.webkitRequestFullscreen;
          if (rq) { try { const p = rq.call(stage); if (p && p.catch) p.catch(() => {}); } catch (e) { /* the window layer is enough */ } }
          fitAll();
          setTimeout(() => { if (isOn() && ch > cw * 1.1) showToast("Turn your phone sideways to see the whole ship bigger"); }, 500);
        } else if (native()) {
          const ex = document.exitFullscreen || document.webkitExitFullscreen;
          try { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* already out */ }
        }
      };
      if (button) button.addEventListener("click", () => set(!isOn()));
      stage.querySelectorAll("[data-fs]").forEach(b => b.addEventListener("click", () => {
        const a = b.dataset.fs;
        if (a === "exit") set(false);
        else if (a === "ship") fitAll();
        else if (a === "tour") window.Office.tour(true);
        else if (a === "in" || a === "out") { stopTour(); zoomAt(cw / 2, ch / 2, a === "in" ? 1.5 : 1 / 1.5); }
      }));
      const changed = () => { if (!native() && isOn()) set(false); };     // the browser left full screen (Esc)
      document.addEventListener("fullscreenchange", changed);
      document.addEventListener("webkitfullscreenchange", changed);
      document.addEventListener("keydown", e => { if (e.key === "Escape" && isOn() && !native()) set(false); });
      return { set, isOn };
    },
    touring() { return tour.on; },
    rooms() { return ROOM_LIST.map(r => ({ id: r.id, label: r.label, kind: r.kind, x: Math.round(r.x), y: Math.round(r.y),
                                           w: Math.round(r.w), h: Math.round(r.h) })); },
    debug() {
      return { cam: { ...cam }, meeting: meeting && meeting.stage, drones: drones.length,
               chars: chars.map(c => ({ id: c.id, home: c.home, room: c.room, x: Math.round(c.x), y: Math.round(c.y), moving: c.path.length > 0 })) };
    },
  };
})();
