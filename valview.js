/* The valuation desk's views (owner 2026-10-12), shared by the desktop dashboard (app.js) and the phone page (m.js).
   FloorVal.load(F) fetches the per-company detail once per valuation run (val.js next to the page locally, the
   encrypted val.enc.json on the published site); FloorVal.detail(ticker, detail) draws one company: the five-year
   forecast, the last eight quarters, the three valuations, the forecast drivers, what the latest quarter showed, the
   two agents' notes and the revision log. */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n, d = 0) => (n == null || isNaN(n)) ? "-" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const chg = (x, d = 1) => (x == null || isNaN(x)) ? "-" : `<span class="${x > 0 ? "up" : x < 0 ? "down" : ""}">${x > 0 ? "+" : ""}${num(x * 100, d)}%</span>`;
  const share = (x, d = 1) => (x == null || isNaN(x)) ? "-" : num(x * 100, d) + "%";
  const mn = x => x == null ? "-" : num(x, Math.abs(x) >= 1000 ? 0 : Math.abs(x) >= 10 ? 1 : 2);
  const ps = x => x == null ? "-" : num(x, Math.abs(x) < 2 ? 3 : 2);
  const BAD = /BAD|LOSS|SQUEEZE|SLOWING|DOWN/;

  const CSS = `.fv table{border-collapse:collapse;width:100%;font-size:12px}
.fv th,.fv td{padding:4px 7px;border-bottom:1px solid rgba(25,230,255,.12);text-align:right;white-space:nowrap}
.fv th:first-child,.fv td:first-child{text-align:left;position:sticky;left:0;background:#0a0f28;z-index:1}
.fv .scroll{overflow-x:auto;margin:6px 0 10px}.fv td.fc,.fv th.fc{background:rgba(25,230,255,.07)}
.fv h4{margin:16px 0 4px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#19e6ff}
.fv .flag{display:inline-block;margin:2px 4px 2px 0;padding:2px 7px;border-radius:6px;font-size:11px;border:1px solid currentColor}
.fv .lead{font-size:15px;margin:4px 0}.fv .sub{opacity:.85}.fv a{color:#9b5cff}`;
  if (!document.getElementById("fv-css")) {
    const st = document.createElement("style");
    st.id = "fv-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  let cache = null, wait = null;
  function load(F) {
    const want = ((F || {}).valuation || {}).as_of;
    if (cache && cache.as_of === want) return Promise.resolve(cache);
    if (wait) return wait;
    let p;
    if (window.FLOOR_VAL_LOADER) p = window.FLOOR_VAL_LOADER(want);
    else if (window.FLOOR_VAL && (window.FLOOR_SNAPSHOT || window.FLOOR_VAL.as_of === want)) p = Promise.resolve(window.FLOOR_VAL);
    else p = new Promise((ok, no) => {
      const s = document.createElement("script");
      s.src = "val.js?t=" + encodeURIComponent(want || Date.now());
      s.onload = () => { s.remove(); window.FLOOR_VAL ? ok(window.FLOOR_VAL) : no(new Error("No valuation detail yet.")); };
      s.onerror = () => { s.remove(); no(new Error("No valuation detail yet.")); };
      document.body.appendChild(s);
    });
    wait = p.then(v => { if (v && v.as_of === want) cache = v; wait = null; return v; }, e => { wait = null; throw e; });
    return wait;
  }

  function flags(list) {
    return (list || []).map(f => `<span class="flag ${BAD.test(f) ? "down" : "up"}">${esc(f)}</span>`).join("");
  }

  function yearTable(d) {
    const hist = d.history || [], fc = d.forecast || [];
    const heads = hist.map(h => `<th>${esc(h.label || "FY" + h.fy)}</th>`).concat(fc.map(f => `<th class="fc">${esc(f.label)}</th>`));
    const fin = d.kind === "bank" || d.kind === "financial";
    const rows = [["Revenue", "revenue", mn], ["Growth", "growth", chg], ["Net income", "net_income", mn], ["Net margin", "net_margin", share],
      ...(fin ? [] : [["EBIT", "ebit", mn], ["EBIT margin", "ebit_margin", share]]),
      ["EPS (EGP)", "eps", ps], ["Dividend (EGP)", "dps", ps], ["Payout", "payout", share],
      ["Free cash flow", "fcf", mn], ["Cash flow valued", "cash_flow", mn]];
    const body = rows.map(([label, key, f]) => `<tr><td>${label}</td>${hist.map(h => `<td>${f(h[key])}</td>`).join("")}${fc.map(x => `<td class="fc">${f(x[key])}</td>`).join("")}</tr>`).join("");
    return `<div class="scroll"><table><thead><tr><th>EGP millions</th>${heads.join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function quarterTable(d) {
    const qs = (d.quarters || []).slice().reverse();
    if (!qs.length) return `<p class="sub">No quarterly figures yet.</p>`;
    const rows = [["Revenue", "revenue", mn], ["vs a year ago", "revenue_yoy", chg], ["Net income", "net_income", mn],
      ["vs a year ago", "net_income_yoy", chg], ["Net margin", "net_margin", share], ["EPS (EGP)", "eps", ps]];
    return `<div class="scroll"><table><thead><tr><th>EGP millions</th>${qs.map(q => `<th title="${esc(q.months || "")}">${esc(q.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(([label, key, f]) => `<tr><td>${label}</td>${qs.map(q => `<td>${f(q[key])}</td>`).join("")}</tr>`).join("")}<tr><td>Source</td>${qs.map(q => `<td class="sub">${esc(q.source || "missing")}</td>`).join("")}</tr></tbody></table></div>`;
  }

  function methods(d) {
    const m = d.methods || {}, w = d.weights || {};
    const row = (k, label) => {
      const x = m[k] || {};
      let extra = "";
      if (k === "multiples" && x.implied) extra = Object.entries(x.implied).map(([a, v]) => `${a} ${ps(v)}`).join(", ");
      if (k === "dcf" && x.value) extra = `${esc(x.model || "")}, terminal value ${share(x.terminal_share, 0)} of the total`;
      if (k === "ddm" && x.value) extra = `terminal payout ${share(x.terminal_payout, 0)}${x.payer === false ? ", pays no dividend now" : ""}`;
      return `<tr><td>${label}</td><td>${ps(x.value)}</td><td>${w[k] != null ? share(w[k], 0) : "-"}</td><td style="text-align:left;white-space:normal">${extra}${x.note ? (extra ? "; " : "") + esc(x.note) : ""}</td></tr>`;
    };
    const c = d.coc || {};
    const path = (label, xs, lng) => xs ? `<tr><td>${label}</td>${xs.map(x => `<td>${share(x, 1)}</td>`).join("")}<td>${share(lng, 1)}</td></tr>` : "";
    return `<div class="scroll"><table><thead><tr><th>Method</th><th>Per share</th><th>Weight</th><th style="text-align:left">Detail</th></tr></thead><tbody>
      ${row("dcf", "Discounted cash flow")}${row("multiples", "Peer multiples")}${row("ddm", "Dividend discount")}
      <tr><td><b>Fair value</b></td><td><b>${ps(d.fair_value)}</b></td><td></td><td style="text-align:left">${d.upside_pct != null ? chg(d.upside_pct / 100) + " against the price" : ""}</td></tr>
      <tr><td>12-month target</td><td>${ps(d.target_12m)}</td><td></td><td style="text-align:left;white-space:normal">fair value grown a year at the cost of equity, less the next dividend</td></tr></tbody></table></div>
      ${c.ke_path ? `<div class="scroll"><table><thead><tr><th>Cost of capital</th><th>Year 1</th><th>Year 2</th><th>Year 3</th><th>Year 4</th><th>Year 5</th><th>Long run</th></tr></thead><tbody>
        ${path("Cost of equity", c.ke_path, c.ke_long)}${d.kind === "bank" || d.kind === "financial" ? "" : path("WACC", c.wacc_path, c.wacc_long)}</tbody></table></div>
        <p class="sub">Risk-free ${share(c.rf, 0)} easing to ${share(c.rf_long, 0)} as inflation falls, beta ${num(c.beta, 2)} (TradingView ${num(c.beta_raw, 2)}), equity risk premium ${share(c.erp, 1)}${c.extra_risk ? `, extra company risk ${share(c.extra_risk, 1)}` : ""}, tax ${share(c.tax, 1)}, long-run growth ${share(c.g, 0)}.</p>` : ""}`;
  }

  function drivers(d) {
    const x = d.drivers, fc = d.forecast || [];
    if (!x) return "";
    const rows = [["Revenue growth", "growth"], ["Net margin", "net_margin"], ...(d.kind === "bank" || d.kind === "financial" ? [] : [["EBIT margin", "ebit_margin"]]), ["Payout", "payout"]];
    const b = d.basis || {};
    return `<h4>Forecast drivers (${esc(d.drivers_source === "analyst" ? "set by the Valuation Analyst" : "the code's baseline, not reviewed yet")})</h4>
      <div class="scroll"><table><thead><tr><th></th>${fc.map(f => `<th class="fc">${esc(f.label)}</th>`).join("")}</tr></thead><tbody>
      ${rows.map(([label, k]) => `<tr><td>${label}</td>${(x[k] || []).map(v => `<td class="fc">${share(v, 1)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="sub">Year 1 growth is for the quarters not reported yet, against the same quarters last year. Long-run return on capital ${share(x.return_on_capital, 0)}.
      The baseline came from: growth this year so far ${chg(b.growth_ytd)}, last year ${chg(b.growth_last_year)}, 3-year average ${chg(b.growth_3y)}; net margin over the last 4 quarters ${share(b.net_margin_ttm)}, 3-year median ${share(b.net_margin_3y)}.</p>`;
  }

  function detail(t, d) {
    if (!d) return `<p class="sub">No valuation for ${esc(t)} yet.</p>`;
    const cal = d.calendar || {}, lq = d.last_quarter || {}, a = d.analyst || {}, r = d.read || {};
    const notes = (d.data_notes || []).filter(Boolean);
    return `<div class="fv"><h3 style="margin-top:0">${esc(d.name || t)} (${esc(t)})</h3>
      <p class="lead">Price <b>${ps(d.price)}</b> · fair value <b>${ps(d.fair_value)}</b> ${d.upside_pct != null ? chg(d.upside_pct / 100) : ""} · 12-month target ${ps(d.target_12m)}</p>
      <p class="sub">${esc(d.sector || "")} · ${esc(d.status || "")}${d.confidence != null ? ` · confidence ${num(d.confidence, 2)} of 0.40` : ""} · next results: ${esc(cal.next_label || "?")} ${cal.expected ? "about " + esc(cal.expected) : ""} (${esc(cal.source || "no date")})${cal.status === "OVERDUE" ? ` <span class="down">late</span>` : ""}</p>
      ${notes.length ? `<p class="sub warn">${notes.map(esc).join(" · ")}</p>` : ""}
      <h4>Five-year forecast (shaded) after the last four years</h4>${yearTable(d)}
      ${(d.forecast || [])[0] && d.forecast[0].actual_quarters ? `<p class="sub">${esc(d.forecast[0].label)}: ${esc(d.forecast[0].actual_quarters)} quarter(s) already reported are facts; the rest of the year is forecast.</p>` : ""}
      <h4>Last eight quarters</h4>${quarterTable(d)}
      ${lq.label ? `<h4>Latest quarter: ${esc(lq.label)}</h4><p>${flags(lq.flags) || `<span class="sub">No warning signs.</span>`}</p>
        <p class="sub">Revenue ${mn(lq.revenue)} (${chg(lq.revenue_yoy)} on a year ago), net income ${mn(lq.net_income)} (${chg(lq.net_income_yoy)})${lq.expected_net_income != null ? `; the forecast before it expected ${mn(lq.expected_net_income)} (${chg(lq.net_income_surprise)} surprise)` : ""}.</p>` : ""}
      ${a.reason ? `<h4>Valuation Analyst</h4><p>${a.quarter_verdict ? `<span class="flag">${esc(String(a.quarter_verdict).replace(/_/g, " "))}</span>` : ""}${a.trend ? `<span class="flag ${a.trend === "WORSENING" ? "down" : a.trend === "IMPROVING" ? "up" : ""}">${esc(a.trend)}</span>` : ""}</p><p>${esc(a.reason)}</p><p class="sub">${esc(String(a.as_of || "").slice(0, 10))} · ${esc(a.trigger || "")}</p>` : ""}
      <h4>Valuation</h4>${methods(d)}
      ${drivers(d)}
      ${r.summary ? `<h4>Earnings Tracker</h4><p>${esc(r.summary)}</p>
        ${(r.one_offs || []).length ? `<p class="sub">One-offs: ${esc(r.one_offs.join("; "))}</p>` : ""}${(r.drivers || []).length ? `<p class="sub">Drivers: ${esc(r.drivers.join("; "))}</p>` : ""}
        ${r.guidance ? `<p class="sub">Guidance: ${esc(r.guidance)}</p>` : ""}${r.dividend ? `<p class="sub">Dividend: ${esc(r.dividend)}</p>` : ""}
        <p class="sub">${(r.sources || []).map(s => s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>` : esc(s.title)).join(" · ")} ${esc(String(r.ts || "").slice(0, 10))}</p>` : ""}
      ${(d.revisions || []).length ? `<h4>Revisions</h4>${d.revisions.slice().reverse().map(x => `<p class="sub">${esc(String(x.ts).slice(0, 10))} · ${esc(x.trigger)}: fair value ${ps(x.fv_before)}${x.fv_after_quarter != null ? ` &rarr; ${ps(x.fv_after_quarter)} after the figures` : ""} &rarr; <b>${ps(x.fv_after)}</b> after the review${x.verdict ? ` (${esc(String(x.verdict).replace(/_/g, " ").toLowerCase())})` : ""}${x.reason ? `. ${esc(x.reason)}` : ""}</p>`).join("")}` : ""}
      </div>`;
  }

  window.FloorVal = { load, detail, flags };
})();
