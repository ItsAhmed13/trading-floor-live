/* Phone page (Safari): the swing desk first, then the other desks. Reads window.FLOOR (data.js locally,
   or the encrypted data.enc.json through phone.js on the published site). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n, d = 2) => (n == null || isNaN(n)) ? "-" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const usd = (n, d = 2) => n == null ? "-" : (n < 0 ? "-$" : "$") + num(Math.abs(n), d);
  const sgn = (n, d = 2) => n == null ? "-" : `<span class="${n > 0 ? "up" : n < 0 ? "down" : ""}">${n > 0 ? "+" : ""}${num(n, d)}</span>`;
  const px = n => n == null ? "-" : num(n, n < 2 ? 5 : n < 500 ? 3 : 1);
  const ago = iso => {
    if (!iso) return "never";
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); return h < 48 ? h + " h ago" : Math.round(h / 24) + " days ago";
  };
  const until = iso => {
    if (!iso) return "-";
    const m = Math.round((Date.parse(iso) - Date.now()) / 60000);
    if (m <= 0) return "due now"; if (m < 60) return "in " + m + " min";
    const h = Math.round(m / 60); return h < 48 ? "in " + h + " h" : "in " + Math.round(h / 24) + " days";
  };
  const empty = t => `<p class="empty">${esc(t)}</p>`;
  const tvCls = l => !l ? "" : l.includes("BUY") ? "up" : l.includes("SELL") ? "down" : "";
  const tvChips = t => !t ? "" : ["1h", "4h", "1D", "1W"].map(k => `<span class="tv ${tvCls(t.ratings[k])}">${k} ${esc((t.ratings[k] || "-").replace("STRONG ", "S."))}</span>`).join("");
  let chartMounted = null;
  function mountChart(sym) {
    if (!sym || chartMounted === sym || !navigator.onLine) return;
    chartMounted = sym;
    const host = $("#tvbox");
    host.innerHTML = "";
    const box = document.createElement("div");
    box.className = "tradingview-widget-container";
    box.style.height = "100%";
    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "100%";
    box.appendChild(inner);
    const sc = document.createElement("script");
    sc.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    sc.async = true;
    sc.textContent = JSON.stringify({ autosize: true, symbol: sym, interval: "240", timezone: "Etc/UTC", theme: "dark", style: "1",
      locale: "en", backgroundColor: "rgba(4, 5, 13, 1)", hide_side_toolbar: true, allow_symbol_change: true,
      studies: ["STD;RSI"], support_host: "https://www.tradingview.com" });
    box.appendChild(sc);
    host.appendChild(box);
  }
  const dirPill = v => v > 0 ? `<span class="pill up">LONG</span>` : v < 0 ? `<span class="pill down">SHORT</span>` : `<span class="pill">NEUTRAL</span>`;

  function render() {
    const F = window.FLOOR;
    if (!F) return;
    $("#lock").style.display = "none";
    $("#upd").textContent = ago(F.generated_at);
    const S = F.swing || {}, st = S.state || {}, a = st.account || {}, cfg = S.config || {};
    const start = a.start_usd || 100, eq = a.equity_usd != null ? a.equity_usd : start;
    $("#account").innerHTML = `<h2>Swing desk: forex + BTC</h2>
      <div class="row"><div class="big">${usd(eq)}</div><div class="sub">start ${usd(start, 0)}</div></div>
      <div class="sub">${sgn(eq - start)} USD (${sgn((eq / start - 1) * 100)}%) since start · ${Object.keys(st.positions || {}).length} open</div>
      <div id="usd-chart"></div>
      <div class="grid"><div><div class="k">Open P&amp;L</div><div class="v">${sgn(a.open_pnl_usd)}</div></div>
      <div><div class="k">Realised</div><div class="v">${sgn(a.realized_usd)}</div></div>
      <div><div class="k">Margin in use</div><div class="v">${usd(a.margin_used_usd)}</div></div>
      <div><div class="k">Margin level</div><div class="v">${a.margin_level_pct ? num(a.margin_level_pct, 0) + "%" : "-"}</div></div>
      <div><div class="k">Leverage</div><div class="v">1:${esc(a.leverage || cfg.leverage || 100)}</div></div>
      <div><div class="k">Risk mood</div><div class="v">${esc((st.macro || {}).risk_mood || "-")}</div></div></div>
      <p class="note">${esc(st.status || "Waiting for the first run.")}</p>`;
    if (window.FloorCharts) FloorCharts.usd($("#usd-chart"), F, 170);

    const E = F.egx, ecfg = F.egx_config || {};
    const ep = (E || {}).portfolio || {}, estart = (E && E.start_capital) || ecfg.starting_capital_egp || 70000;
    $("#egx").innerHTML = `<h2>EGX portfolio</h2>
      <div class="row"><div class="big">${num(E ? ep.total : estart, 0)} <span class="sub">EGP</span></div><div class="sub">start ${num(estart, 0)}</div></div>
      <div class="sub">${E ? `${sgn(ep.pnl_vs_start, 0)} EGP (${sgn(ep.pnl_vs_start_pct)}%) since start · cash ${num(ep.cash, 0)} · in stocks ${num(ep.invested, 0)} · ${(E.holdings || []).length} holdings` : "The EGX desk has not run yet."}</div>
      <div id="egx-chart"></div>`;
    if (window.FloorCharts) FloorCharts.egx($("#egx-chart"), F, 170);

    const pos = Object.entries(st.positions || {});
    $("#open").innerHTML = `<h2>Open trades</h2>` + (pos.length ? pos.map(([p, v]) => `
      <div class="card ${v.direction === "LONG" ? "long" : "short"}">
        <div class="row"><span class="pair">${esc(p)}</span><span class="pill ${v.direction === "LONG" ? "up" : "down"}">${esc(v.direction)}</span></div>
        <div class="row"><span class="big" style="font-size:22px">${sgn(v.upnl_usd)} <span class="sub">USD</span></span><span class="sub">${sgn(v.move_pct)}%</span></div>
        <div class="grid"><div><div class="k">Size</div><div class="v">${esc(v.size)} units</div></div>
        <div><div class="k">Entry / now</div><div class="v">${px(v.entry)} / ${px(v.last_mid)}</div></div>
        <div><div class="k">Margin</div><div class="v">${usd(v.margin_usd)}</div></div>
        <div><div class="k">Opened</div><div class="v">${esc(ago(v.opened_at))}</div></div>
        <div><div class="k">Fundamentals now</div><div class="v">${dirPill(v.fund_view_now)}</div></div>
        <div><div class="k">Quant now</div><div class="v">${dirPill(v.quant_view_now)}</div></div></div>
        <div class="sub" style="margin-top:6px">Closes only when both turn against it. Next fundamental review ${esc(until(((st.pairs || {})[p] || {}).next_review))} (every ${esc(v.review_hours)} h).</div>
        <details><summary>Judge's reason</summary><p>${esc(v.judge_reason)}</p></details></div>`).join("")
      : empty("No open trades. The agents keep analysing every flat pair."));


    const A = F.arb;
    if (A) {
      const ast = A.state || {}, n = ast.now || {}, td = ast.today || {}, pb = ast.playbook || {}, asb = A.scoreboard || {};
      const best = Math.max(td.best_long_edge == null ? -1e9 : td.best_long_edge, td.best_short_edge == null ? -1e9 : td.best_short_edge);
      const ap = ast.position, mt = (A.meetings || []).slice(-1)[0], ld = mt && mt.lead;
      const nm = id => ((F.roster || []).find(r => r.id === id) || { name: id }).name;
      $("#arb").innerHTML = `<h2>BTC arbitrage desk</h2>
        <p class="sub">Reads ${esc(Object.keys(n.venues || {}).length)} exchanges first, every 5 s, then compares your Capital.com price. Trades only when Capital.com strays from its usual place by more than its spread. Inside the shared $100.</p>
        <div class="grid"><div><div class="k">Fair price</div><div class="v">${n.fair ? usd(n.fair, 0) : "-"}</div></div>
        <div><div class="k">Capital.com</div><div class="v">${n.cap_bid ? num(n.cap_bid, 0) + " / " + num(n.cap_ask, 0) : "-"}</div></div>
        <div><div class="k">Gap now</div><div class="v">${n.gap != null ? sgn(n.gap, 1) : "-"}</div></div>
        <div><div class="k">Spread</div><div class="v">${n.spread != null ? usd(n.spread, 0) : "-"}</div></div>
        <div><div class="k">Best edge today</div><div class="v">${best > -1e8 ? sgn(best, 0) : "-"}</div></div>
        <div><div class="k">Desk P&amp;L</div><div class="v">${sgn(ast.realized_usd || 0, 3)}</div></div></div>
        <p class="note">${esc(ast.status || "Not started")}</p>
        ${ap ? `<div class="card ${ap.direction === "LONG" ? "long" : "short"}"><div class="row"><span class="pair">BTCUSD arbitrage</span><span class="pill ${ap.direction === "LONG" ? "up" : "down"}">${esc(ap.direction)}</span></div>
          <div class="sub">${esc(ap.size)} BTC at ${num(ap.entry, 2)} (${esc(ago(ap.opened_at))}), gap ${num(ap.gap_at_entry, 0)} $, edge ${num(ap.edge_at_entry, 0)} $. Open P&amp;L ${sgn(ap.upnl_usd, 3)}. Closes when Capital.com is back in line or after ${esc(pb.max_hold_min)} min.</div></div>` : ""}
        <details><summary>Exchanges now</summary>${Object.entries(n.venues || {}).map(([k, v]) => `<div class="row"><span>${esc(k)}${(n.dropped || []).includes(k) ? " (out of line)" : ""}</span><span class="sub">${num(v.mid, 1)} · usual ${v.usual_premium >= 0 ? "+" : ""}${num(v.usual_premium, 0)}</span></div>`).join("")}
          <p class="sub">Capital.com usually sits ${n.offset != null ? num(n.offset, 1) : "-"} $ from the fair price. Coinbase premium ${esc(n.coinbase_premium_bps)} bps. Funding ${esc((ast.basis || {}).avg_funding_pct)}% per 8 h.</p></details>
        <details><summary>Who does what (role meeting)</summary>${(ast.roles || []).length ? ast.roles.map(r => `<p><b>${esc(nm(r.agent))}</b>: ${esc(r.duties)}</p>`).join("") : "<p class='sub'>The agents meet after about 5 minutes of watching.</p>"}
          ${ld ? `<p><b>${esc(ld.headline)}</b> <span class="sub">${esc(ago(mt.ts))}</span></p><p>${esc(ld.summary)}</p><p class="sub">Outlook: ${esc(ld.honest_outlook)}</p>` : ""}</details>
        <details><summary>Playbook</summary>${Object.entries(pb).map(([k, v]) => `<div class="row"><span>${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("")}</details>
        <p class="sub">${esc(asb.trades || 0)} arbitrage trades, ${esc(asb.wins || 0)} winners, net ${usd(asb.net_usd || 0, 3)}.</p>`;
    } else if ($("#arb")) { $("#arb").style.display = "none"; }
    const pairs = cfg.pairs || Object.keys(st.pairs || {});
    const TV = st.tv || {};
    $("#pairs").innerHTML = `<h2>All pairs</h2>` + pairs.map(p => {
      const ps = (st.pairs || {})[p] || {}, f = ps.fund || {}, q = ps.quant || {};
      const open = (st.positions || {})[p];
      const status = open ? `<span class="pill ${open.direction === "LONG" ? "up" : "down"}">IN TRADE ${esc(open.direction)}</span>`
        : ps.aligned ? `<span class="pill warn">ALIGNED, to the Judge</span>` : `<span class="pill">waiting</span>`;
      return `<div class="p"><div class="pair">${esc(p)}</div><div>${status}
        <div class="sub">Fundamentals ${dirPill(f.view)} ${f.value != null ? sgn(f.value) : ""} · Quant ${q.regime ? `<span class="${q.regime === "BULL" ? "up" : "down"}">${esc(q.regime)}</span> P(bull) ${num(q.p_bull, 2)}` : "-"}</div>
        <div class="sub">TradingView ${TV[p] ? `<b>${px(TV[p].price)}</b> ${sgn(TV[p].change_pct)}%<a class="tvlink" href="${esc(TV[p].chart_url)}" target="_blank" rel="noopener">chart</a>` : "-"}</div>
        <div>${tvChips(TV[p])}</div>
        <div class="sub">Next review ${esc(until(ps.next_review))}${q.regime_age_days != null ? ` · regime ${esc(q.regime_age_days)} days old` : ""}${(st.tv_tech || {})[p] ? ` · TV technician: ${esc(st.tv_tech[p].bias)}` : ""}</div></div></div>`;
    }).join("");

    const sel = $("#chartsym");
    const opts = pairs.filter(p => TV[p]).map(p => [TV[p].symbol, p]);
    if (sel && opts.length && sel.options.length !== opts.length) {
      const firstOpen = Object.keys(st.positions || {}).find(p => TV[p]);
      sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}${(st.positions || {})[l] ? " (open)" : ""}</option>`).join("");
      if (firstOpen) sel.value = TV[firstOpen].symbol;
    }
    if (sel && sel.value) mountChart(sel.value);
    const mt = (S.meetings || []).slice(-1)[0];
    const jd = mt && mt.judge;
    $("#meeting").innerHTML = `<h2>Last Judge meeting</h2>` + (mt ? `<p class="sub">${esc(ago(mt.ts))}</p>
      ${jd ? `<p><b>${esc(jd.headline)}</b></p><p>${esc(jd.summary)}</p>` + (jd.decisions || []).map(d => `
        <div class="card"><div class="row"><span class="pair">${esc(d.pair)}</span><span class="pill ${d.decision === "APPROVE" ? "up" : "down"}">${esc(d.decision)}</span></div>
        <p class="sub">${esc(d.reason)}${d.decision === "APPROVE" ? ` Re-check every ${esc(d.review_hours)} h.` : ""}</p></div>`).join("")
        : empty("The Judge could not run (budget or API).")}` : empty("No meeting yet: a pair's fundamentals and quant regime have not lined up."));

    const views = Object.entries(st.ccy_views || {}).sort();
    $("#views").innerHTML = `<h2>Agents' currency views</h2>` + (st.macro ? `<p class="note">${esc(st.macro.summary)}</p>` : "") +
      (views.length ? views.map(([c, v]) => `<details><summary><b>${esc(c)}</b> ${esc(v.rating)} (${num(v.confidence, 2)}) · ${esc(ago(v.ts))}</summary>
        <p>${esc(v.reason)}</p><p class="sub">Horizon ${esc(v.horizon_days)} days.</p></details>`).join("") : empty("The analysts have not met yet."));

    const tr = (S.trades || []).slice().reverse().slice(0, 20);
    const sb = S.scoreboard || {};
    $("#closed").innerHTML = `<h2>Closed trades</h2><p class="sub">${esc(sb.trades || 0)} trades, ${esc(sb.wins || 0)} winners, net ${usd(sb.net_usd || 0)}.</p>` +
      (tr.length ? tr.map(t => `<div class="card ${t.direction === "LONG" ? "long" : "short"}"><div class="row"><span class="pair">${esc(t.pair)} ${esc(t.direction)}</span>${sgn(t.pnl_usd)}</div>
        <div class="sub">${px(t.entry)} to ${px(t.exit)} (${sgn(t.move_pct)}%), ${esc(t.held_days)} days. ${esc(t.exit_reason)}</div></div>`).join("") : empty("None yet."));

    const g = (F.gold || {}).state || {}, e = F.egx, b = F.budget || {};
    $("#desks").innerHTML = `<h2>Other desks</h2>
      ${(F.gold || {}).enabled === false ? `<div class="card"><b>Gold</b><div class="sub">The gold day-trading desk is switched off: gold now trades inside the swing desk's shared $100 (see All pairs).</div></div>`
        : `<div class="card"><div class="row"><b>Gold (XAUUSD)</b><span class="v">${usd(g.equity_usd)}</span></div><div class="sub">${esc(g.status || "-")}</div></div>`}
      <div class="card"><div class="row"><b>EGX portfolio</b><span class="v">${e ? num(e.portfolio.total, 0) + " EGP" : "-"}</span></div>
        <div class="sub">${e ? `${(e.orders || []).length} order(s) for Thndr from the ${esc(e.session)} close.` : "Not run yet."}</div></div>
      <div class="card"><div class="row"><b>AI budget</b><span class="v">${usd(b.spent)} of ${usd(b.cap, 0)}</span></div><div class="sub">On pace for ${usd(b.projected)} this month.</div></div>`;

    $("#how").innerHTML = `<h2>How the swing desk works</h2><ol>
      <li><b>Analysts</b> (USD, EUR, GBP, JPY, AUD and NZD, CAD, CHF, BTC, gold) and a <b>macro strategist</b> rate each currency. A pair's fundamental view is its first currency's score minus its second's (BTC and gold are rated against the dollar).</li>
      <li>Everyone follows <b>TradingView's live tracker</b>: live prices and its 1h to monthly ratings; a <b>TradingView Technician</b> reads them for the Judge, and the quant agents monitor on TradingView's live price.</li>
      <li>Every pair has a <b>quant agent</b>: a bull/bear regime model (Markov switching, measured against the pair's normal drift), re-checked every 15 minutes.</li>
      <li>When the two agree, the <b>News Checker</b> reads the last week's news and the <b>Swing Judge</b> approves or vetoes, and sets how often the pair is re-analysed.</li>
      <li><b>Size</b>: CRRA (gamma ${esc(cfg.gamma)}) on the shared $100 at 1:100, given the trades already open; max ${num((cfg.max_pair_margin || 0) * 100, 0)}% of equity as margin per pair.</li>
      <li><b>No stop, no target.</b> A trade closes only when the fundamental view and the quant regime both reverse; then the agents meet on that pair again. Capital.com's own rule still applies: all trades close if equity falls to ${num((cfg.stop_out_level || .5) * 100, 0)}% of the margin in use.</li>
      <li>Flat pairs are re-analysed every ${esc(cfg.flat_review_hours)} hours while markets are open. Spread and overnight costs are ignored, as you asked.</li>
      <li><b>BTC arbitrage desk</b> (same $100): reads eight exchanges every 5 seconds, compares your Capital.com price, and trades only when Capital.com strays from its usual place by more than its spread, at Capital.com's real bid and ask. Its agents set the rules in a role meeting; the Trigger applies them instantly.</li></ol>`;
  }

  function lock(msg) {
    $("#lock").style.display = "block";
    $("#lockmsg").textContent = msg || "";
  }

  function load() {
    if (window.FLOOR_LOADER) return window.FLOOR_LOADER().then(render, err => { if (!window.FLOOR) lock(err && err.message); });
    render();
    if (!window.FLOOR) lock("No data yet.");
  }

  $("#keybtn").addEventListener("click", () => {
    const m = /k=([A-Za-z0-9_-]+)/.exec($("#keyin").value || "");
    if (!m) { lock("That link has no key (it should contain #k=...)."); return; }
    try { localStorage.setItem("floor-key", m[1]); } catch (_) { /* storage optional */ }
    location.hash = "k=" + m[1];
    load();
  });
  $("#refresh").addEventListener("click", load);
  $("#chartsym").addEventListener("change", e => mountChart(e.target.value));
  document.querySelectorAll("nav [data-go]").forEach(el => el.addEventListener("click", ev => {
    ev.preventDefault();                                   // keep #k=... in the address (Add to Home Screen)
    const t = document.getElementById(el.dataset.go);
    if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  const full = $("#full");
  if (full && location.hash) full.href = "index.html" + location.hash;
  load();
  setInterval(load, 60000);
})();
