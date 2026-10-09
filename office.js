/* 2D office: every agent walks around its room, shows what it is thinking, and
   walks to the meeting room when its desk pitches to the Judge. Pure canvas, no
   libraries, no assets. */
(function () {
  "use strict";

  const W = 960, H = 540, HALL_Y = 280, TILE = 20;
  const ROOMS = {
    gold:     { x: 16,  y: 34,  w: 292, h: 226, label: "GOLD DESK  XAUUSD", floor: "#0e0a24", accent: "#ff2bd6", door: 162, side: "bottom" },
    fx:       { x: 324, y: 34,  w: 292, h: 226, label: "FX SWING DESK", floor: "#05161a", accent: "#2ff3d0", door: 470, side: "bottom" },
    egx:      { x: 632, y: 34,  w: 312, h: 226, label: "EGX FLOOR", floor: "#071228", accent: "#19e6ff", door: 788, side: "bottom" },
    director: { x: 16,  y: 300, w: 250, h: 224, label: "DIRECTOR", floor: "#0a0b22", accent: "#9b5cff", door: 141, side: "top" },
    meeting:  { x: 286, y: 300, w: 388, h: 224, label: "MEETING ROOM", floor: "#100b28", accent: "#9b5cff", door: 480, side: "top" },
    board:    { x: 694, y: 300, w: 250, h: 224, label: "BOARD", floor: "#060a1c", accent: "#19e6ff", door: 819, side: "top" },
  };
  const SEATS = [
    [352, 382], [402, 382], [452, 382], [502, 382], [552, 382],
    [352, 462], [402, 462], [452, 462], [502, 462], [552, 462], [318, 422], [318, 446],
  ];
  const BENCH = [[630, 404], [630, 446], [600, 425]];

  const SKIN = ["#f1c9a5", "#d9a37b", "#b97a53", "#8d5a3b", "#e8b896", "#c68e66"];
  const HAIR = ["#2b1d14", "#5a3a22", "#1a1a1a", "#7a4e2a", "#3d2b1f", "#a0522d", "#4a4a4a"];
  const SHIRT = { gold: "#b0259a", fx: "#128a74", swing: "#128a74", arb: "#b8860b", egx: "#0f97b0", judge: "#120a26", director: "#2b2f78" };

  let ctx, canvas, dpr = 1, onSelect = null, goldOff = false;
  let chars = [], byId = {}, data = null, notes = {}, meeting = null;
  let hover = null, ambientT = 0, ambientIdx = 0, monitors = [], monT = 0;
  const played = new Set();

  function hash(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function homeRoom(a) {
    if (a.id === "director") return "director";
    if (a.judge) return "meeting";
    if (goldOff && a.desk === "swing" && a.quant) return "gold";      // the gold room becomes the quant room
    if (a.desk === "arb") return goldOff ? "gold" : "fx";             // the BTC arbitrage team sits with the quants
    return a.desk === "gold" ? "gold" : (a.desk === "fx" || a.desk === "swing") ? "fx" : "egx";
  }

  function roomAt(x, y) {
    for (const [k, r] of Object.entries(ROOMS)) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return k;
    }
    return "hall";
  }

  function doorPoints(room) {
    const r = ROOMS[room];
    return r.side === "bottom"
      ? { inside: [r.door, r.y + r.h - 16], outside: [r.door, HALL_Y] }
      : { inside: [r.door, r.y + 18], outside: [r.door, HALL_Y] };
  }

  function pathTo(c, room, x, y) {
    const from = roomAt(c.x, c.y);
    if (from === room) return [[x, y]];
    const pts = [];
    if (from !== "hall") { const d = doorPoints(from); pts.push(d.inside, d.outside); }
    const d2 = doorPoints(room);
    pts.push(d2.outside, d2.inside, [x, y]);
    return pts;
  }

  function layoutDesks() {
    const desks = {};
    for (const room of ["gold", "fx", "egx"]) {
      const members = chars.filter(c => c.home === room);
      const rows = members.length > 14 ? 3 : 2;
      const r = ROOMS[room], cols = Math.max(1, Math.ceil(members.length / rows));
      const colW = (r.w - 40) / cols;
      members.forEach((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = r.x + 20 + (col + 0.5) * colW;
        const y = r.y + (rows === 3 ? 58 + row * 62 : 70 + row * 92);
        c.desk = { x, y, w: Math.min(60, Math.floor(colW) - 6) };
        c.seat = [x, y + 30];
        (desks[room] = desks[room] || []).push(c.desk);
      });
    }
    const dir = byId.director;
    if (dir) { dir.desk = { x: 120, y: 370 }; dir.seat = [120, 404]; }
    chars.filter(c => c.a.judge).forEach((c, i) => { c.desk = null; c.seat = BENCH[i % BENCH.length]; });
    monitors = chars.filter(c => c.desk).map(c => ({ c, pts: Array.from({ length: 8 }, () => rnd(2, 10)) }));
  }

  function makeChar(a) {
    const h = hash(a.id);
    const home = homeRoom(a);
    const c = {
      a, id: a.id, home, x: 0, y: 0, path: [], wait: rnd(0.5, 3), walk: 0, facing: 1,
      speed: rnd(34, 48), locked: false, bubble: null,
      skin: SKIN[h % SKIN.length], hair: HAIR[(h >> 3) % HAIR.length],
      shirt: a.judge ? SHIRT.judge : a.id === "director" ? SHIRT.director : SHIRT[a.desk] || "#777",
    };
    return c;
  }

  function wanderTarget(c) {
    const r = ROOMS[c.home];
    if (c.seat && Math.random() < 0.45) return { pt: c.seat, wait: rnd(4, 9) };
    return { pt: [rnd(r.x + 22, r.x + r.w - 22), rnd(r.y + 44, r.y + r.h - 18)], wait: rnd(1, 3.5) };
  }

  function say(c, text, secs) {
    if (!text) return;
    c.bubble = { text: String(text), until: performance.now() / 1000 + secs };
  }

  // -- meetings ---------------------------------------------------------------
  function startMeeting(kind) {
    if (!data || meeting) return false;
    let lines = [], title = "", stamp = "", stampOk = false;
    if (kind === "fx") {
      const m = (data.swing && data.swing.meetings || []).slice(-1)[0];
      if (!m) return false;
      const ids = ["sw_usd", "sw_eur", "sw_gbp", "sw_jpy", "sw_anz", "sw_cad", "sw_chf", "sw_btc", "sw_macro", "sw_risk"];
      lines = ids.filter(id => notes[id]).map(id => ({ agent: id, line: notes[id].bubble }));
      (m.candidates || []).forEach(c => { const q = "sq_" + c.pair.toLowerCase(); if (notes[q]) lines.push({ agent: q, line: notes[q].bubble }); });
      lines.push({ agent: "sw_judge", line: m.judge ? m.judge.headline : "Judge unavailable. No trade." });
      title = "Swing review: " + (m.candidates || []).map(c => c.pair + " " + c.direction).join(", ");
      const n = (m.opened || []).filter(o => o.direction).length;
      stamp = n + " OPENED";
      stampOk = n > 0;
    } else if (kind === "gold") {
      const m = (data.gold && data.gold.meetings || []).slice(-1)[0];
      if (!m) return false;
      lines = m.transcript || [];
      title = "Gold pitch: " + m.direction;
      stamp = m.final === "APPROVE" ? "APPROVED" : m.final === "APPROVED_TOO_SMALL" ? "APPROVED, TOO SMALL" : "REJECTED";
      stampOk = m.final === "APPROVE";
    } else {
      const e = data.egx;
      if (!e) return false;
      const analysts = ["egx_banks", "egx_nbfi", "egx_realestate", "egx_materials", "egx_industrials",
        "egx_consumer", "egx_tmt", "egx_macro", "egx_quant", "egx_risk"];
      lines = analysts.filter(id => notes[id]).map(id => ({ agent: id, line: notes[id].bubble }));
      const j = e.judge;
      lines.push({ agent: "egx_judge", line: j ? (j.headline || j.bubble) : "No review today (budget or API)." });
      title = "EGX review " + (e.session || "");
      stamp = (e.orders || []).length + " APPROVED  " + (e.vetoed || []).length + " HELD BACK";
      stampOk = (e.orders || []).length > 0;
    }
    if (!lines.length) return false;
    const ids = [...new Set(lines.map(l => l.agent))].filter(id => byId[id] && !byId[id].a.judge);
    ids.forEach((id, i) => {
      const c = byId[id], s = SEATS[i % SEATS.length];
      c.locked = true; c.path = pathTo(c, "meeting", s[0], s[1]); c.bubble = null;
    });
    meeting = { kind, ids, lines, title, stamp, stampOk, stage: "gather", t: 0, idx: 0 };
    return true;
  }

  function updateMeeting(dt) {
    if (!meeting) return;
    const m = meeting;
    m.t += dt;
    if (m.stage === "gather") {
      const arrived = m.ids.every(id => !byId[id].path.length);
      if (arrived || m.t > 14) { m.stage = "talk"; m.t = 3.6; }
    } else if (m.stage === "talk") {
      if (m.t >= 3.6) {
        m.t = 0;
        if (m.idx >= m.lines.length) { m.stage = "verdict"; return; }
        const l = m.lines[m.idx++], c = byId[l.agent];
        if (c) say(c, l.line, 3.5);
      }
    } else if (m.stage === "verdict") {
      if (m.t > 4.5) {
        m.ids.forEach(id => {
          const c = byId[id];
          c.path = pathTo(c, c.home, c.seat ? c.seat[0] : c.x, c.seat ? c.seat[1] : c.y);
          c.wait = rnd(2, 4);
        });
        m.stage = "leave"; m.t = 0;
      }
    } else if (m.stage === "leave") {
      if (m.ids.every(id => !byId[id].path.length) || m.t > 14) {
        m.ids.forEach(id => { byId[id].locked = false; });
        meeting = null;
      }
    }
  }

  // -- simulation ---------------------------------------------------------------
  function step(c, dt) {
    if (c.path.length) {
      const [tx, ty] = c.path[0];
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy), s = c.speed * dt;
      if (d <= s) { c.x = tx; c.y = ty; c.path.shift(); }
      else { c.x += dx / d * s; c.y += dy / d * s; c.walk += dt; if (Math.abs(dx) > 0.5) c.facing = dx < 0 ? -1 : 1; }
      return;
    }
    c.walk = 0;
    if (c.locked) return;
    c.wait -= dt;
    if (c.wait <= 0) {
      const t = wanderTarget(c);
      c.path = pathTo(c, c.home, t.pt[0], t.pt[1]);
      c.wait = t.wait;
    }
  }

  function ambient(dt) {
    ambientT += dt;
    if (ambientT < 2.4) return;
    ambientT = 0;
    const now = performance.now() / 1000;
    const showing = chars.filter(c => c.bubble && c.bubble.until > now).length;
    if (showing >= 3) return;
    for (let k = 0; k < chars.length; k++) {
      const c = chars[(ambientIdx++) % chars.length];
      if (meeting && meeting.ids.includes(c.id)) continue;
      if (c.a.judge && meeting) continue;
      const n = notes[c.id];
      if (n && n.bubble && !(c.bubble && c.bubble.until > now)) { say(c, n.bubble, 6.5); break; }
    }
  }

  // -- drawing (neon HUD palette: cyan, magenta, violet on near-black) ----------------
  const NEON = { cyan: "#19e6ff", magenta: "#ff2bd6", violet: "#9b5cff", mint: "#2ff3d0", pink: "#ff4f9a",
                 ink: "#e2f7ff", dim: "#7f8bb3", void: "#02030a" };
  const FONT = "ui-monospace, 'Cascadia Mono', Consolas, monospace";

  function rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  function glow(col, blur, fn) { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; fn(); ctx.restore(); }
  function accentOf(c) { return ROOMS[c.home].accent; }

  function drawRoom(k, r) {
    rect(r.x, r.y, r.w, r.h, r.floor);
    ctx.strokeStyle = hexA(r.accent, 0.07); ctx.lineWidth = 1; ctx.beginPath();
    for (let x = r.x + TILE; x < r.x + r.w; x += TILE) { ctx.moveTo(x + 0.5, r.y); ctx.lineTo(x + 0.5, r.y + r.h); }
    for (let y = r.y + TILE; y < r.y + r.h; y += TILE) { ctx.moveTo(r.x, y + 0.5); ctx.lineTo(r.x + r.w, y + 0.5); }
    ctx.stroke();
    const t = 6, gap = 38, dy = r.side === "bottom" ? r.y + r.h : r.y - t;
    rect(r.x - t, r.y - t, r.w + 2 * t, t, NEON.void); rect(r.x - t, r.y + r.h, r.w + 2 * t, t, NEON.void);
    rect(r.x - t, r.y, t, r.h, NEON.void); rect(r.x + r.w, r.y, t, r.h, NEON.void);
    glow(r.accent, 8, () => {
      ctx.strokeStyle = hexA(r.accent, 0.8); ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    });
    rect(r.door - gap / 2, dy - 1, gap, t + 2, r.floor);          // the door cuts the neon edge
    rect(r.door - gap / 2 - 2, dy, 2, t, r.accent);
    rect(r.door + gap / 2, dy, 2, t, r.accent);
    for (const [cx, cy, sx, sy] of [[r.x, r.y, 1, 1], [r.x + r.w, r.y + r.h, -1, -1]]) {   // HUD corner brackets
      rect(cx + (sx > 0 ? 0 : -14), cy + (sy > 0 ? 0 : -2), 14, 2, r.accent);
      rect(cx + (sx > 0 ? 0 : -2), cy + (sy > 0 ? 0 : -14), 2, 14, r.accent);
    }
    ctx.font = `bold 11px ${FONT}`;
    const tw = ctx.measureText(r.label).width + 14;
    rect(r.x + 8, r.y + 8, tw, 18, "rgba(2,3,10,.85)");
    ctx.strokeStyle = hexA(r.accent, 0.7); ctx.lineWidth = 1; ctx.strokeRect(r.x + 8.5, r.y + 8.5, tw - 1, 17);
    glow(r.accent, 6, () => { ctx.fillStyle = r.accent; ctx.textBaseline = "middle"; ctx.fillText(r.label, r.x + 15, r.y + 17.5); });
  }

  function drawPlant(x, y) {
    rect(x - 6, y, 12, 10, "#141a3c"); rect(x - 6, y, 12, 2, hexA(NEON.cyan, 0.5));
    glow(NEON.mint, 10, () => {
      ctx.fillStyle = hexA(NEON.mint, 0.7); ctx.beginPath(); ctx.arc(x, y - 4, 8, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = "rgba(191,252,240,.8)"; ctx.beginPath(); ctx.arc(x - 3, y - 7, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  function drawFurniture(now) {
    for (const m of monitors) {
      const { x, y } = m.c.desk, acc = accentOf(m.c), hw = (m.c.desk.w || 60) / 2;
      rect(x - hw, y + 6, 2 * hw, 16, "#121735"); rect(x - hw, y + 6, 2 * hw, 1, hexA(acc, 0.6));
      rect(x - hw, y + 21, 2 * hw, 2, "#080b20");
      rect(x - 11, y - 10, 22, 15, "#03050f"); rect(x - 9, y - 8, 18, 11, "#061024");
      rect(x - 2, y + 5, 4, 2, "#03050f");
      glow(acc, 6, () => {
        ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.beginPath();
        m.pts.forEach((p, i) => { const px = x - 8 + i * 2.3, py = y - 8 + p; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.stroke();
      });
    }
    drawPlant(ROOMS.gold.x + ROOMS.gold.w - 18, ROOMS.gold.y + 36);
    drawPlant(ROOMS.egx.x + ROOMS.egx.w - 18, ROOMS.egx.y + 36);
    drawPlant(ROOMS.fx.x + ROOMS.fx.w - 18, ROOMS.fx.y + 36);
    drawPlant(ROOMS.meeting.x + 20, ROOMS.meeting.y + 210);
    // meeting table: dark glass with a neon rim and a pulsing hologram in the middle
    rect(336, 396, 236, 48, "#0b1030");
    glow(NEON.cyan, 10, () => {
      ctx.strokeStyle = hexA(NEON.cyan, 0.8); ctx.lineWidth = 1.5; ctx.strokeRect(336.5, 396.5, 235, 47);
    });
    rect(344, 420, 220, 1, hexA(NEON.cyan, 0.2));
    const pulse = 0.35 + 0.25 * Math.sin(now * 2.2);
    glow(NEON.violet, 12, () => {
      ctx.strokeStyle = hexA(NEON.violet, pulse + 0.2); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(454, 420, 9 + 3 * pulse, 0, Math.PI * 2); ctx.stroke();
    });
    SEATS.slice(0, 10).forEach(([x, y]) => {
      const yy = y + (y < 420 ? -2 : 6);
      rect(x - 7, yy, 14, 6, "#1a1f4a"); rect(x - 7, yy, 14, 1, hexA(NEON.violet, 0.7));
    });
    rect(612, 388, 22, 76, "#160c30");
    glow(NEON.violet, 8, () => { ctx.strokeStyle = NEON.violet; ctx.lineWidth = 1; ctx.strokeRect(612.5, 388.5, 21, 75); });
    glow(NEON.magenta, 8, () => rect(617, 420, 10, 4, NEON.magenta));
    // director: desk and a shelf of glowing data cartridges
    rect(86, 380, 70, 18, "#121735"); rect(86, 380, 70, 1, hexA(NEON.violet, 0.7));
    rect(28, 336, 40, 70, "#0d1030");
    ctx.strokeStyle = hexA(NEON.violet, 0.6); ctx.lineWidth = 1; ctx.strokeRect(28.5, 336.5, 39, 69);
    [NEON.cyan, NEON.magenta, NEON.violet, NEON.mint].forEach((col, i) => rect(32, 342 + i * 16, 32, 10, hexA(col, 0.75)));
    // board: a big screen with scanlines
    const b = ROOMS.board;
    rect(b.x + 14, b.y + 34, b.w - 28, b.h - 52, "#02040e");
    glow(NEON.cyan, 10, () => {
      ctx.strokeStyle = hexA(NEON.cyan, 0.85); ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x + 14.5, b.y + 34.5, b.w - 29, b.h - 53);
    });
    rect(b.x + 18, b.y + 38, b.w - 36, b.h - 60, "#040a1a");
    for (let y = b.y + 39; y < b.y + b.h - 22; y += 3) rect(b.x + 18, y, b.w - 36, 1, "rgba(25,230,255,.035)");
    drawBoard(b.x + 26, b.y + 52, b.w - 52);
  }

  function drawBoard(x, y, w) {
    if (!data) return;
    ctx.font = `bold 11px ${FONT}`; ctx.textBaseline = "top";
    const bud = data.budget || {}, spent = bud.spent || 0, cap = bud.cap || 20;
    const txt = (s, col, dy) => glow(col, 5, () => { ctx.fillStyle = col; ctx.fillText(s, x, y + dy); });
    txt("AI BUDGET  $" + spent.toFixed(2) + " / $" + cap.toFixed(0), NEON.ink, 0);
    rect(x, y + 16, w, 7, "#151a3c");
    const fill = Math.min(w, w * spent / cap);
    if (fill > 0) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, NEON.cyan); g.addColorStop(1, spent / cap > 0.85 ? NEON.pink : NEON.magenta);
      ctx.fillStyle = g; ctx.fillRect(x, y + 16, fill, 7);
    }
    const snap = data.gold && data.gold.snapshot, gs = data.gold && data.gold.state;
    const pos = gs && gs.position;
    if (data.gold && data.gold.enabled === false) txt("GOLD DESK OFF (IN SWING $100)", NEON.dim, 32);
    else txt("GOLD " + (snap ? snap.features.price.toFixed(2) : "-") + (pos ? "  " + pos.direction : "  FLAT"), NEON.magenta, 32);
    const ss = data.swing && data.swing.state;
    if (ss) txt("SWING " + Object.keys(ss.positions || {}).length + " OPEN", NEON.mint, 48);
    if (ss && ss.account) txt("SWING $" + Number(ss.account.equity_usd != null ? ss.account.equity_usd : 100).toFixed(2), NEON.ink, 64);
    const eg = data.egx && data.egx.portfolio;
    txt("EGX  " + (eg ? Math.round(eg.total).toLocaleString("en-US") + " EGP" : "-"), NEON.cyan, 84);
    if (eg) txt((eg.pnl_vs_start_pct >= 0 ? "+" : "") + eg.pnl_vs_start_pct.toFixed(2) + "% vs start",
      eg.pnl_vs_start_pct >= 0 ? NEON.mint : NEON.pink, 100);
    const n = data.egx ? (data.egx.orders || []).length : 0;
    txt(n + " EGX ORDER" + (n === 1 ? "" : "S") + " TODAY", NEON.ink, 116);
    const lc = data.lab && data.lab.counts;
    if (lc) txt("LAB " + (lc.PASS || 0) + " PASS " + (lc.PROMISING || 0) + " PROMISING", NEON.violet, 132);
    txt("UPDATED " + (data.generated_at || "").slice(11, 16) + " UTC", NEON.dim, 148);
  }

  function drawChar(c) {
    const x = Math.round(c.x), y = Math.round(c.y), acc = accentOf(c);
    const moving = c.path.length > 0, f = moving ? Math.floor(c.walk * 8) % 2 : 0;
    ctx.fillStyle = hexA(acc, 0.22); ctx.beginPath(); ctx.ellipse(x, y + 1, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (c.a.judge) {
      rect(x - 7, y - 18, 14, 18, c.shirt);
      rect(x - 7, y - 18, 1, 18, NEON.violet); rect(x + 6, y - 18, 1, 18, NEON.violet);
      rect(x - 2, y - 18, 4, 4, NEON.ink);
    } else {
      rect(x - 5, y - 6, 4, 6 - (f ? 2 : 0), "#1b1f44"); rect(x + 1, y - 6, 4, 6 - (f ? 0 : 2), "#1b1f44");
      rect(x - 6, y - 17, 12, 11, c.shirt);
      rect(x - 6, y - 17, 12, 1, hexA(acc, 0.9));
      rect(x - 8, y - 16 + (f ? 1 : 0), 2, 8, c.shirt); rect(x + 6, y - 16 + (f ? 0 : 1), 2, 8, c.shirt);
      if (c.id === "director") rect(x - 1, y - 16, 2, 8, NEON.cyan);
    }
    rect(x - 5, y - 27, 10, 10, c.skin);
    rect(x - 5, y - 29, 10, 4, c.hair); rect(x - 5, y - 27, 2, 4, c.hair); rect(x + 3, y - 27, 2, 3, c.hair);
    const ex = c.facing < 0 ? -2 : 0;
    rect(x - 2 + ex, y - 23, 1, 2, "#0a0a14"); rect(x + 2 + ex, y - 23, 1, 2, "#0a0a14");
    if (c.id === "gold_devil" || c.id === "fx_devil") { rect(x - 5, y - 32, 2, 3, NEON.pink); rect(x + 3, y - 32, 2, 3, NEON.pink); }
    if (c.id === "gold_cost" || c.id === "fx_cost") glow(NEON.mint, 6, () => rect(x - 6, y - 26, 12, 2, NEON.mint));
    if (c.id === "egx_quant" || c.id === "gold_chartist" || c.id === "fx_quant") {
      rect(x - 4 + ex, y - 24, 3, 3, hexA(NEON.cyan, 0.6)); rect(x + 1 + ex, y - 24, 3, 3, hexA(NEON.cyan, 0.6));
    }
    if (c.a.judge) rect(x - 6, y - 31, 12, 3, NEON.ink);
    if (c === hover) {
      ctx.font = `bold 10px ${FONT}`; ctx.textBaseline = "top";
      const tw = ctx.measureText(c.a.name).width + 8;
      rect(x - tw / 2, y + 4, tw, 13, "#02040e");
      ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x - tw / 2) + 0.5, y + 4.5, tw - 1, 12);
      ctx.fillStyle = acc; ctx.fillText(c.a.name, x - tw / 2 + 4, y + 6);
    }
  }

  function wrap(text, maxW, maxLines) {
    const words = text.split(/\s+/), lines = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; if (lines.length === maxLines) break; }
      else cur = t;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length + 1) {
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "...";
    }
    return lines;
  }

  function overlaps(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

  function drawBubble(c, now, placed) {
    if (!c.bubble || c.bubble.until < now) return;
    ctx.font = `11px ${FONT}`; ctx.textBaseline = "top";
    const lines = wrap(c.bubble.text, 168, 3), acc = accentOf(c);
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14, h = lines.length * 13 + 10;
    let bx = Math.min(Math.max(c.x - w / 2, 4), W - w - 4), by = c.y - 40 - h;
    if (by < 2) by = c.y + 8;
    // Nudge sideways, then up, until it clears bubbles already drawn.
    const tries = [[0, 0], [w * 0.6, 0], [-w * 0.6, 0], [0, -(h + 6)], [w * 0.6, -(h + 6)], [-w * 0.6, -(h + 6)]];
    for (const [ox, oy] of tries) {
      const r = { x: Math.min(Math.max(bx + ox, 4), W - w - 4), y: Math.max(2, by + oy), w, h };
      if (!placed.some(p => overlaps(p, r))) { bx = r.x; by = r.y; break; }
    }
    placed.push({ x: bx, y: by, w, h });
    rect(bx, by, w, h, "rgba(5,8,24,.94)");
    glow(acc, 8, () => {
      ctx.strokeStyle = acc; ctx.lineWidth = 1.5; ctx.strokeRect(Math.round(bx) + 0.5, Math.round(by) + 0.5, w - 1, h - 1);
    });
    if (by < c.y && c.x > bx && c.x < bx + w) { rect(c.x - 3, by + h, 6, 4, acc); rect(c.x - 1, by + h - 1, 2, 3, "rgba(5,8,24,.94)"); }
    ctx.fillStyle = NEON.ink;
    lines.forEach((l, i) => ctx.fillText(l, bx + 7, by + 6 + i * 13));
  }

  function drawMeetingBanner() {
    if (!meeting) return;
    const r = ROOMS.meeting, acc = meeting.kind === "gold" ? NEON.magenta : meeting.kind === "fx" ? NEON.mint : NEON.cyan;
    ctx.font = `bold 11px ${FONT}`; ctx.textBaseline = "top";
    const t = meeting.title + (meeting.stage === "gather" ? "  (gathering)" : "");
    const tw = ctx.measureText(t).width + 14, bx = r.x + r.w - tw - 8;
    rect(bx, r.y + 8, tw, 18, hexA(acc, 0.16));
    ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, r.y + 8.5, tw - 1, 17);
    glow(acc, 6, () => { ctx.fillStyle = acc; ctx.fillText(t, bx + 7, r.y + 12); });
    if (meeting.stage === "verdict") {
      ctx.font = `bold 22px ${FONT}`;
      const sw = ctx.measureText(meeting.stamp).width + 24, sx = 454 - sw / 2, sy = 404;
      const col = meeting.stampOk ? NEON.cyan : NEON.magenta;
      ctx.save(); ctx.translate(454, 420); ctx.rotate(-0.06); ctx.translate(-454, -420);
      rect(sx, sy, sw, 34, "rgba(4,6,20,.95)");
      glow(col, 16, () => {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, sy + 1, sw - 2, 32);
        ctx.fillStyle = col; ctx.fillText(meeting.stamp, sx + 12, sy + 7);
      });
      ctx.restore();
    }
  }

  function draw() {
    const now = performance.now() / 1000;
    rect(0, 0, W, H, NEON.void);
    // hallway with circuit traces and a data pulse running along them
    rect(0, 262, W, 36, "#060818");
    ctx.strokeStyle = hexA(NEON.cyan, 0.25); ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(0, 272.5); ctx.lineTo(W, 272.5); ctx.moveTo(0, 288.5); ctx.lineTo(W, 288.5); ctx.stroke();
    for (let x = 30; x < W; x += 60) { rect(x - 1, 271, 3, 3, hexA(NEON.cyan, 0.55)); rect(x + 29, 287, 3, 3, hexA(NEON.magenta, 0.55)); }
    const px = (now * 140) % (W + 40) - 20, px2 = W - ((now * 95) % (W + 40) - 20);
    glow(NEON.cyan, 10, () => rect(px - 6, 271, 12, 3, NEON.cyan));
    glow(NEON.magenta, 10, () => rect(px2 - 6, 287, 12, 3, NEON.magenta));
    for (const [k, r] of Object.entries(ROOMS)) drawRoom(k, r);
    drawFurniture(now);
    [...chars].sort((a, b) => a.y - b.y).forEach(drawChar);
    drawMeetingBanner();
    const placed = [];
    chars.forEach(c => drawBubble(c, now, placed));
  }

  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    monT += dt;
    if (monT > 1) { monT = 0; monitors.forEach(m => { m.pts.shift(); m.pts.push(Math.min(10, Math.max(1, m.pts[m.pts.length - 1] + rnd(-3, 3)))); }); }
    chars.forEach(c => step(c, dt));
    updateMeeting(dt);
    ambient(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    const x = (ev.clientX - r.left) * W / r.width, y = (ev.clientY - r.top) * H / r.height;
    let best = null, bd = 22;
    for (const c of chars) { const d = Math.hypot(c.x - x, c.y - 14 - y); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  window.Office = {
    init(cv, selectCb) {
      canvas = cv; ctx = cv.getContext("2d"); onSelect = selectCb;
      resize(); window.addEventListener("resize", resize);
      cv.addEventListener("mousemove", e => { hover = pick(e); cv.style.cursor = hover ? "pointer" : "default"; });
      cv.addEventListener("mouseleave", () => { hover = null; });
      cv.addEventListener("click", e => { const c = pick(e); if (c && onSelect) onSelect(c.id); });
      requestAnimationFrame(frame);
    },
    setData(F) {
      data = F; notes = F.notes || {};
      goldOff = !!(F.gold && F.gold.enabled === false);
      if (goldOff) { ROOMS.gold.label = F.arb ? "QUANTS + BTC ARBITRAGE" : "SWING QUANTS  HMM"; ROOMS.gold.accent = "#2ff3d0"; ROOMS.fx.label = "SWING DESK  $100"; }
      let added = false;
      for (const a of F.roster || []) {
        if (byId[a.id]) { byId[a.id].a = a; continue; }
        const c = makeChar(a);
        chars.push(c); byId[a.id] = c; added = true;
      }
      if (added) {
        layoutDesks();
        chars.forEach(c => {
          if (!c.x) { const p = c.seat || [ROOMS[c.home].x + 60, ROOMS[c.home].y + 80]; c.x = p[0] + rnd(-10, 10); c.y = p[1]; }
        });
      }
      // Auto-play a fresh meeting once per page load.
      for (const kind of ["gold", "fx"]) {
        const src = kind === "fx" ? "swing" : kind;
        const m = (F[src] && F[src].meetings || []).slice(-1)[0];
        if (m && !played.has(m.id) && Date.now() - Date.parse(m.ts) < 30 * 60 * 1000) {
          if (startMeeting(kind)) { played.add(m.id); break; }
        }
      }
    },
    replay(kind) { return startMeeting(kind); },
    busy() { return !!meeting; },
    // Advance the simulation by hand (tests, or a hidden tab where rAF is paused).
    advance(seconds, dt = 0.05) {
      for (let t = 0; t < seconds; t += dt) {
        chars.forEach(c => step(c, dt)); updateMeeting(dt); ambient(dt);
        chars.forEach(c => { if (c.bubble) c.bubble.until -= dt; });
      }
      draw();
      return { stage: meeting ? meeting.stage : "none", talking: chars.filter(c => c.bubble && c.bubble.until > performance.now() / 1000).map(c => c.id) };
    },
  };
})();
