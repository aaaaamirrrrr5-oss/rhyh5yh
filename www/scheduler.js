/* Site Inspector Scheduler (v1.35).
 * Pure decision logic for every automatic run (SEO rebuild/full run, auto-pilot, on-device growth cycle).
 * No DOM, no network, no timers: the app passes in "now", the task state and the device environment.
 *
 * What it adds on top of the plain "interval elapsed" check:
 *  - a skipped run (busy / not allowed / no bridge) does NOT consume the schedule, so it is retried soon instead of a whole interval later;
 *  - failures are retried with a growing delay (15 min, 1 h, 3 h, 6 h) and then given up until the next interval, instead of hammering or waiting a full day;
 *  - device policy: offline, low battery (not charging), Wi-Fi only / data saver, and optional quiet hours;
 *  - unknown environment (no Battery API, no Network Information API) is permissive: never blocks because data is missing.
 * It never decides WHAT to change on the site; it only decides WHEN a run may start.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.SI = root.SI || {}; root.SI.Scheduler = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const BACKOFF = [15 * MIN, 60 * MIN, 180 * MIN, 360 * MIN];
  const BUSY_RETRY = 5 * MIN;
  const BLOCKED_RETRY = 60 * MIN;
  const DEFAULT_POLICY = { wifiOnly: false, minBattery: 20, quietEnabled: false, quietStart: 23, quietEnd: 7 };
  const LABELS = {
    ready: 'آماده اجرا',
    off: 'خاموش',
    not_due: 'هنوز موعد نشده',
    busy: 'کار دیگری در حال اجراست',
    backoff: 'تلاش دوباره پس از خطا',
    offline: 'اینترنت قطع است',
    battery: 'باتری کم است (به شارژر وصل کن)',
    metered: 'فقط با Wi‑Fi اجرا می‌شود',
    quiet: 'ساعت سکوت',
    not_allowed: 'مجوز افزونه یا اتصال امن لازم است',
    no_bridge: 'افزونه متصل نیست',
    no_report: 'هنوز سایتی بازرسی نشده',
    gave_up: 'چند بار پیاپی ناموفق بود؛ در نوبت بعد دوباره تلاش می‌شود'
  };

  const int = (v, d, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

  function normalizePolicy(p) {
    p = p && typeof p === 'object' ? p : {};
    return {
      wifiOnly: !!p.wifiOnly,
      minBattery: int(p.minBattery == null ? DEFAULT_POLICY.minBattery : p.minBattery, DEFAULT_POLICY.minBattery, 0, 60),
      quietEnabled: !!p.quietEnabled,
      quietStart: int(p.quietStart == null ? DEFAULT_POLICY.quietStart : p.quietStart, DEFAULT_POLICY.quietStart, 0, 23),
      quietEnd: int(p.quietEnd == null ? DEFAULT_POLICY.quietEnd : p.quietEnd, DEFAULT_POLICY.quietEnd, 0, 23)
    };
  }

  /** Quiet window in local hours; supports overnight windows (23 → 7). Equal start and end means "no window". */
  function inQuiet(policy, now) {
    const p = normalizePolicy(policy);
    if (!p.quietEnabled || p.quietStart === p.quietEnd) return false;
    const h = new Date(now == null ? Date.now() : now).getHours();
    return p.quietStart < p.quietEnd ? (h >= p.quietStart && h < p.quietEnd) : (h >= p.quietStart || h < p.quietEnd);
  }

  /** Milliseconds from now until the quiet window ends (0 when not inside it). */
  function quietRemainingMs(policy, now) {
    if (!inQuiet(policy, now)) return 0;
    const p = normalizePolicy(policy); const d = new Date(now == null ? Date.now() : now);
    const end = new Date(d); end.setMinutes(0, 0, 0); end.setHours(p.quietEnd);
    if (end.getTime() <= d.getTime()) end.setDate(end.getDate() + 1);
    return end.getTime() - d.getTime();
  }

  /** Device-level gate. env: { online, battery: {level 0..1, charging} | null, type, saveData }. Missing data never blocks. */
  function envGate(policy, env, now) {
    const p = normalizePolicy(policy); const e = env || {};
    if (e.online === false) return { ok: false, code: 'offline', reason: LABELS.offline, retryMs: 10 * MIN };
    if (inQuiet(p, now)) return { ok: false, code: 'quiet', reason: LABELS.quiet, retryMs: quietRemainingMs(p, now) };
    const b = e.battery;
    if (b && typeof b.level === 'number' && b.charging !== true && b.level * 100 < p.minBattery) return { ok: false, code: 'battery', reason: LABELS.battery, retryMs: 30 * MIN };
    if (p.wifiOnly && (e.type === 'cellular' || e.saveData === true)) return { ok: false, code: 'metered', reason: LABELS.metered, retryMs: 30 * MIN };
    return { ok: true, code: 'ready', reason: LABELS.ready, retryMs: 0 };
  }

  /**
   * Full decision for one task.
   * ctx: { now, due, state, busy (falsy | string), policy, env }
   * Order matters: not due → busy → backoff → device policy.
   */
  function gate(ctx) {
    const c = ctx || {}; const now = c.now == null ? Date.now() : c.now; const st = c.state || {};
    if (!c.due) return { ok: false, code: 'not_due', reason: LABELS.not_due, retryAt: 0 };
    if (c.busy) return { ok: false, code: 'busy', reason: LABELS.busy, retryAt: now + BUSY_RETRY };
    if (Number(st.retryAt || 0) > now) { const code = !st.lastCode || st.lastCode === 'fail' ? 'backoff' : st.lastCode; return { ok: false, code, reason: LABELS[code] || LABELS.backoff, retryAt: Number(st.retryAt) }; }
    const g = envGate(c.policy, c.env, now);
    if (!g.ok) return { ok: false, code: g.code, reason: g.reason, retryAt: now + g.retryMs };
    return { ok: true, code: 'ready', reason: LABELS.ready, retryAt: 0 };
  }

  /**
   * Fold the result of one attempt into the task's retry state.
   * outcome: { ok: true } | { skipped: true, reason } | { ok: false, error }
   * Returns { state, consumed }: consumed === true means the app should stamp lastRun = now
   * (the interval starts over); false means the schedule must stay due so the run is retried.
   */
  function record(prev, outcome, now) {
    const t = now == null ? Date.now() : now; const s = prev && typeof prev === 'object' ? prev : {}; const o = outcome || {};
    const base = { failures: Number(s.failures || 0), retryAt: 0, lastAt: t, lastOk: Number(s.lastOk || 0), lastCode: '', lastError: '' };
    if (o.ok) return { consumed: true, state: Object.assign(base, { failures: 0, lastOk: t, lastCode: 'ok' }) };
    if (o.skipped) {
      const reason = String(o.reason || 'busy');
      return { consumed: false, state: Object.assign(base, { lastCode: reason, retryAt: t + (reason === 'busy' ? BUSY_RETRY : BLOCKED_RETRY) }) };
    }
    const failures = base.failures + 1; const err = String(o.error || '').slice(0, 160);
    if (failures > BACKOFF.length) return { consumed: true, state: Object.assign(base, { failures: 0, lastCode: 'gave_up', lastError: err }) };
    return { consumed: false, state: Object.assign(base, { failures, retryAt: t + BACKOFF[failures - 1], lastCode: 'fail', lastError: err }) };
  }

  /** Map the return value of the app's run functions ({ok, reason, summary}) to a record() outcome. */
  function outcomeOf(res) {
    if (res && res.ok) return { ok: true };
    if (res && res.reason && !res.summary) return { skipped: true, reason: res.reason };
    const err = res && (res.error || (res.summary && res.summary.error)) || 'اجرای خودکار ناموفق بود.';
    return { ok: false, error: err };
  }

  /** When the next attempt can start, ignoring device policy (for the status panel). 0 = unknown/off. */
  function nextAt(enabled, lastRun, hours, state, now) {
    if (!enabled) return 0;
    const t = now == null ? Date.now() : now;
    const due = Number(lastRun || 0) + Number(hours || 24) * HOUR;
    return Math.max(due, Number((state || {}).retryAt || 0), 0) || t;
  }

  /** One-line status for the UI. */
  function describe(task, now) {
    const t = task || {}; const n = now == null ? Date.now() : now;
    if (!t.enabled) return { code: 'off', label: LABELS.off, at: 0 };
    const st = t.state || {}; const at = nextAt(true, t.lastRun, t.hours, st, n);
    if (st.lastCode === 'gave_up' && at > n) return { code: 'gave_up', label: LABELS.gave_up, at };
    if (Number(st.retryAt || 0) > n) return { code: st.lastCode === 'fail' ? 'backoff' : st.lastCode, label: LABELS[st.lastCode === 'fail' ? 'backoff' : st.lastCode] || LABELS.backoff, at };
    if (at > n) return { code: 'not_due', label: LABELS.not_due, at };
    return { code: 'ready', label: LABELS.ready, at: n };
  }

  return { DEFAULT_POLICY, BACKOFF, LABELS, normalizePolicy, inQuiet, quietRemainingMs, envGate, gate, record, outcomeOf, nextAt, describe };
});
