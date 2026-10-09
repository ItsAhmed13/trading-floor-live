/* The Trading Floor website (owner 2026-11-04): every section has its own tab at the top, every desk and every Judge
   its own pages under it, and the site opens on an introduction that moves one slide per scroll of the mouse wheel.
   One simple palette (index.html). Reads window.FLOOR (data.js locally, the encrypted copy through phone.js online). */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
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
  const plain = h => String(h == null ? "" : h).replace(/<[^>]*>/g, "").trim();
  // A table whose long-text columns (found from their length) never squeeze into narrow columns (owner 2026-11-05:
  // "not clean and easy to read"): a row keeps its short columns, and its long text runs full width on a line under
  // it, labelled. On a phone (index.html, up to 700 px) each row becomes a short block: the first cell is its title
  // and the short cells sit side by side under their column names.
  const blankCell = c => { const t = plain(c); return t === "" || t === "-"; };
  const table = (head, rows, numCols = []) => {
    if (!rows.length) return empty("Nothing here yet.");
    const long = head.map((_, i) => {
      if (i === 0) return false;                                // the first cell is the row's title
      const n = rows.map(r => plain(r[i]).length);
      return n.reduce((a, b) => a + b, 0) / n.length > 45 || Math.max(...n) > 110;
    });
    const short = head.map((_, i) => i).filter(i => !long[i]), texts = head.map((_, i) => i).filter(i => long[i]);
    const td = (c, i) => `<td class="${[numCols.includes(i) ? "num" : "", blankCell(c) ? "blank" : ""].filter(Boolean).join(" ")}" data-label="${esc(head[i])}">${c == null ? "" : c}</td>`;
    const detail = r => {
      const parts = texts.filter(i => !blankCell(r[i])).map(i => `<div class="dl">${head[i] ? `<span class="dk">${esc(head[i])}</span> ` : ""}${r[i]}</div>`);
      return parts.length ? `<tr class="detail"><td colspan="${short.length}">${parts.join("")}</td></tr>` : "";
    };
    return `<div class="tablewrap"><table${texts.length ? ' class="has-detail"' : ""}><thead><tr>${short.map(i => `<th class="${numCols.includes(i) ? "num" : ""}">${esc(head[i])}</th>`).join("")}</tr></thead>`
      + `<tbody>${rows.map(r => `<tr${texts.length ? ' class="main"' : ""}>${short.map(i => td(r[i], i)).join("")}</tr>${texts.length ? detail(r) : ""}`).join("")}</tbody></table></div>`;
  };
  // One section of a page. title and sub are HTML: callers escape what they put in them.
  const block = (title, html, sub) => `<section class="block">${title ? `<h3>${title}</h3>` : ""}${sub ? `<p class="sub">${sub}</p>` : ""}${html}</section>`;

  let F = null;
  const tvCls = l => !l ? "" : l.includes("BUY") ? "up" : l.includes("SELL") ? "down" : "";
  const tvTag = l => l ? `<span class="${tvCls(l)}">${esc(l)}</span>` : "-";
  const tvBrief = x => x ? `${tvTag(x.rating_1D)}<div class="sub">1W ${esc(x.rating_1W || "-")}` +
    `${x.pe != null ? " · P/E " + num(x.pe, 1) : ""}${x.dividend_yield_pct != null ? " · yield " + num(x.dividend_yield_pct, 1) + "%" : ""}</div>` : "-";
  const nameOf = id => ((F.roster || []).find(a => a.id === id) || { name: id }).name;
  const dirT = v => v > 0 ? `<span class="tag buy">LONG</span>` : v < 0 ? `<span class="tag sell">SHORT</span>` : `<span class="tag hold">NEUTRAL</span>`;
  const decTag = d => `<span class="tag ${/APPROVE|KEEP|BUY/.test(d || "") ? "buy" : /VETO|REJECT|CLOSE|SELL/.test(d || "") ? "sell" : "hold"}">${esc(d || "-")}</span>`;
  const money2 = (v, cur) => v == null ? "-" : `${v >= 0 ? "+" : ""}${num(v, 2)} ${esc(cur)}`;
  // A graded-facts object of any shape, flattened into label / value rows (the weekly card grows new facts).
  function factsKv(o) {
    if (!o || typeof o !== "object") return empty("Not graded yet.");
    const rows = [];
    const walk = (x, pre) => {
      for (const [k, v] of Object.entries(x)) {
        if (v && typeof v === "object" && !Array.isArray(v)) walk(v, pre + k + " ");
        else rows.push(`<span>${esc((pre + k).replace(/_/g, " "))}</span><span>${Array.isArray(v) ? esc(v.join(", "))
          : typeof v === "number" ? num(v, Number.isInteger(v) ? 0 : 3) : esc(v)}</span>`);
      }
    };
    walk(o, "");
    return rows.length ? `<div class="kv">${rows.join("")}</div>` : empty("Not graded yet.");
  }

  // -- the top bar's status ------------------------------------------------------------------------
  function status() {
    const b = F.budget || {}, ls = F.llm_status || {}, e = F.egx || {};
    const out = [`<span>Updated ${esc(ago(F.generated_at))}</span>`,
      `<span>AI spend ${usd(b.spent)} of ${usd(b.cap, 0)} this month</span>`];
    if (F.generated_at && Date.now() - Date.parse(F.generated_at) > 45 * 60000)
      out.push(`<span class="pill warn">Not updating: is the laptop awake and signed in?</span>`);
    if (ls.ok === false) out.push(`<span class="pill bad">Agents offline: ${esc(ls.detail)}</span>`);
    if ((e.warnings || []).length) out.push(`<span class="pill warn">${esc(e.warnings.length)} data warning${e.warnings.length > 1 ? "s" : ""}</span>`);
    $("#status").innerHTML = out.join("");
  }

  // -- shared numbers ------------------------------------------------------------------------------
  function swingNumbers() {
    const S = F.swing;
    if (!S) return null;
    const st = S.state || {}, a = st.account || {}, aed = a.currency === "AED", fx = aed ? 3.6725 : 1;
    const mon = v => v == null ? "-" : aed ? `${num(v, 2)} AED` : usd(v);
    const start = aed ? (a.start_ccy ?? (a.start_usd || 100) * fx) : (a.start_usd || 100);
    const eq = aed ? (a.equity_ccy ?? (a.equity_usd ?? start / fx) * fx) : (a.equity_usd != null ? a.equity_usd : start);
    const margin = aed ? (a.margin_ccy ?? (a.margin_used_usd || 0) * fx) : a.margin_used_usd;
    return { S, st, a, aed, fx, mon, start, eq, margin, chg: eq - start, eqTxt: mon(eq),
             chgTxt: (eq - start >= 0 ? "+" : "") + mon(eq - start), live: a.source === "live" };
  }
  function egxNow() {
    const e = F.egx, OD = F.egx_orders || {};
    if (!e) return null;
    const live = OD.live && String(OD.live.as_of) > String(e.as_of) ? OD.live : null;
    return { e, OD, live, p: live || e.portfolio };
  }
  function egxToPlace(e, OD) {
    return OD.book ? (e.orders || []).filter(o => OD.book.some(b => b.ticker === o.ticker && b.action === o.action)) : (e.orders || []);
  }
  function noOrdersText(e) {
    return (e.orders || []).length ? "The Order Desk has already filled or settled this plan's orders (see Recent executions)."
      : e.no_trade_reason || ((e.vetoed || []).length ? "Proposals are waiting for the Judge" + ((F.llm_status || {}).ok === false
        ? " (agents offline: " + F.llm_status.detail + ")" : "") + "." : "Nothing to do. Hold what you have.");
  }
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
  // One card per open position: why, how long, what closes it, what is at risk (floor/explain.py builds the words).
  function planCards(list) {
    if (!(list || []).length) return empty("No open positions to explain.");
    return list.map(c => `<details class="block"><summary><b>${esc(c.title)}</b>
        <span class="tag ${c.status === "On track" || c.status === "Holding" ? "buy" : c.status === "Closing" || c.status === "Being sold" ? "sell" : "hold"}">${esc(c.status)}</span>
        <div class="sub">${esc(c.headline)}</div></summary>
      <div class="kv" style="margin:10px 0">${(c.levels || []).map(l => `<span>${esc(l.label)}</span><span>${esc(l.value)}</span>`).join("")}</div>
      ${(c.sections || []).map(x => `<p><b>${esc(x.h)}.</b> ${esc(x.p)}</p>`).join("")}</details>`).join("");
  }

  // ===================================================================== the swing desk
  // The H6 rate-news system (owner 2026-11-09): the surprise meter over the last year, its +-2 lines and big days.
  function h6Chart(hist, thr) {
    if (!(hist || []).length) return "";
    const W = 640, H = 150, pad = 26, n = hist.length, zs = hist.map(h => h[1]);
    const m = Math.max(3, thr + 0.6, ...zs.map(z => Math.abs(z)));
    const x = i => pad + (W - 2 * pad) * i / Math.max(1, n - 1), y = z => H / 2 - (H / 2 - 12) * z / m;
    const line = zs.map((z, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(z).toFixed(1)}`).join("");
    const dots = zs.map((z, i) => Math.abs(z) >= thr ? `<circle cx="${x(i).toFixed(1)}" cy="${y(z).toFixed(1)}" r="3.5" fill="${z > 0 ? "#2fbf71" : "#e05a5a"}"><title>${esc(hist[i][0])}: z ${num(z, 2)}</title></circle>` : "").join("");
    const rule = (v, label, dy) => `<line x1="${pad}" x2="${W - pad}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="currentColor" stroke-opacity="${v ? 0.35 : 0.15}" ${v ? 'stroke-dasharray="4 4"' : ""}/>${label ? `<text x="${pad + 2}" y="${(y(v) + dy).toFixed(1)}" font-size="10" fill="currentColor" opacity=".65">${label}</text>` : ""}`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="The surprise meter over the last year">
      ${rule(thr, `+${thr}: big day, long the dollar`, -4)}${rule(0, "", 0)}${rule(-thr, `-${thr}: big day, short the dollar`, 12)}
      <path d="${line}" fill="none" stroke="#4a8fe8" stroke-width="1.4"/>${dots}
      <text x="${pad}" y="${H - 2}" font-size="10" fill="currentColor" opacity=".55">${esc(hist[0][0])}</text>
      <text x="${W - pad}" y="${H - 2}" font-size="10" fill="currentColor" opacity=".55" text-anchor="end">${esc(hist[n - 1][0])}</text></svg>`;
  }
  // The H6 entry meeting (owner 2026-11-12): H6 gives the signal, the analysts review the week, the Judge decides.
  const entryTag = d => `<span class="tag ${d === "ENTER" ? "buy" : d === "SKIP" ? "sell" : "hold"}">${esc(d || "-")}</span>`;
  const stanceTag = s => `<span class="tag ${s === "SUPPORTS" ? "buy" : s === "AGAINST" ? "sell" : "hold"}">${esc(s || "-")}</span>`;
  function h6Entry(m, full) {
    if (!m || !m.ts) return `<p class="sub">No entry meeting yet. When H6 gives a signal and a market fits the account, the analysts review the last week's news and reports, then the Judge decides.</p>`;
    const J = m.judge || {}, S = m.signal || {};
    const dec = (m.decisions || []).map(d => [`<b>${esc(d.pair)}</b> <span class="sub">${esc(d.side || "")}</span>`, entryTag(d.decision),
      d.decision === "ENTER" ? (d.opened ? "opened" : `<span class="sub">no room yet: ${esc(d.no_room || "")}</span>`) : d.decision === "WAIT" ? `looks again in ${num(d.next_look_hours)} h` : "not in this window",
      esc(d.reason)]);
    const rev = Object.entries(m.reviews || {}).map(([c, r]) => [`<b>${esc(c)}</b>`, stanceTag(r.stance), num(r.confidence, 2),
      esc(r.summary) + (full && (r.evidence || []).length ? `<ul class="sub">${r.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : "")
        + (full && r.risks_ahead ? `<div class="sub">Risks ahead: ${esc(r.risks_ahead)}</div>` : "")]);
    return `<p class="sub">${full ? "" : esc(ago(m.ts)) + " · "}the ${esc(S.date || "")} big day (${esc(S.direction || "")}) · ${num((m.candidates || []).length)} market(s) fitted the account</p>
      ${J.headline ? `<p><b>${esc(J.headline)}</b></p>${full && J.summary ? `<p>${esc(J.summary)}</p>` : ""}` : `<p class="note">${esc(m.note || "The Judge did not meet.")}</p>`}
      ${dec.length ? table(["Market", "Judge", "Then", "Why"], dec) : ""}
      ${rev.length ? `<p class="sub" style="margin-top:8px"><b>The analysts' week review:</b> does the last week's news back the move H6 expects for each currency?</p>` + table(["Currency", "The week's news", "Confidence", "Summary"], rev, [2]) : ""}`;
  }
  function swingH6() {
    const S = F.swing || {}, st = S.state || {}, h = st.h6;
    if (!h || (S.config || {}).system !== "h6") return "";
    const L = h.latest || {}, A = h.active, P = h.pending;
    const big = L.z != null && Math.abs(L.z) >= h.threshold;
    const pos = Object.entries(st.positions || {}), h6open = pos.filter(([, v]) => v.system === "h6"), old = pos.filter(([, v]) => v.system !== "h6");
    const rows = (h.big_days || []).slice().reverse().map(b => [esc(b.date), `${b.dy_bp > 0 ? "+" : ""}${num(b.dy_bp, 1)} bp`, num(b.z, 2),
      `<span class="tag ${b.usd_dir > 0 ? "buy" : "sell"}">${esc(b.direction)}</span>`, esc((b.entry_at || "").slice(0, 16).replace("T", " ")), esc((b.ends_at || "").slice(0, 10))]);
    const waits = Object.entries(h.skips || {}).map(([p, s]) => `<li><b>${esc(p)}</b>: ${esc(s.why)} <span class="sub">(${esc(ago(s.ts))})</span></li>`).join("");
    return block("H6 rate-news system", `<div class="kv">
        <span>US 2-year yield</span><span><b>${L.yield_pct != null ? num(L.yield_pct, 2) + "%" : "-"}</b> on ${esc(L.date || "-")}: ${L.dy_bp == null ? "-" : (L.dy_bp > 0 ? "+" : "") + num(L.dy_bp, 1) + " bp"} <span class="sub">(a normal day moves about ${num(L.sd_bp, 1)} bp)</span></span>
        <span>Surprise meter</span><span><b class="${big ? cls(L.z) : ""}">${L.z == null ? "-" : (L.z > 0 ? "+" : "") + num(L.z, 2)}</b> <span class="sub">a big day is ${num(h.threshold, 0)} or more either way</span>${big ? " · <b>big day</b>" : ""}</span>
        <span>Now</span><span>${A ? `In the window of the <b>${esc(A.date)}</b> big day: <b>${esc(A.direction)}</b> until ${esc((A.ends_at || "").slice(0, 10))}` : "No big day in its 20-day window: no H6 trades to hold"}${P ? `<div class="sub">Next: the ${esc(P.date)} big day (${esc(P.direction)}) opens at ${esc((P.entry_at || "").slice(11, 16))} UTC on ${esc((P.entry_at || "").slice(0, 10))}</div>` : ""}</span>
        <span>Trades</span><span>${num(h6open.length)} H6 trade(s) open${old.length ? `<div class="sub">Old-system trades for you to close at Capital.com (the desk follows): ${esc(old.map(([p, v]) => p + " " + v.direction).join(", "))}</div>` : ""}</span>
      </div>
      ${h6Chart(h.history, h.threshold)}
      <p class="sub" style="margin-top:8px"><b>How an H6 trade opens:</b> 1. the signal engine sees a big day · 2. the currency analysts review the last week's news and reports · 3. the Swing Judge rules ENTER, WAIT or SKIP for each market that fits the account · 4. ENTERs open in the Judge's order, each with your volatility model's stop loss and take-profit.</p>
      <h4 style="margin:10px 0 4px">Last entry meeting</h4>${h6Entry((h.entry || {}).last, false)}
      ${waits ? `<p class="sub" style="margin-top:8px"><b>Waiting to open</b></p><ul class="sub">${waits}</ul>` : ""}
      ${rows.length ? table(["Big day", "2-year move", "z", "Dollar", "Entry (UTC)", "Window ends"], rows, [1, 2]) : ""}
      ${h.error ? `<p class="note">${esc(h.error)}</p>` : ""}`,
      "The desk trades only H6. After a big move in the US 2-year Treasury yield (2 normal days or more), every H6 market is proposed on the dollar's side for 20 trading days from the next noon New York: long the dollar when the yield jumped, short when it dropped. The analysts review the last week's news and reports and the Swing Judge decides each entry. Every trade has your volatility model's stop loss and take-profit (stretched to the window), and the Judge reviews each one daily and may close it early when momentum, volume and fundamentals say the drift is fading. Research r2611: confirmed on 1977-2002 data it never saw; the edge is small.");
  }
  // The weekend rule (owner 2026-11-13): every trade closes before the weekend; one hour after the markets reopen the desk
  // measures how each instrument opened and the Weekend Open Analyst reads the weekend's news; then H6 goes on.
  const kindTag = k => `<span class="tag ${k === "FUNDAMENTAL" ? "buy" : k === "VOLATILITY" ? "sell" : "hold"}">${esc(k || "-")}</span>`;
  const pmv = (v, d) => v == null ? "-" : (v > 0 ? "+" : "") + num(v, d == null ? 2 : d);
  function swingWeekend() {
    const st = (F.swing || {}).state || {}, wk = st.weekend;
    if (!wk || !wk.friday) return "";
    const L = wk.last || {}, closedNow = Object.entries(wk.closed || {});
    const who = c => c.by === "owner" ? "closed by you" : "closed by the rule";
    const closedLine = list => list.map(([p, c]) => `<b>${esc(p)}</b> ${esc(c.direction || "")} <span class="sub">(${who(c)}, ${pmv(c.move_pct)}%)</span>`).join(" · ");
    const rows = Object.entries(L.markets || {}).map(([p, r]) => [
      `<b>${esc(p)}</b>${r.h6_side ? ` <span class="sub">H6 ${esc(r.h6_side)}</span>` : ""}`,
      `${pmv(r.gap_pct)}%<div class="sub">${pmv(r.gap_in_normal_days)} d</div>`,
      `${pmv(r.first_hour_pct)}%<div class="sub">${pmv(r.first_hour_in_normal_days)} d</div>`,
      `${pmv(r.total_pct)}%<div class="sub">${pmv(r.total_in_normal_days)} d · ${esc(r.size || "")}</div>`,
      r.kind ? kindTag(r.kind) : `<span class="sub">no analysis</span>`,
      r.h6_view && r.h6_view !== "NO_SIGNAL" ? stanceTag(r.h6_view) : `<span class="sub">-</span>`,
      esc((r.drivers || []).join(" · ") || r.analyst_note || r.note || "")]);
    const after = (L.resumed || []).map(x => `<li><b>${esc(x.pair)}</b>: ${esc(x.next)}</li>`).join("");
    return block("Weekend rule", `<div class="kv">
        <span>Now</span><span>${wk.phase === "open" ? "Trading as normal: the last review is done." : esc(wk.now || wk.pause || "The weekend rule is in force.")}</span>
        ${closedNow.length ? `<span>Closed for this weekend</span><span>${closedLine(closedNow)}</span>` : ""}
      </div>
      ${L.at ? `<h4 style="margin:10px 0 4px">Weekend review <span class="sub" style="font-weight:400">${esc(ago(L.at))} · the weekend of ${esc(L.friday || "")}</span></h4>
        ${L.headline ? `<p><b>${esc(L.headline)}</b></p>` : ""}${L.summary ? `<p>${esc(L.summary)}</p>` : ""}${L.note ? `<p class="note">${esc(L.note)}</p>` : ""}
        ${rows.length ? table(["Market", "Weekend gap", "First hour", "Total", "Move", "News vs H6", "What moved it"], rows, [1, 2, 3]) : ""}
        ${(L.themes || []).length ? `<p class="sub"><b>Themes:</b> ${esc(L.themes.join(" · "))}</p>` : ""}
        ${L.risks_ahead ? `<p class="sub"><b>Risks ahead:</b> ${esc(L.risks_ahead)}</p>` : ""}
        ${after ? `<p class="sub" style="margin-top:6px"><b>After the review</b></p><ul class="sub">${after}</ul>` : ""}`
      : `<p class="sub">No weekend review yet. The first one comes one hour after the markets reopen on Sunday.</p>`}`,
      "Every trade closes before the weekend: no new trades from 12:00 New York on Friday, and every open trade closes from 15:00 New York, two hours before the forex close. One hour after each market reopens on Sunday, the desk measures the weekend gap and the first hour, and the Weekend Open Analyst reads the weekend's news: FUNDAMENTAL is a move with a clear news cause, VOLATILITY a move with none, QUIET means little happened. Then the markets closed for the weekend go back to the Judge's H6 entry meeting. 'd' is the instrument's normal daily moves.");
  }
  function swingHowText() {
    const cfg = (F.swing || {}).config || {}, lvl = cfg.risk_scale || 40;
    if (cfg.system === "h6") return `The desk trades <b>only the H6 rate-news system</b>. H6 is the signal engine: after a big move in the US 2-year Treasury yield (at least 2 normal daily moves), USDCAD, BTCUSD, USDJPY, GBPUSD, AUDUSD, gold, EURUSD and NZDUSD are each proposed on the dollar's side for 20 trading days from the next noon New York. Since 12 November 2026 <b>the Swing Judge decides every entry</b>: first the currency analysts in play review the last week's news and reports for their currencies (the high-impact releases, the event memory, the political reads, the last 3 days of articles, the news scouts, the Political + News Index, their own ratings and the prices), then the Judge rules ENTER, WAIT (look again later) or SKIP (not this window) for each market that fits the account, and the ENTERs open in its order, the smallest deal each. <b>Your volatility model</b> sets every stop loss (about a 20% chance of being hit against the trade in the window) and take-profit (about a 50% chance of being reached), its 10-day table stretched to the window; your risk level ${esc(lvl)}/100 caps a take-profit at ${num(lvl * 0.25, 0)}% of the account and all open stops together may lose at most half of it. The Judge reviews every H6 trade daily and closes it early when the drift is fading: momentum slowing, plus trading volume fading or fundamentals no longer behind the move. The window's end closes it. Since 13 November 2026 <b>every trade closes before the weekend</b> (from 15:00 New York on Friday); one hour after the markets reopen the desk measures how each one opened and reads the weekend's news, then the Judge decides whether to enter again on the same signal. Trades are copied onto your live Capital.com account while your three locks are open.`;
    return `10 forex pairs, BTCUSD and gold, traded on <b>fundamentals only</b>: a pair is proposed when the currency analysts' score takes a clear side (beyond ±${esc(cfg.view_threshold ?? 0.6)}), strongest first, and the Swing Judge approves it and picks a <b>holding period</b> (2 to 10 trading days). ${cfg.sizing === "min" ? "Size: the smallest deal Capital.com allows, at its own margin. Several trades can be open at once while Capital.com's free funds cover the margin; all their stops together may lose at most half the account." : `CRRA (gamma ${esc(cfg.gamma)}) sizes it.`} <b>Your volatility model</b> sets the stop loss and take-profit for that period: the take-profit where the price gets with about a 50% chance in the period, the stop where it gets against the trade with only about a 20% chance (outside the normal noise, inside the extremes); the Judge may move each inside its zone. Your risk level ${esc(lvl)}/100 caps a take-profit at ${num(lvl * 0.25, 0)}% of the account. Capital.com holds the stop and take-profit on the live order. A trade also closes when the fundamental view turns against it, after a News Sentinel emergency meeting, or when the Judge re-checks it (on its schedule and when its holding period ends) and would no longer open it. New trades are copied onto your live Capital.com account.`;
  }

  // The swing evaluation run (owner 2026-11-05, review fix 1): one frozen setup, judged once by rules written first.
  const runTag = v => `<span class="tag ${v === "PASS" ? "buy" : /FAIL|SETUP|VOID/.test(v || "") ? "sell" : "hold"}">${esc(v || "-")}</span>`;
  function evalBlock(ev, full) {
    if (!ev) return empty("The evaluation run starts with the next swing check.");
    const tp = ev.take_profit_first || {}, sf = ev.stop_first || {};
    const done = Math.min(100, 100 * (ev.closed_trades || 0) / (ev.target_trades || 200));
    const r = ev.mean_r == null ? "-" : `<span class="${cls(ev.mean_r)}">${ev.mean_r > 0 ? "+" : ""}${num(ev.mean_r, 2)} R a trade</span>${ev.se_r ? ` <span class="sub">(give or take ${num(ev.se_r, 2)})</span>` : ""}`;
    return `<p>${runTag(ev.verdict)} <b>Run ${esc(ev.run)}</b>, started ${esc((ev.started_at || "").slice(0, 10))}. ${esc(ev.verdict_text)}</p>
      <div class="bar-meter" title="${num(done, 0)}% of the trades the run needs"><i style="width:${done}%"></i></div>
      <div class="kv" style="margin-top:10px">
        <span>Closed run trades</span><span>${num(ev.closed_trades)} of ${num(ev.target_trades)} · day ${num(ev.days, 0)} of ${num(ev.max_days)}</span>
        <span>Average result</span><span>${r}</span>
        <span>Take-profit reached first</span><span>${num(tp.hits)} of ${num(tp.of)} · ${num(tp.expected_if_random, 1)} if prices were random</span>
        <span>Stop reached first</span><span>${num(sf.hits)} of ${num(sf.of)} · ${num(sf.expected_if_random, 1)} if random</span>
        <span>Won</span><span>${num(ev.wins)} · net ${usd(ev.net_usd)}</span>
        ${full ? `<span>Run trades still open</span><span>${num(ev.open_trades)}</span><span>Code fixes written down</span><span>${num(ev.amendments)}</span>` : ""}
      </div>`;
  }
  function swingEval() {
    const ev = (((F.swing || {}).state) || {}).eval_run;
    const trades = ((ev || {}).trades || []).slice().reverse().map(t => [`<b>${esc(t.pair)}</b>`, esc((t.opened_at || "").slice(0, 16).replace("T", " ")),
      esc(t.outcome.replace("_", " ")), t.r == null ? "-" : `<span class="${cls(t.r)}">${t.r > 0 ? "+" : ""}${num(t.r, 2)} R</span>`,
      `<span class="${cls(t.usd)}">${usd(t.usd)}</span><div class="sub">${esc(t.source)}</div>`,
      t.p_tp_if_random == null ? "-" : num(t.p_tp_if_random * 100, 0) + "%"]);
    return block("Is the swing desk better than luck?", evalBlock(ev, true),
        "One setup is frozen and judged once, by rules written down before its first trade (research/eval_run/PREREG_swing_run1.md). R = a trade's result divided by what it stood to lose at its stop: -1 R is a full stop.")
      + block("Run trades (latest first)", table(["Pair", "Opened (UTC)", "How it ended", "Result", "Money", "Take-profit first if random"], trades, [3, 4, 5]))
      + block("The rules", `<ul>
          <li><b>When it ends:</b> after ${num((ev || {}).target_trades || 200)} closed trades or ${num((ev || {}).max_days || 365)} days. Fewer than 50 by then: not enough trades.</li>
          <li><b>Pass:</b> the average result is above 0 R by more than luck explains (p under 0.05), and still so when trades in the same week are treated as one piece of evidence (p under 0.10). Anything else is a fail.</li>
          <li><b>Early stops, never for success:</b> after 100 trades the average is below zero and luck rarely turns that around; or the account falls to half its value at the start.</li>
          <li><b>Frozen:</b> the swing settings, the agents' models and instructions, every agent's weight (x1.00), the news and political schedules, and the volatility model. A change ends the run and a new one starts from zero.</li>
          <li><b>Not part of the verdict:</b> the win rate. These trades are built to win often and lose more when they lose, so wins alone prove nothing; the "if random" odds show what luck alone would do.</li></ul>`);
  }

  function swingOverview() {
    const n = swingNumbers();
    if (!n) return empty("The swing desk is switched off.");
    const st = n.st, acct = n.a, bp = (st.live || {}).broker_positions || [];
    const open = Object.entries(st.positions || {}).map(([p, v]) => {
      const M = FloorCharts.tradeMoney(v, n.aed);
      return [`<b>${esc(p)}</b>`, dirT(v.direction === "LONG" ? 1 : -1), esc(v.size), px(M.entry), px(v.last_mid),
        `<span class="${cls(M.v)}">${money2(M.v, M.cur)}</span><div class="sub">${M.real ? "your account" + (M.fees ? `, fees ${num(M.fees, 2)}` : "") : "paper only"}</div>`,
        `${num((v.margin_usd || 0) * n.fx, 2)} ${n.aed ? "AED" : "USD"}`,
        v.system === "h6" ? `<span class="tag hold">H6</span><div class="sub">${esc((v.h6 || {}).signal_day)} · z ${num((v.h6 || {}).z, 2)}</div>` : `${dirT(v.fund_view_now)}<div class="sub">old system</div>`,
        v.hold_until ? `${esc(v.hold_days)} days<div class="sub">ends ${esc(v.hold_until.slice(5, 16).replace("T", " "))}</div>` : `<span class="sub">not set</span>`,
        esc(v.review_hours) + " h", esc(ago(v.opened_at))];
    });
    const onAcct = bp.map(b => [`<b>${esc(b.epic)}</b>`, esc(b.direction), esc(b.size), esc(b.level),
      `<span class="${cls(b.upl)}">${b.upl != null ? num(b.upl, 2) + " " + esc(acct.currency || "") : "-"}</span>`, esc((b.created || "").slice(0, 16).replace("T", " "))]);
    const acctHtml = `<div class="cols"><div><div class="big">${n.eqTxt}</div>
        <div class="sub"><span class="${cls(n.chg)}">${n.chgTxt}</span> since start (${n.mon(n.start)}) · margin ${n.mon(n.margin)} in use${n.aed && acct.equity_usd != null ? ` · about ${usd(acct.equity_usd)}` : ""}</div>
        <p class="note">${esc(st.status || "Not started")}</p>${st.live ? `<p class="note"><b>Live account:</b> ${esc(st.live.status)}</p>` : ""}
        <p class="sub">Last check ${esc(ago(st.last_cycle))}.</p></div><div data-chart="usd" data-h="170"></div></div>`;
    return block(n.live ? "Your Capital.com account (live)" : "The desk's account", acctHtml)
      + swingH6()
      + swingWeekend()
      + block("Evaluation run", evalBlock(st.eval_run, false), "Is this setup better than luck? Judged once, by rules written first. Details on the Evaluation run page.")
      + block("Open trades", table(["Pair", "Side", "Size", "Entry", "Now", "P&L", "Margin", "Why it is open", "Holding period", "Review every", "Opened"], open, [2, 3, 4, 5, 6]))
      + (open.length ? block("Live charts", Object.keys(st.positions || {}).map(p => `<div class="poschart" data-pair="${esc(p)}"></div>`).join(""),
        "Each open trade's price with its entry, stop loss and take-profit. The line is Capital.com's 15-minute closes; while this page is open it keeps moving with TradingView's live price, fetched every 5 seconds straight from TradingView (no AI cost, and the laptop does nothing extra).") : "")
      + (onAcct.length ? block("Positions on the Capital.com account", table(["Instrument", "Side", "Size", "Opened at", "P&L", "When (UTC)"], onAcct, [2, 3, 4])) : "")
      + block("How this desk trades", `<p class="sub">${swingHowText()}</p>`);
  }

  function swingPairs() {
    const S = F.swing;
    if (!S) return empty("The swing desk is switched off.");
    const st = S.state || {}, cfg = S.config || {}, lvl = cfg.risk_scale || 40;
    const ownExit = pb => {
      const x = (pb || {}).exit || {};
      if (x.take_profit_move_pct == null) return "-";
      const r = x.if_random_pct || {};
      return `${esc(x.hold_days)} days, ${esc(x.side_shown || "")}: take-profit <b>${num(x.take_profit_move_pct, 2)}%</b>${x.take_profit_aed != null ? ` (+${num(x.take_profit_aed, 2)} AED${x.capped_by_risk_level ? ", your risk-level cap" : ""})` : ""}, stop <b>${num(x.stop_move_pct, 2)}%</b>${x.stop_aed != null ? ` (-${num(x.stop_aed, 2)} AED)` : ""}`
        + `<div class="sub">90% range ${px(((x.range_90pct || [])[0]))} to ${px(((x.range_90pct || [])[1]))}</div>`
        + (r.take_profit_first != null ? `<div class="sub">with no edge: take-profit first ${r.take_profit_first}%, stop first ${r.stop_first}%</div>` : "");
    };
    const pairs = (cfg.pairs || []).map(p => {
      const ps = (st.pairs || {})[p] || {}, f = ps.fund || {}, tv = (st.tv || {})[p];
      return [`<b>${esc(p)}</b>${tv ? `<div class="sub"><a href="${esc(tv.chart_url)}" target="_blank" rel="noopener">${esc(tv.symbol)}</a> ${px(tv.price)}</div><div class="sub">1h ${esc(tv.ratings["1h"])} · 4h ${esc(tv.ratings["4h"])} · 1D ${esc(tv.ratings["1D"])} · 1W ${esc(tv.ratings["1W"])}</div>` : ""}`,
        `${dirT(f.view)} ${f.value != null ? num(f.value, 2) : ""}`,
        ps.vol_scale_pct != null ? `${num(ps.vol_scale_pct, 2)}%` : "-", ownExit(ps.playbook),
        (st.positions || {})[p] ? `<span class="tag buy">IN TRADE</span>` : ps.aligned ? `<span class="tag hold">READY</span>` : `<span class="sub">waiting</span>`,
        esc(ps.next_review ? ps.next_review.slice(5, 16).replace("T", " ") : "-")];
    });
    return block("Every pair: its own entry and exit", table(["Pair", "Fundamental view", "Normal day (volatility model)", "Stop and take-profit for a typical holding period", "Status", "Next review (UTC)"], pairs),
      `Entry: this pair's fundamental score beyond ±${esc(cfg.view_threshold ?? 0.6)}, then the Judge, who picks the holding period (the paid web News Checker is off since 2026-11-05). Exit: your volatility model's take-profit (about a 50% chance of being reached in the period, at most ${num(lvl * 0.25, 0)}% of the account) and stop (about a 20% chance against the trade), the fundamental view turning against it, or the Judge's review. Shown for ${esc(((F.swing || {}).config || {}).default_hold_days || 5)} trading days, in the direction the fundamentals point (long when they are neutral).`);
  }

  function swingAnalysts() {
    const S = F.swing;
    if (!S) return empty("The swing desk is switched off.");
    const st = S.state || {};
    const views = Object.entries(st.ccy_views || {}).sort().map(([c, v]) => [`<b>${esc(c)}</b>`, esc(v.rating), num(v.confidence, 2), esc(v.horizon_days), esc(v.reason), esc(ago(v.ts))]);
    return (st.macro ? block("Macro strategist", `<p><span class="tag hold">${esc(st.macro.risk_mood)}</span></p><p>${esc(st.macro.summary)}</p><p class="sub">${esc(ago(st.macro.ts))}</p>`) : "")
      + block("Currency analysts", table(["Currency", "Rating", "Confidence", "Horizon (days)", "Why", "When"], views, [2, 3]),
        "Each analyst rates its currencies; a pair's fundamental view is the base currency's score minus the quote currency's.");
  }

  function swingPlans() {
    return block("Each trade explained", planCards((F.explain || {}).swing),
      "Click a trade for its plan: why it was opened, how long it is expected to stay, what closes it and what is at risk.");
  }

  function swingHistory() {
    const n = swingNumbers();
    if (!n) return empty("The swing desk is switched off.");
    const S = n.S, LS = (S.scoreboard || {}).live || {};
    const trades = (S.trades || []).slice().reverse().slice(0, 40).map(t => {
      const C = FloorCharts.closedMoney(t, n.aed), L = t.live || {};
      return [`<b>${esc(t.pair)}</b>`, esc(t.direction),
        C.pending ? `<span class="sub">waiting for Capital.com to book it</span>`
                  : `<span class="${cls(C.v)}">${money2(C.v, C.cur)}</span><div class="sub">${C.real ? "your account" + (C.fees ? `, fees ${num(C.fees, 2)}` : "") : "paper only"}</div>`,
        px(L.open_level || t.entry), px(L.close_level || t.exit), esc((t.opened_at || "").slice(5, 16).replace("T", " ")),
        esc(t.held_days), esc(t.exit_reason)];
    });
    const lorders = (S.live_orders || []).slice().reverse().slice(0, 25).map(o => [`<b>${esc(o.pair)}</b>`, esc(o.kind), esc((o.ts || "").slice(5, 16).replace("T", " ")), esc(o.text)]);
    return block("Closed trades", table(["Pair", "Side", "P&L", "Entry", "Exit", "Opened (UTC)", "Days", "Why closed"], trades, [2, 3, 4, 6]),
        LS.trades ? `On your Capital.com account: ${esc(LS.trades)} trade(s), ${esc(LS.wins)} winner(s), net <b class="${cls(LS.net_ccy)}">${money2(LS.net_ccy, LS.currency || "AED")}</b> (real results, overnight fees included).` : "")
      + (lorders.length ? block("Live orders", table(["Pair", "What", "When (UTC)", "Detail"], lorders)) : "");
  }

  // ===================================================================== the EGX desk
  function egxPortfolio() {
    const x = egxNow();
    if (!x) return empty("The EGX desk has not run yet.");
    const { e, live, p } = x;
    const rows = (live ? e.holdings : e.holdings || []).map(h => [`<b>${esc(h.ticker)}</b><div class="sub">${esc(h.name)}</div>`, esc(h.sector), num(h.shares),
      num(h.avg_cost, 2), num(h.price, 2), egp(h.value), `<span class="${cls(h.pnl)}">${egp(h.pnl)} (${pct(h.pnl_pct, 1)})</span>`,
      num(h.weight * 100, 1) + "%", num(h.target_weight * 100, 1) + "%", `<span class="tag ${h.action === "HOLD" ? "hold" : h.action === "SELL" || h.action === "TRIM" ? "sell" : "buy"}">${esc(h.action)}</span>`,
      h.stop_loss != null ? `${num(h.stop_loss, 2)} / ${num(h.take_profit, 2)}<div class="sub">${esc(h.hold_sessions)} sessions, to ${esc(h.plan_ends)}</div>` : "-", tvBrief(h.tv)]);
    const fills = ((F.egx_orders || {}).fills || e.recent_fills || []).slice().reverse().map(f => [`<b>${esc(f.ticker)}</b>`, esc(f.action), num(f.shares), f.price ? num(f.price, 2) : "-", esc(f.date) + (f.time ? " " + esc(f.time) : ""), esc([f.note, f.realized_pnl != null ? "P&L " + egp(f.realized_pnl) : ""].filter(Boolean).join(" · "))]);
    const card = `<div class="cols"><div><div class="big">${egp(p.total)}</div>
        <div class="sub"><span class="${cls(p.pnl_vs_start)}">${p.pnl_vs_start >= 0 ? "+" : ""}${egp(p.pnl_vs_start)} (${pct(p.pnl_vs_start_pct, 2)})</span> vs ${egp(e.start_capital)} start</div>
        <div class="kv" style="margin-top:10px"><span>Cash</span><span>${egp(p.cash)}</span><span>In stocks</span><span>${egp(p.invested)}</span>
        <span>Holdings</span><span>${(live ? live.holdings : e.holdings || []).length}</span><span>Tracking</span><span>${esc(e.portfolio_source)}</span></div>
        ${live ? `<p class="sub">Valued at ${esc(live.seen_at)} with TradingView prices (${esc(live.market)}). ${(live.holdings || []).map(h => `${esc(h.ticker)} ${esc(h.last)} (${h.pnl >= 0 ? "+" : ""}${egp(h.pnl)})`).join(" · ")}</p>` : ""}</div>
      <div data-chart="egx" data-h="170"></div></div>`;
    return block("EGX portfolio (paper)", card)
      + block("Holdings", table(["Stock", "Sector", "Shares", "Avg cost", "Price", "Value", "P&L", "Weight", "Target", "Action", "Stop / take-profit", "TradingView"], rows, [2, 3, 4, 5, 6, 7, 8]),
        `"Stop / take-profit": your volatility model's levels for each holding's period (the stop is reached only about 1 time in 5, never moved down; the take-profit is the fair value kept realistic, or reached about half the time). The Order Desk sells when a session trades through either and your phone hears at once.`)
      + block("Recent fills (paper)", table(["Stock", "Action", "Shares", "Price", "Date", "Note"], fills, [2, 3]),
        "Bought or sold for real? Put what you actually hold in <code>state/egx_my_holdings.json</code> and the desk will use it (see README).");
  }

  function egxOrders() {
    const x = egxNow();
    if (!x) return empty("The EGX desk has not run yet.");
    const { e, OD } = x, orders = egxToPlace(e, OD);
    const execs = (OD.fills || []).filter(f => f.shares).slice(-4).reverse().map(f => `<li>${esc(f.date.slice(5))}${f.time ? " " + esc(f.time) : ""}: ${f.action === "BUY" || f.action === "ADD" ? "bought" : "sold"} ${num(f.shares)} ${esc(f.ticker)} at ${esc(f.price)}</li>`).join("");
    const todo = (OD.status ? `<p class="note"><b>Order Desk:</b> ${esc(OD.status)}${OD.last_check ? ` <span class="sub">(${esc(ago(OD.last_check))})</span>` : ""}</p>` : "")
      + (execs ? `<p class="sub" style="margin:6px 0 0">Recent executions</p><ul style="margin:4px 0 8px">${execs}</ul>` : "")
      + (orders.length ? `<ul class="todo">${orders.map(orderLine).join("")}</ul>` : `<p class="sub">${esc(noOrdersText(e))}</p>`)
      + `<p class="sub" style="margin-top:8px">Limit orders, valid for one session. Prices from ${esc(e.session)} close.</p>`;
    const ordRows = (e.orders || []).map(o => [
      `<b>${esc(o.ticker)}</b><div class="sub">${esc(o.name)} · ${esc(o.sector)}</div>`,
      `<span class="tag ${o.action === "BUY" || o.action === "ADD" ? "buy" : "sell"}">${esc(o.action)}</span>`,
      num(o.shares), num(o.price_now, 2), `<b>${num(o.limit, 2)}</b>`, o.chase_max ? num(o.chase_max, 2) : "-",
      egp(o.value_egp), num(o.target_weight * 100, 1) + "%",
      `${num(o.est_fees_egp, 2)}<div class="sub">${egp(o.cash_needed_egp != null ? o.cash_needed_egp : o.cash_back_egp)} ${o.cash_needed_egp != null ? "total" : "back"}</div>`,
      tvBrief(o.tv),
      o.fresh_news ? `<b class="${o.fresh_news.verdict === "AGAINST" ? "down" : o.fresh_news.verdict === "SUPPORTS" ? "up" : ""}">${esc(o.fresh_news.verdict)}</b><div class="sub">${esc(o.fresh_news.summary || "")}</div>` : "-",
      esc(o.analyst ? `${o.analyst.rating} (${num(o.analyst.confidence, 2)}): ${o.analyst.reason}` : "Model only"),
      esc(o.judge || "")]);
    const vet = (e.vetoed || []).map(o => [`<b>${esc(o.ticker)}</b>`, esc(o.action), num(o.shares), num(o.limit, 2), esc(o.judge)]);
    const watch = (e.watchlist || []).map(w => [`<b>${esc(w.ticker)}</b> <span class="sub">${esc(w.name)}</span>`, esc(w.sector),
      num(w.price, 2), pct(w.blended_month_pct, 2), tvBrief(w.tv), esc(w.analyst ? `${w.analyst.rating}: ${w.analyst.reason}` : "-")]);
    return block("Do this next (next session)", todo)
      + block("Approved orders", table(["Stock", "Action", "Shares", "Last", "Limit", "Don't chase", "Value", "Target weight", "Thndr fees", "TradingView", "News check", "Analyst", "Judge"], ordRows, [2, 3, 4, 5, 6, 7, 8])
        + (e.no_trade_reason ? `<p class="note">${esc(e.no_trade_reason)}</p>` : ""),
        `${e.universe ? `Chosen from the ${num(e.universe.liquid || 0)} most-traded EGX stocks (${num(e.eligible)} eligible today). ` : ""}Place these on Thndr as limit orders. "Limit" is the most you pay (buys) or the least you accept (sells). If the price runs above "don't chase", skip it.`)
      + block("Held back", table(["Stock", "Action", "Shares", "Limit", "Why"], vet, [2, 3]), "Vetoed by the Judge, or waiting because the Judge could not run.")
      + block("Watchlist (next best, not bought)", table(["Stock", "Sector", "Price", "Expected excess / month", "TradingView", "Analyst"], watch, [2, 3]));
  }

  function egxPlans() {
    return block("Each holding explained", planCards((F.explain || {}).egx),
      "Click a holding for its plan: why it was bought, why it is still held, how long, its stop loss and take-profit (your volatility model) and what is at risk.");
  }

  function egxAnalysts() {
    const e = F.egx;
    if (!e) return empty("The EGX desk has not run yet.");
    const m = e.macro;
    const sectors = Object.entries(e.sector_views || {}).map(([id, v]) => `<div class="note"><b>${esc(nameOf(id))}</b> <span class="tag ${v.view === "POSITIVE" ? "buy" : v.view === "NEGATIVE" ? "sell" : "hold"}">${esc(v.view)}</span><div>${esc(v.summary)}</div></div>`).join("");
    const ratings = Object.entries(e.ratings || {}).sort((a, b) => a[0].localeCompare(b[0])).map(([tk, r]) => [`<b>${esc(tk)}</b>`, esc(r.rating), num(r.confidence, 2), esc(r.reason)]);
    return block("Macro & Pound Strategist", m ? `<p><span class="tag hold">EGP ${esc(m.egp_outlook)}</span><span class="tag hold">CBE ${esc(m.rates_outlook)}</span><span class="tag hold">${esc(m.equity_mood)}</span></p><p>${esc(m.summary)}</p>` : empty("Unavailable this run."))
      + block("Sector analysts", sectors || empty("Unavailable this run."), `${esc(e.session)} run.`)
      + block("Every stock rating", table(["Stock", "Rating", "Confidence", "Reason"], ratings, [2]));
  }

  function egxModel() {
    const e = F.egx;
    if (!e) return empty("The EGX desk has not run yet.");
    const h = e.habit || {}, t = e.crra_target || {}, c = e.crra_current || {};
    return `<div class="cols">${block("Habit-CCAPM state", `<div class="kv">
          <span>Market last month</span><span>${pct(h.g_t_month_pct, 2)} (z ${num(h.g_z_score, 2)})</span>
          <span>Habit adjustment</span><span>${pct(h.habit_shift_month_pct, 2)} per month</span>
          <span>CBE rate (cash)</span><span>${pct(h.rf_cbe_month_pct, 2)} per month</span>
          <span>gamma / delta / w</span><span>${num(h.gamma, 1)} / ${num(h.delta, 2)} / ${num(h.w_habit, 2)}</span></div>
          <p class="note">${esc(h.mood || "")}</p>`)}
        ${block("CRRA risk control", `<div class="kv">
          <span>Stocks / cash</span><span>${num(t.equity_share_pct, 0)}% / ${num(t.cash_share_pct, 0)}%</span>
          <span>Expected return</span><span>${pct(t.exp_total_year_pct, 1)} a year (model)</span>
          <span>Volatility</span><span>${num(t.vol_year_pct, 1)}% a year</span>
          <span>Certainty equivalent</span><span>${pct(t.ce_excess_month_pct, 2)} a month over cash (now ${pct(c.ce_excess_month_pct, 2)})</span></div>
          <p class="sub">Model expected returns are noisy estimates, not promises.</p>`)}</div>`
      + block("Data checks", (e.warnings || []).length || (e.notes || []).length ? `<ul>${(e.warnings || []).map(w => `<li class="warnc">${esc(w)}</li>`).join("")}${(e.notes || []).map(n => `<li class="sub">${esc(n)} <i>(handled automatically)</i></li>`).join("")}</ul>` : empty("No data problems this run."));
  }

  // ===================================================================== the valuation desk
  let valSector = "", valSort = "upside";
  const flagShort = f => esc(String(f).split(":")[0]);
  function valOverview() {
    const V = F.valuation;
    if (!V) return empty("The valuation desk has not run yet. It runs inside the EGX desk after each close.");
    const c = V.counts || {}, s = V.settings || {}, x = V.excel || {}, all = V.companies || [];
    const today = new Date().toISOString().slice(0, 10), soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const due = all.filter(r => r.nx && r.ns !== "OVERDUE" && r.nx >= today && r.nx <= soon).sort((a, b) => a.nx.localeCompare(b.nx));
    const late = all.filter(r => r.ns === "OVERDUE").sort((a, b) => (b.qb || 0) - (a.qb || 0));
    const p = v => v == null ? "-" : num(v, v < 2 ? 3 : 2);
    const reads = (V.reads || []).slice().reverse().map(r => [`<b>${esc(r.ticker)}</b>`, esc((r.ts || "").slice(5, 16).replace("T", " ")),
      esc(nameOf(r.agent)), esc(String(r.mode || "").toLowerCase()), r.found ? `<span class="up">found ${esc(r.period_end || "")}</span>` : `<span class="sub">not out yet</span>`, esc(r.summary || "")]);
    const revs = (V.revisions || []).slice().reverse().map(r => [`<b>${esc(r.ticker)}</b>`, esc((r.ts || "").slice(0, 10)), esc(r.trigger),
      `${p(r.fv_before)}${r.fv_after_quarter != null ? ` &rarr; ${p(r.fv_after_quarter)}` : ""} &rarr; <b>${p(r.fv_after)}</b>`, esc(r.verdict ? String(r.verdict).replace(/_/g, " ").toLowerCase() : "-"),
      esc(r.reason || (r.flags || []).join("; "))]);
    return block("The desk today", `<div class="kv"><span>Valued</span><span>${num(c.valued)} of ${num(c.companies)} companies (${num(c.reviewed_by_analyst)} reviewed by an analyst, the rest on the code's baseline)${c.no_data ? `; ${num(c.no_data)} have no figures yet` : ""}${c.stale ? `; ${num(c.stale)} with stale figures` : ""}</span>
        <span>Results</span><span>${num(c.due_30d)} due in the next 30 days · <span class="${c.late ? "down" : ""}">${num(c.late)} late</span> (filing deadline passed, figures not out or not on TradingView yet)</span>
        <span>Market reading</span><span>the median stock ${c.median_upside != null ? `is <span class="${cls(c.median_upside)}">${pct(c.median_upside, 1)}</span> against its fair value` : "has no reliable value yet"}${c.median_upside_big15 != null ? `; the 15 biggest companies ${pct(c.median_upside_big15, 1)}` : ""}. The portfolio uses each stock's valuation against this median, so a model-wide tilt does not push it into cash.</span>
        <span>Cost of capital</span><span>risk-free ${num((s.rf || 0) * 100, 0)}% easing to ${num((s.rf_long || 0) * 100, 0)}%, equity risk premium ${num((s.erp || 0) * 100, 1)}%, long-run growth ${num((s.g_inf || 0) * 100, 0)}%, tax ${num((s.tax || 0) * 100, 1)}%</span>
        <span>Excel spreads</span><span><code>${esc(x.folder || "-")}</code>${(x.skipped || []).length ? ` <span class="warnc">${esc(x.skipped.join("; "))}</span>` : ""}</span>
        <span>Updated</span><span>${esc(ago(V.as_of))}</span></div>`)
      + `<div class="cols">${block("Results due in the next 30 days", table(["Stock", "Date", "Period"], due.map(r => [`<b>${esc(r.t)}</b> <span class="sub">${esc(r.n || "")}</span>`, esc(r.nx), esc(r.nl || "")])))}
        ${block(`Late results (${num(late.length)})`, table(["Stock", "Next period", "Quarters behind"], late.slice(0, 15).map(r => [`<b>${esc(r.t)}</b> <span class="sub">${esc(r.n || "")}</span>`, esc(r.nl || ""), num(r.qb || 0)]), [2])
          + (late.length > 15 ? `<p class="sub">And ${num(late.length - 15)} more, each one quarter or two behind: ${late.slice(15).map(r => esc(r.t)).join(", ")}. The trackers chase them, a few a day, holdings first.</p>` : ""))}</div>`
      + block("Latest revisions", table(["Stock", "Date", "Trigger", "Fair value", "Verdict", "Why"], revs), "Fair value before the results &rarr; after the new figures with the old forecast &rarr; after the analyst's review.")
      + block("Earnings Trackers' latest reads", table(["Stock", "When", "Tracker", "Task", "Result", "Summary"], reads));
  }

  function valCompanies() {
    const V = F.valuation;
    if (!V) return empty("The valuation desk has not run yet.");
    const all = V.companies || [], sectors = [...new Set(all.map(r => r.s).filter(Boolean))].sort();
    const key = { upside: r => -(r.up == null ? -1e9 : r.up), name: r => r.t, next: r => r.nx || "9999", conf: r => -(r.cf || 0) }[valSort];
    const rows = all.filter(r => !valSector || r.s === valSector).sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
    const p = v => v == null ? "-" : num(v, v < 2 ? 3 : 2);
    const tr = r => `<tr class="valrow" data-val="${esc(r.t)}"><td data-label="Stock"><b>${esc(r.t)}</b><div class="sub">${esc(r.n || "")}</div></td><td data-label="Sector">${esc(r.s || "")}</td>
      <td class="num" data-label="Price">${p(r.p)}</td><td class="num" data-label="Fair value"><b>${p(r.fv)}</b></td><td class="num" data-label="Upside"><span class="${cls(r.up)}">${pct(r.up, 1)}</span></td>
      <td class="num" data-label="DCF">${p(r.dcf)}</td><td class="num" data-label="Multiples">${p(r.mu)}</td><td class="num" data-label="DDM">${p(r.ddm)}</td><td class="num" data-label="Confidence">${r.cf != null ? num(r.cf, 2) : "-"}</td>
      <td data-label="Latest quarter">${esc(r.lq || "-")}${(r.fl || []).length ? `<div class="sub">${r.fl.map(f => `<span class="${/BAD|LOSS|SQUEEZE|SLOWING|DOWN/.test(f) ? "down" : "up"}">${flagShort(f)}</span>`).join(" · ")}</div>` : ""}</td>
      <td data-label="Analyst">${r.vd ? esc(String(r.vd).replace(/_/g, " ").toLowerCase()) : `<span class="sub">${r.src === "analyst" ? "-" : "baseline"}</span>`}${r.tr ? `<div class="sub">${esc(r.tr.toLowerCase())}</div>` : ""}</td>
      <td data-label="Next results">${esc(r.nx || "-")}<div class="sub">${esc(r.nl || "")}${r.ns === "OVERDUE" ? ` <span class="down">late</span>` : ""}</div></td></tr>`;
    const head = ["Stock", "Sector", "Price", "Fair value", "Upside", "DCF", "Multiples", "DDM", "Confidence", "Latest quarter", "Analyst", "Next results"];
    return block(`Every company (${num(rows.length)})`, `<div class="valbar"><label class="sub">Sector <select id="val-sector"><option value="">All</option>${sectors.map(s2 => `<option ${s2 === valSector ? "selected" : ""}>${esc(s2)}</option>`).join("")}</select></label>
        <label class="sub">Sort <select id="val-sort">${[["upside", "Upside"], ["next", "Next results"], ["conf", "Confidence"], ["name", "Ticker"]].map(([k, l]) => `<option value="${k}" ${k === valSort ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <div class="tablewrap"><table><thead><tr>${head.map((h, i) => `<th class="${[2, 3, 4, 5, 6, 7, 8].includes(i) ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(tr).join("")}</tbody></table></div>
      <p class="sub">Confidence runs to 0.40: lower when the three methods disagree, the figures are stale or the company is missing data. Upside is fair value against today's price; a fairly priced stock still has to earn its cost of equity, so the 12-month target sits above the fair value.</p>`,
      "Click a company for its full five-year forecast, its last eight quarters and the three valuations.");
  }

  // ===================================================================== the news desk
  const MAT = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
  const sentTag = v => v == null ? "-" : `<span class="tag ${v > 0.15 ? "buy" : v < -0.15 ? "sell" : "hold"}">${v > 0 ? "+" : ""}${num(v, 2)}</span>`;
  const NEWS_HEAD = ["Instrument", "Sentiment", "Materiality", "Priced in", "Scout's read", "Read"];
  function newsRank(a, b) { return (MAT[b[1].materiality] || 0) - (MAT[a[1].materiality] || 0) || Math.abs(b[1].sentiment) - Math.abs(a[1].sentiment); }
  function newsItems(r) {
    return (r.items || []).map(i => `<li><span class="sub">${esc(i.date)} · ${esc(i.source)}</span> ${esc(i.headline)} <span class="sub">(${esc(i.impact)}, ${esc(i.materiality)}${i.relevance && i.relevance !== "DIRECT" ? ", " + esc(i.relevance.toLowerCase()) : ""})</span></li>`).join("");
  }
  const newsRow = ([k, r]) => [`<b>${esc(k)}</b>`, sentTag(r.sentiment), esc(r.materiality), esc(r.priced_in || "-"), esc(r.key_point) +
    ((r.red_flags || []).length ? `<div class="sub">Red flags: ${esc(r.red_flags.join("; "))}</div>` : "") +
    ((r.items || []).length ? `<details><summary>${esc(r.headlines_read)} headlines read</summary><ul>${newsItems(r)}</ul></details>` : ""),
    esc(ago(r.read_at)) + (r.stale ? " <span class=\"down\">(stale)</span>" : "")];
  function newsFx() {
    const N = F.news;
    if (!N) return empty("The news scouts are switched off.");
    const pairs = new Set(((F.swing || {}).config || {}).pairs || []);
    const fx = Object.entries(N.fx || {}).filter(([k]) => !pairs.size || pairs.has(k)).sort(newsRank);
    return block(`Forex, gold and bitcoin (${fx.length})`, table(NEWS_HEAD, fx.map(newsRow), [1]),
      "Every 4 hours, day and night (02:00, 06:00, 10:00, 14:00, 18:00 and 22:00 Cairo). A read made while the market is closed is not graded.");
  }
  function newsEgx() {
    const N = F.news;
    if (!N) return empty("The news scouts are switched off.");
    const egx = Object.entries(N.egx || {}).sort(newsRank), withNews = egx.filter(([, r]) => r.materiality !== "NONE");
    return block(`EGX stocks with news (${withNews.length})`, table(NEWS_HEAD, withNews.map(newsRow), [1])
      + `<p class="sub">${egx.length - withNews.length} more EGX stock(s) had no news in the last two weeks.</p>`,
      "Once per EGX run, right before the desk decides. Each stock's news is sized against the company (market cap, revenue, profit).");
  }

  // ===================================================================== the political desk
  function polWorld() {
    const G = (F.geo || {}).world, GO = (G || {}).opinion;
    if (!G) return empty("Not run yet.");
    const lex = ((F.geo || {}).egypt || {}).lexicon || {};
    const geoRows = GO ? (GO.instruments || []).map(i => [`<b>${esc(i.pair)}</b>`,
      `<span class="${cls(i.pressure)}">${num(i.pressure, 2)}</span>`, num(i.confidence, 2),
      `<span class="${cls(((G.code || {}).pairs || {})[i.pair])}">${num(((G.code || {}).pairs || {})[i.pair], 0)}</span>`,
      `<span class="${cls(((G.ai || {}).pairs || {})[i.pair])}">${num(((G.ai || {}).pairs || {})[i.pair], 0)}</span>`,
      esc((i.key_issues || []).join("; ")), `<div class="sub">up: ${esc(i.case_up)}</div><div class="sub">down: ${esc(i.case_down)}</div>`]) : [];
    const conflictRows = GO ? (GO.conflicts || []).map(c => [esc(c.front), esc(c.status), num(c.escalation_probability_7d_pct, 0) + "%", esc(c.currencies), esc(c.note)]) : [];
    const pool = (F.geo || {}).pool || {}, gx = (F.geo || {}).x || {};
    const poolLine = pool.articles != null ? `Looked at <b>${num(pool.articles, 0)}</b> different articles in the last 24 hours from ${num(pool.outlets, 0)} outlets (target ${num(pool.target || 3000, 0)}${pool.articles < (pool.target || 3000) ? ", <span class=\"down\">below target</span>" : ""}): ${num(pool.reputable, 0)} from reputable outlets; the AI reader read ${num(pool.ai_read, 0)} and judged ${num(pool.ai_material, 0)} material. X posts: ${gx.enabled ? `on, ${num(gx.posts_today || 0, 0)} today (about ${num(gx.usd_today || 0, 2)} USD on X's bill)` : "off until an X token is added (X charges about 0.005 USD a post); the same reporters' articles are followed through Google News"}.` : "";
    return block("Geopolitics & Conflicts Analyst", GO ? `<p><span class="tag ${GO.global_risk.level === "LOW" ? "buy" : GO.global_risk.level === "ELEVATED" ? "hold" : "sell"}">Global risk ${esc(GO.global_risk.level)} ${num(GO.global_risk.score, 0)}</span>${GO.shock ? ` <span class="tag sell">SHOCK</span> ${esc(GO.shock_note)}` : ""} <span class="sub">read ${esc(ago(G.read_at))}</span></p><p>${esc(GO.summary)}</p>${GO.what_would_change_my_mind ? `<p class="sub">What would change its mind: ${esc(GO.what_would_change_my_mind)}</p>` : ""}` : empty("No read yet."),
        `Every war, conflict, sanction and political crisis, scored each hour by ${num(lex.keywords, 0)} weighted keywords and ${num(lex.phrases, 0)} weighted phrases and labelled by the AI reader, then the analyst's own read every 6 hours (02:00, 08:00, 14:00 and 20:00 Cairo, and after a shock), written without seeing the desk's trades.`)
      + (conflictRows.length ? block("Conflict fronts", table(["Front", "Status", "Worse in 7 days", "Currencies", "Note"], conflictRows, [2])) : "")
      + (geoRows.length ? block("Each instrument", table(["Instrument", "Agent pressure", "Confidence", "Code pressure", "AI reader", "Key issues", "Both sides"], geoRows, [1, 2, 3, 4]),
        "Pressure: + pushes the price up, - down (agent -1..+1, code and AI reader -100..+100).") : "")
      + (poolLine ? block("The articles", `<p class="sub">${poolLine}</p>`) : "");
  }

  // The EGX desk's Political & Economic Factors Analyst (owner 2026-10-27).
  function polEgypt() {
    const P = (F.geo || {}).egypt;
    if (!P) return empty("Not run yet.");
    const C = P.code || {}, R = P.read || {}, M = R.political_mood || {};
    const tag = l => `<span class="tag ${String(l).includes("NEG") ? "sell" : String(l).includes("POS") ? "buy" : "hold"}">${esc(String(l).replace("_", " "))}</span>`;
    const tracks = Object.entries(C.tracks || {}).map(([t, v]) => {
      const a = (R.tracks || []).find(x => x.track === t) || {};
      return [`<b>${esc(t)}</b>`, `<span class="${cls(v.mood)}">${num(v.mood, 0)}</span>`, esc(v.headlines),
              a.score != null ? `<span class="${cls(a.score)}">${num(a.score, 0)}</span>` : "-", esc(a.summary || "")];
    });
    const war = (R.war_risk || []).map(w => [`<b>${esc(w.front)}</b>`, num(w.probability_30d_pct, 0) + "%", num(w.egypt_drawn_in_30d_pct, 0) + "%",
      esc(w.trend), `<div>${esc(w.evidence)}</div><div class="sub">base rate: ${esc(w.base_rate)}</div>`]);
    const fronts = Object.entries(C.fronts || {}).map(([f, d]) => [esc(d.name || f), num(d.heat, 0), esc(d.n_up), esc(d.n_down)]);
    const events = (R.world_events || []).map(e => [esc(e.event), esc(e.egypt_channel), `<span class="${e.direction === "GOOD" ? "up" : e.direction === "BAD" ? "down" : ""}">${esc(e.direction)}</span>`, esc(e.materiality),
      esc([(e.sectors_hurt || []).length ? "hurts " + e.sectors_hurt.join(", ") : "", (e.sectors_helped || []).length ? "helps " + e.sectors_helped.join(", ") : ""].filter(Boolean).join("; "))]);
    const laws = (R.laws || []).map(x => [esc(x.title), `<span class="tag ${x.stage === "IN_FORCE" ? "buy" : x.stage === "APPROVED" ? "hold" : ""}">${esc(x.stage.replace("_", " "))}</span>`, esc(x.date), esc(x.impact), esc(x.effect)]);
    const tilts = (R.sector_tilts || []).filter(t => t.tilt !== "NEUTRAL").map(t => [esc(t.sector), esc(t.tilt), esc(t.reason)]);
    return block("Political & Economic Factors Analyst", `<p>Mood: code ${tag(C.label || "-")} <b class="${cls(C.egypt_mood)}">${num(C.egypt_mood, 0)}</b> · AI reader <b class="${cls((P.ai || {}).egypt_mood)}">${num((P.ai || {}).egypt_mood, 0)}</b> · analyst ${M.label ? tag(M.label) : "-"} <b class="${cls(M.score)}">${num(M.score, 0)}</b>${(P.shock || []).length ? ` <span class="tag sell">SHOCK</span> ${esc(P.shock.map(s => s.name).join(", "))}` : ""}${(P.markets || {}).risk_tone ? ` · other markets <b>${esc(P.markets.risk_tone.replace("_", " "))}</b>` : ""}</p>
        ${R.summary ? `<p>${esc(R.summary)}</p>` : ""}${M.vs_code ? `<p class="sub">vs the code: ${esc(M.vs_code)}</p>` : ""}
        ${(P.articles || {}).articles != null ? `<p class="sub">Looked at <b>${num(P.articles.articles, 0)}</b> different articles in the last 24 hours (${num(P.articles.reputable, 0)} from reputable outlets, ${num(P.articles.ai_material, 0)} judged material by the AI reader).</p>` : ""}
        ${table(["Track", "Code mood", "Headlines", "Analyst", "Analyst's view"], tracks, [1, 2, 3])}`,
        `Egypt's politics, war risk on its borders, world events and how they reach Egypt, other markets and new laws. Code scores every headline with ${num((P.lexicon || {}).keywords, 0)} weighted keywords and ${num((P.lexicon || {}).phrases, 0)} weighted phrases (English and Arabic); the analyst reads once a day at 13:00 Cairo, without seeing the portfolio. Read ${esc(ago(P.read_at))}, scores ${esc(ago(P.as_of))} (${num(C.headlines_scored, 0)} headlines).`)
      + block("War and conflict risk", table(["Front", "Escalation in 30 days", "Egypt drawn in", "Trend", "Evidence"], war, [1, 2])
        + `<p class="sub">Code heat 0-100 (headlines that escalate minus those that calm, newest counting most):</p>` + table(["Front", "Heat", "Escalating", "Calming"], fronts, [1, 2, 3]))
      + block("World events reaching Egypt", table(["Event", "Channel", "For Egypt", "Size", "Sectors"], events))
      + block("Laws and regulations", table(["Law or decree", "Stage", "Date", "Impact", "Effect"], laws))
      + (tilts.length ? block("Sector tilts from politics", table(["Sector", "Tilt", "Why"], tilts)) : "")
      + ((R.red_flags || []).length || R.what_would_change_my_mind ? block("Red flags", `${(R.red_flags || []).length ? `<ul>${R.red_flags.map(w => `<li class="warnc">${esc(w)}</li>`).join("")}</ul>` : ""}${R.what_would_change_my_mind ? `<p class="sub">What would change the analyst's mind: ${esc(R.what_would_change_my_mind)}</p>` : ""}`) : "");
  }

  // The Political + News Index and the Judge's daily rating of the political read (owner 2026-11-03).
  function polIndex() {
    const st = (F.swing || {}).state || {}, IX = st.sentiment_index || {}, RT = st.geo_ratings || {};
    const rows = Object.entries(IX.pairs || {}).map(([p, r]) => {
      const j = r.judge_rating;
      return [`<b>${esc(p)}</b>`, r.political != null ? `<span class="${cls(r.political)}">${num(r.political, 0)}</span>` : "-",
        r.news != null ? `<span class="${cls(r.news)}">${num(r.news, 0)}</span>` : "-",
        r.index != null ? `<b class="${cls(r.index)}">${num(r.index, 0)}</b>` : "-", esc((r.label || "-").replace("_", " ")),
        esc(r.agree || "-"), j ? `<b>${esc(j.score)}/5</b> ${esc(j.verdict)}<div class="sub">${esc(j.why)}</div>` : "-"];
    });
    return block("Political + News Index", rows.length ? table(["Instrument", "Political", "News", "Index", "Reading", "The two", "Judge's rating"], rows, [1, 2, 3]) : empty("No index yet."),
      `One number per instrument, -100 to +100 (+ pushes the price up): the average of the political sentiment (the Geopolitics Analyst's pressure x confidence) and the news sentiment (the pair's news scout: sentiment x confidence x materiality). Equal weights until both have graded records.${RT.headline ? ` <b>Swing Judge, ${esc(ago(RT.ts))}:</b> ${esc(RT.headline)}` : ""}`);
  }

  function polMemory() {
    const rows = ((F.geo || {}).memory || []).map(m => [esc(m.date), `<div>${esc(m.what)}</div>${m.after ? `<div class="sub">then ${num(m.after["1d_pct"], 2)}% next day, ${num(m.after["3d_pct"], 2)}% over 3 days</div>` : ""}`,
      (m.news || []).map(n => `<div class="sub">${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>` : esc(n.title)} (${esc(n.source)})</div>`).join("") || "-"]);
    return block("Event memory", rows.length ? table(["Date", "What happened", "News alongside"], rows) : empty("No events yet."),
      "The floor remembers which news came with each big move, shock, surprise release and closed trade (headlines only), and shows the political agents the past events most like today's news.");
  }

  // ===================================================================== the PRO12 desk
  function pro12Terminal() {
    const T = F.terminal;
    const intro = `Every afternoon before the EGX run, the terminal agents work <b>DFN Mubasher PRO 12</b> on your laptop through Windows' accessibility layer, so they never touch your mouse. The <b>Results Watcher</b> reads every covered company's EGX announcements and spots results the day they come out; the <b>Listings Clerk</b> marks stocks that stopped trading; the <b>Terminal Spreader</b> pulls balance sheets and ratios only for new or late results and adds the figures that agree with TradingView to the spreads (source "DFN PRO12"). PRO12 must be open and signed in, with a Company Profile window open (minimized to its tab is fine); if PRO12 is hidden behind other windows, it is brought to the front for the few minutes of the run, only once you have been away from the keyboard for 2 minutes.`;
    if (!T) return block("Terminal agents", empty("The terminal desk has not run yet. It runs Sunday to Thursday at 15:10 (catch-ups 17:30, 20:30, 22:30)."), intro);
    const ok = T.status === "ok" || T.status === "partial";
    const res = Object.entries(T.results || {});
    const lc = (T.listings || {}).counts || {}, na = Object.entries((T.listings || {}).not_active || {});
    const pulls = (T.pulls || []).filter(x => (x.stored || []).length || x.held_back || (x.notes || []).length);
    const kinds = Object.entries(T.new_by_kind || {}).filter(([k]) => !["halt", "disclosure_form", "reminder"].includes(k)).map(([k, n]) => `${num(n)} ${esc(k.replace(/_/g, " "))}`).join(", ");
    return block("Last run", `<div class="kv"><span>Last run</span><span>${ok ? `<span class="up">${T.status === "partial" ? "partly done (the 17:30 run finishes it)" : "ok"}</span>` : `<span class="down">${esc(String(T.status || "").replace(/_/g, " "))}</span>`} · ${esc(ago(T.as_of))}${T.seconds != null ? ` · ${num(T.seconds / 60, 1)} min` : ""}${T.detail ? `<div class="sub warnc">${esc(T.detail)}</div>` : ""}</span>
        <span>Announcements</span><span>${num(T.companies_read || 0)} companies read · ${num(T.new_items || 0)} new${kinds ? ` (${kinds})` : ""}</span>
        <span>Results spotted</span><span>${res.length ? res.map(([t, r]) => `<b>${esc(t)}</b> ${esc(r.period_end || "new period")}`).join(" · ") : "none new"}</span>
        <span>Figures added</span><span>${num(T.filled || 0)} companies${(T.held_back || []).length ? ` · <span class="warnc">held back: ${T.held_back.map(esc).join(", ")}</span>` : ""}</span>
        <span>Listings</span><span>${Object.entries(lc).map(([k, n]) => `${num(n)} ${esc(k.toLowerCase().replace(/_/g, " "))}`).join(" · ") || "-"}${na.length ? `<div class="sub">${na.slice(0, 6).map(([t, w]) => `<b>${esc(t)}</b> ${esc(w)}`).join("; ")}</div>` : ""}</span>
        ${T.digest ? `<span>Watcher's digest</span><span>${esc(T.digest)}</span>` : ""}</div>`, intro)
      + (pulls.length ? block("Figures pulled", table(["Stock", "Why pulled", "PRO12 up to", "Added", "Note"], pulls.map(x => [`<b>${esc(x.ticker)}</b>`, esc((x.reasons || []).join("; ")), esc(x.newest_pro12 || "-"),
        x.held_back ? `<span class="warnc">held back</span>` : (x.stored || []).length ? `<span class="up">${x.stored.map(esc).join(", ")}</span>` : "balance sheet",
        esc(x.held_back || x.note || (x.notes || []).join(" ") || "")]))) : "");
  }

  // The Order Book Clerk's PRO12 snapshots (owner 2026-11-03): midday and the last 10 minutes before the close.
  function pro12Books() {
    const O = F.orderbook;
    const intro = "The waiting bids and offers of every followed stock, captured twice a session: from 12:15 and from 14:20 (the last 10 minutes before the close). Imbalance: +1 all buyers, -1 all sellers (top 5 levels). A wall is a level holding 3 times the usual size. An order book shows intentions that can be pulled in a second.";
    if (!O) return block("Order books", empty("No snapshot yet."), intro);
    const rows = Object.entries(O.books || {}).sort((a, b) => (b[1].held - a[1].held) || Math.abs(b[1].imbalance || 0) - Math.abs(a[1].imbalance || 0)).slice(0, 40)
      .map(([t, b]) => [`<b>${esc(t)}</b>${b.held ? ' <span class="tag hold">held</span>' : ""}`, num(b.best_bid, 2), num(b.best_offer, 2), num(b.spread_pct, 2) + "%",
        num(b.bid_qty, 0), num(b.offer_qty, 0), `<span class="${cls(b.imbalance)}">${num(b.imbalance, 2)}</span>${b.midday_imbalance != null ? `<div class="sub">midday ${num(b.midday_imbalance, 2)}</div>` : ""}`,
        esc((b.walls || []).map(w => `${w.side} ${num(w.qty, 0)} at ${num(w.price, 2)} (${num(w.distance_pct, 1)}% away)`).join("; ") || "-")]);
    const M = O.market || {}, N = O.note || {};
    return block("Latest snapshot", `<p><b>${esc(O.label)}</b> snapshot ${esc(O.local || "")} Cairo: ${esc(O.status)}, ${num(O.parsed, 0)} of ${num(O.of, 0)} books${O.by_ai ? ` (${num(O.by_ai, 0)} read by the AI)` : ""}; ${num(M.buyers_lean, 0)} lean to buyers, ${num(M.sellers_lean, 0)} to sellers.${O.detail ? ` <span class="sub">${esc(O.detail)}</span>` : ""}</p>`
        + (N.market ? `<p>${esc(N.market)}</p>` : "") + ((N.notable || []).length ? `<ul>${N.notable.map(x => `<li><b>${esc(x.ticker)}</b>: ${esc(x.note)}</li>`).join("")}</ul>` : ""), intro)
      + (rows.length ? block("Every book", table(["Stock", "Best bid", "Best offer", "Spread", "Bids (top 5)", "Offers (top 5)", "Imbalance", "Walls"], rows, [1, 2, 3, 4, 5, 6])) : "");
  }

  // ===================================================================== the Swing Judge
  function sjMeetings() {
    const S = F.swing || {}, all = S.meetings || [];
    const ms = all.filter(m => !m.kind).slice().reverse().slice(0, 6), em = all.filter(m => m.kind === "emergency").slice().reverse();
    const h6m = all.filter(m => m.kind === "h6_entry").slice().reverse().slice(0, 6);
    const one = m => {
      const jd = m.judge;
      return block(`${jd ? esc(jd.headline) : "Judge unavailable"} <span class="sub" style="font-weight:400">${esc(ago(m.ts))}</span>`,
        jd ? `<p>${esc(jd.summary)}</p>` + table(["Pair", "Decision", "Review every", "Reason"], (jd.decisions || []).map(d => [`<b>${esc(d.pair)}</b>`, decTag(d.decision), esc(d.review_hours) + " h", esc(d.reason)]))
          : empty("The Judge could not run at this meeting."));
    };
    return h6m.map(m => block(`H6 entry meeting <span class="sub" style="font-weight:400">${esc(ago(m.ts))}</span>`, h6Entry(m, true))).join("")
      + (ms.length ? (h6m.length ? `<h3 style="margin:18px 0 6px">Before H6 (the fundamentals system)</h3>` : "") + ms.map(one).join("") : h6m.length ? "" : block("Trade meetings", empty("No meeting yet.")))
      + (em.length ? block("Emergency meetings", table(["Pair", "When (UTC)", "Release", "Decision", "Reason"], em.map(m => [`<b>${esc(m.pair)}</b>`, esc((m.ts || "").slice(5, 16).replace("T", " ")),
          esc(`${(m.release || {}).country || ""} ${(m.release || {}).title || ""}`), decTag(m.decision), esc(m.reason)])),
        "A News Sentinel calls one when a high-impact release surprises against an open trade.") : "");
  }

  function sjReviews() {
    const rs = ((F.swing || {}).meetings || []).filter(m => m.kind === "review").slice().reverse().slice(0, 8);
    if (!rs.length) return block("Open-trade reviews", empty("No open-trade review yet."));
    return rs.map(m => {
      const rv = m.review || {};
      return block(`${esc(rv.headline || "Review")} <span class="sub" style="font-weight:400">${esc(ago(m.ts))}</span>`,
        table(["Pair", "Decision", "Would open today?", "Next look", "Reason"], (rv.decisions || []).map(d => [`<b>${esc(d.pair)}</b>`, decTag(d.decision), d.would_open_today ? "yes" : "no", esc(d.next_review_hours) + " h", esc(d.reason)])));
    }).join("");
  }

  function sjRatings() {
    const RT = ((F.swing || {}).state || {}).geo_ratings || {};
    if (!RT.pairs) return block("Political ratings", empty("No rating yet. The Judge rates the political read once a day."));
    const rows = Object.entries(RT.pairs).map(([p, r]) => [`<b>${esc(p)}</b>`, `<b>${esc(r.score)}/5</b>`, decTag(r.verdict), esc(r.why)]);
    return block(esc(RT.headline || "Latest rating"), (RT.overall ? `<p>${esc(typeof RT.overall === "string" ? RT.overall : JSON.stringify(RT.overall))}</p>` : "")
        + table(["Instrument", "Score", "Verdict", "Why"], rows),
      `Rated ${esc(ago(RT.ts))}, on the Geopolitics Analyst's read of ${esc((RT.read_at || "").slice(0, 16).replace("T", " "))} UTC. 1 = the read looks wrong, 5 = fully agree. The report card checks whether high ratings go with reads that turn out right.`);
  }

  function sjRecord() {
    const f = (F.weekly || {}).facts || {}, sj = f.swing_judge || {};
    return block("Approved against vetoed", `<div class="kv">
        <span>Approved trades</span><span>${num((sj.approved || {}).n || 0)} · avg ${pct((sj.approved || {}).avg_move_pct, 2)}</span>
        <span>Vetoed trades</span><span>${num((sj.vetoed || {}).n || 0)} · avg ${pct((sj.vetoed || {}).avg_move_pct, 2)}</span></div>`,
        "Each in the direction proposed, one week later. A good Judge's approvals beat its vetoes.")
      + block("Open-trade reviews", factsKv(f.swing_judge_open_reviews))
      + (f.judge_ratings_of_political_read ? block("Its ratings of the political read", factsKv(f.judge_ratings_of_political_read)) : "")
      + `<p class="sub">From the weekly report card, ${esc(ago((F.weekly || {}).as_of))}.</p>`;
  }

  // ===================================================================== the EGX Judge
  function ejRead() {
    const e = F.egx;
    if (!e) return empty("The EGX desk has not run yet.");
    const j = e.judge;
    return block(`The Judge's read (${esc(e.session)})`, j ? `<p class="big" style="font-size:20px">${esc(j.headline)}</p><p>${esc(j.summary)}</p><ul>${(j.key_points || []).map(k => `<li>${esc(k)}</li>`).join("")}</ul>
        ${(j.warnings || []).length ? `<p><b>Warnings</b></p><ul>${j.warnings.map(w => `<li class="warnc">${esc(w)}</li>`).join("")}</ul>` : ""}`
        : empty("No Judge review this run (no proposals, budget pause, or API down)."))
      + (e.no_trade_reason ? block("Why no trade", `<p class="note">${esc(e.no_trade_reason)}</p>`) : "");
  }

  function ejDecisions() {
    const e = F.egx;
    if (!e) return empty("The EGX desk has not run yet.");
    const j = e.judge || {}, exits = (j.exits || []).concat(e.judge_exits || []);
    const exitRow = x => [`<b>${esc(x.ticker || "-")}</b>`, esc(x.action || x.decision || "-"), esc(x.reason || x.note || x.why || "")];
    return block("Every proposed order", table(["Stock", "Approved", "Judge's note"], (j.decisions || []).map(d => [`<b>${esc(d.ticker)}</b>`, d.approve ? `<span class="up">yes</span>` : `<span class="down">no</span>`, esc(d.note)])))
      + block("Held back", table(["Stock", "Action", "Shares", "Limit", "Why"], (e.vetoed || []).map(o => [`<b>${esc(o.ticker)}</b>`, esc(o.action), num(o.shares), num(o.limit, 2), esc(o.judge)]), [2, 3]))
      + block("Holdings it decided to sell or trim", exits.length ? table(["Stock", "Decision", "Why"], exits.map(exitRow)) : empty("None this run: it re-checks every holding daily with the political read."));
  }

  function ejRecord() {
    const f = (F.weekly || {}).facts || {}, ej = f.egx_judge || {};
    return block("Approved against held back", `<div class="kv">
        <span>Approved buys</span><span>${num((ej.approved || {}).n)} · avg ${pct((ej.approved || {}).avg_return_pct, 2)}</span>
        <span>Held-back buys</span><span>${num((ej.rejected || {}).n)} · avg ${pct((ej.rejected || {}).avg_return_pct, 2)}</span></div>
        ${ej.note ? `<p class="sub">${esc(ej.note)}</p>` : ""}`, "A good Judge's approved buys beat the ones it held back.")
      + `<p class="sub">From the weekly report card, ${esc(ago((F.weekly || {}).as_of))}.</p>`;
  }

  // ===================================================================== report card, budget, how it works
  function reportCard() {
    const r = F.weekly, d = F.director && F.director.note;
    const director = block("Director's note", d ? `<p>${esc(d.note)}</p>${(d.issues || []).length ? `<ul>${d.issues.map(i => `<li class="warnc">${esc(i)}</li>`).join("")}</ul>` : ""}<p class="sub">${esc(ago(F.director.as_of))}</p>`
      : empty("The Director writes a note after each EGX run."));
    if (!r) return director + block("Report card", empty("The first report card arrives on Saturday morning, after a week of logged calls."));
    const c = r.card || {}, ag = r.agents || {}, f = r.facts || {};
    const grades = Object.fromEntries((c.agents || []).map(a => [a.agent, a]));
    // owner 2026-11-05 (review fix 1): n = separate bets (an unchanged view is one bet until its horizon passes), the
    // chance that luck does as well or as badly, and frozen weights
    const luck = s => s.p_value == null ? "-" : `<span class="${s.p_value < 0.05 ? (s.hit_rate >= 0.5 ? "up" : "down") : ""}">${num(s.p_value * 100, s.p_value < 0.1 ? 1 : 0)}%</span>`;
    const rows = Object.entries(ag).sort((a, b) => b[1].n - a[1].n).map(([id, s]) => [`<b>${esc(s.name || nameOf(id))}</b>${s.baseline ? ` <span class="tag hold">baseline</span>` : ""}`,
      num(s.n) + (s.raw_n && s.raw_n !== s.n ? `<div class="sub">${num(s.raw_n)} rows</div>` : ""), num(s.hit_rate * 100, 0) + "%", luck(s), pct(s.avg_edge_pct, 2),
      s.weighted === false ? `<span class="sub">graded only</span>` : `<b class="${s.multiplier > 1 ? "up" : s.multiplier < 1 ? "down" : ""}">x${num(s.multiplier, 2)}</b>`,
      esc((grades[id] || grades[s.name] || {}).grade || "-"), esc((grades[id] || grades[s.name] || {}).comment || "")]);
    const pre = Object.values(f.pre_registered_tests || {}), run = (((F.swing || {}).state) || {}).eval_run || f.swing_evaluation_run;
    const preHtml = pre.map(t => `<p>${runTag(t.verdict)} <b>${esc(t.name)}</b></p>
        <div class="bar-meter"><i style="width:${Math.min(100, 100 * (t.n || 0) / (t.target_n || 1))}%"></i></div>
        <div class="kv" style="margin:10px 0 14px"><span>Calls since ${esc((t.registered_at || "").slice(0, 10))}</span><span>${num(t.n)} of ${num(t.target_n)}</span>
          <span>Right</span><span>${t.hit_rate == null ? "-" : num(t.hit_rate * 100, 0) + "%"}${t.p_hits != null ? ` · luck does this ${num(t.p_hits * 100, 1)}% of the time` : ""}</span>
          <span>Average edge</span><span>${pct(t.avg_edge_pct, 2)}</span><span>Status</span><span>${esc(t.verdict_text)}</span></div>`).join("");
    const bl = Object.values(f.baselines || {});
    const blHtml = bl.length ? `<div class="kv">${bl.map(b => `<span>${esc(b.name)}</span><span>${num(b.hit_rate * 100, 0)}% of ${num(b.n)} bets · avg ${pct(b.avg_edge_pct, 2)}</span>`).join("")}</div>`
      : empty("The carry rule is graded once its first week has passed.");
    const ns = f.news_scouts || {}, od = f.order_desk || {}, wait = f.waiting_to_be_graded || {};
    const team = (k, label) => { const t = ns[k] || {}; return `<span>${label}</span><span>${t.n ? `${num(t.hit_rate * 100, 0)}% of ${num(t.n)} reads` : "not graded yet"}</span>` +
      Object.entries(t.by_materiality || {}).map(([m, v]) => `<span class="sub">&nbsp;&nbsp;${esc(m)} reads</span><span class="sub">${num(v.hit_rate * 100, 0)}% of ${num(v.n)}</span>`).join(""); };
    const waits = Object.entries(wait).sort((a, b) => b[1].n - a[1].n).map(([id, v]) => [`<b>${esc(nameOf(id))}</b>`, num(v.n), esc(v.first_due || "-")]);
    return block(esc(c.headline || "This week"), `<p>${esc(c.summary || "")}</p>${(c.lessons || []).length ? `<ul>${c.lessons.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}<p class="sub">Updated ${esc(ago(r.as_of))}. The Judges' own records are on their tabs.</p>`)
      + director
      + block("Tests set up in advance", (run ? `<p><b>The swing desk's evaluation run</b></p>${evalBlock(run, false)}<br>` : "") + (preHtml || empty("No test registered yet.")),
        "Each test was written down before its data existed: what counts, how many, and what a pass is. Numbers before the end are progress, not a result.")
      + block("Every agent", table(["Agent", "Graded bets", "Hit rate", "Luck could do this", "Average edge", "Weight", "Grade", "Comment"], rows, [1, 2, 3, 4]),
        "Graded bets = separate calls: a view an agent keeps repeating is one bet until its horizon passes (rows = what was logged). Hit rate = bets that went the right way. Luck could do this = how often a coin flip does at least this well, or this badly: under 5% is unusual, above it is luck. Weight = the agent's say: frozen at x1.00 for everyone while the swing evaluation run lasts.")
      + block("Baseline", blHtml, "A simple rule to beat. An agent no better than this, or than a coin flip (50%), adds nothing.")
      + `<div class="cols">${block("News scouts", `<div class="kv">${team("news_fx", "Pair scouts")}${team("news_egx", "EGX stock scouts")}</div>`, "UP/DOWN reads that went the stated way (pairs 3 days later; stocks 5 sessions later, against the market).")}
        ${block("EGX Order Desk", `<div class="kv">${Object.entries(od).map(([k, v]) => `<span>${esc(k)}</span><span>${num(v.right)} of ${num(v.n)} right · avg ${pct(v.avg_edge_pct, 2)}</span>`).join("") || "<span>No graded decisions yet</span><span></span>"}</div>`, "Chases, waits, exits and holds, judged 3 sessions later against the market.")}</div>`
      + block("Waiting to be graded", table(["Agent", "Calls waiting", "First one due"], waits, [1]), "Calls whose horizon has not passed yet. They join the grades once it has.");
  }

  function budgetSpend() {
    const b = F.budget || {};
    const desks = Object.values(b.desks || {}).sort((x, y) => (y.cap || 0) - (x.cap || 0)).map(d => `<div style="margin:10px 0"><div class="kv"><span><b>${esc(d.desk)}</b></span><span>${usd(d.month, 3)} of ${usd(d.cap)} this month · today ${usd(d.today, 3)} (pace limit ${usd(d.daily_allowance, 3)}/day) · ${num(d.calls_month)} calls</span></div>
      <div class="bar-meter" role="img" aria-label="${esc(d.desk)} ${num(d.cap ? d.month / d.cap * 100 : 0, 0)}% of its budget"><i style="width:${Math.min(100, d.cap ? d.month / d.cap * 100 : 0).toFixed(1)}%"></i></div></div>`).join("");
    return block(`${usd(b.spent)} of ${usd(b.cap)} (${esc(b.month)})`, `<p class="sub">On pace for ${usd(b.projected)} this month.</p>${desks}`,
      "A hard cap in code. Each desk also has a daily pace so it can't spend the month early. When a desk hits a limit, its agents go quiet and the maths keeps running.");
  }
  function budgetTeam() {
    const M = F.models || {};
    const modelOf = a => a.judge ? M.judge : a.id === "director" ? M.director : /^et_/.test(a.id) ? M.tracker + " + web search"
      : /^va_/.test(a.id) ? M.valuer : /newscheck|^sw_news$/.test(a.id) ? M.news + " + web search" : /^news_/.test(a.id) ? M.scout
      : a.id === "egx_orders" ? M.orders : M.analyst;
    const roster = (F.roster || []).map(a => [`<b>${esc(a.name)}</b>`, esc(a.desk), a.llm ? esc(modelOf(a)) : "maths (free)", esc(a.role)]);
    return block(`The team (${num(roster.length)})`, table(["Agent", "Desk", "Runs on", "Job"], roster));
  }
  function budgetCalls() {
    const calls = (F.agent_calls || []).slice().reverse().slice(0, 60).map(c => [`<b>${esc(nameOf(c.agent))}</b>`, esc(c.ts.slice(5, 16).replace("T", " ")), esc(c.status), usd(c.usd, 4), esc(c.detail)]);
    return block("Recent agent calls", table(["Agent", "When (UTC)", "Status", "Cost", "Detail"], calls, [3]));
  }

  function howItWorks() {
    const c = F.egx_config || {};
    return `<div class="cols">${block("Swing desk (forex, gold and bitcoin, around the clock)", `<p>${swingHowText()}</p>`)}
      ${block("EGX desk (once a day, after the close)", `<ol>
      <li><b>Baseline return (your course formula).</b> CCAPM with external habit: each stock's expected monthly excess return is
        gamma x cov(stock, consumption growth) + w x delta x (1 - gamma) x last month's growth. Consumption growth is proxied by the equal-weight EGX return.
        gamma ${num(c.gamma, 1)}, delta ${num(c.delta_habit, 2)}, w ${num(c.w_habit, 2)}.</li>
      <li><b>The valuation desk values every company.</b> Per sector, an Earnings Tracker keeps the company's spread current (it knows every results date and reads each release online the day it comes out) and a Valuation Analyst keeps a five-year yearly forecast. Code turns it into a DCF, peer multiples and a dividend discount value, blended into a fair value (see the Valuation tab).</li>
      <li><b>Analysts adjust it.</b> 7 sector analysts rate each stock using those valuations, TradingView's live fundamentals and technical ratings, and their news scouts; the Macro & Pound Strategist tilts sectors. Black-Litterman blends the ratings, the tilts and the fair values into the baseline, each weighted by its confidence.</li>
      <li><b>CRRA sizes it.</b> Maximise expected return minus gamma/2 x variance. Long only, no borrowing, max ${num(c.max_positions)} stocks, max ${num((c.max_weight || 0) * 100)}% each, max ${num((c.max_sector_weight || 0) * 100)}% per sector. The rest earns the CBE rate (${num((c.rf_annual || 0) * 100, 1)}%) in cash.</li>
      <li><b>Thndr fees.</b> Your figure: about 0.1% of the order, all-in, with a 2 EGP floor. Trades only happen if the CRRA gain beats the round-trip fees. Stocks under ${num(c.min_price_egp, 0)} EGP are never bought (one price step there costs as much as the fees).</li>
      <li><b>News check.</b> Before the Judge rules, the News Checker searches the web for each proposed buy's last 30 days of news.</li>
      <li><b>The Judge reviews every order</b> (sector, then company, then the pound) and can veto. No Judge, no new orders. For every buy it picks a holding period of 20, 40 or 60 sessions.</li>
      <li><b>Your volatility model sets the exits.</b> Each holding gets a stop loss where the price falls with only a 20% chance in its holding period (outside the normal noise, inside the extremes; never moved down) and a take-profit at the valuation desk's fair value kept inside the realistic zone, or where the price gets with a 50% chance. The Order Desk sells when a session trades through either, and your phone hears at once (Thndr has no stop orders).</li></ol>
      <p class="sub">The pure model's own risk-free rate comes out unrealistically high for Egypt (the risk-free rate puzzle), so the real CBE rate is used for cash.</p>`)}</div>`;
  }

  // ===================================================================== the archive (desks that are off, research)
  const verdictTag = v => `<span class="tag ${v === "PASS" ? "buy" : v === "PROMISING" ? "hold" : "sell"}">${esc(v || "-")}</span>`;
  const bps = (n, d = 2) => n == null ? "-" : `<span class="${cls(n)}">${n > 0 ? "+" : ""}${num(n, d)}</span>`;
  const sizeTxt = (epic, size) => epic === "BTCUSD" ? `${num(size, 4)} BTC` : `${num(size)} units`;

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
    const I = F.ideas;
    const irows = I ? (I.rows || []).map(x => {
      const cf = x.confirm || {}, e = x.explore || {};
      return [`<b>${esc(x.sym)}</b>`, `${esc(x.name)}<div class="sub">${esc(x.note)}</div>`,
        e.n ? `${bps(e.mean_bps)}<div class="sub">${num(e.n)} trades, t ${num(e.t, 2)}</div>` : "-",
        cf.n ? `${bps(cf.mean_bps)}<div class="sub">${num(cf.n)} trades, p ${num(cf.p, 3)}, placebo p ${num(cf.placebo_p, 2)}</div>` : "-",
        verdictTag(x.verdict === "NOT CARRIED" ? "FAIL" : x.verdict) + (x.verdict === "NOT CARRIED" ? `<div class="sub">not carried</div>` : "")];
    }) : [];
    return (I ? block("13 ideas, one per market (trial and error)", `<p>${esc(I.headline || "")}</p>
        <div class="kv"><span>Pass</span><span>${num((I.counts || {}).PASS || 0)}</span><span>Promising</span><span>${num((I.counts || {}).PROMISING || 0)}</span>
        <span>Fail</span><span>${num((I.counts || {}).FAIL || 0)}</span><span>Not carried</span><span>${num((I.counts || {})["NOT CARRIED"] || 0)}</span></div>
        ${table(["Market", "Idea and what we learned", "Explore", "Confirm (unseen data)", "Verdict"], irows)}`,
        "Each idea: one pre-registered rule, settings chosen only on the explore years, then one look at years it had never seen, with real costs, a 200-draw random-entry placebo and buy-and-hold benchmarks. Rules: ideas/PREREG.md.") : "")
      + (o ? block("Your rule, version 2", `<p>${esc(o.headline || "")}</p><ul>${(o.findings || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        ${table(["Market", "Oct 2024 to Mar 2026", "Apr to Oct 2026 (out of sample)", "Exits: stop / target", "Verdict"], orows)}
        <p class="sub">Rules locked before testing: lab/PREREG_OWNER.md, fingerprint ${esc((o.prereg_sha256 || "").slice(0, 12))}.</p>`) : "")
      + block("The 7 lab strategies: short answer", `<p>${esc(L.headline || "")}</p>
        <div class="kv"><span>Pass</span><span>${num(c.PASS || 0)}</span><span>Promising</span><span>${num(c.PROMISING || 0)}</span><span>Fail</span><span>${num(c.FAIL || 0)}</span>
        <span>Settings tried</span><span>${num(L.trials)} on the first 18 months; ${num(L.family_size)} carried to the locked-away 6 months</span>
        <span>Rules locked</span><span>before the test: lab/PREREG.md, fingerprint ${esc((L.prereg_sha256 || "").slice(0, 12))}</span></div>
        <h3>What we found</h3><ol>${(L.findings || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol>
        <h3>What the desk does with it</h3><p>${esc(L.desk_rule || "")}</p>
        <h3>The formula behind each strategy (course methods)</h3><ul>${formulas}</ul>`)
      + block("Every test", table(["", "Market", "Why it should work (dev)", "Same test, holdout", "Dev net/trade", "Holdout net/trade", "Carried?", "Verdict"], rows),
        `"Why it should work" is the econometric test of the idea itself (DiD coefficient, GMM slope, Wald or LR statistic). bps are hundredths of a percent per trade after Capital.com's real bid/ask spread. Dev = Oct 2024 to Mar 2026. Holdout = Apr to Oct 2026, opened once with frozen settings.`);
  }

  function archGold() {
    const g = F.gold || {}, s = g.snapshot, sb = g.scoreboard || {}, gs = g.state || {};
    const off = g.enabled === false;
    const trades = (g.trades || []).slice().reverse().map(t => [esc((t.closed_at || "").slice(0, 16).replace("T", " ")), esc(t.direction), num(t.size, 2),
      num(t.entry, 2), num(t.exit, 2), `<span class="${cls(t.net_pnl_usd)}">${usd(t.net_pnl_usd)}</span>`,
      `<span class="sub">spread ${usd(t.spread_paid_usd || 0, 3)} · FX ${usd(t.fx_fee_usd || 0, 3)} · overnight ${usd(-(t.overnight_usd || 0), 3)}</span>`,
      esc(t.exit_reason), esc(t.mode)]);
    const side = (x, label) => `<div class="kv"><span>${label} pitches scored</span><span>${num(x.n)}</span><span>Win rate</span><span>${x.win_rate == null ? "-" : num(x.win_rate * 100, 0) + "%"}</span><span>Avg move</span><span>${pct(x.avg_move_pct, 3)}</span></div>`;
    const gj = ((F.weekly || {}).facts || {}).gold_judge_scoreboard || {};
    return block(off ? "The gold day-trading desk is switched off" : "Gold desk", off ? `<p>Gold now trades inside the swing desk's account (see the Swing desk tab).</p>`
        : `<div class="big">${usd(gs.equity_usd)}</div><p class="note">${esc(gs.status || "Not started")}</p>`)
      + block("Scoreboard: was the Judge any good?", `<div class="cols"><div>${side(sb.approved || {}, "Approved")}</div><div>${side(sb.rejected || {}, "Rejected")}</div></div>
        <p class="note">${esc(sb.verdict || "")} Real trades: ${num(sb.trades || 0)}, net ${usd(sb.net_pnl_usd || 0)}.</p>
        <div class="kv"><span>Gold Judge, approved</span><span>${num((gj.approved || {}).n)} · win ${(gj.approved || {}).win_rate == null ? "-" : num(gj.approved.win_rate * 100, 0) + "%"}</span>
        <span>Gold Judge, rejected</span><span>${num((gj.rejected || {}).n)} · win ${(gj.rejected || {}).win_rate == null ? "-" : num(gj.rejected.win_rate * 100, 0) + "%"}</span></div>`,
        "Every Judge decision replayed against what gold did next (target or stop first, else the close at the time limit, minus the spread).")
      + block("Trades", table(["Closed (UTC)", "Side", "Oz", "Entry", "Exit", "Net", "Capital.com costs", "Why closed", "Mode"], trades, [2, 3, 4, 5]))
      + (s && !off ? block("Last market snapshot", `<p class="sub">${esc((s.features || {}).session || "")} · price ${num((s.features || {}).price, 2)}</p>`) : "");
  }

  function archGoldMeetings() {
    const ms = ((F.gold || {}).meetings || []).slice().reverse();
    return ms.length ? ms.map(m => block(`${esc(m.ts.slice(0, 16).replace("T", " "))} UTC · ${esc(m.direction)} pitch <span class="stamp ${m.final === "APPROVE" ? "up" : "down"}" style="margin-left:8px">${esc(m.final)}</span>`,
        `<div class="transcript">${m.transcript.map(l => `<p><b>${esc(nameOf(l.agent))}</b> ${esc(l.line)}</p>`).join("")}</div>
        <p class="sub">Judge: ${esc(m.judge_reasoning)}</p>${m.plan ? `<p class="sub">Plan: stop ${num(m.plan.stop, 2)}, target ${num(m.plan.target, 2)}, hold up to ${num(m.plan.hold)} min</p>` : ""}`)).join("")
      : block("Gold meetings", empty("No gold meetings. A meeting happened only when 3 of 4 analysts agreed on a direction."));
  }

  function archFx() {
    const fx = F.fx;
    if (!fx) return block("FX & crypto desk (old)", empty("Switched off. Its forex pairs and bitcoin now trade on the swing desk."));
    const st = fx.state || {}, sb = fx.scoreboard || {}, all = sb.all || {};
    const trades = (fx.trades || []).slice().reverse().slice(0, 25).map(t => [esc((t.opened_at || "").slice(5, 16).replace("T", " ")),
      `<b>${esc(t.epic)}</b>`, esc(t.direction), sizeTxt(t.epic, t.size), px(t.entry), px(t.exit), bps(t.move_bps, 1), usd(t.net_pnl_usd, 3),
      `${esc(t.strategy)} ${verdictTag(t.verdict)}`, esc(t.exit_reason)]);
    return block("FX & crypto desk (old)", `<div class="kv"><span>All trades</span><span>${num(all.n || 0)} · ${usd(all.net_usd || 0, 3)}${all.avg_bps != null ? ` · avg ${num(all.avg_bps, 1)} bps` : ""}</span></div><p class="note">${esc(st.status || "")}</p>`)
      + block("Trades", table(["Opened (UTC)", "Market", "Side", "Size", "Entry", "Exit", "bps", "Net", "Strategy", "Exit reason"], trades, [3, 4, 5, 6, 7]));
  }

  // ===================================================================== home: the introduction slides
  const stat = (label, value, note) => `<div class="stat"><span>${label}</span><b>${value}</b><em>${note}</em></div>`;

  function slideCover() {
    const n = swingNumbers(), x = egxNow(), b = F.budget || {}, open = Object.keys(((F.swing || {}).state || {}).positions || {});
    return `<p class="kicker">Live · updated ${esc(ago(F.generated_at))}</p><h1>Trading Floor</h1>
      <p class="lead">AI agents trade forex, gold and bitcoin on your Capital.com account and run an Egyptian stock portfolio on paper. Every desk, every Judge and the ship have their own tab at the top.</p>
      <div class="stats">${n ? stat(n.live ? "Capital.com account" : "Swing account", n.eqTxt, `<span class="${cls(n.chg)}">${n.chgTxt}</span> since start`) : ""}
        ${x ? stat("EGX portfolio (paper)", egp(x.p.total), `<span class="${cls(x.p.pnl_vs_start)}">${pct(x.p.pnl_vs_start_pct, 2)}</span> vs ${egp(x.e.start_capital)}`) : ""}
        ${stat("Open trades", num(open.length), esc(open.join(", ") || "none"))}
        ${stat("AI spend this month", usd(b.spent), `of ${usd(b.cap, 0)}, on pace for ${usd(b.projected)}`)}</div>
      <p class="scroll-hint">Scroll down for the rest ↓</p>`;
  }

  function slideMoney() {
    const n = swingNumbers(), x = egxNow();
    return `<p class="kicker">Your money</p><h2>One live account, one paper portfolio</h2><div class="cols">
      <div class="block"><h3>${n && n.live ? "Capital.com account (live)" : "Swing account"}</h3>${n ? `<div class="big">${n.eqTxt}</div><div class="sub"><span class="${cls(n.chg)}">${n.chgTxt}</span> since start · margin ${n.mon(n.margin)} in use</div><div data-chart="usd" data-h="140"></div>` : empty("The swing desk is off.")}</div>
      <div class="block"><h3>EGX portfolio (paper)</h3>${x ? `<div class="big">${egp(x.p.total)}</div><div class="sub"><span class="${cls(x.p.pnl_vs_start)}">${x.p.pnl_vs_start >= 0 ? "+" : ""}${egp(x.p.pnl_vs_start)} (${pct(x.p.pnl_vs_start_pct, 2)})</span> vs ${egp(x.e.start_capital)} start · cash ${egp(x.p.cash)}</div><div data-chart="egx" data-h="140"></div>` : empty("The EGX desk has not run yet.")}</div></div>`;
  }

  function slideTrades() {
    const n = swingNumbers();
    if (!n) return `<p class="kicker">Open trades</p><h2>The swing desk is off</h2>`;
    const ps = Object.entries(n.st.positions || {});
    const rows = ps.slice(0, 6).map(([p, v]) => {
      const M = FloorCharts.tradeMoney(v, n.aed);
      return `<div class="row"><b>${esc(p)} <span class="tag ${v.direction === "LONG" ? "buy" : "sell"}">${esc(v.direction)}</span></b>
        <span class="sub">entry ${px(M.entry)} · stop ${esc(v.stop_loss ?? "-")} · take profit ${esc(v.take_profit_price ?? "-")} · opened ${esc(ago(v.opened_at))}</span>
        <span class="r ${cls(M.v)}">${M.v == null ? "-" : (M.v >= 0 ? "+" : "") + num(M.v, 2) + " " + esc(M.cur)}</span></div>`;
    }).join("");
    return `<p class="kicker">Open trades</p><h2>${ps.length ? `${num(ps.length)} trade${ps.length > 1 ? "s" : ""} open right now` : "No open trades right now"}</h2>
      ${rows ? `<div class="rows">${rows}</div>` : ""}${ps.length > 6 ? `<p class="sub">And ${num(ps.length - 6)} more on the Swing desk tab.</p>` : ""}
      <p class="note">${esc(n.st.status || "Not started")}</p>
      <div class="go"><button class="primary" type="button" data-go="swing:overview">Open the Swing desk</button><button type="button" data-go="swingjudge:reviews">The Judge's reviews</button></div>`;
  }

  function slideEgx() {
    const x = egxNow();
    if (!x) return `<p class="kicker">EGX, next session</p><h2>The EGX desk has not run yet</h2>`;
    const { e, OD } = x, orders = egxToPlace(e, OD);
    return `<p class="kicker">EGX, next session</p><h2>${orders.length ? `${num(orders.length)} order${orders.length > 1 ? "s" : ""} to place on Thndr` : "Nothing to place"}</h2>
      ${orders.length ? `<ul class="todo">${orders.slice(0, 4).map(orderLine).join("")}</ul>` : `<p class="lead">${esc(noOrdersText(e))}</p>`}
      ${OD.status ? `<p class="note"><b>Order Desk:</b> ${esc(OD.status)}${OD.last_check ? ` <span class="sub">(${esc(ago(OD.last_check))})</span>` : ""}</p>` : ""}
      <div class="go"><button class="primary" type="button" data-go="egx:orders">Open the EGX desk</button><button type="button" data-go="egxjudge:read">The Judge's read</button></div>`;
  }

  function slideWorld() {
    const G = (F.geo || {}).world || {}, GO = G.opinion, P = (F.geo || {}).egypt || {}, R = P.read || {}, M = R.political_mood || {};
    const IX = (((F.swing || {}).state || {}).sentiment_index || {}).pairs || {}, pool = (F.geo || {}).pool || {};
    const top = Object.entries(IX).filter(([, r]) => r.index != null).sort((a, b) => Math.abs(b[1].index) - Math.abs(a[1].index)).slice(0, 3);
    return `<p class="kicker">The world today</p><h2>${GO && GO.global_risk ? `Global risk: ${esc(String(GO.global_risk.level).toLowerCase())}` : "Politics and the news"}</h2><div class="cols">
      <div class="block"><h3>The world, for the swing desk</h3>${GO ? `<p class="clamp">${esc(GO.summary)}</p><p class="sub">Read ${esc(ago(G.read_at))}${pool.articles != null ? `, from ${num(pool.articles)} articles in the last 24 hours` : ""}.</p>` : empty("No read yet.")}</div>
      <div class="block"><h3>Egypt, for the EGX desk</h3>${R.summary ? `<p>Mood <b class="${cls(M.score)}">${num(M.score, 0)}</b> <span class="sub">${esc(String(M.label || "").replace("_", " ").toLowerCase())}</span></p><p class="clamp">${esc(R.summary)}</p><p class="sub">Read ${esc(ago(P.read_at))}.</p>` : empty("No read yet.")}</div></div>
      ${top.length ? `<h3>Strongest Political + News Index readings</h3><div class="rows">${top.map(([p, r]) => `<div class="row"><b>${esc(p)}</b><span class="sub">political ${num(r.political, 0)} · news ${num(r.news, 0)}${r.agree ? " · " + esc(r.agree.toLowerCase()) : ""}</span><span class="r ${cls(r.index)}">${num(r.index, 0)}</span></div>`).join("")}</div>` : ""}
      <div class="go"><button class="primary" type="button" data-go="politics:world">Open the Political desk</button><button type="button" data-go="politics:index">The index</button></div>`;
  }

  function slideJudges() {
    const S = F.swing || {}, ms = S.meetings || [];
    const mt = ms.filter(m => !m.kind || m.kind === "h6_entry").slice(-1)[0], jd = mt && mt.judge, rvm = ms.filter(m => m.kind === "review").slice(-1)[0], rv = rvm && rvm.review;
    const isH6 = !!(mt && mt.kind === "h6_entry"), decs = isH6 ? (mt.decisions || []) : ((jd || {}).decisions || []);
    const e = F.egx || {}, j = e.judge, RT = (S.state || {}).geo_ratings || {};
    const appr = decs.filter(d => d.decision === "APPROVE" || d.decision === "ENTER").length;
    return `<p class="kicker">The Judges</p><h2>Every trade needs a Judge's yes</h2><div class="cols">
      <div class="block"><h3>Swing Judge</h3>${jd ? `<p><b>${esc(jd.headline)}</b></p><p class="sub">${isH6 ? "Last H6 entry meeting" : "Last meeting"} ${esc(ago(mt.ts))}: ${num(decs.length)} market(s) looked at, ${num(appr)} ${isH6 ? "entered" : "approved"}.</p>` : empty("No meeting yet.")}
        ${rv ? `<p class="sub">Open-trade review ${esc(ago(rvm.ts))}: ${esc(rv.headline)}</p>` : ""}${RT.headline ? `<p class="sub">Its rating of the political read: ${esc(RT.headline)}</p>` : ""}
        <div class="go"><button type="button" data-go="swingjudge:meetings">Open the Swing Judge</button></div></div>
      <div class="block"><h3>EGX Portfolio Judge</h3>${j ? `<p><b>${esc(j.headline)}</b></p><p class="sub clamp">${esc(j.summary)}</p><p class="sub">${esc(e.session)}: ${num((e.orders || []).length)} order(s) approved, ${num((e.vetoed || []).length)} held back.</p>` : empty("No review yet.")}
        <div class="go"><button type="button" data-go="egxjudge:read">Open the EGX Judge</button></div></div></div>`;
  }

  function slideFloor() {
    const t = (go, title, line) => `<button type="button" class="tile" data-go="${go}"><b>${esc(title)}</b><span>${line}</span></button>`;
    const N = F.news || {}, V = (F.valuation || {}).counts || {}, T = F.terminal || {}, W = (F.weekly || {}).card || {}, b = F.budget || {};
    const n = swingNumbers(), x = egxNow(), G = ((F.geo || {}).world || {}).opinion || {};
    return `<p class="kicker">The floor</p><h2>Pick a desk</h2><div class="tiles">
      ${t("ship", "The ship", "Every agent at work, live")}
      ${t("swing", "Swing desk", n ? `${num(Object.keys(n.st.positions || {}).length)} open trades · ${esc(n.eqTxt)}` : "switched off")}
      ${t("egx", "EGX desk", x ? `${num((x.e.holdings || []).length)} holdings · ${esc(egp(x.p.total))}` : "not run yet")}
      ${t("valuation", "Valuation desk", `${num(V.valued)} companies valued · ${num(V.late)} late results`)}
      ${t("news", "News desk", `${num(Object.keys(N.fx || {}).length)} pair scouts · ${num(Object.keys(N.egx || {}).length)} stock scouts`)}
      ${t("politics", "Political desk", G.global_risk ? `global risk ${esc(String(G.global_risk.level).toLowerCase())}` : "two political agents")}
      ${t("pro12", "PRO12 desk", T.as_of ? `last run ${esc(ago(T.as_of))}` : "not run yet")}
      ${t("swingjudge", "Swing Judge", "meetings, reviews, ratings")}
      ${t("egxjudge", "EGX Judge", "its read and every decision")}
      ${t("report", "Report card", esc(W.headline || "every agent graded weekly"))}
      ${t("budget", "Budget", `${usd(b.spent)} of ${usd(b.cap, 0)} this month`)}
      ${t("markets", "Markets", "live TradingView charts")}</div>`;
  }

  const SLIDES = [["Welcome", slideCover], ["Your money", slideMoney], ["Open trades", slideTrades], ["EGX next session", slideEgx],
    ["The world today", slideWorld], ["The Judges", slideJudges], ["Pick a desk", slideFloor]];
  let deckI = 0, lockUntil = 0, lastWheel = 0, lastMove = 0, deckBuilt = false;

  function drawHome() {
    const deck = $("#deck");
    if (!deckBuilt) {
      deck.innerHTML = SLIDES.map(([label], i) => `<section class="slide" aria-label="${esc(label)}"><div class="slide-in" data-slide="${i}"></div></section>`).join("");
      $("#dots").innerHTML = SLIDES.map(([label], i) => `<button type="button" data-dot="${i}" aria-label="${esc(label)}" title="${esc(label)}"></button>`).join("");
      deckBuilt = true;
    }
    SLIDES.forEach(([, fn], i) => { deck.querySelector(`[data-slide="${i}"]`).innerHTML = safe(fn); });
    after(deck);
    dots();
  }
  function dots() { $$("#dots [data-dot]").forEach((b, i) => b.setAttribute("aria-current", String(i === deckI))); }
  const smooth = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  function scrollDeck(top) {
    $("#deck").scrollTo({ top, behavior: smooth() });
    lastMove = performance.now(); lockUntil = lastMove + 650;
  }
  function go(i) {
    const d = $("#deck");
    deckI = Math.max(0, Math.min(SLIDES.length - 1, i));
    scrollDeck(d.children[deckI].offsetTop);
    dots();
  }
  // One slide per scroll of the wheel: a mouse notch is one event; a trackpad swipe is a stream (with inertia) that
  // counts once. A new move needs the slide to have arrived and either a fresh gesture or 1.2 s of steady scrolling.
  // A slide taller than the screen (a short laptop screen) is scrolled through first, then the next one comes.
  $("#deck").addEventListener("wheel", e => {
    if (e.ctrlKey) return;                                       // pinch-zoom on a trackpad
    e.preventDefault();
    const now = performance.now(), fresh = now - lastWheel > 180;
    lastWheel = now;
    if (Math.abs(e.deltaY) < 1 || now < lockUntil) return;
    if (!fresh && now - lastMove < 1200) return;
    const d = $("#deck"), s = d.children[deckI], down = e.deltaY > 0;
    if (s && down && d.scrollTop + d.clientHeight < s.offsetTop + s.offsetHeight - 4)
      return scrollDeck(Math.min(s.offsetTop + s.offsetHeight - d.clientHeight, d.scrollTop + d.clientHeight * 0.85));
    if (s && !down && d.scrollTop > s.offsetTop + 4)
      return scrollDeck(Math.max(s.offsetTop, d.scrollTop - d.clientHeight * 0.85));
    go(deckI + (down ? 1 : -1));
  }, { passive: false });
  let deckScrollT = 0;
  $("#deck").addEventListener("scroll", () => {                   // touch swipes snap natively: follow where they land
    clearTimeout(deckScrollT);
    deckScrollT = setTimeout(() => {
      const d = $("#deck"), y = d.scrollTop + 8;
      let i = 0;
      [...d.children].forEach((s, k) => { if (s.offsetTop <= y) i = k; });
      if (i !== deckI) { deckI = i; dots(); }
    }, 90);
  }, { passive: true });
  $("#dots").addEventListener("click", e => { const b = e.target.closest("[data-dot]"); if (b) go(+b.dataset.dot); });
  document.addEventListener("keydown", e => {
    if (cur !== "home" || e.altKey || e.ctrlKey || e.metaKey || $("#agent-dialog").open) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (["input", "select", "textarea"].includes(tag) || (e.key === " " && tag === "button")) return;
    const k = e.key;
    if (k === "ArrowDown" || k === "PageDown" || (k === " " && !e.shiftKey)) go(deckI + 1);
    else if (k === "ArrowUp" || k === "PageUp" || (k === " " && e.shiftKey)) go(deckI - 1);
    else if (k === "Home") go(0);
    else if (k === "End") go(SLIDES.length - 1);
    else return;
    e.preventDefault();
  });

  // ===================================================================== the Economies monitor (owner 2026-11-06)
  // A monthly description of each economy's fundamentals (floor/macro/monitor.py). Not a forecast: the trading
  // version failed its one-shot test (research/macro_fundamentals/REPORT.md), so no signals or crisis odds are shown.
  const econTag = l => `<span class="tag ${l === "Strong" || l === "Improving" ? "buy" : l === "Fragile" ? "sell" : "hold"}">${esc(l || "-")}</span>`;
  const signed = (v, d = 2) => v == null ? "-" : `<span class="${cls(v)}">${v > 0 ? "+" : ""}${num(v, d)}</span>`;
  function econRanking() {
    const M = F.macro;
    if (!M) return empty("The first monthly ranking is made after the month ends.");
    const rows = (M.ranking || []).map(r => [`<b>${esc(r.rank)}. ${esc(r.name)}</b>`, `${esc(r.lo)} to ${esc(r.hi)}`,
      signed(r.health), signed(r.chg12), econTag(r.label), esc(r.strongest), esc(r.weakest)]);
    return block(`Fundamentals ranking, ${esc(M.as_of)}`, `<p class="note">${esc(M.note)}</p>`
        + table(["Economy", "Likely rank", "Health", "12-month change", "Label", "Strongest pillar", "Weakest pillar"], rows, [2, 3]),
      "Health: 0 is the middle of the 44 economies, +1 one typical step stronger. Likely rank: where the rank lands in 90% of 1,000 re-draws of the uncertain inputs and the pillar weights.");
  }
  function econEgypt() {
    const M = F.macro, E = M && M.egypt;
    if (!E) return empty("The first Egypt profile is made after the month ends.");
    const names = M.pillar_names || {};
    const pil = Object.entries(E.pillars || {}).map(([p, v]) => [esc(names[p] || p), signed(v)]);
    const ind = (E.indicators || []).map(i => [esc(i.pillar), esc(i.what), i.value == null ? "-" : num(i.value, 2), signed(i.z), esc(i.source)]);
    const hist = Object.entries(E.history || {}).map(([d, v]) => [esc(d.slice(0, 7)), signed(v)]);
    return block(`Egypt: ${esc(E.rank)} of ${esc(M.n)} ${econTag(E.label)}`,
        `<p>${esc(E.summary_en)}</p><p dir="rtl" lang="ar" style="text-align:right">${esc(E.summary_ar)}</p>`,
        `Likely rank ${esc(E.lo)} to ${esc(E.hi)} · as of ${esc(M.as_of)}`)
      + block("Pillars", table(["Pillar", "Rating"], pil, [1]), "Each pillar is a rating with its own uncertainty; 0 is the middle of the 44 economies, + is healthier.")
      + block("The inputs", table(["Pillar", "What it measures", "Value", "Against the others", "Source"], ind, [2, 3]),
        "Against the others: how far Egypt sits from the middle, signed so that + is healthier. A dash: the free data has no value for Egypt, so that pillar keeps its last rating with a wider error bar.")
      + block("Egypt's health over time", table(["Year end", "Health"], hist, [1]));
  }
  function econAbout() {
    const M = F.macro, T = (M || {}).test || {};
    return block("What this is", `<p>Once a month, after the month ends, about 45 economies are scored on eight pillars: growth, inflation and policy, external position, government finances, credit, currency value, market stress, and institutions and politics. Only data already published on that day is used: the IMF's forecasts from each release, the BIS, the World Bank, FRED and the geopolitical-risk index. Each pillar is a rating that moves a little with every new release and carries its own uncertainty.</p>
      <p><b>It is a description, not a forecast.</b> The trading version was tested once over 2008-2026, with every rule written down first: ${T.verdict ? `<b>${esc(T.verdict)}</b> (Sharpe ratio ${num(T.sharpe, 2)}, p = ${num(T.p_one_sided, 2)})` : "not run"}. So the monitor shows no trading signals and no crisis probabilities (the crisis model did worse than the base rate). The full report is ${esc(T.report || "research/macro_fundamentals/REPORT.md")}.</p>
      <p class="sub">It costs nothing to run (no AI). Each month's ranking is written once and never changed.</p>`);
  }

  // ===================================================================== tabs and pages
  const TABS = [
    { id: "home", label: "Home" },
    { id: "ship", label: "Ship" },
    { group: "Desks" },
    { id: "swing", label: "Swing", title: "Swing desk", about: "Forex pairs, gold and bitcoin on your live Capital.com account. The desk trades only the H6 rate-news system: a big move in the US 2-year yield is the signal, the currency analysts review the last week's news and reports, and the Swing Judge decides each entry. Your volatility model sets every stop loss and take-profit, and the Judge reviews each trade daily and may close it early.",
      pages: [["overview", "Account & open trades", swingOverview], ["evaluation", "Evaluation run", swingEval], ["pairs", "All pairs", swingPairs], ["analysts", "Currency analysts", swingAnalysts], ["plans", "Trade plans", swingPlans], ["history", "History", swingHistory]] },
    { id: "egx", label: "EGX", title: "EGX desk", about: "A 70,000 EGP portfolio of Egyptian stocks on paper. The model proposes, seven sector analysts and the macro strategist adjust, and the Portfolio Judge approves every order.",
      pages: [["portfolio", "Portfolio", egxPortfolio], ["orders", "Orders", egxOrders], ["plans", "Holding plans", egxPlans], ["analysts", "Analysts", egxAnalysts], ["model", "The model", egxModel]] },
    { id: "valuation", label: "Valuation", title: "Valuation desk", about: "Every covered EGX company gets a five-year forecast and three valuations (cash flows, peer multiples, dividends), kept current by an Earnings Tracker and a Valuation Analyst per sector.",
      pages: [["overview", "Overview", valOverview], ["companies", "Every company", valCompanies]] },
    { id: "news", label: "News", title: "News desk", about: "One news scout per instrument: each reads only its own headlines and hands a short, critical read to the analysts who cover it. Sentiment runs from -1 to +1 in the direction of the price.",
      pages: [["fx", "Forex, gold & bitcoin", newsFx], ["egx", "EGX stocks", newsEgx]] },
    { id: "politics", label: "Politics", title: "Political desk", about: "Two political agents read thousands of articles a day, mainly from reputable outlets: the Geopolitics & Conflicts Analyst for the swing desk and the Political & Economic Factors Analyst for Egypt. Neither sees the trades.",
      pages: [["world", "World", polWorld], ["egypt", "Egypt", polEgypt], ["index", "Political + News Index", polIndex], ["memory", "Event memory", polMemory]] },
    { id: "pro12", label: "PRO12", title: "PRO12 desk", about: "Agents that read DFN Mubasher PRO 12 on your laptop: company announcements, listings, results figures and order books.",
      pages: [["terminal", "Terminal agents", pro12Terminal], ["books", "Order books", pro12Books]] },
    { group: "Judges" },
    { id: "swingjudge", label: "Swing Judge", title: "Swing Judge", about: "Decides every H6 entry (ENTER, WAIT or SKIP) after the analysts' review of the week's news, re-checks open trades daily or after a shock, and rates the political read once a day.",
      pages: [["meetings", "Trade meetings", sjMeetings], ["reviews", "Open-trade reviews", sjReviews], ["ratings", "Political ratings", sjRatings], ["record", "Track record", sjRecord]] },
    { id: "egxjudge", label: "EGX Judge", title: "EGX Portfolio Judge", about: "Reviews every proposed EGX order (the sector, then the company, then the pound), can veto any of them, and re-checks every holding daily with the political read.",
      pages: [["read", "Latest read", ejRead], ["decisions", "Decisions", ejDecisions], ["record", "Track record", ejRecord]] },
    { group: "" },
    { id: "markets", label: "Markets" },
    { id: "econ", label: "Economies", title: "Economies monitor", about: "Once a month, about 45 economies are scored on eight pillars of fundamentals from free public data, using only what was published by the date. A description, not a forecast.",
      pages: [["ranking", "Ranking", econRanking], ["egypt", "Egypt", econEgypt], ["about", "How it works", econAbout]] },
    { id: "report", label: "Report card", title: "Report card", about: "Every agent graded once a week on what the market did next, one graded bet per view. Every agent's weight is frozen at x1.00 while the swing evaluation run lasts.", pages: [["card", "Report card", reportCard]] },
    { id: "budget", label: "Budget", title: "Budget & team", about: "The AI budget: a fixed monthly cap split by desk, with a daily pace so no desk spends the month early.",
      pages: [["spend", "Spend", budgetSpend], ["team", "The team", budgetTeam], ["calls", "Recent calls", budgetCalls]] },
    { id: "how", label: "How it works", title: "How it works", about: "How the two trading desks decide.", pages: [["how", "How it works", howItWorks]] },
    { id: "archive", label: "Archive", title: "Archive", about: "Desks that are switched off, and the research that came before the current desks.",
      pages: [["lab", "Strategy Lab", tabLab], ["gold", "Gold desk (off)", archGold], ["goldmeetings", "Gold meetings", archGoldMeetings], ["fx", "FX & crypto (off)", archFx]] },
  ];
  let cur = "home", lastGen = null;
  const curPage = {};
  const tabDef = id => TABS.find(t => t.id === id);

  function safe(fn) {
    try { return fn(); } catch (err) {
      if (window.console) console.error(err);
      return `<p class="warnc">This part could not be drawn (${esc(err && err.message)}). The rest of the site still works.</p>`;
    }
  }
  // After a page is drawn: its money charts, and the live charts of open trades (they poll only while on screen).
  function after(root = document) {
    if (!window.FloorCharts) return;
    $$("[data-chart]", root).forEach(h => { try { FloorCharts[h.dataset.chart](h, F, +h.dataset.h || 160); } catch (err) { if (window.console) console.error(err); } });
    if (FloorCharts.positions) FloorCharts.positions(F);
  }
  function headH() { document.documentElement.style.setProperty("--head-h", Math.round($("#top").getBoundingClientRect().height) + "px"); }

  function drawTabs() {
    $("#tabs").innerHTML = TABS.map(t => t.id ? `<button role="tab" type="button" data-tab="${t.id}" aria-selected="${t.id === cur}">${esc(t.label)}</button>`
      : `<span class="grp${t.group ? "" : " sep"}" aria-hidden="true">${esc(t.group)}</span>`).join("");
  }

  function show(id, page, keep) {
    const t = tabDef(id) || tabDef("home");
    const moved = t.id !== cur;
    cur = t.id;
    if (page) curPage[t.id] = page;
    $$("#tabs [data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === cur)));
    const tb = $(`#tabs [data-tab="${cur}"]`);
    if (tb && moved) tb.scrollIntoView({ block: "nearest", inline: "nearest" });
    document.documentElement.classList.toggle("home", cur === "home");
    ["home", "ship", "markets", "page"].forEach(v => { $("#view-" + v).hidden = true; });
    const sub = $("#subtabs");
    if (!t.pages) {
      sub.hidden = true; sub.innerHTML = "";
      $("#view-" + cur).hidden = false;
      headH();
      if (cur === "home") drawHome();
      else if (cur === "markets") mountLive();
      if (!keep) window.scrollTo(0, 0);
      return;
    }
    const p = t.pages.find(x => x[0] === curPage[t.id]) || t.pages[0];
    curPage[t.id] = p[0];
    sub.hidden = t.pages.length < 2;
    sub.innerHTML = t.pages.length < 2 ? "" : t.pages.map(([k, label]) => `<button role="tab" type="button" data-page="${k}" aria-selected="${k === p[0]}">${esc(label)}</button>`).join("");
    $("#page-head").innerHTML = `<h2>${esc(t.title || t.label)}${t.pages.length > 1 ? ` <span class="sub" style="font-size:16px;font-weight:400">· ${esc(p[1])}</span>` : ""}</h2>${t.about ? `<p>${t.about}</p>` : ""}`;
    $("#view-page").hidden = false;
    headH();
    const y = window.scrollY;
    $("#panel").innerHTML = safe(p[2]);
    after($("#panel"));
    window.scrollTo(0, keep ? y : 0);
  }

  function refresh() {
    if (F.generated_at === lastGen) return;                     // nothing new: leave the page as the reader has it
    lastGen = F.generated_at;
    const t = tabDef(cur);
    if (cur === "home") drawHome();
    else if (t && t.pages) show(cur, null, true);
  }

  $("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); });
  $("#tabs").addEventListener("keydown", e => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const bs = $$("#tabs [data-tab]"), i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    bs[(i + (e.key === "ArrowRight" ? 1 : -1) + bs.length) % bs.length].focus();
  });
  $("#subtabs").addEventListener("click", e => { const b = e.target.closest("[data-page]"); if (b) show(cur, b.dataset.page); });
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-go]");
    if (!g) return;
    const [t, p] = g.dataset.go.split(":");
    show(t, p);
  });
  $("#panel").addEventListener("click", e => { const r = e.target.closest("[data-val]"); if (r) showValuation(r.dataset.val); });
  $("#panel").addEventListener("change", e => {
    if (e.target.id === "val-sector") { valSector = e.target.value; show(cur, null, true); }
    else if (e.target.id === "val-sort") { valSort = e.target.value; show(cur, null, true); }
  });
  window.addEventListener("resize", () => {
    headH();
    if (cur === "home") { const s = $("#deck").children[deckI]; if (s) $("#deck").scrollTop = s.offsetTop; }
  });
  if (window.ResizeObserver) new ResizeObserver(headH).observe($("#top"));

  // ===================================================================== dialogs
  function showValuation(t) {
    const dlg = $("#agent-dialog");
    dlg.classList.add("wide");
    $("#agent-body").innerHTML = `<p class="sub">Loading ${esc(t)}...</p>`;
    if (!dlg.open) dlg.showModal();
    if (!window.FloorVal) { $("#agent-body").innerHTML = empty("The valuation view did not load."); return; }
    window.FloorVal.load(F).then(V => { $("#agent-body").innerHTML = window.FloorVal.detail(t, ((V || {}).companies || {})[t]); },
      err => { $("#agent-body").innerHTML = empty((err && err.message) || "Could not load the valuation detail."); });
  }
  function showScout(kind, key) {
    const r = ((F.news || {})[kind] || {})[key];
    const who = kind === "fx" ? `${key} news scout` : `${key} news scout (EGX)`;
    $("#agent-dialog").classList.remove("wide");
    $("#agent-body").innerHTML = `<h3 style="margin-top:0">${esc(who)}</h3><p class="sub">A flying drone that reads the news on ${esc(key)} for its analysts.</p>` + (r ? `
      <p>${sentTag(r.sentiment)} <span class="tag hold">${esc(r.materiality || "?")}</span>${r.direction ? ` <span class="tag ${r.direction === "UP" ? "buy" : r.direction === "DOWN" ? "sell" : "hold"}">${esc(r.direction)}</span>` : ""} <span class="sub">priced in: ${esc((r.priced_in || "?").toLowerCase())}</span></p>
      <p class="note">${esc(r.key_point || "")}</p>${(r.items || []).length ? `<ul>${newsItems(r)}</ul>` : ""}<p class="sub">Read ${esc(ago(r.read_at))}.</p>` : empty("No read yet."));
    $("#agent-dialog").showModal();
  }
  function showAgent(id) {
    if (String(id).startsWith("scout:")) { const [, kind, key] = String(id).split(":"); return showScout(kind, key); }
    const a = (F.roster || []).find(r => r.id === id) || { name: id, role: "" };
    const n = (F.notes || {})[id];
    $("#agent-dialog").classList.remove("wide");
    $("#agent-body").innerHTML = `<h3 style="margin-top:0">${esc(a.name)}</h3><p class="sub">${esc(a.role)}</p>` + (n ? `
      ${n.stance ? `<p><span class="tag hold">${esc(n.stance)}</span>${n.confidence != null ? ` confidence ${num(n.confidence, 2)}` : ""}</p>` : ""}
      <p class="note">${esc(n.bubble)}</p><p>${esc(n.reasoning || "")}</p><p class="sub">${esc(ago(n.ts))}</p>` : empty("Nothing to say yet."));
    $("#agent-dialog").showModal();
  }

  // ===================================================================== markets (TradingView widgets, loaded on first open)
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
      theme: "dark", style: "1", locale: "en", backgroundColor: "rgba(22, 27, 35, 1)",
      gridColor: "rgba(230, 233, 239, 0.06)", allow_symbol_change: true, hide_volume: false,
      studies: ["STD;RSI", "STD;MACD"], support_host: "https://www.tradingview.com" });
    tvWidget($("#tv-ta"), "technical-analysis", {
      interval: symbol.startsWith("EGX:") ? "1D" : "15m", width: "100%", height: "100%", isTransparent: true,
      symbol, showIntervalTabs: true, displayMode: "single", locale: "en", colorTheme: "dark" });
  }
  function mountLive() {
    if (liveMounted) return;
    if (!navigator.onLine) { $("#live-note").textContent = "Live widgets need an internet connection."; return; }
    liveMounted = true;
    const e = F.egx || {};
    const egx = [...new Set([...(e.holdings || []).map(h => h.ticker), ...(e.orders || []).map(o => o.ticker)])];
    tvWidget($("#tv-tape"), "ticker-tape", {
      symbols: [...TV_BASE.map(([proName, title]) => ({ proName, title })), ...egx.map(t => ({ proName: "EGX:" + t, title: t }))],
      showSymbolLogo: true, isTransparent: true, displayMode: "adaptive", colorTheme: "dark", locale: "en" });
    const sel = $("#live-symbol");
    sel.innerHTML = [["OANDA:XAUUSD", "Gold (XAUUSD)"], ["EGX:EGX30", "EGX 30 index"], ...egx.map(t => ["EGX:" + t, t + " (EGX)"])]
      .map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
    sel.addEventListener("change", () => mountChart(sel.value));
    mountChart("OANDA:XAUUSD");
  }

  // ===================================================================== data
  // The site was updated since this page loaded: load the new version (a new address skips the browser's cache).
  function freshCode(D) {
    const meta = document.querySelector('meta[name="floor-version"]'), mine = meta && meta.content, theirs = D && D.code_version;
    if (!mine || !theirs || mine === theirs) return false;
    try { if (sessionStorage.getItem("floor-upgraded") === theirs) return false; sessionStorage.setItem("floor-upgraded", theirs); } catch (e) { /* storage blocked */ }
    location.replace(location.pathname + "?v=" + theirs + location.hash);
    return true;
  }
  let started = false;
  function render() {
    F = window.FLOOR;
    if (freshCode(F)) return;
    if (!F) { $("#nodata").hidden = false; $("#app").hidden = true; return; }
    $("#nodata").hidden = true; $("#app").hidden = false;
    status();
    window.Office.setData(F);
    $("#replay-gold").hidden = !(F.gold && F.gold.enabled !== false);
    if (!started) {                                             // the site always opens on the introduction
      started = true; lastGen = F.generated_at;
      drawTabs();
      const q = new URLSearchParams(location.search);
      show(q.get("tab") || "home", q.get("page"));
    } else refresh();
  }
  function locked(err) {
    if (F) return;                                              // keep showing the last good data on a blip
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

  // ===================================================================== the ship's controls
  $("#refresh").addEventListener("click", reload);
  const replay = (kind, none) => () => {
    if (window.Office.busy()) return alert("A meeting is already running. Watch it finish first.");
    if (!window.Office.replay(kind)) alert(none);
  };
  $("#replay-gold").addEventListener("click", replay("gold", "No gold meeting to replay yet."));
  $("#replay-egx").addEventListener("click", replay("egx", "No EGX review to replay yet."));
  $("#replay-fx").addEventListener("click", replay("fx", "No swing review to replay yet."));
  $("#ship-in").addEventListener("click", () => window.Office.zoomBy(1.5));
  $("#ship-out").addEventListener("click", () => window.Office.zoomBy(1 / 1.5));
  $("#ship-fit").addEventListener("click", () => window.Office.view("ship"));
  $("#ship-tour").addEventListener("click", () => window.Office.tour(true));
  $("#ship-goto").innerHTML = [["", "Choose a room..."], ["fx", "FX ring (all pairs)"], ["egx", "Nile ring (EGX)"], ["tail", "Tail: engines, cargo, reactor, lab"]]
    .concat(window.Office.rooms().map(r => [r.id, r.label]))
    .map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
  $("#ship-goto").addEventListener("change", e => { if (e.target.value) window.Office.view(e.target.value); e.target.value = ""; });

  window.Office.init($("#office"), showAgent);                  // waits, idle, until the Ship tab gives it a size
  if (window.Office.attachFullscreen) window.Office.attachFullscreen($("#ship-stage"), $("#ship-full"));
  headH();
  if (window.FLOOR_LOADER) reload(); else render();
  setInterval(reload, 60000);
})();
