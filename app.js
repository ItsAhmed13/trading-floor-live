/* Panels: "Your money" sidebar and the detail tabs. Reads window.FLOOR (data.js). */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n, d = 0) => (n == null || isNaN(n)) ? "-" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const egp = (n, d = 0) => n == null ? "-" : num(n, d) + " EGP";
  const usd = (n, d = 2) => n == null ? "-" : (n < 0 ? "-$" : "$") + num(Math.abs(n), d);
  const pct = (n, d = 1) => n == null ? "-" : (n > 0 ? "+" : "") + num(n, d) + "%";
  const cls = n => n > 0 ? "up" : n < 0 ? "down" : "";
  const px = n => num(n, n != null && n < 2 ? 3 : 2);
  const ago = iso => {
    if (!iso) return "never";
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 48) return h + " h ago";
    return Math.round(h / 24) + " days ago";
  };
  const empty = t => `<p class="empty">${esc(t)}</p>`;
  const table = (head, rows, numCols = []) => rows.length ? `<div class="tablewrap"><table><thead><tr>${head.map((h, i) =>
    `<th class="${numCols.includes(i) ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r =>
    `<tr>${r.map((c, i) => `<td class="${numCols.includes(i) ? "num" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : empty("Nothing here yet.");

  let F = null, tab = "orders";
  const tvCls = l => !l ? "" : l.includes("BUY") ? "up" : l.includes("SELL") ? "down" : "";
  const tvTag = l => l ? `<span class="${tvCls(l)}">${esc(l)}</span>` : "-";
  const tvBrief = x => x ? `${tvTag(x.rating_1D)}<div class="sub">1W ${esc(x.rating_1W || "-")}` +
    `${x.pe != null ? " · P/E " + num(x.pe, 1) : ""}${x.dividend_yield_pct != null ? " · yield " + num(x.dividend_yield_pct, 1) + "%" : ""}</div>` : "-";
  const nameOf = id => ((F.roster || []).find(a => a.id === id) || { name: id }).name;

  // -- header chips ---------------------------------------------------------------
  function chips() {
    const b = F.budget || {}, gs = (F.gold || {}).state || {}, e = F.egx;
    const share = b.cap ? b.spent / b.cap : 0;
    const out = [
      `<span class="chip ${share > 0.85 ? "warn" : ""}">AI budget <b>${usd(b.spent)}</b> of ${usd(b.cap, 0)} (${esc(b.month || "")}), on pace for ${usd(b.projected)}</span>`,
      F.gold && F.gold.enabled === false ? `<span class="chip">Gold desk <b>OFF</b> (gold is in the swing $100)</span>` : `<span class="chip">Gold desk <b>${esc((gs.mode_note || (F.gold.config || {}).mode || "paper").toUpperCase())}</b></span>`,
      F.swing ? `<span class="chip">Swing desk <b>${usd(((F.swing.state || {}).account || {}).equity_usd != null ? F.swing.state.account.equity_usd : 100)}</b> · ${num(Object.keys((F.swing.state || {}).positions || {}).length)} open</span>` : "",
      F.lab ? `<span class="chip">Strategy Lab <b>${num((F.lab.counts || {}).PASS || 0)}</b> pass of ${num((F.lab.rows || []).length)}</span>` : "",
      `<span class="chip">EGX data <b>${esc(e ? e.session : "none")}</b>${e && e.universe ? ` · <b>${num(e.eligible)}</b> stocks` : ""}</span>`,
      `<span class="chip">Updated <b>${esc(ago(F.generated_at))}</b></span>`,
    ];
    const ls = F.llm_status || {};
    if (ls.ok === false) out.unshift(`<span class="chip warn">Agents offline: <b>${esc(ls.detail)}</b></span>`);
    if (e && e.warnings && e.warnings.length) out.push(`<span class="chip warn">${esc(e.warnings.length)} data warning${e.warnings.length > 1 ? "s" : ""}</span>`);
    $("#chips").innerHTML = out.join("");
  }

  // -- your money -------------------------------------------------------------------
  function orderLine(o) {
    const buy = o.action === "BUY" || o.action === "ADD";
    const head = `<span class="tag ${buy ? "buy" : "sell"}">${esc(o.action)}</span><span class="act">${num(o.shares)} ${esc(o.ticker)}</span> <span class="sub">${esc(o.name || "")}</span>`;
    const fees = o.est_fees_egp != null ? ` + ${num(o.est_fees_egp, 2)} Thndr fees` : "";
    const body = buy
      ? `Thndr: Buy, Limit <b>${px(o.limit)} EGP</b>, quantity <b>${num(o.shares)}</b>. Don't chase above ${px(o.chase_max)}.
         ${egp(o.value_egp)}${fees} = <b>${egp(o.cash_needed_egp != null ? o.cash_needed_egp : o.value_egp)}</b>.`
      : `Thndr: Sell, Limit <b>${px(o.limit)} EGP</b>, quantity <b>${num(o.shares)}</b>.
         ${egp(o.value_egp)}${fees.replace("+", "-")} = <b>${egp(o.cash_back_egp != null ? o.cash_back_egp : o.value_egp)}</b> back.`;
    const nw = o.fresh_news ? `<div class="sub">News check: <b class="${o.fresh_news.verdict === "AGAINST" ? "down" : o.fresh_news.verdict === "SUPPORTS" ? "up" : ""}">${esc(o.fresh_news.verdict)}</b>. ${esc(o.fresh_news.summary || "")}</div>` : "";
    return `<li class="${buy ? "buy" : "sell"}">${head}<div class="sub">${body}</div>${nw}</li>`;
  }

  function money() {
    const e = F.egx, cfg = F.egx_config || {};
    if (e) {
      const p = e.portfolio;
      $("#money-egx").innerHTML = `<h2>EGX portfolio</h2>
        <div class="big">${egp(p.total)}</div>
        <div class="sub"><span class="${cls(p.pnl_vs_start)}">${p.pnl_vs_start >= 0 ? "+" : ""}${egp(p.pnl_vs_start)} (${pct(p.pnl_vs_start_pct, 2)})</span> vs ${egp(e.start_capital)} start</div>
        <div class="kv" style="margin-top:8px"><span>Cash</span><span>${egp(p.cash)}</span><span>In stocks</span><span>${egp(p.invested)}</span>
        <span>Holdings</span><span>${(e.holdings || []).length}</span><span>Tracking</span><span>${esc(e.portfolio_source)}</span></div>
        <div id="egx-chart"></div>`;
      if (window.FloorCharts) FloorCharts.egx($("#egx-chart"), F, 150);
      const orders = e.orders || [];
      $("#money-todo").innerHTML = `<h2>Do this next (EGX, next session)</h2>` +
        (orders.length ? `<ul class="todo">${orders.map(orderLine).join("")}</ul>`
          : `<p class="sub">${esc(e.no_trade_reason || ((e.vetoed || []).length ? "Proposals are waiting for the Judge" + ((F.llm_status || {}).ok === false ? " (agents offline: " + F.llm_status.detail + ")" : "") + ". See What to buy & sell." : "Nothing to do. Hold what you have."))}</p>`) +
        `<p class="sub" style="margin-top:8px">Limit orders, valid for one session. Prices from ${esc(e.session)} close.</p>`;
    } else {
      $("#money-egx").innerHTML = `<h2>EGX portfolio</h2><div class="big">${egp(cfg.starting_capital_egp)}</div><p class="sub">EGX desk has not run yet.</p>`;
      $("#money-todo").innerHTML = `<h2>Do this next</h2>${empty("Waiting for the first EGX run.")}`;
    }
    const g = F.gold || {}, gs = g.state || {}, snap = g.snapshot, pos = gs.position;
    let posHtml = `<p class="sub">No open trade.</p>`;
    if (pos && snap) {
      const px = pos.direction === "LONG" ? snap.features.bid : snap.features.offer;
      const u = (px - pos.entry) * pos.size * (pos.direction === "LONG" ? 1 : -1);
      posHtml = `<div class="kv"><span>Open</span><span><b>${esc(pos.direction)}</b> ${num(pos.size, 2)} oz @ ${num(pos.entry, 2)}</span>
        <span>Stop / target</span><span>${num(pos.stop, 2)} / ${num(pos.target, 2)}</span>
        <span>Open P&amp;L</span><span class="${cls(u)}">${usd(u)}</span><span>Since</span><span>${esc(ago(pos.opened_at))}</span></div>`;
    }
    if ((F.gold || {}).enabled === false) {
      const gt = ((F.swing || {}).state || {}).tv || {}, gp = ((F.swing || {}).state || {}).positions || {};
      $("#money-gold").innerHTML = `<h2>Gold (XAUUSD)</h2><p>The gold day-trading desk is switched off. Gold now trades inside the swing desk's shared $100.</p>
        <p class="sub">${gp.GOLD ? `Swing desk holds gold ${esc(gp.GOLD.direction)} ${esc(gp.GOLD.size)} oz.` : "No gold position in the swing desk."}${gt.GOLD ? ` TradingView ${num(gt.GOLD.price, 2)}, daily ${esc(gt.GOLD.ratings["1D"])}.` : ""}</p>`;
    } else
    $("#money-gold").innerHTML = `<h2>Gold desk (XAUUSD)</h2>
      <div class="big">${usd(gs.equity_usd != null ? gs.equity_usd : (g.config || {}).paper_equity_usd)}</div>
      <div class="sub">Today <span class="${cls(gs.pnl_today_usd)}">${usd(gs.pnl_today_usd || 0)}</span> · ${num(gs.trades_today || 0)} trade(s) · price ${snap ? num(snap.features.price, 2) : "-"}</div>
      <div style="margin-top:8px">${posHtml}</div>
      <p class="note" style="margin-top:8px">${esc(gs.status || "Not started")}</p>
      <p class="sub">Last check ${esc(ago(gs.last_cycle))}. Margin per trade: ${num(((g.config || {}).margin_pct_of_equity || 0.01) * 100, 0)}% of the gold budget.</p>`;
    const d = F.director && F.director.note;
    $("#money-director").innerHTML = `<h2>Director's note</h2>` + (d
      ? `<p>${esc(d.note)}</p>${(d.issues || []).length ? `<ul>${d.issues.map(i => `<li class="warnc">${esc(i)}</li>`).join("")}</ul>` : ""}<p class="sub">${esc(ago(F.director.as_of))}</p>`
      : empty("The Director writes a note after each EGX run."));
  }


  // -- FX & crypto desk + Strategy Lab ------------------------------------------------------
  const verdictTag = v => `<span class="tag ${v === "PASS" ? "buy" : v === "PROMISING" ? "hold" : "sell"}">${esc(v || "-")}</span>`;
  const bps = (n, d = 2) => n == null ? "-" : `<span class="${cls(n)}">${n > 0 ? "+" : ""}${num(n, d)}</span>`;
  const sizeTxt = (epic, size) => epic === "BTCUSD" ? `${num(size, 4)} BTC` : `${num(size)} units`;

  function fxOpenRows() {
    const fx = F.fx || {}, st = fx.state || {}, q = fx.quotes || {};
    return (st.positions || []).map(p => {
      const qq = q[p.epic] || {}, now = p.direction === "LONG" ? qq.bid : qq.offer;
      const mv = now != null ? (now / p.entry - 1) * 1e4 * (p.direction === "LONG" ? 1 : -1) : null;
      const usdNow = mv != null && p.notional_usd ? mv * 1e-4 * p.notional_usd : null;
      return [`<b>${esc(p.epic)}</b>`, `<span class="tag ${p.direction === "LONG" ? "buy" : "sell"}">${esc(p.direction)}</span>`,
        sizeTxt(p.epic, p.size), px(p.entry), px(now), bps(mv, 1), usd(usdNow, 3),
        `${esc(p.strategy === "OWNER" ? "Your rule" : p.strategy)} ${verdictTag(p.verdict)}${p.forced ? `<div class="sub">one-trade-a-day rule</div>` : ""}${p.judge_view ? `<div class="sub">Judge would ${p.judge_view === "APPROVE" ? "take" : "skip"} it</div>` : ""}`,
        p.stop != null ? `${px(p.stop)} / ${px(p.target)}` : "-",
        p.planned_exit_utc ? esc(p.planned_exit_utc.slice(11, 16)) + " UTC" : "stop or target"];
    });
  }

  function moneyFx() {
    const fx = F.fx, ca = F.capital_account;
    if (!fx) { $("#money-fx").innerHTML = ""; return; }
    const st = fx.state || {}, sb = fx.scoreboard || {}, all = sb.all || {};
    const open = (st.positions || []).map(p => `<li><b>${esc(p.epic)}</b> ${esc(p.direction)} ${sizeTxt(p.epic, p.size)} @ ${px(p.entry)}, exits ${esc((p.planned_exit_utc || "").slice(11, 16))} UTC</li>`).join("");
    $("#money-fx").innerHTML = `<h2>FX &amp; crypto desk (Capital.com)</h2>
      ${ca ? `<div class="big">${usd(ca.balance_usd)}</div><div class="sub">One Capital.com paper account: gold ${usd(ca.gold_realized_usd || 0)} + FX/BTC ${usd(ca.fx_realized_usd || 0)} since start (${usd(ca.start_usd, 0)})</div>` : ""}
      <div class="kv" style="margin-top:8px"><span>Today</span><span class="${cls(st.pnl_today_usd)}">${usd(st.pnl_today_usd || 0, 3)} · ${num(st.trades_today || 0)} trade(s)</span>
      <span>All trades</span><span>${num(all.n || 0)} · ${usd(all.net_usd || 0, 3)}${all.avg_bps != null ? ` · avg ${num(all.avg_bps, 1)} bps` : ""}</span>
      <span>Size</span><span>Smallest deal only (100 units, 0.0001 BTC)</span>
      <span>Holding</span><span>Your rule: until stop or target (overnight allowed if costs are beaten)</span></div>
      ${open ? `<ul style="margin:8px 0 0">${open}</ul>` : ""}
      <p class="note" style="margin-top:8px">${esc(st.status || "Not started")}</p>
      <p class="sub">Last check ${esc(ago(st.last_cycle))}. Overnight funding is charged at Capital.com's rates when a trade is held past 22:00 UK time.</p>`;
  }

  function tabFx() {
    const fx = F.fx;
    if (!fx) return empty("The FX & crypto desk is switched off.");
    const st = fx.state || {}, snap = fx.snapshot || {}, sb = fx.scoreboard || {}, cfgx = fx.config || {};
    const cands = (snap.candidates_all || []).map(c => [`<b>${esc(c.epic)}</b>`, esc(c.direction), `${esc(c.strategy)} <span class="sub">${esc(c.name)}</span>`,
      verdictTag(c.verdict), esc((c.exit_utc || "").slice(11, 16)), c.holdout ? `${bps(c.holdout.mean_bps)} (${num(c.holdout.n_trades)})` : "-"]);
    const trades = (fx.trades || []).slice().reverse().slice(0, 25).map(t => [esc((t.opened_at || "").slice(5, 16).replace("T", " ")),
      `<b>${esc(t.epic)}</b>`, esc(t.direction), sizeTxt(t.epic, t.size), px(t.entry), px(t.exit), bps(t.move_bps, 1),
      `${usd(t.net_pnl_usd, 3)}${t.overnight_charges ? `<div class="sub">${num(t.overnight_charges)} overnight charge(s): ${usd(t.overnight_usd, 4)}</div>` : ""}`,
      `${esc(t.strategy)} ${verdictTag(t.verdict)}${t.forced ? " <span class=\"sub\">daily rule</span>" : ""}`, esc(t.exit_reason)]);
    const quotes = Object.entries(fx.quotes || {}).map(([e, q]) => [`<b>${esc(e)}</b>`, px(q.bid), px(q.offer), num(q.spread_bps, 2),
      e === "BTCUSD" ? num(q.min_size, 4) : num(q.min_size), num((q.margin_factor || 0) * 100, 2) + "%", esc(q.status)]);
    const sh = Object.entries(fx.shadow || {}).sort((a, b) => (b[1].t_nw || -9) - (a[1].t_nw || -9)).map(([k, v]) => [esc(k.replace("|", " ")),
      num(v.n), bps(v.mean_bps), v.t_nw == null ? "-" : num(v.t_nw, 2), v.p_one_sided == null ? "-" : num(v.p_one_sided, 3),
      v.holm_survives ? `<span class="up">significant</span>` : v.enough ? "not significant" : "collecting"]);
    const m = (fx.meetings || []).slice(-1)[0];
    const tick = ok => ok ? `<span class="up">yes</span>` : `<span class="sub">no</span>`;
    const sgn = v => v == null ? "-" : `<span class="${cls(v)}">${v > 0 ? "up" : v < 0 ? "down" : "flat"}</span>`;
    const owner = (snap.owner_panel || []).map(r => {
      const side = r.long_ok ? "LONG" : r.short_ok ? "SHORT" : null;
      const dir = r.long_ok ? 1 : r.short_ok ? -1 : (r.bias && r.bias.D1 > 0 ? 1 : -1);
      return [`<b>${esc(r.epic)}</b>`, sgn(r.bias && r.bias.D1), sgn(r.bias && r.bias.H4), sgn(r.channel_15m),
        tick(dir > 0 ? r.close > r.sma200 : r.close < r.sma200), tick(dir > 0 ? r.close > r.sma50 : r.close < r.sma50),
        tick(dir > 0 ? r.close > r.sma18 : r.close < r.sma18),
        side ? `<span class="tag ${side === "LONG" ? "buy" : "sell"}">${side}${r.fresh ? " NEW" : ""}</span>` : `<span class="sub">not aligned</span>`,
        r.holdout && r.holdout.n_trades ? `${bps(r.holdout.mean_bps)} <span class="sub">(${num(r.holdout.n_trades)})</span>` : "-",
        verdictTag(r.verdict)];
    });
    const by = Object.entries(sb.by_strategy || {}).map(([k, v]) => [esc(k), num(v.n), usd(v.net_usd, 3), v.avg_bps == null ? "-" : num(v.avg_bps, 2), num(v.wins)]);
    return `<h3>How this desk trades</h3>
      <p class="sub">11 forex pairs and BTCUSD on Capital.com, paper mode (live prices, simulated fills). Every entry is the <b>smallest deal Capital.com allows</b>. Trades from your rule hold until their stop or target, overnight if needed, and pay Capital.com's overnight funding (charged at 22:00 UK time; forex and gold triple on Wednesday, none at weekends; BTC every night). They only open when the target beats twice the spread plus the expected overnight cost. Lab-signal and daily-slot trades still close by ${esc(cfgx.flat_by_utc)} UTC. If nothing has traded by ${esc(cfgx.daily_trade_utc)} UTC, the Judge must pick one trade (your one-trade-a-day rule). Strategies with lab verdict ${esc((cfgx.trade_verdicts || []).join(" or "))} may trade on their own signals; none has earned that yet (see Strategy Lab).</p>
      <p class="note">${esc(st.status || "Not started")}${st.daily_rule ? " · " + esc(st.daily_rule) : ""}</p>
      <h3>Open positions</h3>${table(["Market", "Side", "Size", "Entry", "Now", "bps", "Open P&L", "Why", "Stop / target", "Exit by"], fxOpenRows(), [2, 3, 4, 5, 6])}
      <h3>Your rule, market by market (last closed 15-min bar)</h3>
      <p class="sub">Bias = bull or bear regime measured against the market's normal drift (Markov-switching model, version 2). A trade opens when the daily and 4-hour bias, the 15-minute channel and price vs the 200, 50 and 18 moving averages all point the same way. Stop and target come from the volume profile (LuxAlgo method). "Backtest" is the out-of-sample result (Apr to Oct 2026) after Capital.com's spread.</p>
      ${table(["Market", "Daily bias", "4h bias", "15m channel", "SMA 200", "SMA 50", "SMA 18", "Status", "Backtest bps/trade", "Verdict"], owner, [8])}
      <h3>Strategy signals this slot (${esc((snap.slot || "").slice(11, 16))} UTC)</h3>
      ${table(["Market", "Side", "Strategy", "Lab verdict", "Exit UTC", "Holdout bps/trade (n)"], cands, [5])}
      <h3>Trades</h3>${table(["Opened (UTC)", "Market", "Side", "Size", "Entry", "Exit", "bps", "Net", "Strategy", "Exit reason"], trades, [3, 4, 5, 6, 7])}
      <h3>Results by strategy</h3>${table(["Strategy", "Trades", "Net", "Avg bps", "Wins"], by, [1, 2, 3, 4])}
      <h3>Shadow book: every signal, traded or not, graded on new data</h3>
      <p class="sub">A fresh test no lab choice has seen. A strategy needs 30+ signals and must survive the Holm correction before it counts as significant.</p>
      ${table(["Strategy | market", "Signals", "Avg net bps", "t (Newey-West)", "p", "Status"], sh, [1, 2, 3, 4])}
      ${m ? `<h3>Last meeting ${m.forced ? "(daily trade slot)" : ""}: <span class="stamp ${m.decision === "APPROVE" ? "up" : "down"}">${esc(m.decision)}</span></h3>
        <div class="transcript">${(m.transcript || []).map(l => `<p><b>${esc(nameOf(l.agent))}</b> ${esc(l.line)}</p>`).join("")}</div>
        ${m.judge_reasoning ? `<p class="note">${esc(m.judge_reasoning)}</p>` : ""}` : ""}
      <h3>Capital.com quotes (last check)</h3>${table(["Market", "Bid", "Offer", "Spread bps", "Smallest deal", "Margin", "Status"], quotes, [1, 2, 3, 4, 5])}`;
  }

  function tabLab() {
    const L = F.lab;
    if (!L) return empty("The Strategy Lab has not produced results yet.");
    const c = L.counts || {};
    const rows = (L.rows || []).map(r => {
      const md = r.mechanism_dev || {}, mh = r.mechanism_holdout || {}, d = r.dev || {}, h = r.holdout || {};
      return [`<b>${esc(r.strategy)}</b>`, esc(r.epic), `${num(md.coef, 3)}<div class="sub">p ${num(md.p, 4)}</div>`,
        mh.coef != null ? `${num(mh.coef, 3)}<div class="sub">p ${mh.p == null ? "-" : num(mh.p, 3)}</div>` : "-",
        d.n_trades ? `${bps(d.mean_bps)}<div class="sub">${num(d.n_trades)} trades, t ${num(d.t_nw, 2)}</div>` : "-",
        h.n_trades ? `${bps(h.mean_bps)}<div class="sub">${num(h.n_trades)} trades, t ${num(h.t_nw, 2)}</div>` : "-",
        r.carried ? "yes" : "no", verdictTag(r.verdict)];
    });
    const formulas = Object.entries(L.formulas || {}).map(([k, v]) => `<li><b>${esc(k)}</b> <code>${esc(v)}</code></li>`).join("");
    const o = L.owner_rule;
    const orows = o ? (o.rows || []).map(r => {
      const d = r.dev || {}, h = r.holdout || {}, ex = r.exits || {};
      return [`<b>${esc(r.epic)}</b>`, d.n_trades ? `${bps(d.mean_bps)}<div class="sub">${num(d.n_trades)} trades, t ${num(d.t_nw, 2)}</div>` : "-",
        h.n_trades ? `${bps(h.mean_bps)}<div class="sub">${num(h.n_trades)} trades, t ${num(h.t_nw, 2)}, p ${num(h.p_one_sided, 3)}</div>` : "-",
        `${num((ex.stop || 0) * 100)}% / ${num((ex.target || 0) * 100)}%`, verdictTag(r.verdict)];
    }) : [];
    const ownerHtml = o ? `<h3>Your rule, version 2 (bias vs normal drift + channel + SMA 200/50/18 + volume profile, holds overnight)</h3><p>${esc(o.headline || "")}</p>
      <ul>${(o.findings || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      ${table(["Market", "Oct 2024 to Mar 2026", "Apr to Oct 2026 (out of sample)", "Exits: stop / target", "Verdict"], orows)}
      <p class="sub">Rules locked before testing: lab/PREREG_OWNER.md, fingerprint ${esc((o.prereg_sha256 || "").slice(0, 12))}.</p>` : "";
    const I = F.ideas;
    const irows = I ? (I.rows || []).map(x => {
      const c = x.confirm || {}, e = x.explore || {};
      return [`<b>${esc(x.sym)}</b>`, `${esc(x.name)}<div class="sub">${esc(x.note)}</div>`,
        e.n ? `${bps(e.mean_bps)}<div class="sub">${num(e.n)} trades, t ${num(e.t, 2)}</div>` : "-",
        c.n ? `${bps(c.mean_bps)}<div class="sub">${num(c.n)} trades, p ${num(c.p, 3)}, placebo p ${num(c.placebo_p, 2)}</div>` : "-",
        verdictTag(x.verdict === "NOT CARRIED" ? "FAIL" : x.verdict) + (x.verdict === "NOT CARRIED" ? `<div class="sub">not carried</div>` : "")];
    }) : [];
    const ideasHtml = I ? `<h3>13 ideas, one per market (trial and error)</h3><p>${esc(I.headline || "")}</p>
      <div class="kv"><span>Pass</span><span>${num((I.counts || {}).PASS || 0)}</span><span>Promising</span><span>${num((I.counts || {}).PROMISING || 0)}</span>
      <span>Fail</span><span>${num((I.counts || {}).FAIL || 0)}</span><span>Not carried</span><span>${num((I.counts || {})["NOT CARRIED"] || 0)}</span></div>
      ${table(["Market", "Idea and what we learned", "Explore", "Confirm (unseen data)", "Verdict"], irows)}
      <p class="sub">Each idea: one pre-registered rule, settings chosen only on the explore years, then one look at years it had never seen, with real costs, a 200-draw random-entry placebo and buy-and-hold benchmarks. Rules: ideas/PREREG.md.</p>` : "";
    return `${ideasHtml}${ownerHtml}<h3>The 7 lab strategies: short answer</h3><p>${esc(L.headline || "")}</p>
      <div class="kv"><span>Pass</span><span>${num(c.PASS || 0)}</span><span>Promising</span><span>${num(c.PROMISING || 0)}</span><span>Fail</span><span>${num(c.FAIL || 0)}</span>
      <span>Settings tried</span><span>${num(L.trials)} on the first 18 months; ${num(L.family_size)} carried to the locked-away 6 months</span>
      <span>Rules locked</span><span>before the test: lab/PREREG.md, fingerprint ${esc((L.prereg_sha256 || "").slice(0, 12))}</span></div>
      <h3>What we found</h3><ol>${(L.findings || []).map(f => `<li>${esc(f)}</li>`).join("")}</ol>
      <h3>What the desk does with it</h3><p>${esc(L.desk_rule || "")}</p>
      <h3>The formula behind each strategy (course methods)</h3><ul>${formulas}</ul>
      <h3>Every test</h3>
      <p class="sub">"Why it should work" is the econometric test of the idea itself (DiD coefficient, GMM slope, Wald or LR statistic). bps are hundredths of a percent per trade after Capital.com's real bid/ask spread. Dev = Oct 2024 to Mar 2026. Holdout = Apr to Oct 2026, opened once with frozen settings.</p>
      ${table(["", "Market", "Why it should work (dev)", "Same test, holdout", "Dev net/trade", "Holdout net/trade", "Carried?", "Verdict"], rows)}`;
  }


  function moneySwing() {
    const S = F.swing;
    if (!S) return false;
    const st = S.state || {}, a = st.account || {}, start = a.start_usd || 100, eq = a.equity_usd != null ? a.equity_usd : start;
    const open = Object.entries(st.positions || {}).map(([p, v]) => `<li><b>${esc(p)}</b> ${esc(v.direction)} ${esc(v.size)} @ ${px(v.entry)}: <span class="${cls(v.upnl_usd)}">${usd(v.upnl_usd)}</span></li>`).join("");
    $("#money-fx").innerHTML = `<h2>Swing desk: forex, BTC, gold ($100, 1:100)</h2>
      <div class="big">${usd(eq)}</div><div class="sub"><span class="${cls(eq - start)}">${usd(eq - start)}</span> since start · margin ${usd(a.margin_used_usd)} in use</div>
      ${open ? `<ul style="margin:8px 0 0">${open}</ul>` : `<p class="sub">No open trades.</p>`}
      ${F.arb ? `<p class="sub">BTC arbitrage desk (inside this $100): ${(F.arb.state || {}).position ? esc(F.arb.state.position.direction) + " " + esc(F.arb.state.position.size) + " BTC open" : "flat"}, net ${usd((F.arb.state || {}).realized_usd || 0, 3)}.</p>` : ""}
      <div id="usd-chart"></div>
      <p class="note" style="margin-top:8px">${esc(st.status || "Not started")}</p><p class="sub">Last check ${esc(ago(st.last_cycle))}.</p>`;
    if (window.FloorCharts) FloorCharts.usd($("#usd-chart"), F, 150);
    return true;
  }

  function tabSwing() {
    const S = F.swing;
    if (!S) return empty("The swing desk is switched off.");
    const st = S.state || {}, cfg = S.config || {};
    const dirT = v => v > 0 ? `<span class="tag buy">LONG</span>` : v < 0 ? `<span class="tag sell">SHORT</span>` : `<span class="tag hold">NEUTRAL</span>`;
    const open = Object.entries(st.positions || {}).map(([p, v]) => [`<b>${esc(p)}</b>`, dirT(v.direction === "LONG" ? 1 : -1), esc(v.size), px(v.entry), px(v.last_mid),
      `<span class="${cls(v.upnl_usd)}">${usd(v.upnl_usd, 3)}</span>`, usd(v.margin_usd), dirT(v.fund_view_now), dirT(v.quant_view_now), esc(v.review_hours) + " h", esc(ago(v.opened_at))]);
    const pairs = (cfg.pairs || []).map(p => {
      const ps = (st.pairs || {})[p] || {}, f = ps.fund || {}, q = ps.quant || {};
      const tv = (st.tv || {})[p];
      return [`<b>${esc(p)}</b>${tv ? `<div class="sub"><a href="${esc(tv.chart_url)}" target="_blank" rel="noopener">${esc(tv.symbol)}</a> ${px(tv.price)}</div><div class="sub">1h ${esc(tv.ratings["1h"])} · 4h ${esc(tv.ratings["4h"])} · 1D ${esc(tv.ratings["1D"])} · 1W ${esc(tv.ratings["1W"])}</div>` : ""}`,
        `${dirT(f.view)} ${f.value != null ? num(f.value, 2) : ""}`, q.regime ? `${esc(q.regime)} ${num(q.p_bull, 2)}` : "-",
        esc(q.regime_age_days != null ? q.regime_age_days + " d" : "-"), (st.positions || {})[p] ? "IN TRADE" : ps.aligned ? "ALIGNED" : "waiting", esc(ps.next_review ? ps.next_review.slice(5, 16).replace("T", " ") : "-")];
    });
    const views = Object.entries(st.ccy_views || {}).sort().map(([c, v]) => [`<b>${esc(c)}</b>`, esc(v.rating), num(v.confidence, 2), esc(v.horizon_days), esc(v.reason), esc(ago(v.ts))]);
    const trades = (S.trades || []).slice().reverse().slice(0, 25).map(t => [esc((t.opened_at || "").slice(5, 16).replace("T", " ")), `<b>${esc(t.pair)}</b>`, esc(t.direction),
      px(t.entry), px(t.exit), `<span class="${cls(t.pnl_usd)}">${usd(t.pnl_usd, 3)}</span>`, esc(t.held_days), esc(t.exit_reason)]);
    const mt = (S.meetings || []).slice(-1)[0], jd = mt && mt.judge;
    return `<h3>How it trades</h3><p class="sub">11 forex pairs, BTCUSD and gold share one $${esc(cfg.start_usd || 100)} paper budget at 1:${esc(cfg.leverage)}, costs ignored. A trade opens when the currency analysts' fundamental view and the pair's regime model agree and the Swing Judge approves; CRRA (gamma ${esc(cfg.gamma)}) sizes it. No stop, no target: it closes only when both views reverse, then the agents meet on that pair again.</p>
      <p class="note">${esc(st.status || "Not started")}</p>
      <h3>Open trades</h3>${table(["Pair", "Side", "Size", "Entry", "Now", "P&L", "Margin", "Fundamentals now", "Quant now", "Review every", "Opened"], open, [2, 3, 4, 5, 6])}
      <h3>All pairs</h3>${table(["Pair", "Fundamental view", "Regime, P(bull)", "Regime age", "Status", "Next review (UTC)"], pairs)}
      <h3>Last Judge meeting</h3>${mt ? `<p><b>${esc(jd ? jd.headline : "Judge unavailable")}</b> <span class="sub">${esc(ago(mt.ts))}</span></p>${jd ? `<p>${esc(jd.summary)}</p>` +
        table(["Pair", "Decision", "Review every", "Reason"], (jd.decisions || []).map(d => [`<b>${esc(d.pair)}</b>`, esc(d.decision), esc(d.review_hours) + " h", esc(d.reason)])) : ""}` : empty("No meeting yet.")}
      <h3>Currency views</h3>${st.macro ? `<p class="note">${esc(st.macro.risk_mood)}: ${esc(st.macro.summary)}</p>` : ""}${table(["Currency", "Rating", "Confidence", "Horizon (days)", "Why", "When"], views, [2, 3])}
      <h3>Closed trades</h3>${table(["Opened", "Pair", "Side", "Entry", "Exit", "P&L", "Days", "Why closed"], trades, [3, 4, 5, 6])}`;
  }

  function arbSpark(rows) {
    const v = (rows || []).filter(r => r.gap_min != null);
    if (v.length < 2) return "";
    const sp = v[v.length - 1].spread || 50;
    const w = 640, h = 90, lo = Math.min(...v.map(r => r.gap_min), -sp * 1.1), hi = Math.max(...v.map(r => r.gap_max), sp * 1.1);
    const y = x => (h - 6 - (x - lo) / (hi - lo || 1) * (h - 12)).toFixed(1);
    const xs = i => (i / (v.length - 1) * w).toFixed(1);
    const band = v.map((r, i) => `${xs(i)},${y(r.gap_max)}`).join(" ") + " " + v.map((r, i) => `${xs(i)},${y(r.gap_min)}`).reverse().join(" ");
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:90px" role="img" aria-label="Capital.com gap against the exchanges">
      <line x1="0" x2="${w}" y1="${y(sp)}" y2="${y(sp)}" stroke="#ff5a7a" stroke-dasharray="4 4"/><line x1="0" x2="${w}" y1="${y(-sp)}" y2="${y(-sp)}" stroke="#ff5a7a" stroke-dasharray="4 4"/>
      <line x1="0" x2="${w}" y1="${y(0)}" y2="${y(0)}" stroke="#555"/><polygon points="${band}" fill="#19e6ff55" stroke="#19e6ff"/></svg>
      <p class="sub">Blue band: how far Capital.com strayed from its usual place each minute (last ${v.length} min). Red dashes: the $${num(sp, 0)} spread. A trade needs the band to cross a red line.</p>`;
  }

  function tabArb() {
    const A = F.arb;
    if (!A) return empty("The BTC arbitrage desk is switched off.");
    const st = A.state || {}, n = st.now || {}, td = st.today || {}, pb = st.playbook || {}, cfg = A.config || {}, sb = A.scoreboard || {};
    const best = Math.max(td.best_long_edge == null ? -1e9 : td.best_long_edge, td.best_short_edge == null ? -1e9 : td.best_short_edge);
    const sg = (x, d = 1) => { const r = Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x; return (r > 0 ? "+" : "") + num(r, d); };
    const venues = Object.entries(n.venues || {}).map(([k, v]) => [`<b>${esc(k)}</b>${(n.dropped || []).includes(k) ? ' <span class="down">out of line</span>' : ""}`,
      px(v.mid), sg(v.usual_premium), v.vs_fair == null ? "-" : sg(v.vs_fair)]);
    const errs = Object.entries(n.errors || {}).map(([k, e]) => `${esc(k)}: ${esc(e)}`).join("; ");
    const pos = st.position;
    const mt = (A.meetings || []).slice(-1)[0], ld = mt && mt.lead;
    const roles = (st.roles || []).map(r => [`<b>${esc(nameOf(r.agent))}</b>`, esc(r.duties)]);
    const speeches = mt ? (mt.speeches || []).map(s => [`<b>${esc(s.name)}</b>`, esc(s.my_role), esc(s.what_i_see),
      (s.proposals || []).map(p => `${esc(p.param)} = ${esc(p.value)} <span class="sub">(${esc(p.why)})</span>`).join("<br>"), esc(s.to_colleagues)]) : [];
    const book = Object.entries(pb).map(([k, v]) => [esc(k), esc(v), esc((cfg.playbook_default || {})[k]), esc(((cfg.bounds || {})[k] || []).join(" to "))]);
    const trades = (A.trades || []).slice().reverse().map(t => [esc((t.opened_at || "").slice(5, 16).replace("T", " ")), esc(t.direction), esc(t.size),
      px(t.entry), px(t.exit), `${num(t.gap_at_entry, 0)} / ${num(t.edge_at_entry, 0)}`, `<span class="${cls(t.pnl_usd)}">${usd(t.pnl_usd, 3)}</span>`, esc(t.held_min), esc(t.exit_reason)]);
    const kpi = (k, v, c = "") => `<div><div class="k">${k}</div><div class="v ${c}">${v}</div></div>`;
    return `<h3>How it works</h3><p class="sub">You trade on Capital.com only, so the desk cannot buy on one exchange and sell on another. It reads ${esc((cfg.venues || []).length)} big exchanges first, every ${esc(cfg.sample_seconds)} seconds, and builds bitcoin's fair price. Then it compares Capital.com's live price. When Capital.com strays from where it usually sits by more than its spread, the desk buys (Capital.com too cheap) or sells (too dear) on Capital.com, and closes when Capital.com is back in line. Fills are at Capital.com's real bid and ask, inside the swing desk's shared $100 at 1:100. The agents agree the rules in a role meeting; the Trigger applies them instantly, because a gap is gone before a meeting could finish. Capital.com re-prices bitcoin in steps (3 changes in 30 seconds when we measured), so a gap only counts when Capital.com has re-quoted recently: trading against a frozen quote assumes a fill Capital.com would not give.</p>
      <p class="note">${esc(st.status || "Not started")} <span class="sub">Last watch ${esc(ago(st.last_run))}.</span></p>
      <div class="arbkpi">${kpi("Fair price (exchanges)", n.fair ? usd(n.fair, 0) : "-")}${kpi("Capital.com bid / ask", n.cap_bid ? px(n.cap_bid) + " / " + px(n.cap_ask) : "-")}
        ${kpi("Gap from usual place", n.gap != null ? usd(n.gap, 1) : "-")}${kpi("Spread", n.spread != null ? usd(n.spread, 0) : "-")}
        ${kpi("Best edge today", best > -1e8 ? usd(best, 0) : "-", cls(best))}${kpi("Desk P&amp;L", usd(st.realized_usd || 0, 3), cls(st.realized_usd))}</div>
      ${arbSpark(A.minutes)}
      <h3>Open arbitrage trade</h3>${pos ? `<p><b>${esc(pos.direction)}</b> ${esc(pos.size)} BTC at ${px(pos.entry)} (${esc(ago(pos.opened_at))}); gap at entry ${usd(pos.gap_at_entry, 0)}, edge ${usd(pos.edge_at_entry, 0)}; open P&amp;L <span class="${cls(pos.upnl_usd)}">${usd(pos.upnl_usd, 3)}</span>; margin ${usd(pos.margin_usd)}.</p>` : empty("None. " + (st.blocked ? "Last blocked signal: " + st.blocked.why + "." : ""))}
      <h3>Exchanges right now</h3><p class="sub">Capital.com usually sits ${n.offset != null ? usd(n.offset, 1) : "-"} from the fair price; its quote was ${esc(n.quote_age_s)} s old. USDT = ${esc(n.usdt_usd)} USD. Coinbase premium ${esc(n.coinbase_premium_bps)} bps.${errs ? " Not answering: " + errs : ""}</p>
      ${table(["Exchange", "Mid (USD)", "Usual premium ($)", "Vs fair price ($)"], venues, [1, 2, 3])}
      <h3>Futures basis</h3>${st.basis ? `<p class="sub">Funding per 8 h: Binance ${esc(st.basis.binance_funding_pct)}%, Bybit ${esc(st.basis.bybit_funding_pct)}%, OKX ${esc(st.basis.okx_funding_pct)}%. Binance perpetual ${esc(st.basis.binance_perp_premium_bps)} bps over spot. Context for the agents, not a trade: cash-and-carry needs two accounts.</p>` : empty("Not read yet.")}
      <h3>Playbook (agreed in the role meeting)</h3>${table(["Rule", "Now", "Default", "Allowed range"], book, [1, 2])}
      <h3>Who does what</h3>${roles.length ? table(["Agent", "Duties"], roles) : empty("The agents have not held their role meeting yet (it runs after about 5 minutes of watching).")}
      <h3>Last role meeting</h3>${mt ? `<p><b>${esc(ld ? ld.headline : "The Lead could not run")}</b> <span class="sub">${esc(ago(mt.ts))}</span></p>${ld ? `<p>${esc(ld.summary)}</p><p class="note">Outlook: ${esc(ld.honest_outlook)}</p><p class="sub">Debrief: ${esc(ld.debrief)}</p>` : ""}
        ${table(["Agent", "Role", "What it sees", "Proposals", "To colleagues"], speeches)}` : empty("No meeting yet.")}
      <h3>Closed arbitrage trades</h3><p class="sub">${esc(sb.trades || 0)} trades, ${esc(sb.wins || 0)} winners, ${esc(sb.converged || 0)} converged, net ${usd(sb.net_usd || 0, 3)}.</p>
      ${table(["Opened", "Side", "BTC", "Entry", "Exit", "Gap / edge ($)", "P&L", "Minutes", "Why closed"], trades, [2, 3, 4, 6, 7])}`;
  }
  // -- tabs ------------------------------------------------------------------------------
  const TABS = [
    ["orders", "What to buy & sell"], ["holdings", "EGX portfolio"], ["analysis", "Latest analysis"],
    ["gold", "Gold desk"], ["swing", "Swing desk"], ["arb", "BTC arbitrage"], ["fx", "FX & crypto (old)"], ["lab", "Strategy Lab"], ["meetings", "Meetings"], ["report", "Report card"], ["budget", "Budget & agents"], ["how", "How it works"],
  ];

  function tabOrders() {
    const e = F.egx;
    if (!e) return empty("EGX desk has not run yet.");
    const ordRows = (e.orders || []).map(o => [
      `<span class="tag ${o.action === "BUY" || o.action === "ADD" ? "buy" : "sell"}">${esc(o.action)}</span>`,
      `<b>${esc(o.ticker)}</b><div class="sub">${esc(o.name)} · ${esc(o.sector)}</div>`,
      num(o.shares), num(o.price_now, 2), `<b>${num(o.limit, 2)}</b>`, o.chase_max ? num(o.chase_max, 2) : "-",
      egp(o.value_egp), num(o.target_weight * 100, 1) + "%",
      `${num(o.est_fees_egp, 2)}<div class="sub">${egp(o.cash_needed_egp != null ? o.cash_needed_egp : o.cash_back_egp)} ${o.cash_needed_egp != null ? "total" : "back"}</div>`,
      tvBrief(o.tv),
      o.fresh_news ? `<b class="${o.fresh_news.verdict === "AGAINST" ? "down" : o.fresh_news.verdict === "SUPPORTS" ? "up" : ""}">${esc(o.fresh_news.verdict)}</b><div class="sub">${esc(o.fresh_news.summary || "")}</div>` : "-",
      esc(o.analyst ? `${o.analyst.rating} (${num(o.analyst.confidence, 2)}): ${o.analyst.reason}` : "Model only"),
      esc(o.judge || "")]);
    const vet = (e.vetoed || []).map(o => [esc(o.action), `<b>${esc(o.ticker)}</b>`, num(o.shares), num(o.limit, 2), esc(o.judge)]);
    const watch = (e.watchlist || []).map(w => [`<b>${esc(w.ticker)}</b> <span class="sub">${esc(w.name)}</span>`, esc(w.sector),
      num(w.price, 2), pct(w.blended_month_pct, 2), tvBrief(w.tv), esc(w.analyst ? `${w.analyst.rating}: ${w.analyst.reason}` : "-")]);
    return `<h3>Approved orders for the next session</h3>
      <p class="sub">${e.universe ? `Chosen from the ${num(e.universe.liquid || 0)} most-traded EGX stocks (${num(e.eligible)} eligible today). ` : ""}Place these on Thndr as limit orders. "Limit" is the most you pay (buys) or the least you accept (sells). If the price runs above "don't chase", skip it.</p>
      ${table(["Action", "Stock", "Shares", "Last", "Limit", "Don't chase", "Value", "Target weight", "Thndr fees", "TradingView", "News check", "Analyst", "Judge"], ordRows, [2, 3, 4, 5, 6, 7, 8])}
      ${e.no_trade_reason ? `<p class="note">${esc(e.no_trade_reason)}</p>` : ""}
      <h3>Held back</h3><p class="sub">Vetoed by the Judge, or waiting because the Judge could not run.</p>
      ${table(["Action", "Stock", "Shares", "Limit", "Why"], vet, [2, 3])}
      <h3>Watchlist (next best, not bought)</h3>${table(["Stock", "Sector", "Price", "Expected excess / month", "TradingView", "Analyst"], watch, [2, 3])}`;
  }

  function spark(hist) {
    if (!hist || hist.length < 2) return "";
    const v = hist.map(h => h.total), lo = Math.min(...v), hi = Math.max(...v), w = 600, h = 80;
    const pts = v.map((y, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(h - 6 - (hi === lo ? 0.5 : (y - lo) / (hi - lo)) * (h - 12)).toFixed(1)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Portfolio value history"><polyline fill="none" stroke-width="2" points="${pts}"/></svg>
      <p class="sub">${esc(hist[0].session)} to ${esc(hist[hist.length - 1].session)}: ${egp(lo)} low, ${egp(hi)} high</p>`;
  }

  function tabHoldings() {
    const e = F.egx;
    if (!e) return empty("EGX desk has not run yet.");
    const rows = (e.holdings || []).map(h => [`<b>${esc(h.ticker)}</b><div class="sub">${esc(h.name)}</div>`, esc(h.sector), num(h.shares),
      num(h.avg_cost, 2), num(h.price, 2), egp(h.value), `<span class="${cls(h.pnl)}">${egp(h.pnl)} (${pct(h.pnl_pct, 1)})</span>`,
      num(h.weight * 100, 1) + "%", num(h.target_weight * 100, 1) + "%", `<span class="tag ${h.action === "HOLD" ? "hold" : h.action === "SELL" || h.action === "TRIM" ? "sell" : "buy"}">${esc(h.action)}</span>`,
      num(h.review_below, 2), tvBrief(h.tv)]);
    const fills = (e.recent_fills || []).slice().reverse().map(f => [esc(f.date), esc(f.action), esc(f.ticker), num(f.shares), f.price ? num(f.price, 2) : "-", esc(f.note || (f.realized_pnl != null ? "P&L " + egp(f.realized_pnl) : ""))]);
    return `<h3>Holdings</h3>
      <p class="sub">"Review below" is two monthly standard deviations under today's price: a fall that far is unusual and worth a fresh look.</p>
      ${table(["Stock", "Sector", "Shares", "Avg cost", "Price", "Value", "P&L", "Weight", "Target", "Action", "Review below", "TradingView"], rows, [2, 3, 4, 5, 6, 7, 8, 10])}
      <h3>Value over time</h3>${spark(F.egx_history) || empty("Builds up after a few daily runs.")}
      <h3>Recent fills (paper)</h3>${table(["Date", "Action", "Stock", "Shares", "Price", "Note"], fills, [3, 4])}
      <p class="sub">Bought or sold for real? Put what you actually hold in <code>state/egx_my_holdings.json</code> and the desk will use it (see README).</p>`;
  }

  function tabAnalysis() {
    const e = F.egx;
    if (!e) return empty("EGX desk has not run yet.");
    const j = e.judge, m = e.macro, h = e.habit || {}, t = e.crra_target || {}, c = e.crra_current || {};
    const sectors = Object.entries(e.sector_views || {}).map(([id, v]) => `<div class="note"><b>${esc(nameOf(id))}</b> <span class="tag ${v.view === "POSITIVE" ? "buy" : v.view === "NEGATIVE" ? "sell" : "hold"}">${esc(v.view)}</span><div>${esc(v.summary)}</div></div>`).join("");
    const ratings = Object.entries(e.ratings || {}).sort((a, b) => a[0].localeCompare(b[0])).map(([tk, r]) => [`<b>${esc(tk)}</b>`, esc(r.rating), num(r.confidence, 2), esc(r.reason)]);
    return `<h3>The Judge's read (${esc(e.session)})</h3>` +
      (j ? `<p class="big" style="font-size:18px">${esc(j.headline)}</p><p>${esc(j.summary)}</p><ul>${(j.key_points || []).map(k => `<li>${esc(k)}</li>`).join("")}</ul>
          ${(j.warnings || []).length ? `<p><b>Warnings</b></p><ul>${j.warnings.map(w => `<li class="warnc">${esc(w)}</li>`).join("")}</ul>` : ""}`
        : empty("No Judge review this run (no proposals, budget pause, or API down)."))
      + `<div class="grid2"><div><h3>Habit-CCAPM state</h3><div class="kv">
          <span>Market last month</span><span>${pct(h.g_t_month_pct, 2)} (z ${num(h.g_z_score, 2)})</span>
          <span>Habit adjustment</span><span>${pct(h.habit_shift_month_pct, 2)} per month</span>
          <span>CBE rate (cash)</span><span>${pct(h.rf_cbe_month_pct, 2)} per month</span>
          <span>gamma / delta / w</span><span>${num(h.gamma, 1)} / ${num(h.delta, 2)} / ${num(h.w_habit, 2)}</span></div>
          <p class="note">${esc(h.mood || "")}</p></div>
        <div><h3>CRRA risk control</h3><div class="kv">
          <span>Stocks / cash</span><span>${num(t.equity_share_pct, 0)}% / ${num(t.cash_share_pct, 0)}%</span>
          <span>Expected return</span><span>${pct(t.exp_total_year_pct, 1)} a year (model)</span>
          <span>Volatility</span><span>${num(t.vol_year_pct, 1)}% a year</span>
          <span>Certainty equivalent</span><span>${pct(t.ce_excess_month_pct, 2)} a month over cash (now ${pct(c.ce_excess_month_pct, 2)})</span></div>
          <p class="sub">Model expected returns are noisy estimates, not promises.</p></div></div>
        <h3>Macro & Pound Strategist</h3>${m ? `<p><span class="tag hold">EGP ${esc(m.egp_outlook)}</span><span class="tag hold">CBE ${esc(m.rates_outlook)}</span><span class="tag hold">${esc(m.equity_mood)}</span></p><p>${esc(m.summary)}</p>` : empty("Unavailable this run.")}
        <h3>Sector analysts</h3>${sectors || empty("Unavailable this run.")}
        <h3>Every stock rating</h3>${table(["Stock", "Rating", "Confidence", "Reason"], ratings, [2])}`;
  }

  function tvGoldSection(f) {
    const tv = f.tradingview;
    if (!tv) return `<h3>TradingView (second feed)</h3>${empty("TradingView was unreachable this cycle.")}`;
    const tfs = Object.keys(tv.ratings || {});
    const ind = tv.indicators_15m || {}, i1 = tv.indicators_1h || {}, pv = tv.pivots_daily || {};
    const gap = f.feed_gap_bps;
    return `<h3>TradingView (second feed, ${esc(tv.feed || "")})</h3>
      <div class="kv"><span>OANDA:XAUUSD</span><span>${num(tv.price, 2)} vs Capital.com ${num(f.price, 2)}
        (<span class="${Math.abs(gap) > 25 ? "down" : ""}">${gap > 0 ? "+" : ""}${num(gap, 1)} bps</span>)</span>
        <span>15m MAs / oscillators</span><span>${esc(tv.ma_vs_oscillators_15m || "")}</span></div>
      ${table(["Timeframe", ...tfs], [["Rating (26 indicators)", ...tfs.map(t => `${tvTag(tv.ratings[t])} <span class="sub">${num((tv.rating_scores || {})[t], 2)}</span>`)]])}
      <div class="grid2"><div><div class="kv">
        <span>RSI 15m / 1h</span><span>${num(ind.rsi, 1)} / ${num(i1.rsi, 1)}</span>
        <span>MACD hist 15m</span><span class="${cls(ind.macd_hist)}">${num(ind.macd_hist, 2)}</span>
        <span>ADX 15m (+DI / -DI)</span><span>${num(ind.adx, 1)} (${num(ind["adx+di"], 1)} / ${num(ind["adx-di"], 1)})</span>
        <span>ADX 1h</span><span>${num(i1.adx, 1)}</span>
        <span>Stoch K / D</span><span>${num(ind.stoch_k, 1)} / ${num(ind.stoch_d, 1)}</span>
        <span>CCI / Williams %R</span><span>${num(ind.cci20, 0)} / ${num(ind.w_r, 0)}</span></div></div>
      <div><div class="kv">
        <span>VWAP 15m</span><span>${num(ind.vwap, 2)}</span>
        <span>Bollinger 15m</span><span>${num(ind.bb_lower, 2)} to ${num(ind.bb_upper, 2)}</span>
        <span>EMA 20 / 50 / 200</span><span>${num(ind.ema20, 1)} / ${num(ind.ema50, 1)} / ${num(ind.ema200, 1)}</span>
        <span>Ichimoku base 1h</span><span>${num(i1.ichimoku_base, 2)}</span>
        <span>Daily pivots</span><span>S2 ${num(pv.s2, 1)} · S1 ${num(pv.s1, 1)} · P ${num(pv.middle, 1)} · R1 ${num(pv.r1, 1)} · R2 ${num(pv.r2, 1)}</span></div></div></div>`;
  }

  function tabGold() {
    const g = F.gold || {}, s = g.snapshot, sb = g.scoreboard || {};
    const f = s ? s.features : null;
    const trades = (g.trades || []).slice().reverse().map(t => [esc((t.closed_at || "").slice(0, 16).replace("T", " ")), esc(t.direction), num(t.size, 2),
      num(t.entry, 2), num(t.exit, 2), `<span class="${cls(t.net_pnl_usd)}">${usd(t.net_pnl_usd)}</span>`,
      `<span class="sub">spread ${usd(t.spread_paid_usd || 0, 3)} · FX ${usd(t.fx_fee_usd || 0, 3)} · overnight ${usd(-(t.overnight_usd || 0), 3)}</span>`,
      esc(t.exit_reason), esc(t.mode)]);
    const side = (x, label) => `<div class="kv"><span>${label} pitches scored</span><span>${num(x.n)}</span><span>Win rate</span><span>${x.win_rate == null ? "-" : num(x.win_rate * 100, 0) + "%"}</span><span>Avg move</span><span>${pct(x.avg_move_pct, 3)}</span></div>`;
    return `<h3>Market now</h3>` + (f ? `<div class="kv">
        <span>Price</span><span>${num(f.price, 2)} (spread ${num(f.spread, 2)}, ${num(f.spread_bps, 1)} bps)</span>
        <span>Session</span><span>${esc(f.session)}</span><span>Trend 15m / 1h</span><span>${esc(f.trend_15m)} / ${esc(f.trend_1h)}</span>
        <span>RSI 15m / 1h</span><span>${num(f.rsi15, 0)} / ${num(f.rsi60, 0)}</span><span>ATR 15m</span><span>${num(f.atr15, 2)} (${num(f.atr15_pct, 3)}%)</span>
        <span>Change 1h / 4h / 24h</span><span>${pct(f.ret_1h_pct, 2)} / ${pct(f.ret_4h_pct, 2)} / ${pct(f.ret_24h_pct, 2)}</span>
        <span>Today's range</span><span>${num(f.day_low, 2)} to ${num(f.day_high, 2)}</span></div>
        ${tvGoldSection(f)}
        <h3>Cost Gatekeeper</h3><p class="note">${esc(s.gate.bubble)}</p><div class="kv">
        <span>Spread (round trip)</span><span>${num(s.gate.spread_pct, 4)}%</span><span>FX fee on P&amp;L</span><span>${num(s.gate.fx_fee_pct_of_pnl, 2)}%</span>
        <span>Commission</span><span>none (Capital.com CFD)</span>
        <span>Overnight fee (Capital.com, live)</span><span>long ${num(((s.gate.capital_com || {}).overnight_long_pct_per_day), 4)}% · short ${num(((s.gate.capital_com || {}).overnight_short_pct_per_day), 4)}% a day.
          Not paid: flat before the ${esc(((s.gate.capital_com || {}).next_rollover_utc || "").slice(11, 16))} UTC rollover</span>
        <span>Guaranteed stop</span><span>not used (would cost a premium)</span>
        <span>Leverage</span><span>${esc(s.sizing.leverage || "-")} (Capital.com lists gold at ${num(s.sizing.broker_margin_pct, 0)}% margin on your live account)</span>
        <span>1% margin buys</span><span>${num(s.sizing.size, 2)} oz (${usd(s.sizing.notional_usd)} exposure, ${usd(s.sizing.margin_usd)} margin)</span>
        <span>Smallest budget that can trade</span><span>${usd(s.sizing.min_equity_for_min_size)}</span></div>
        <h3>US calendar today</h3>${table(["UTC", "Event", "Impact", "Forecast", "Previous"], (s.calendar_today || []).map(c => [esc(c.time_utc), esc(c.title), esc(c.impact), esc(c.forecast), esc(c.previous)]))}
        <h3>Headlines</h3><ul>${(s.headlines || []).map(h => `<li>${esc(h.title)}</li>`).join("")}</ul>` : empty("No market snapshot yet."))
      + `<h3>Scoreboard: is the Judge any good?</h3><p class="sub">Every Judge decision is replayed against what gold did next (target or stop first, else the close at the time limit, minus the spread). If approved pitches don't beat rejected ones over time, the agents add nothing.</p>
        <div class="grid2"><div>${side(sb.approved || {}, "Approved")}</div><div>${side(sb.rejected || {}, "Rejected")}</div></div>
        <p class="note">${esc(sb.verdict || "")} Real trades: ${num(sb.trades || 0)}, net ${usd(sb.net_pnl_usd || 0)}.</p>
        <h3>Trades</h3>${table(["Closed (UTC)", "Side", "Oz", "Entry", "Exit", "Net", "Capital.com costs", "Why closed", "Mode"], trades, [2, 3, 4, 5])}`;
  }

  function tabMeetings() {
    const g = F.gold || {};
    const ms = (g.meetings || []).slice().reverse();
    const gold = ms.length ? ms.map(m => `<div class="card" style="padding:12px;margin:10px 0">
        <b>${esc(m.ts.slice(0, 16).replace("T", " "))} UTC · ${esc(m.direction)} pitch</b>
        <span class="stamp ${m.final === "APPROVE" ? "up" : "down"}" style="margin-left:8px">${esc(m.final)}</span>
        <div class="transcript" style="margin-top:8px">${m.transcript.map(l => `<p><b>${esc(nameOf(l.agent))}</b> ${esc(l.line)}</p>`).join("")}</div>
        <p class="sub">Judge: ${esc(m.judge_reasoning)}</p>${m.plan ? `<p class="sub">Plan: stop ${num(m.plan.stop, 2)}, target ${num(m.plan.target, 2)}, hold up to ${num(m.plan.hold)} min</p>` : ""}</div>`).join("")
      : empty("No gold meetings yet. A meeting happens only when 3 of 4 analysts agree on a direction.");
    const e = F.egx, j = e && e.judge;
    return `<h3>Gold desk meetings</h3>${gold}<h3>EGX review</h3>` + (j ? `<p><b>${esc(j.headline)}</b></p>
      ${table(["Stock", "Approved", "Judge note"], (j.decisions || []).map(d => [`<b>${esc(d.ticker)}</b>`, d.approve ? `<span class="up">yes</span>` : `<span class="down">no</span>`, esc(d.note)]))}` : empty("No EGX review yet."));
  }

  function tabReport() {
    const r = F.weekly;
    if (!r) return empty("The first report card arrives on Saturday morning, after a week of logged calls.");
    const c = r.card || {}, ag = r.agents || {}, f = r.facts || {};
    const grades = Object.fromEntries((c.agents || []).map(a => [a.agent, a]));
    const rows = Object.entries(ag).sort((a, b) => b[1].n - a[1].n).map(([id, s]) => [`<b>${esc(s.name || nameOf(id))}</b>`,
      num(s.n), num(s.hit_rate * 100, 0) + "%", pct(s.avg_edge_pct, 2),
      `<b class="${s.multiplier > 1 ? "up" : s.multiplier < 1 ? "down" : ""}">x${num(s.multiplier, 2)}</b>`,
      esc((grades[id] || grades[s.name] || {}).grade || "-"), esc((grades[id] || grades[s.name] || {}).comment || "")]);
    const ej = f.egx_judge || {}, gj = f.gold_judge_scoreboard || {};
    return `<h3>${esc(c.headline || "")}</h3><p>${esc(c.summary || "")}</p>
      ${(c.lessons || []).length ? `<ul>${c.lessons.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      <h3>Every agent</h3><p class="sub">Hit rate = calls that went the right way. Weight = how much say the agent gets next week
        (more than 1 = trusted more). Fewer than 5 graded calls keeps a neutral x1.00.</p>
      ${table(["Agent", "Graded calls", "Hit rate", "Average edge", "Weight", "Grade", "Judge's comment"], rows, [1, 2, 3])}
      <div class="grid2"><div><h3>EGX Judge</h3><div class="kv">
        <span>Approved buys</span><span>${num((ej.approved || {}).n)} · avg ${pct((ej.approved || {}).avg_return_pct, 2)}</span>
        <span>Held-back buys</span><span>${num((ej.rejected || {}).n)} · avg ${pct((ej.rejected || {}).avg_return_pct, 2)}</span></div>
        ${ej.note ? `<p class="sub">${esc(ej.note)}</p>` : ""}</div>
      <div><h3>Gold Judge</h3><div class="kv">
        <span>Approved pitches</span><span>${num((gj.approved || {}).n)} · win ${(gj.approved || {}).win_rate == null ? "-" : num(gj.approved.win_rate * 100, 0) + "%"}</span>
        <span>Rejected pitches</span><span>${num((gj.rejected || {}).n)} · win ${(gj.rejected || {}).win_rate == null ? "-" : num(gj.rejected.win_rate * 100, 0) + "%"}</span>
        <span>Paper trades</span><span>${num(gj.trades || 0)} · net ${usd(gj.net_pnl_usd || 0)}</span></div></div></div>
      <p class="sub">Updated ${esc(ago(r.as_of))}.</p>`;
  }

  function tabBudget() {
    const b = F.budget || {};
    const desks = Object.values(b.desks || {}).map(d => `<div style="margin:8px 0"><div class="kv"><span><b>${esc(d.desk)}</b></span><span>${usd(d.month, 3)} of ${usd(d.cap)} this month · today ${usd(d.today, 3)} (pace limit ${usd(d.daily_allowance, 3)}/day) · ${num(d.calls_month)} calls</span></div>
      <div class="bar"><i style="width:${Math.min(100, d.cap ? d.month / d.cap * 100 : 0).toFixed(1)}%"></i></div></div>`).join("");
    const calls = (F.agent_calls || []).slice().reverse().slice(0, 30).map(c => [esc(c.ts.slice(5, 16).replace("T", " ")), esc(nameOf(c.agent)), esc(c.status), usd(c.usd, 4), esc(c.detail)]);
    const roster = (F.roster || []).map(a => [`<b>${esc(a.name)}</b>`, esc(a.desk), a.llm ? esc(a.judge ? (F.models || {}).judge : a.id === "director" ? (F.models || {}).director : (F.models || {}).analyst) : "maths (free)", esc(a.role)]);
    return `<h3>API budget: ${usd(b.spent)} of ${usd(b.cap)} (${esc(b.month)})</h3>
      <p class="sub">Hard cap in code. Each desk also has a daily pace so it can't spend the month early. When a desk hits a limit, its agents go quiet and the maths keeps running.</p>${desks}
      <h3>The team</h3>${table(["Agent", "Desk", "Runs on", "Job"], roster)}
      <h3>Recent agent calls</h3>${table(["When (UTC)", "Agent", "Status", "Cost", "Detail"], calls, [3])}`;
  }

  function tabHow() {
    const c = F.egx_config || {}, g = (F.gold || {}).config || {};
    return `<div class="grid2"><div><h3>EGX desk (once a day, after the close)</h3><ol>
      <li><b>Baseline return (your course formula).</b> CCAPM with external habit: each stock's expected monthly excess return is
        gamma x cov(stock, consumption growth) + w x delta x (1 - gamma) x last month's growth. Consumption growth is proxied by the equal-weight EGX return.
        gamma ${num(c.gamma, 1)}, delta ${num(c.delta_habit, 2)}, w ${num(c.w_habit, 2)}.</li>
      <li><b>Analysts adjust it.</b> 7 sector analysts rate each stock using TradingView's live fundamentals (P/E, P/B, yield, ROE) and technical ratings; the Macro & Pound Strategist tilts sectors; Kemto's 1-year targets act as a low-confidence reality check. Black-Litterman blends these into the baseline, weighted by confidence.</li>
      <li><b>CRRA sizes it.</b> Maximise expected return minus gamma/2 x variance. Long only, no borrowing, max ${num(c.max_positions)} stocks, max ${num((c.max_weight || 0) * 100)}% each, max ${num((c.max_sector_weight || 0) * 100)}% per sector. The rest earns the CBE rate (${num((c.rf_annual || 0) * 100, 1)}%) in cash.</li>
      <li><b>Thndr fees.</b> Your figure: about 0.1% of the order, all-in (mostly fixed charges plus a very small percentage), with a 2 EGP floor. Trades only happen if the CRRA gain beats the round-trip fees. (Thndr's itemised support-page schedule, about 0.18% + 3 EGP, can be switched back on in config.json.) Stocks under ${num(c.min_price_egp, 0)} EGP are never bought (one price step there costs as much as the fees).</li>
      <li><b>News check.</b> Before the Judge rules, the News Checker searches the web for each proposed buy's last 30 days of news.</li>
      <li><b>The Judge reviews every order</b> (sector, then company, then the pound) and can veto. No Judge, no new orders.</li></ol>
      <p class="sub">Note: the pure model's own risk-free rate (eq. 12) comes out unrealistically high for Egypt (the risk-free rate puzzle), so the real CBE rate is used for cash.</p></div>
      <div><h3>Gold desk (every 15 min, ${esc((g.trading_window_utc || []).join(" to "))} UTC)</h3><ol>
      <li><b>Cost Gatekeeper first</b> (maths): spread, 0.70% FX fee on P&amp;L for an AED account, no overnight fee because the desk is flat by ${esc(g.flat_by_utc)} UTC. If a normal move can't beat costs 3x, nobody is even asked.</li>
      <li><b>5 analysts</b> vote LONG, SHORT or FLAT, including the <b>TA Technician</b>, who reads TradingView's independent feed (multi-timeframe ratings of 26 indicators, ADX, MACD, pivots). A meeting needs 3 agreeing, none against, and at least one of them must be the Macro Linker or News Hound: three chart readers agreeing is one signal counted three times.</li>
      <li><b>Two price feeds</b>: Capital.com and TradingView. If they disagree by more than 25 bps, the desk stands down.</li>
      <li><b>Devil's Advocate</b> argues against, then the <b>Judge</b> approves or rejects and sets stop, target and time limit.</li>
      <li><b>1% margin</b>: position size = 1% of the gold budget / (price / leverage), at 1:100 on paper. All costs are Capital.com's: live spread, 0.70% FX conversion for an AED account, and the live overnight rate (never paid, since the desk closes before the rollover). Max ${num(g.max_trades_per_day)} trades a day, daily loss stop, no entries near big US news.</li>
      <li><b>Position Manager</b> checks open trades every 15 minutes.</li>
      <li><b>Scoreboard</b>: approved vs rejected pitches, so you can see whether the Judge adds value.</li></ol>
      <p class="sub">Mode: ${esc(g.mode)}. Live orders need 4 separate switches (see README).</p></div></div>`;
  }

  const RENDER = { orders: tabOrders, holdings: tabHoldings, analysis: tabAnalysis, gold: tabGold, swing: tabSwing, arb: tabArb, fx: tabFx, lab: tabLab, meetings: tabMeetings, report: tabReport, budget: tabBudget, how: tabHow };

  function tabs() {
    $("#tablist").innerHTML = TABS.map(([k, label]) => `<button role="tab" type="button" id="tab-${k}" aria-selected="${k === tab}" aria-controls="tabpanel">${esc(label)}</button>`).join("");
    $("#tabpanel").innerHTML = RENDER[tab]();
    $("#tabpanel").setAttribute("aria-labelledby", "tab-" + tab);
  }

  function showAgent(id) {
    const a = (F.roster || []).find(r => r.id === id) || { name: id, role: "" };
    const n = (F.notes || {})[id];
    $("#agent-body").innerHTML = `<h3 style="margin-top:0">${esc(a.name)}</h3><p class="sub">${esc(a.role)}</p>` + (n ? `
      ${n.stance ? `<p><span class="tag hold">${esc(n.stance)}</span>${n.confidence != null ? ` confidence ${num(n.confidence, 2)}` : ""}</p>` : ""}
      <p class="note">${esc(n.bubble)}</p><p>${esc(n.reasoning || "")}</p><p class="sub">${esc(ago(n.ts))}</p>` : empty("Nothing to say yet."));
    $("#agent-dialog").showModal();
  }

  // TVC:DXY and TVC:US10Y are not licensed for widgets (they show a red "!"), so use Capital.com's feed.
  const TV_BASE = [["OANDA:XAUUSD", "Gold"], ["CAPITALCOM:DXY", "Dollar index"], ["FX:EURUSD", "EUR/USD"],
    ["OANDA:XAGUSD", "Silver"], ["FX_IDC:USDEGP", "USD/EGP"], ["EGX:EGX30", "EGX 30"]];
  let liveMounted = false;

  function tvWidget(host, name, config) {
    host.innerHTML = "";
    const box = document.createElement("div");
    box.className = "tradingview-widget-container";
    box.style.height = "100%";
    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = "100%";
    box.appendChild(inner);
    const sc = document.createElement("script");
    sc.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
    sc.async = true;
    sc.textContent = JSON.stringify(config);
    box.appendChild(sc);
    host.appendChild(box);
  }

  function mountChart(symbol) {
    tvWidget($("#tv-chart"), "advanced-chart", {
      autosize: true, symbol, interval: symbol.startsWith("EGX:") ? "D" : "15", timezone: "Etc/UTC",
      theme: "dark", style: "1", locale: "en", backgroundColor: "rgba(4, 5, 13, 1)",
      gridColor: "rgba(25, 230, 255, 0.06)", allow_symbol_change: true, hide_volume: false,
      studies: ["STD;RSI", "STD;MACD"], support_host: "https://www.tradingview.com" });
    tvWidget($("#tv-ta"), "technical-analysis", {
      interval: symbol.startsWith("EGX:") ? "1D" : "15m", width: "100%", height: "100%", isTransparent: true,
      symbol, showIntervalTabs: true, displayMode: "single", locale: "en", colorTheme: "dark" });
  }

  function mountLive() {
    if (liveMounted || !navigator.onLine) {
      if (!navigator.onLine) $("#live-note").textContent = "Live widgets need an internet connection.";
      return;
    }
    liveMounted = true;
    const e = F.egx || {};
    const egx = [...new Set([...(e.holdings || []).map(h => h.ticker), ...(e.orders || []).map(o => o.ticker)])];
    tvWidget($("#tv-tape"), "ticker-tape", {
      symbols: [...TV_BASE.map(([proName, title]) => ({ proName, title })),
        ...egx.map(t => ({ proName: "EGX:" + t, title: t }))],
      showSymbolLogo: true, isTransparent: true, displayMode: "adaptive", colorTheme: "dark", locale: "en" });
    const sel = $("#live-symbol");
    sel.innerHTML = [["OANDA:XAUUSD", "Gold (XAUUSD)"], ["EGX:EGX30", "EGX 30 index"],
      ...egx.map(t => ["EGX:" + t, t + " (EGX)"])].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
    sel.addEventListener("change", () => mountChart(sel.value));
    mountChart("OANDA:XAUUSD");
  }

  function render() {
    F = window.FLOOR;
    if (!F) { $("#nodata").hidden = false; $("#app").hidden = true; return; }
    $("#nodata").hidden = true; $("#app").hidden = false;
    chips(); money(); if (!moneySwing()) moneyFx(); tabs();
    window.Office.setData(F);
    mountLive();
  }

  function locked(err) {
    if (F) return;                       // keep showing the last good data on a blip
    $("#nodata").hidden = false; $("#app").hidden = true;
    $("#nodata").innerHTML = `<p class="big">Can't open the data</p><p>${esc(err && err.message || err)}</p>`;
  }

  function reload() {
    if (window.FLOOR_LOADER) { window.FLOOR_LOADER().then(render, locked); return; }
    if (window.FLOOR_SNAPSHOT) { location.reload(); return; }
    const s = document.createElement("script");
    s.src = "data.js?t=" + Date.now();
    s.onload = () => { s.remove(); render(); };
    s.onerror = () => s.remove();
    document.body.appendChild(s);
  }

  $("#tablist").addEventListener("click", e => {
    const b = e.target.closest("button[role=tab]");
    if (!b) return;
    tab = b.id.replace("tab-", "");
    try { localStorage.setItem("floor-tab", tab); } catch (_) { /* storage optional */ }
    tabs();
  });
  $("#refresh").addEventListener("click", reload);
  $("#replay-gold").addEventListener("click", () => { if (!window.Office.replay("gold")) alert("No gold meeting to replay yet."); });
  $("#replay-egx").addEventListener("click", () => { if (!window.Office.replay("egx")) alert("No EGX review to replay yet."); });
  $("#replay-fx").addEventListener("click", () => { if (!window.Office.replay("fx")) alert("No FX meeting to replay yet."); });

  try { const t = localStorage.getItem("floor-tab"); if (t && RENDER[t]) tab = t; } catch (_) { /* storage optional */ }
  window.Office.init($("#office"), showAgent);
  if (window.FLOOR_LOADER) reload(); else render();
  setInterval(reload, 60000);
})();
