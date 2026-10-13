// Remembers which creator sent the visitor (?ref=username) for 30 days, and counts one visit per day.
import { API_BASE } from "./config.js";
const KEY = "wv-ref", DAY = 86400000;
try {
  const u = (new URLSearchParams(location.search).get("ref") || "").trim().toLowerCase();
  if (/^[a-z0-9][a-z0-9_-]{2,23}$/.test(u)) {
    let prev = null; try { prev = JSON.parse(localStorage.getItem(KEY)); } catch {}
    const fresh = !prev || prev.u !== u || Date.now() - (prev.seen || 0) > DAY;
    localStorage.setItem(KEY, JSON.stringify({ u, t: prev && prev.u === u ? prev.t : Date.now(), seen: fresh ? Date.now() : prev.seen }));
    if (fresh && !/YOUR-/.test(API_BASE)) {
      fetch(`${API_BASE}/trackRef`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: u }), keepalive: true }).catch(() => {});
    }
  }
} catch {}
