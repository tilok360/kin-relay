// "m h dom mon dow" schedules (numbers, lists, ranges, */n) checked against a Date in this PC's time zone.
"use strict";
function cronMatches(expr, d) {
  const f = String(expr || "").trim().split(/\s+/); if (f.length !== 5) return false;
  const vals = [d.getMinutes(), d.getHours(), d.getDate(), d.getMonth() + 1, d.getDay()];
  return f.every((part, i) => part.split(",").some((p) => {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(p); if (!m) return false;
    const step = m[2] ? Number(m[2]) : 1; let lo = 0, hi = 99;
    if (m[1] !== "*") { const r = m[1].split("-").map(Number); lo = r[0]; hi = r.length > 1 ? r[1] : (m[2] ? 99 : r[0]); }
    return vals[i] >= lo && vals[i] <= hi && (vals[i] - lo) % step === 0;
  }));
}

module.exports = { cronMatches };
