/* Money-over-time line charts for the home pages: the EGX portfolio and the swing desk's account (forex, BTC,
   gold). Used by the desktop "Your money" cards (app.js) and the phone page (m.js).
   Live position charts (owner 2026-10-20): every open swing trade gets a price chart with its entry, stop loss and
   take-profit lines. The history is Capital.com's 15-minute closes published by the laptop; while the chart is on
   screen, the page itself asks TradingView for the live price every 5 seconds, so the line keeps moving. No AI and
   nothing on the laptop is involved in the live updates.
   One series per chart, so no legend box: the card title names it. 2px line, an end dot with a surface
   ring and a "now" label, a hairline at the starting amount, a crosshair + tooltip on hover and on the
   keyboard (arrow keys), and a table of the numbers so no value is hover-only. No libraries. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  // Line hue: the dashboard's cyan, one step deeper so it passes the dataviz checks on the dark card
  // (OKLCH L inside 0.48-0.67, chroma >= 0.1, >= 3:1 against #0c1130; validate_palette.js, 2026-10-10).
  const LINE = "#1aa3c8", SURFACE = "#0c1130", GRID = "rgba(226, 247, 255, .08)", AXIS = "#8b98bf", INK = "#e2f7ff";
  // Status colours for the trade levels (never series colours): take-profit green, stop red, entry the axis grey.
  const GOOD = "#2fd98a", BAD = "#ff5a7a";

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
    .mchart-table th { color: ${AXIS}; font-weight: 400; }
    .poschart { margin: 10px 0 18px; }
    .poshead { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; color: ${INK}; font-size: 13px; }
    .poshead .k { color: ${AXIS}; font-size: 12px; }
    .poshead .up { color: ${GOOD}; } .poshead .down { color: ${BAD}; }
    .posbar { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; margin-top: 8px;
              font: 11px ui-monospace, Menlo, Consolas, monospace; }
    .posbar .s { color: ${BAD}; } .posbar .t { color: ${GOOD}; text-align: right; }
    .posbar .track { position: relative; height: 8px; border-radius: 4px; background: linear-gradient(90deg, rgba(255, 90, 122, .35), rgba(139, 152, 191, .18) 50%, rgba(47, 217, 138, .35)); }
    .posbar .track i { position: absolute; top: -3px; width: 2px; height: 14px; transform: translateX(-1px); }
    .posbar .track i.e { background: ${AXIS}; }
    .posbar .track i.n { width: 10px; height: 10px; top: -1px; border-radius: 50%; transform: translateX(-5px); background: ${INK}; box-shadow: 0 0 0 2px ${SURFACE}; }
    .posrange { display: flex; gap: 6px; margin-top: 8px; }
    .posrange button { font: 11px ui-monospace, Menlo, Consolas, monospace; color: ${AXIS}; background: transparent; border: 1px solid rgba(139, 152, 191, .35);
                       border-radius: 999px; padding: 2px 9px; cursor: pointer; }
    .posrange button[aria-pressed="true"] { color: ${INK}; border-color: ${LINE}; background: rgba(26, 163, 200, .18); }
    .posrange button:focus-visible { outline: 2px solid #ff2bd6; outline-offset: 2px; }
    .poshead .live { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${GOOD}; margin-right: 5px; vertical-align: 1px; }
    @media (prefers-reduced-motion: no-preference) { .poshead .live { animation: posPulse 1.6s ease-in-out infinite; } }
    @keyframes posPulse { 50% { opacity: .35; } }`;
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
    const levels = (o.levels || []).filter(l => l && isFinite(l.v));
    const vals = pts.map(p => p.v).concat(o.start != null ? [o.start] : [], levels.map(l => l.v));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max((hi - lo) * 0.18, Math.abs(hi) * (o.flatPad == null ? 0.005 : o.flatPad), o.minPad == null ? 0.5 : o.minPad);
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
    // trade levels (entry, stop, take-profit): dashed lines labelled at the left, in the status colours
    for (const l of levels) {
      svgEl("line", { x1: m.l, x2: W - m.r, y1: y(l.v), y2: y(l.v), stroke: l.color || AXIS, "stroke-width": 1.5,
                      "stroke-dasharray": l.dash || "6 4", "stroke-opacity": .9 }, svg);
      const lt = svgEl("text", { x: m.l + 4, y: y(l.v) - 5, fill: l.color || AXIS, "font-size": 10.5,
                                 "font-family": "ui-monospace, Menlo, Consolas, monospace" }, svg);
      lt.textContent = l.label;
    }
    // a vertical marker (when the trade opened), only inside the drawn time range
    for (const vm of (o.vlines || [])) {
      if (!isFinite(vm.t) || vm.t < t0 || vm.t > t1) continue;
      svgEl("line", { x1: x(vm.t), x2: x(vm.t), y1: m.t, y2: H - m.b, stroke: AXIS, "stroke-width": 1, "stroke-dasharray": "2 3" }, svg);
      const vt = svgEl("text", { x: x(vm.t) + 4, y: m.t + 9, fill: AXIS, "font-size": 10.5 }, svg);
      vt.textContent = vm.label;
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
    const by = {};
    const put = (session, total, ts) => {
      if (!session || total == null) return;
      const p = by[session];
      if (!p || String(ts) > String(p.ts)) by[session] = { session, total: Number(total), ts: String(ts) };
    };
    for (const r of F.egx_history || []) put(r && r.session, r && r.total, r && r.ts);
    if (F.egx && F.egx.portfolio) put(F.egx.session, F.egx.portfolio.total, F.egx.as_of);
    const live = (F.egx_orders || {}).live;          // the Order Desk's valuation (15 min delayed in the session)
    if (live) put(live.session, live.total, live.as_of);
    return Object.values(by).map(r => ({ t: Date.parse(r.session + "T12:00:00Z"), v: r.total }));
  }

  function usdSeries(F) {
    const S = F.swing || {}, a = (S.state || {}).account || {};
    const aed = a.currency === "AED";
    const pts = (S.equity || []).map(r => ({ t: Date.parse(r.ts), v: aed ? Number(r.equity_ccy != null ? r.equity_ccy : r.equity * 3.6725) : Number(r.equity) }));
    const nowT = Date.parse((S.state || {}).last_cycle || F.generated_at);
    const nowV = aed ? a.equity_ccy : a.equity_usd;
    if (nowV != null && isFinite(nowT) && (!pts.length || nowT - pts[pts.length - 1].t > 5 * 60000)) pts.push({ t: nowT, v: Number(nowV) });
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
      note: pts.length < 2 ? "One point per EGX session: the line grows after each close (Sunday to Thursday). In a session the last point follows the Order Desk's live value." : "",
      emptyText: "The line starts after the EGX desk's first run.",
    });
  }

  function usd(host, F, height) {
    if (!host) return;
    const pts = usdSeries(F);
    const a = ((F.swing || {}).state || {}).account || {}, aed = a.currency === "AED";
    const start = aed ? (Number(a.start_ccy) || Number(a.start_usd) * 3.6725) : (Number(a.start_usd) || 100);
    const u = aed ? " AED" : "", p = aed ? "" : "$";
    draw(host, {
      label: a.source === "live" ? "Your Capital.com account (live)" : "Swing desk account", points: pts, start, height,
      startLabel: "start " + p + num(start, 2) + u,
      fmt: v => p + num(v, 2) + u, fmtShort: v => p + num(v, 2) + u, fmtDelta: v => (v < 0 ? "-" : "") + p + num(Math.abs(v), 2) + u,
      fmtAxis: (v, step) => p + num(v, step < 1 ? (step < 0.1 ? 2 : 1) : 0),
      fmtDate: day, fmtTime: t => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      timeHeader: "When (your time)", valueHeader: aed ? "Equity (AED)" : "Equity (USD)", minPad: start < 50 ? 0.2 : 0.5,
      note: pts.length < 2 ? "Logged every hour: the line grows as the agents trade." : "",
      emptyText: "The line starts after the swing desk's first hourly log.",
    });
  }

  // -- live position charts (owner 2026-10-20) -------------------------------------------------------------------------
  const SCAN = "https://scanner.tradingview.com/global/scan";      // answers browsers (it echoes the page's origin)
  const TICKS = {};                                                // pair -> [{t, v}], kept while the page is open
  const tick = { timer: null, want: {}, last: null, error: null, F: null, range: {} };
  const EVERY_MS = 5000, RETRY_MS = 30000;                         // live: every 5 s; after a failed try, 30 s
  const SPANS = { "2h": 2 * 3600e3, "12h": 12 * 3600e3 };          // "entry": from 12 h before the trade opened
  try { Object.assign(tick.range, JSON.parse(localStorage.getItem("floor-posrange") || "{}")); } catch (e) { /* storage optional */ }
  const decimals = pair => pair.includes("JPY") ? 3 : pair === "GOLD" ? 2 : pair === "BTCUSD" ? 1 : 5;

  async function poll() {
    const syms = Object.values(tick.want).filter(Boolean);
    if (!syms.length || document.hidden || !navigator.onLine || !document.querySelector(".poschart[data-pair]")) return;
    try {
      const r = await fetch(SCAN, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" },
                                    body: JSON.stringify({ symbols: { tickers: syms, query: { types: [] } }, columns: ["close"] }) });
      if (!r.ok) throw new Error("TradingView answered " + r.status);
      const j = await r.json(), now = Date.now();
      for (const row of j.data || []) {
        const pair = Object.keys(tick.want).find(k => tick.want[k] === row.s), v = row.d && Number(row.d[0]);
        if (!pair || !isFinite(v)) continue;
        const a = TICKS[pair] = TICKS[pair] || [];
        a.push({ t: now, v });
        if (a.length > 8640) a.shift();                             // twelve hours of 5-second prices
      }
      tick.last = now; tick.error = null;
    } catch (e) { tick.error = String(e && e.message || e); }
    if (tick.F) positions(tick.F, true);
  }

  function loop() {
    tick.timer = setTimeout(async () => { await poll(); loop(); }, tick.error ? RETRY_MS : EVERY_MS);
  }

  function liveTicks(want) {
    tick.want = want;
    if (tick.timer || !Object.keys(want).length) return;
    document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
    poll().then(loop);
  }

  // A trade's money figure (owner 2026-10-21: the website must show what the account shows). On the live account:
  // Capital.com's own profit or loss for the position (marked at the bid or offer, as its app shows it) and the
  // overnight fees charged so far. Not on the account: the paper book's figure at the mid, labelled as paper.
  function tradeMoney(pos, aed) {
    const L = pos.live || {};
    if (L.upl_ccy != null) return { v: Number(L.upl_ccy), fees: Number(L.fees_ccy || 0), entry: Number(L.level || pos.entry),
                                    real: true, cur: L.currency || (aed ? "AED" : "USD"), asOf: L.as_of };
    return { v: pos.upnl_usd != null ? Number(pos.upnl_usd) * (aed ? 3.6725 : 1) : null, fees: 0, entry: Number(pos.entry),
             real: false, cur: aed ? "AED" : "USD" };
  }

  // A closed trade's figure: its real result on the account (Capital.com's booked profit or loss plus the overnight
  // fees), "waiting" until Capital.com books it, or the paper result for a trade that was never on the account.
  function closedMoney(t, aed) {
    const L = t.live || {};
    if (L.net_ccy != null) return { v: Number(L.net_ccy), fees: Number(L.fees_ccy || 0), real: true, cur: L.currency || "AED" };
    if (L.pending) return { v: null, real: true, pending: true, cur: L.currency || "AED" };
    return { v: Number(t.pnl_usd) * (aed ? 3.6725 : 1), real: false, cur: aed ? "AED" : "USD" };
  }

  function positionChart(host, pair, pos, chart, aed) {
    const nd = decimals(pair), fx = aed ? 3.6725 : 1, unit = aed ? " AED" : " USD";
    const M = tradeMoney(pos, aed), L = pos.live || {};
    const entry = M.entry, stop = Number(pos.stop_loss), tp = Number(pos.take_profit_price), side = pos.direction === "LONG" ? 1 : -1;
    const bars = ((chart || {}).bars || []).map(([t, v]) => ({ t, v }));
    const lastBar = bars.length ? bars[bars.length - 1].t : 0;
    const live = (TICKS[pair] || []).filter(p => p.t > lastBar);
    const opened = Date.parse(pos.opened_at);
    const range = tick.range[pair] || "2h";
    const endT = live.length ? live[live.length - 1].t : (lastBar || Date.now());
    const fromT = range === "entry" ? (isFinite(opened) ? opened - SPANS["12h"] : 0) : endT - SPANS[range];
    const pts = bars.concat(live).filter(p => p.t >= fromT);
    const nowP = live.length ? live[live.length - 1] : (pos.last_mid != null ? { t: lastBar || Date.now(), v: Number(pos.last_mid) } : null);
    if (nowP && !pts.length) pts.push(nowP);
    const price = nowP ? nowP.v : NaN;
    const uq = (pair === "BTCUSD" || pair === "GOLD" || pair.endsWith("USD")) ? 1 : pair.startsWith("USD") ? 1 / price : Number(pos.usd_per_quote);
    // On the account: Capital.com's figure at the last update, moved by the live price since that update (the same
    // TradingView price read then), so the number matches the app at every update and keeps moving in between.
    const tvAt = Number(L.tv_price);
    const moved = live.length && isFinite(tvAt) && isFinite(price) && isFinite(uq) ? side * (price - tvAt) * Number(pos.size) * uq * fx : 0;
    const pnlCcy = M.real ? M.v + moved
                          : (isFinite(price) && isFinite(uq) ? side * (price - Number(pos.entry)) * Number(pos.size) * uq * fx : M.v);
    const frac = v => (isFinite(v) && isFinite(stop) && isFinite(tp) && tp !== stop) ? Math.max(0, Math.min(1, (v - stop) / (tp - stop))) : null;
    const fNow = frac(price), fEntry = frac(entry);
    const when = live.length ? new Date(nowP.t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;
    const src = live.length ? `TradingView live, ${when}` + (tick.error ? " (last try failed: " + tick.error + ", retrying)" : "")
                            : (tick.error ? "live price unavailable: " + tick.error : "the laptop's last update; live price starting");
    // the viewer is reading the chart (hover or keyboard): keep its crosshair, refresh only the figures above it
    const reading = host.querySelector(".mchart svg:hover, .mchart svg:focus");
    const keepChart = reading ? reading.closest(".posbox") : null;
    host.textContent = "";
    const head = document.createElement("div");
    head.className = "poshead";
    const sign = v => (v >= 0 ? "+" : "-") + num(Math.abs(v), 2) + (M.real ? " " + M.cur : unit);
    const asOf = M.asOf ? new Date(M.asOf).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
    head.innerHTML = `<b>${pair} ${pos.direction === "LONG" ? "LONG" : "SHORT"}</b>`
      + `<span>${live.length && !tick.error ? '<i class="live" aria-hidden="true"></i>' : ""}<span class="k">now</span> <b>${isFinite(price) ? num(price, nd) : "-"}</b> <span class="k">(${src})</span></span>`
      + (isFinite(pnlCcy) ? `<span><span class="k">${M.real ? "P&amp;L on your account" : "P&amp;L (paper: not on your account)"}</span> `
          + `<b class="${pnlCcy >= 0 ? "up" : "down"}">${sign(pnlCcy)}</b>`
          + (M.real ? ` <span class="k">(Capital.com ${asOf}${moved ? ", moved with the live price" : ""})</span>` : "") + `</span>` : "")
      + (M.real && M.fees ? `<span class="k">overnight fees so far ${sign(M.fees)}</span>` : "")
      + (fNow != null ? `<span class="k">${Math.round(fNow * 100)}% of the way from the stop to the take-profit</span>` : "");
    host.appendChild(head);
    if (fNow != null) {
      const bar = document.createElement("div");
      bar.className = "posbar";
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label", `${Math.round(fNow * 100)}% of the way from the stop at ${num(stop, nd)} to the take-profit at ${num(tp, nd)}`);
      bar.innerHTML = `<span class="s">stop ${num(stop, nd)}</span><div class="track"><i class="e" style="left:${(fEntry * 100).toFixed(1)}%"></i>`
        + `<i class="n" style="left:${(fNow * 100).toFixed(1)}%"></i></div><span class="t">take-profit ${num(tp, nd)}</span>`;
      host.appendChild(bar);
    }
    const ctl = document.createElement("div");
    ctl.className = "posrange";
    ctl.setAttribute("role", "group");
    ctl.setAttribute("aria-label", `${pair} chart range`);
    for (const [k, label] of [["2h", "Last 2 hours"], ["12h", "Last 12 hours"], ["entry", "Since the entry"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.setAttribute("aria-pressed", String(range === k));
      b.addEventListener("click", () => {
        tick.range[pair] = k;
        try { localStorage.setItem("floor-posrange", JSON.stringify(tick.range)); } catch (e) { /* storage optional */ }
        positionChart(host, pair, pos, chart, aed);
      });
      ctl.appendChild(b);
    }
    host.appendChild(ctl);
    if (keepChart) { host.appendChild(keepChart); return; }
    const box = document.createElement("div");
    box.className = "posbox";
    host.appendChild(box);
    draw(box, {
      label: `${pair} price`, points: pts, height: 210, minPad: 0, flatPad: 0.0005,
      levels: [{ v: tp, label: "take-profit " + num(tp, nd), color: GOOD }, { v: entry, label: (M.real ? "your entry " : "entry ") + num(entry, nd), color: AXIS, dash: "2 3" },
               { v: stop, label: "stop " + num(stop, nd), color: BAD }],
      vlines: [{ t: opened, label: "opened" }],
      fmt: v => num(v, nd), fmtShort: v => num(v, nd), fmtDelta: v => num(v, nd),
      fmtAxis: (v, step) => num(v, Math.max(0, Math.min(nd, -Math.floor(Math.log10(step)) + 1))),
      fmtDate: t => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      fmtTime: t => new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      timeHeader: "When (your time)", valueHeader: `${pair} price`,
      note: "Line: Capital.com's 15-minute closes, then TradingView's live price every 5 seconds while this chart is on screen.",
      emptyText: "No price history yet: it appears after the next update.",
    });
  }

  // Draw every open trade's chart into its .poschart host and keep the minute ticker pointed at the open instruments.
  function positions(F, fromTick) {
    if (!F) return;
    tick.F = F;
    const S = F.swing || {}, st = S.state || {}, open = st.positions || {}, charts = S.charts || {};
    const a = st.account || {}, aed = a.currency === "AED" || !!st.start_ccy;
    document.querySelectorAll(".poschart[data-pair]").forEach(host => {
      const pair = host.dataset.pair;
      if (open[pair]) positionChart(host, pair, open[pair], charts[pair], aed);
    });
    if (!fromTick) {
      const want = {};
      for (const p of Object.keys(open)) want[p] = (charts[p] || {}).tv || ((st.tv || {})[p] || {}).symbol || null;
      liveTicks(want);
    }
  }

  window.FloorCharts = { draw, egx, usd, positions, tradeMoney, closedMoney };
})();
