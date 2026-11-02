#!/bin/bash
# click-by-text helper: $1 = text to match, $2 = optional wait ms (default 1500)
IP="21.0.21.97"
Q="$1"
W="${2:-1500}"
CLICK='(() => {
  const q = '"$Q"';
  const els = [...document.querySelectorAll("button, a, [role=button], [role=menuitem], [role=tab], [role=option]")];
  const vis = els.filter(e => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    if (e.closest("[aria-hidden=true]")) return false;
    return true;
  });
  const el = vis.find(e => (e.textContent||"").trim().toLowerCase().includes(q.toLowerCase())) ||
             vis.find(e => (e.getAttribute("aria-label")||"").toLowerCase().includes(q.toLowerCase()));
  if (!el) return "NOT-FOUND: " + q;
  const info = el.tagName + " [" + ((el.textContent||"").trim().slice(0,30) || el.getAttribute("aria-label")) + "]";
  el.click();
  return "CLICKED: " + info;
})()'
agent-browser eval "$CLICK" 2>/dev/null
agent-browser wait "$W" >/dev/null 2>&1
STATE='(() => {
  const h1 = document.querySelector("h1, h2");
  return JSON.stringify({url: location.search || location.pathname, h1: (h1?.textContent||"").trim().slice(0,60), textLen: document.body.innerText.length, errOverlay: !!document.querySelector("nextjs-portal")});
})()'
agent-browser eval "$STATE" 2>/dev/null
