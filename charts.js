/* Money-over-time line charts for the home pages: the EGX portfolio and the shared $100 (swing desk +
   BTC arbitrage). Used by the desktop "Your money" cards (app.js) and the phone page (m.js).
   One series per chart, so no legend box: the card title names it. 2px line, an end dot with a surface
   ring and a "now" label, a hairline at the starting amount, a crosshair + tooltip on hover and on the
   keyboard (arrow keys), and a table of the numbers so no value is hover-only. No libraries. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  // Line hue: the dashboard's cyan, one step deeper so it passes the dataviz checks on the dark card
  // (OKLCH L inside 0.48-0.67, chroma >= 0.1, >= 3:1 against #0c1130; validate_palette.js, 2026-10-10).
  const LINE = "#1aa3c8", SURFACE = "#0c1130", GRID = "rgba(226, 247, 255, .08)", AXIS = "#8b98bf", INK = "#e2f7ff";

  const css = `
    .mchart { position: relative; margin-top: 10px; }
    .mchart svg { display: block; width: 100%; overflow: visible; touch-action: pan-y; }
    .mchart svg:focus-visible { outline: 2px solid #ff2bd6; outline-offset: 3px; border-radius: 4px; }
    .mchart-tip { position: absolute; pointer-events: none; background: #0a0f28; border: 1px solid rgba(25, 230, 255, .35);
                  border-radius: 6px; padding: 5px 8px; white-space: nowrap; transform: translate(-50%, -100%); z-index: 3; }
    .mchart-tip b { display: block; color: ${INK}; font: 600 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .mchart-tip span { color: ${AXIS}; font: 11px/1.3 ui-monospace, Menlo, Consolas, monospace; }
    .mchart-note { color: ${AXIS}; font-size: 12px; margin: 4px 0 0; }
    .mchart details { margin-top: 6px; }
    .mchart summary { cursor: pointer; color: #9b5cff; font: 12px ui-monospace, Menlo, Consolas, monospace; }
    .mchart-table { max-height: 190px; overflow: auto; margin-top: 6px; }
    .mchart-table table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .mchart-table th, .mchart-table td { text-align: left; padding: 3px 6px; border-bottom: 1px solid rgba(25, 230, 255, .08); }
    .mchart-table td:last-child, .mchart-table th:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .mchart-table th { color: ${AXIS}; font-weight: 400; }`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceTicks(lo, hi, n) {
    const raw = (hi - lo) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toFixed(10));
    return { ticks: out, step };
  }

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(entries => {
    for (const en of entries) {
      const host = en.target;
      if (!host.isConnected) { ro.unobserve(host); continue; }
      const w = Math.round(host.clientWidth);
      if (host._mchart && w && Math.abs(w - (host._mchartW || 0)) > 4) draw(host, host._mchart);
    }
  }) : null;

  function draw(host, o) {
    host._mchart = o;
    host.textContent = "";
    const wrap = document.createElement("div");
    wrap.className = "mchart";
    host.appendChild(wrap);
    const pts = (o.points || []).filter(p => p && isFinite(p.t) && isFinite(p.v)).sort((a, b) => a.t - b.t);
    if (!pts.length) {
      const p = document.createElement("p");
      p.className = "mchart-note";
      p.textContent = o.emptyText || "No history yet.";
      wrap.appendChild(p);
      return;
    }
    const W = Math.max(200, Math.round(host.clientWidth || 320)), H = o.height || 160;
    host._mchartW = W;
    const m = { l: 52, r: 10, t: 16, b: 22 };
    const vals = pts.map(p => p.v).concat(o.start != null ? [o.start] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max((hi - lo) * 0.18, Math.abs(hi) * (o.flatPad == null ? 0.005 : o.flatPad), o.minPad || 0.5);
    lo -= pad; hi += pad;
    const { ticks, step } = niceTicks(lo, hi, 3);
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const x = t => t1 === t0 ? m.l + (W - m.l - m.r) / 2 : m.l + (t - t0) / (t1 - t0) * (W - m.l - m.r);
    const y = v => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b);
    const last = pts[pts.length - 1];

    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", tabindex: "0" }, null);
    svg.style.height = H + "px";
    svg.setAttribute("aria-label", `${o.label}: ${o.fmt(last.v)} now` + (pts.length > 1 ? `, ${o.fmt(pts[0].v)} on ${o.fmtTime(pts[0].t)}` : "") +
      ". Use the left and right arrow keys to read each point.");
    wrap.appendChild(svg);

    // recessive grid + y ticks (clean numbers)
    for (const v of ticks) {
      svgEl("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: GRID, "stroke-width": 1 }, svg);
      const tx = svgEl("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end", fill: AXIS, "font-size": 11,
                                 "font-family": "ui-monospace, Menlo, Consolas, monospace" }, svg);
      tx.textContent = o.fmtAxis(v, step);
    }
    // the starting amount: a hairline with its label
    if (o.start != null) {
      svgEl("line", { x1: m.l, x2: W - m.r, y1: y(o.start), y2: y(o.start), stroke: AXIS, "stroke-opacity": .55, "stroke-width": 1 }, svg);
      const st = svgEl("text", { x: m.l + 4, y: y(o.start) - 5, fill: AXIS, "font-size": 10.5 }, svg);
      st.textContent = o.startLabel || "start";
    }
    // x labels: first and last date
    const xl = (t, anchor, xx) => {
      const e = svgEl("text", { x: xx, y: H - 5, "text-anchor": anchor, fill: AXIS, "font-size": 11 }, svg);
      e.textContent = o.fmtDate(t);
    };
    if (pts.length > 1 && o.fmtDate(t0) !== o.fmtDate(t1)) { xl(t0, "start", m.l); xl(t1, "end", W - m.r); }
    else xl(t1, "middle", x(t1));
    // the line
    if (pts.length > 1) {
      svgEl("path", { d: pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(""), fill: "none",
                      stroke: LINE, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    }
    // end dot with a surface ring, and the current value
    svgEl("circle", { cx: x(last.t), cy: y(last.v), r: 4, fill: LINE, stroke: SURFACE, "stroke-width": 2 }, svg);
    // above the dot, unless that is off the top or on the start label's row (the start label sits above its line)
    const nearStart = o.start != null && Math.abs(y(last.v) - y(o.start)) < 16;
    const ly = (y(last.v) - 10 < m.t + 2 || nearStart) ? y(last.v) + 18 : y(last.v) - 10;
    const lab = svgEl("text", { x: Math.min(x(last.t), W - m.r), y: ly, "text-anchor": pts.length > 1 ? "end" : "middle", fill: INK,
                                "font-size": 12, "font-weight": 600 }, svg);
    lab.textContent = "now " + o.fmtShort(last.v);

    // hover / keyboard layer: crosshair snaps to the nearest point; one tooltip
    const cross = svgEl("line", { y1: m.t, y2: H - m.b, stroke: AXIS, "stroke-width": 1, visibility: "hidden" }, svg);
    const hot = svgEl("circle", { r: 4.5, fill: LINE, stroke: SURFACE, "stroke-width": 2, visibility: "hidden" }, svg);
    const hit = svgEl("rect", { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: "transparent" }, svg);
    const tip = document.createElement("div");
    tip.className = "mchart-tip";
    tip.hidden = true;
    const tb = document.createElement("b"), ts = document.createElement("span");
    tip.append(tb, ts);
    wrap.appendChild(tip);
    let idx = pts.length - 1;
    const show = i => {
      idx = Math.max(0, Math.min(pts.length - 1, i));
      const p = pts[idx], px = x(p.t), py = y(p.v), scale = svg.getBoundingClientRect().width / W || 1;
      for (const [a, b] of [["x1", px], ["x2", px]]) cross.setAttribute(a, b);
      hot.setAttribute("cx", px); hot.setAttribute("cy", py);
      cross.setAttribute("visibility", "visible"); hot.setAttribute("visibility", "visible");
      tb.textContent = o.fmt(p.v) + (o.start != null ? `  (${p.v - o.start >= 0 ? "+" : ""}${o.fmtDelta(p.v - o.start)})` : "");
      ts.textContent = o.fmtTime(p.t);
      tip.hidden = false;
      const tw = tip.offsetWidth, left = Math.min(Math.max(px * scale, tw / 2), wrap.clientWidth - tw / 2);
      tip.style.left = left + "px";
      tip.style.top = Math.max(py * scale - 10, 34) + "px";
    };
    const hide = () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); hot.setAttribute("visibility", "hidden"); };
    const nearest = ev => {
      const r = svg.getBoundingClientRect(), vx = (ev.clientX - r.left) * (W / r.width);
      let best = 0, bd = Infinity;
      pts.forEach((p, i) => { const d = Math.abs(x(p.t) - vx); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    hit.addEventListener("pointermove", ev => show(nearest(ev)));
    hit.addEventListener("pointerdown", ev => show(nearest(ev)));
    hit.addEventListener("pointerleave", ev => { if (ev.pointerType === "mouse") hide(); });   // a tap on a phone keeps its readout
    svg.addEventListener("focus", () => show(idx));
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", ev => {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") { ev.preventDefault(); show(idx + (ev.key === "ArrowRight" ? 1 : -1)); }
      else if (ev.key === "Home") { ev.preventDefault(); show(0); }
      else if (ev.key === "End") { ev.preventDefault(); show(pts.length - 1); }
      else if (ev.key === "Escape") hide();
    });

    if (o.note) {
      const n = document.createElement("p");
      n.className = "mchart-note";
      n.textContent = o.note;
      wrap.appendChild(n);
    }
    // the numbers, newest first (no value is hover-only)
    const det = document.createElement("details"), sum = document.createElement("summary"), box = document.createElement("div");
    sum.textContent = "Show the numbers";
    box.className = "mchart-table";
    const table = document.createElement("table"), thead = table.createTHead(), hr = thead.insertRow();
    for (const h of [o.timeHeader || "When", o.valueHeader || "Value"]) { const th = document.createElement("th"); th.textContent = h; hr.appendChild(th); }
    const tbody = table.createTBody();
    for (const p of pts.slice().reverse()) {
      const r = tbody.insertRow();
      r.insertCell().textContent = o.fmtTime(p.t);
      r.insertCell().textContent = o.fmt(p.v);
    }
    box.appendChild(table);
    det.append(sum, box);
    wrap.appendChild(det);
    if (ro) ro.observe(host);
  }

  // -- the two money series -------------------------------------------------------------------
  const num = (n, d) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const day = t => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  function egxSeries(F) {
    const bySession = {};
    for (const r of F.egx_history || []) {
      if (!r || r.total == null || !r.session) continue;
      const prev = bySession[r.session];
      if (!prev || String(r.ts) > String(prev.ts)) bySession[r.session] = r;
    }
    if (F.egx && F.egx.portfolio && F.egx.session) bySession[F.egx.session] = { session: F.egx.session, total: F.egx.portfolio.total, ts: "z" };
    return Object.values(bySession).map(r => ({ t: Date.parse(r.session + "T12:00:00Z"), v: Number(r.total) }));
  }

  function usdSeries(F) {
    const S = F.swing || {}, a = (S.state || {}).account || {};
    const pts = (S.equity || []).map(r => ({ t: Date.parse(r.ts), v: Number(r.equity) }));
    const nowT = Date.parse((S.state || {}).last_cycle || F.generated_at);
    if (a.equity_usd != null && isFinite(nowT) && (!pts.length || nowT - pts[pts.length - 1].t > 5 * 60000)) pts.push({ t: nowT, v: Number(a.equity_usd) });
    return pts;
  }

  function egx(host, F, height) {
    if (!host) return;
    const start = (F.egx && F.egx.start_capital) || (F.egx_config || {}).starting_capital_egp || 70000;
    const pts = egxSeries(F);
    draw(host, {
      label: "EGX portfolio value", points: pts, start, height, startLabel: `start ${num(start, 0)} EGP`,
      fmt: v => num(v, 0) + " EGP", fmtShort: v => num(v, 0), fmtDelta: v => num(v, 0),
      fmtAxis: (v, step) => step >= 1000 ? num(v / 1000, step >= 10000 ? 0 : 1) + "K" : num(v, 0),
      fmtDate: day, fmtTime: t => "Session " + new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
      timeHeader: "EGX session", valueHeader: "Portfolio (EGP)", minPad: 50,
      note: pts.length < 2 ? "One point per EGX session: the line grows after each close (Sunday to Thursday)." : "",
      emptyText: "The line starts after the EGX desk's first run.",
    });
  }

  function usd(host, F, height) {
    if (!host) return;
    const pts = usdSeries(F);
    draw(host, {
      label: "Shared $100 (swing desk + BTC arbitrage)", points: pts, start: 100, height, startLabel: "start $100",
      fmt: v => "$" + num(v, 2), fmtShort: v => "$" + num(v, 2), fmtDelta: v => (v < 0 ? "-$" : "$") + num(Math.abs(v), 2),
      fmtAxis: (v, step) => "$" + num(v, step < 1 ? (step < 0.1 ? 2 : 1) : 0),
      fmtDate: day, fmtTime: t => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      timeHeader: "When (your time)", valueHeader: "Equity (USD)", minPad: 0.5,
      note: pts.length < 2 ? "Logged every hour: the line grows as the agents trade." : "",
      emptyText: "The line starts after the swing desk's first hourly log.",
    });
  }

  window.FloorCharts = { draw, egx, usd };
})();
