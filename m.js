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
  let shipOn = false;
  function showSheet(id) {
    const F = window.FLOOR || {};
    let html;
    if (String(id).startsWith("scout:")) {
      const [, kind, key] = String(id).split(":"), r = ((F.news || {})[kind] || {})[key];
      html = `<h2>${esc(key)} news scout</h2><p class="sub">A flying drone that reads the news on ${esc(key)} for its analysts.</p>` + (r
        ? `<p><span class="pill ${r.sentiment > 0.15 ? "up" : r.sentiment < -0.15 ? "down" : ""}">${r.sentiment > 0 ? "+" : ""}${num(r.sentiment, 2)}</span> <span class="pill">${esc(r.materiality || "?")}</span>${r.direction ? ` <span class="pill">${esc(r.direction)}</span>` : ""}</p>
           <p class="note">${esc(r.key_point || "")}</p>${(r.items || []).slice(0, 5).map(i => `<p class="sub">${esc(i.date)} · ${esc(i.source)}: ${esc(i.headline)}</p>`).join("")}
           <p class="sub">Read ${esc(ago(r.read_at))}.</p>`
        : empty("No read yet."));
    } else {
      const a = (F.roster || []).find(r => r.id === id) || { name: id, role: "" }, n = (F.notes || {})[id];
      html = `<h2>${esc(a.name)}</h2><p class="sub">${esc(a.role)}</p>` + (n
        ? `${n.stance ? `<p><span class="pill">${esc(n.stance)}</span>${n.confidence != null ? ` <span class="sub">confidence ${num(n.confidence, 2)}</span>` : ""}</p>` : ""}
           <p class="note">${esc(n.bubble)}</p><p>${esc(n.reasoning || "")}</p><p class="sub">${esc(ago(n.ts))}</p>`
        : empty("Nothing to say yet."));
    }
    $("#sheet-body").innerHTML = html;
    const d = $("#sheet");
    d.classList.remove("wide");
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  }
  function showVal(t) {
    const d = $("#sheet");
    d.classList.add("wide");
    $("#sheet-body").innerHTML = `<p class="sub">Loading ${esc(t)}...</p>`;
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
    if (!window.FloorVal) { $("#sheet-body").innerHTML = empty("The valuation view did not load."); return; }
    window.FloorVal.load(window.FLOOR).then(V => { $("#sheet-body").innerHTML = window.FloorVal.detail(t, ((V || {}).companies || {})[t]); },
      err => { $("#sheet-body").innerHTML = empty((err && err.message) || "Could not load the valuation detail."); });
  }

  function renderValuation(F) {
    const host = $("#valuation");
    if (!host) return;
    const V = F.valuation;
    if (!V) { host.innerHTML = `<h2>Valuations</h2>${empty("The valuation desk has not run yet. It runs inside the EGX desk after each close.")}`; return; }
    const all = V.companies || [], c = V.counts || {};
    const ok = all.filter(r => r.fv && r.st === "OK" && (r.cf || 0) >= 0.1 && r.up != null);
    const cheap = ok.slice().sort((a, b) => b.up - a.up).slice(0, 5), dear = ok.slice().sort((a, b) => a.up - b.up).slice(0, 5);
    const today = new Date().toISOString().slice(0, 10), soon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const due = all.filter(r => r.nx && r.ns !== "OVERDUE" && r.nx >= today && r.nx <= soon).sort((a, b) => a.nx.localeCompare(b.nx));
    const late = all.filter(r => r.ns === "OVERDUE");
    const bad = f => /BAD|LOSS|SQUEEZE|SLOWING|DOWN/.test(f);
    const line = r => `<div class="vrow" data-val="${esc(r.t)}"><span><b>${esc(r.t)}</b> <span class="sub">${esc(r.n || "")}</span>
      <div class="sub">fair value ${num(r.fv, 2)} vs ${num(r.p, 2)}${r.lq ? ` · ${esc(r.lq)}` : ""}${(r.fl || []).length ? ` · <span class="${bad(r.fl[0]) ? "down" : "up"}">${esc(String(r.fl[0]).split(":")[0].toLowerCase())}</span>` : ""}</div></span>
      <span>${r.up != null ? sgn(r.up, 1) + "%" : `<span class="sub">${esc(String(r.st || "").toLowerCase().replace("_", " "))}</span>`}</span></div>`;
    const revs = (V.revisions || []).slice().reverse().slice(0, 5).map(r => `<div class="vrow" data-val="${esc(r.ticker)}"><span><b>${esc(r.ticker)}</b> <span class="sub">${esc(r.trigger)}</span>
      <div class="sub">${num(r.fv_before, 2)} &rarr; <b>${num(r.fv_after, 2)}</b>${r.verdict ? ` · ${esc(String(r.verdict).replace(/_/g, " ").toLowerCase())}` : ""}</div></span><span class="sub">${esc((r.ts || "").slice(5, 10))}</span></div>`).join("");
    host.innerHTML = `<h2>Valuations</h2>
      <p class="sub">Every covered company: a five-year forecast and three valuations (a DCF, peer multiples, a dividend discount model) blended into a fair value. Per sector, an Earnings Tracker reads each set of results the day it comes out and keeps the Excel spreads; a Valuation Analyst revises the forecast after every quarter. Tap a company for its forecast.</p>
      <div class="grid"><div><div class="k">Valued</div><div class="v">${num(c.valued, 0)} of ${num(c.companies, 0)}</div></div>
        <div><div class="k">Reviewed by analysts</div><div class="v">${num(c.reviewed_by_analyst, 0)}</div></div>
        <div><div class="k">Results in 14 days</div><div class="v">${num(due.length, 0)}</div></div>
        <div><div class="k">Late results</div><div class="v ${late.length ? "warn" : ""}">${num(late.length, 0)}</div></div></div>
      <div class="k" style="margin-top:12px">Cheapest against fair value</div>${cheap.map(line).join("") || empty("None yet.")}
      <div class="k" style="margin-top:12px">Dearest against fair value</div>${dear.map(line).join("") || empty("None yet.")}
      <div class="k" style="margin-top:12px">Results due in the next 2 weeks</div>${due.map(r => `<div class="vrow" data-val="${esc(r.t)}"><span><b>${esc(r.t)}</b> <span class="sub">${esc(r.nl || "")}</span></span><span class="sub">${esc(r.nx.slice(5))}</span></div>`).join("") || empty("Nothing due.")}
      ${revs ? `<div class="k" style="margin-top:12px">Latest revisions</div>${revs}` : ""}
      <details><summary>All ${num(all.length, 0)} companies</summary>${all.slice().sort((a, b) => a.t.localeCompare(b.t)).map(line).join("")}</details>
      ${terminalLine(F.terminal)}
      ${late.length ? `<details><summary>${num(late.length, 0)} late results</summary><p class="sub">${late.map(r => esc(r.t)).join(", ")}</p><p class="sub">The filing deadline passed and the figures are not out (or not on TradingView yet). The trackers chase them, a few a day.</p></details>` : ""}
      <p class="sub">Updated ${esc(ago(V.as_of))}. Excel spreads: ${esc((V.excel || {}).folder || "-")}</p>`;
  }
  // The PRO12 terminal desk (owner 2026-10-13): one short block on the phone.
  function terminalLine(T) {
    if (!T) return `<div class="k" style="margin-top:12px">PRO12 terminal</div><p class="sub">Not run yet. It reads PRO12 on the laptop Sunday to Thursday at 15:10.</p>`;
    const res = Object.entries(T.results || {}), na = Object.entries((T.listings || {}).not_active || {});
    return `<div class="k" style="margin-top:12px">PRO12 terminal</div>
      <p class="sub">${T.status === "ok" || T.status === "partial" ? "Read" : `<span class="down">${esc(String(T.status || "").replace(/_/g, " "))}</span> ·`} ${esc(ago(T.as_of))}: ${num(T.companies_read || 0, 0)} companies, ${num(T.new_items || 0, 0)} new announcements; results spotted: ${res.length ? res.map(([t, r]) => `<b>${esc(t)}</b> ${esc(r.period_end || "")}`).join(", ") : "none"}; figures added for ${num(T.filled || 0, 0)}${(T.held_back || []).length ? `, held back ${T.held_back.map(esc).join(", ")}` : ""}.${na.length ? ` Not trading: ${na.slice(0, 5).map(([t]) => esc(t)).join(", ")}.` : ""}</p>
      ${T.status !== "ok" && T.detail ? `<p class="sub warn">${esc(T.detail)}</p>` : ""}`;
  }
  const dirPill = v => v > 0 ? `<span class="pill up">LONG</span>` : v < 0 ? `<span class="pill down">SHORT</span>` : `<span class="pill">NEUTRAL</span>`;

  // The site was updated since this page loaded: load the new version (a new address skips the browser's cache).
  function freshCode(F) {
    const meta = document.querySelector('meta[name="floor-version"]'), mine = meta && meta.content, theirs = F && F.code_version;
    if (!mine || !theirs || mine === theirs) return false;
    try { if (sessionStorage.getItem("floor-upgraded") === theirs) return false; sessionStorage.setItem("floor-upgraded", theirs); } catch (e) { /* storage blocked */ }
    location.replace(location.pathname + "?v=" + theirs + location.hash);
    return true;
  }

  function render() {
    const F = window.FLOOR;
    if (!F || freshCode(F)) return;
    $("#lock").style.display = "none";
    $("#upd").textContent = ago(F.generated_at);
    const age = (Date.now() - Date.parse(F.generated_at)) / 60000, stale = $("#stale");
    if (stale) {                                   // the laptop publishes every 15 minutes; 45+ means it has stopped
      stale.style.display = age > 45 ? "" : "none";
      if (age > 45) stale.innerHTML = `<h2 style="color:#ff4f9a">Not updating</h2><p>Nothing new since ${esc(new Date(F.generated_at).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" }))} (${esc(ago(F.generated_at))}). The laptop is probably asleep, off or offline, so the agents are paused. They resume by themselves once it is awake and signed in.</p>`;
    }
    if (window.Office && $("#ship-canvas")) {
      if (!shipOn) { window.Office.init($("#ship-canvas"), showSheet); if (window.Office.attachFullscreen) window.Office.attachFullscreen($("#ship-stage"), $("#ship-full")); shipOn = true; }
      window.Office.setData(F);
    }
    const S = F.swing || {}, st = S.state || {}, a = st.account || {}, cfg = S.config || {};
    const aed = a.currency === "AED", fx = aed ? 3.6725 : 1, unit = aed ? "AED" : "USD";
    const cc = (vUsd, vCcy) => vCcy != null ? Number(vCcy) : vUsd != null ? Number(vUsd) * fx : null;   // own currency
    const m = (v, d = 2) => v == null ? "-" : `${num(v, d)} ${unit}`;
    const start = cc(a.start_usd || 100, a.start_ccy), eq = cc(a.equity_usd, a.equity_ccy) ?? start;
    const isLive = a.source === "live", lv = st.live || {}, bp = lv.broker_positions || [];
    const lvl = cfg.risk_scale || 40, tpPct = lvl * 0.25;
    const onAcct = bp.map(b => `<div class="row"><span><b>${esc(b.epic)}</b> ${esc(b.direction === "BUY" ? "LONG" : b.direction === "SELL" ? "SHORT" : b.direction)} ${esc(b.size)} at ${esc(b.level)}</span><span>${b.upl != null ? sgn(b.upl) + " " + esc(a.currency || "") : "-"}</span></div>`).join("");
    const orders = (S.live_orders || []).filter(o => o.kind !== "skip").slice().reverse().slice(0, 5).map(o => `<div class="sub">${esc((o.ts || "").slice(5, 16).replace("T", " "))} · ${esc(o.text)}</div>`).join("");
    $("#account").innerHTML = `<h2>${isLive ? "Your Capital.com account (live)" : "Swing desk: forex + BTC"}</h2>
      <div class="row"><div class="big">${num(eq, 2)} <span class="sub">${unit}</span></div><div class="sub">start ${m(start)}${aed && a.equity_usd != null ? ` · about ${usd(a.equity_usd)}` : ""}</div></div>
      <div class="sub">${sgn(eq - start)} ${unit} (${sgn((eq / start - 1) * 100)}%) since start · ${isLive ? bp.length + " open on your account" : Object.keys(st.positions || {}).length + " open"}</div>
      <div id="usd-chart"></div>
      <div class="grid"><div><div class="k">Open P&amp;L</div><div class="v">${sgn(cc(a.open_pnl_usd, a.open_pnl_ccy))}</div></div>
      <div><div class="k">Realised</div><div class="v">${sgn(cc(a.realized_usd, a.realized_ccy))}</div></div>
      <div><div class="k">Margin in use</div><div class="v">${m(cc(a.margin_used_usd, a.margin_ccy))}</div></div>
      <div><div class="k">Margin level</div><div class="v">${a.margin_level_pct ? num(a.margin_level_pct, 0) + "%" : "-"}</div></div>
      <div><div class="k">Risk level</div><div class="v">${esc(lvl)} / 100</div></div>
      <div><div class="k">Risk mood</div><div class="v">${esc((st.macro || {}).risk_mood || "-")}</div></div></div>
      ${isLive ? `<div class="k" style="margin-top:8px">On your account</div>${onAcct || `<p class="sub">No trades open on your account.</p>`}` : ""}
      <p class="note"><b>Your risk level ${esc(lvl)}/100:</b> each instrument has its own take-profit, up to ${num(tpPct, 0)}% of the account (about ${m(eq * tpPct / 100)}), lower for instruments that rarely move that far in a few days. The Judge picks the risk-to-reward and the stop sits at that multiple of the instrument's own take-profit distance; Capital.com holds both prices on the order.</p>
      <p class="note">${esc(st.status || "Waiting for the first run.")}</p>
      ${st.live ? `<p class="note"><b>Live copy:</b> ${esc(st.live.status)}</p>` : ""}
      ${orders ? `<div class="k" style="margin-top:6px">Latest live orders</div>${orders}` : ""}`;
    if (window.FloorCharts) FloorCharts.usd($("#usd-chart"), F, 170);

  // The plan for one position, from floor/explain.py (why, how long, what closes it, what is at risk).
  const planOf = (desk, id) => ((F.explain || {})[desk] || []).find(c => c.id === id);
  const planDetails = c => c ? `<details><summary>The plan: why, how long, exits</summary>
      <div class="grid">${(c.levels || []).map(l => `<div><div class="k">${esc(l.label)}</div><div class="v">${esc(l.value)}</div></div>`).join("")}</div>
      ${(c.sections || []).map(x => `<p><b>${esc(x.h)}.</b> ${esc(x.p)}</p>`).join("")}</details>` : "";
    const E = F.egx, ecfg = F.egx_config || {}, OD = F.egx_orders || {};
    const live = OD.live && (!E || String(OD.live.as_of) > String(E.as_of)) ? OD.live : null;
    const ep = live || (E || {}).portfolio || {}, estart = (E && E.start_capital) || ecfg.starting_capital_egp || 70000;
    const hold = live ? live.holdings.map(h => ({ ticker: h.ticker, shares: h.shares, avg_cost: h.avg_cost, price: h.last, pnl: h.pnl, pnl_pct: h.pnl_pct }))
      : ((E || {}).holdings || []);
    const today = new Date().toISOString().slice(0, 10);
    const book = (OD.book || (E || {}).orders || []).map(o => {
      const state = o.worked_on ? `<span class="pill warn">working since the open</span>` : `<span class="pill">waits for the next open</span>`;
      return `<div class="row"><span><b>${esc(o.action)}</b> ${num(o.shares, 0)} ${esc(o.ticker)} at ${esc(o.limit)}${o.chase_max ? ` <span class="sub">(no chase above ${esc(o.chase_max)})</span>` : ""}</span>${state}</div>`;
    }).join("");
    const fills = (OD.fills || (E || {}).recent_fills || []).filter(f => f.shares).slice().reverse().slice(0, 8).map(f => `
      <div class="row"><span>${esc(f.date.slice(5))}${f.time ? " " + esc(f.time) : ""} · <b>${f.action === "BUY" || f.action === "ADD" ? "Bought" : "Sold"}</b> ${num(f.shares, 0)} ${esc(f.ticker)}</span><span class="v">${esc(f.price)}</span></div>
      ${f.note ? `<div class="sub" style="margin:-2px 0 6px">${esc(f.note)}</div>` : ""}`).join("");
    const expired = (OD.log || []).filter(o => o.status === "EXPIRED" || o.status === "CANCELLED").slice().reverse().slice(0, 4).map(o => `
      <div class="sub">${esc((o.closed_on || "").slice(5))} · ${esc(o.action)} ${num(o.shares, 0)} ${esc(o.ticker)} at ${esc(o.limit)}: ${esc(o.close_note || o.status.toLowerCase())}</div>`).join("");
    const decisions = (OD.day === today ? (OD.decisions || []) : []).map(d => `<div class="note"><b>${esc(d.time)} ${esc(d.ticker)}: ${esc(d.decision)}</b> ${esc(d.reason)}</div>`).join("");
    $("#egx").innerHTML = `<h2>EGX portfolio</h2>
      <div class="row"><div class="big">${num(E || live ? ep.total : estart, 0)} <span class="sub">EGP</span></div><div class="sub">start ${num(estart, 0)}</div></div>
      <div class="sub">${E || live ? `${sgn(ep.pnl_vs_start, 0)} EGP (${sgn(ep.pnl_vs_start_pct)}%) since start · cash ${num(ep.cash, 0)} · in stocks ${num(ep.invested, 0)}` : "The EGX desk has not run yet."}</div>
      ${live ? `<div class="sub">Valued at ${esc(live.seen_at)} with TradingView prices (${esc(live.market)}${live.market === "open" ? ", 15 min delayed" : ""}).</div>` : ""}
      <div id="egx-chart"></div>
      ${hold.length ? `<h2 style="margin-top:12px">Holdings</h2>` + hold.map(h => `<div class="row"><span><b>${esc(h.ticker)}</b> ${num(h.shares, 0)} at ${esc(h.avg_cost)} <span class="sub">now ${esc(h.price)}</span></span><span>${sgn(h.pnl, 0)} <span class="sub">(${sgn(h.pnl_pct)}%)</span></span></div>${planDetails(planOf("egx", "egx:" + h.ticker))}`).join("") : ""}
      <h2 style="margin-top:12px">Order Desk</h2>
      <p class="sub">${esc(OD.status || "Places the Judge's orders at the open and tracks them every 15 minutes in the session.")}${OD.last_check ? ` Last check ${esc(ago(OD.last_check))}.` : ""}</p>
      ${book ? `<div class="k" style="margin-top:6px">Order book</div>${book}` : `<p class="sub">No orders in the book.</p>`}
      ${decisions}
      ${fills ? `<div class="k" style="margin-top:10px">Executions</div>${fills}` : ""}
      ${expired ? `<div class="k" style="margin-top:6px">Expired or replaced</div>${expired}` : ""}`;
    if (window.FloorCharts) FloorCharts.egx($("#egx-chart"), F, 170);
    renderValuation(F);

    const pos = Object.entries(st.positions || {});
    const aedOn = (st.account || {}).currency === "AED" || !!st.start_ccy, fxA = aedOn ? 3.6725 : 1, uA = aedOn ? "AED" : "USD";
    $("#open").innerHTML = `<h2>Open trades</h2>` + (pos.length ? pos.map(([p, v]) => `
      <div class="card ${v.direction === "LONG" ? "long" : "short"}">
        <div class="row"><span class="pair">${esc(p)}</span><span class="pill ${v.direction === "LONG" ? "up" : "down"}">${esc(v.direction)}</span></div>
        ${(M => `<div class="row"><span class="big" style="font-size:22px">${M.v == null ? "-" : sgn(M.v)} <span class="sub">${esc(M.cur)}</span></span><span class="sub">${M.real ? "on your Capital.com account" : "paper only (not on your account)"}</span></div>`
          + (M.real && M.fees ? `<div class="sub">overnight fees so far ${sgn(M.fees)} ${esc(M.cur)}</div>` : ""))(FloorCharts.tradeMoney(v, aedOn))}
        <div class="grid"><div><div class="k">Size</div><div class="v">${esc(v.size)} units</div></div>
        <div><div class="k">Entry / now</div><div class="v">${px(FloorCharts.tradeMoney(v, aedOn).entry)} / ${px(v.last_mid)}</div></div>
        <div><div class="k">Margin</div><div class="v">${num(v.margin_usd * fxA, 2)} ${uA}</div></div>
        <div><div class="k">Opened</div><div class="v">${esc(ago(v.opened_at))}</div></div>
        <div><div class="k">Fundamentals now</div><div class="v">${dirPill(v.fund_view_now)}</div></div>
        <div><div class="k">Quant now</div><div class="v">${dirPill(v.quant_view_now)}</div></div></div>
        <div class="poschart" data-pair="${esc(p)}"></div>
        <div class="sub" style="margin-top:6px">Closes at its take-profit or stop, or when both views turn against it. Next fundamental review ${esc(until(((st.pairs || {})[p] || {}).next_review))} (every ${esc(v.review_hours)} h).</div>
        ${planDetails(planOf("swing", "swing:" + p)) || `<details><summary>Judge's reason</summary><p>${esc(v.judge_reason)}</p></details>`}</div>`).join("")
      : empty("No open trades. The agents keep analysing every flat pair."));
    if (window.FloorCharts && FloorCharts.positions) FloorCharts.positions(F);         // live chart per open trade


    const N = F.news;
    if (N && $("#news")) {
      const MAT = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
      const rank = (a, b) => (MAT[b[1].materiality] || 0) - (MAT[a[1].materiality] || 0) || Math.abs(b[1].sentiment) - Math.abs(a[1].sentiment);
      const line = ([k, r]) => `<details><summary><b>${esc(k)}</b> ${sgn(r.sentiment)} · ${esc(r.materiality)}${r.priced_in && r.priced_in !== "UNCLEAR" ? " · priced in " + esc(r.priced_in.toLowerCase()) : ""}</summary>
        <p>${esc(r.key_point)}</p>${(r.items || []).map(i => `<div class="sub">${esc(i.date)} · ${esc(i.source)}: ${esc(i.headline)} (${esc(i.impact)})</div>`).join("")}
        ${(r.red_flags || []).length ? `<div class="sub warn">Red flags: ${esc(r.red_flags.join("; "))}</div>` : ""}</details>`;
      const fx = Object.entries(N.fx || {}).sort(rank), egx = Object.entries(N.egx || {}).filter(([, r]) => r.materiality !== "NONE").sort(rank);
      $("#news").innerHTML = `<h2>News scouts</h2><p class="sub">One scout per pair and per EGX stock reads its own headlines and briefs the analysts who cover it. Sentiment -1 to +1: which way the news pushes the price.</p>
        <div class="k" style="margin-top:8px">Forex, gold, bitcoin</div>${fx.map(line).join("") || empty("Not read yet.")}
        <div class="k" style="margin-top:10px">EGX stocks with news</div>${egx.slice(0, 15).map(line).join("") || empty("No material EGX news in the last two weeks.")}`;
    }
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
        <div class="sub">Next review ${esc(until(ps.next_review))}${q.regime_age_days != null ? ` · regime ${esc(q.regime_age_days)} days old` : ""}${(st.tv_tech || {})[p] ? ` · TV technician: ${esc(st.tv_tech[p].bias)}` : ""}</div>
        ${((ps.playbook || {}).exit || {}).take_profit_aed != null ? `<div class="sub">Own take-profit: <b>+${num(ps.playbook.exit.take_profit_aed, 2)} AED</b> on a ${num(ps.playbook.exit.take_profit_move_pct, 2)}% move${ps.playbook.exit.typical_days != null ? `, about ${num(ps.playbook.exit.typical_days, 1)} days` : ""}${ps.playbook.exit.lowered_from_aed != null ? ` (lowered from ${num(ps.playbook.exit.lowered_from_aed, 2)})` : ""}; stop at the Judge's risk-to-reward</div>` : ""}</div></div>`;
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
    const sb = S.scoreboard || {}, ls = sb.live || {};
    const aedC = (st.account || {}).currency === "AED" || !!st.start_ccy;
    $("#closed").innerHTML = `<h2>Closed trades</h2>` + (ls.trades
      ? `<p class="sub">On your Capital.com account: ${esc(ls.trades)} trade(s), ${esc(ls.wins)} winner(s), net <b>${sgn(ls.net_ccy)} ${esc(ls.currency || "AED")}</b> (real results, overnight fees included).</p>`
      : `<p class="sub">${esc(sb.trades || 0)} trades, ${esc(sb.wins || 0)} winners (paper book).</p>`) +
      (tr.length ? tr.map(t => { const C = FloorCharts.closedMoney(t, aedC), L = t.live || {};
        return `<div class="card ${t.direction === "LONG" ? "long" : "short"}"><div class="row"><span class="pair">${esc(t.pair)} ${esc(t.direction)}</span>${C.pending ? `<span class="sub">waiting for Capital.com</span>` : `${sgn(C.v)} <span class="sub">${esc(C.cur)}${C.real ? "" : " (paper)"}</span>`}</div>
        <div class="sub">${px(L.open_level || t.entry)} to ${px(L.close_level || t.exit)}, ${esc(t.held_days)} days. ${esc(t.exit_reason)}</div></div>`; }).join("") : empty("None yet."));


    const R = F.weekly;
    if ($("#report")) {
      if (!R) { $("#report").innerHTML = `<h2>Report card</h2>${empty("The first report card arrives on Saturday morning.")}`; }
      else {
        const c = R.card || {}, ag = R.agents || {}, f = R.facts || {}, grades = Object.fromEntries((c.agents || []).map(a => [a.agent, a]));
        const nm = id => ((F.roster || []).find(r => r.id === id) || { name: id }).name;
        const rows = Object.entries(ag).sort((a, b) => b[1].n - a[1].n).map(([id, s]) => {
          const g = grades[id] || grades[s.name] || {};
          return `<details><summary><b>${esc(s.name || nm(id))}</b> ${g.grade ? `<span class="pill">${esc(g.grade)}</span>` : ""} <span class="sub">${num(s.hit_rate * 100, 0)}% of ${esc(s.n)}${s.weighted === false ? "" : ` · weight x${num(s.multiplier, 2)}`}</span></summary>${g.comment ? `<p>${esc(g.comment)}</p>` : ""}</details>`;
        }).join("");
        const wait = Object.entries(f.waiting_to_be_graded || {}), waiting = wait.reduce((n, [, v]) => n + v.n, 0);
        const due = wait.map(([, v]) => v.first_due).filter(Boolean).sort()[0];
        $("#report").innerHTML = `<h2>Report card</h2><p><b>${esc(c.headline || "")}</b></p><p class="sub">${esc(c.summary || "")}</p>
          ${(c.lessons || []).length ? `<ul>${c.lessons.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
          ${rows || empty("No agent has graded calls yet.")}
          ${waiting ? `<p class="sub">${num(waiting, 0)} more calls are waiting for their horizon${due ? `; the first is due ${esc(due)}` : ""}.</p>` : ""}
          <p class="sub">Updated ${esc(ago(R.as_of))}. Saturdays at 10:00.</p>`;
      }
    }
    const g = (F.gold || {}).state || {}, e = F.egx, b = F.budget || {};
    $("#desks").innerHTML = `<h2>Other desks</h2>
      ${(F.gold || {}).enabled === false ? `<div class="card"><b>Gold</b><div class="sub">The gold day-trading desk is switched off: gold now trades inside the swing desk's shared $100 (see All pairs).</div></div>`
        : `<div class="card"><div class="row"><b>Gold (XAUUSD)</b><span class="v">${usd(g.equity_usd)}</span></div><div class="sub">${esc(g.status || "-")}</div></div>`}
      <div class="card"><div class="row"><b>EGX portfolio</b><span class="v">${e ? num(e.portfolio.total, 0) + " EGP" : "-"}</span></div>
        <div class="sub">${e ? `${(e.orders || []).length} order(s) for Thndr from the ${esc(e.session)} close.` : "Not run yet."}</div></div>
      <div class="card"><div class="row"><b>AI budget</b><span class="v">${usd(b.spent)} of ${usd(b.cap, 0)}</span></div><div class="sub">On pace for ${usd(b.projected)} this month.</div></div>`;

    $("#how").innerHTML = `<h2>How the swing desk works</h2><ol>
      <li><b>Analysts</b> (USD, EUR, GBP, JPY, AUD and NZD, CAD, BTC, gold) and a <b>macro strategist</b> rate each currency. A pair's fundamental view is its first currency's score minus its second's (BTC and gold are rated against the dollar).</li>
      <li>Everyone follows <b>TradingView's live tracker</b>: live prices and its 1h to monthly ratings; a <b>TradingView Technician</b> reads them for the Judge, and the quant agents monitor on TradingView's live price.</li>
      <li>Every pair has a <b>quant agent</b>: a bull/bear regime model (Markov switching, measured against the pair's normal drift), re-checked every 15 minutes.</li>
      <li>When the two agree, the <b>News Checker</b> reads the last week's news and the <b>Swing Judge</b> approves or vetoes, and sets how often the pair is re-analysed.</li>
      <li><b>Size</b>: ${cfg.sizing === "min" ? "the smallest deal Capital.com allows, at its own margin. Several trades can be open at once, as long as Capital.com's free funds cover the margin; all their stops together may lose at most half the account." : `CRRA (gamma ${esc(cfg.gamma)}) given the trades already open.`}</li>
      <li><b>Your risk level: ${esc(cfg.risk_scale || 40)} out of 100</b> (1 = very, very safe, 100 = all in). Profit is banked as soon as a trade reaches its instrument's own target: up to ${num((cfg.risk_scale || 40) * 0.25, 0)}% of the account, lowered for instruments that rarely move that far in ${esc(cfg.target_reach_days || 3)} days, instead of waiting for the whole move.</li>
      <li><b>Stop loss</b>: set at entry by the Judge, after the analysts present the trade: it decides the risk-to-reward from the trade's conditions, and the stop sits at that multiple of the instrument's own take-profit distance, where the idea is logically wrong. One survival limit: a stop that would lose more than half the account is pulled in. Capital.com holds the stop and the take-profit on the live order.</li>
      <li><b>Other exits</b>: a trade also closes when the fundamental view and the quant regime both reverse, or after a News Sentinel emergency meeting. Amounts are shown in AED, your account's currency. Capital.com's own rule still applies: all trades close if equity falls to ${num((cfg.stop_out_level || .5) * 100, 0)}% of the margin in use.</li>
      <li><b>Live copy</b>: every new trade is copied onto your Capital.com account with the same smallest deal, and closed with it. The account panel shows your real balance and every position on the account, including ones you open yourself.</li>
      <li>Flat pairs are re-analysed every ${esc(cfg.flat_review_hours)} hours while markets are open. The desk's own figures ignore costs; your live account pays the real spread, overnight funding and the 0.7% conversion fee.</li></ol>`;
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
  if ($("#valuation")) $("#valuation").addEventListener("click", e => {
    const r = e.target.closest("[data-val]");
    if (r) showVal(r.dataset.val);
  });
  $("#sheet-close").addEventListener("click", () => { const d = $("#sheet"); if (d.close) d.close(); else d.removeAttribute("open"); });
  document.querySelectorAll("[data-ship]").forEach(b => b.addEventListener("click", () => { if (window.Office) window.Office.view(b.dataset.ship); }));
  $("#ship-tour").addEventListener("click", () => { if (window.Office) window.Office.tour(true); });
  for (const [id, kind, none] of [["#ship-replay-fx", "fx", "No swing review to replay yet."], ["#ship-replay-egx", "egx", "No EGX review to replay yet."]]) {
    $(id).addEventListener("click", () => {
      if (!window.Office) return;
      if (window.Office.busy()) return alert("A meeting is already running. Watch it finish first.");
      if (!window.Office.replay(kind)) alert(none);
      $("#ship").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
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
