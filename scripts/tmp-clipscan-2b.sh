#!/bin/bash
# Task 2-b: content-loss (clipped content) scan per page
IP="21.0.21.97"
EVAL='(() => {
  const vw = document.documentElement.clientWidth;
  const docOv = document.documentElement.scrollWidth - vw;
  const lost = [];
  document.querySelectorAll("*").forEach(el => {
    if (el.offsetWidth > 0) {
      const cs = getComputedStyle(el);
      if (cs.overflowX === "hidden" && el.scrollWidth - el.clientWidth > 8 && !el.closest("[data-intentional-hscroll]")) {
        lost.push(el.tagName + "." + String(el.className).slice(0,60) + " clip=" + (el.scrollWidth - el.clientWidth));
      }
    }
  });
  return JSON.stringify({docOv, lostCount: lost.length, lost: lost.slice(0,6)});
})()'
for p in "$@"; do
  agent-browser open "http://$IP:3000/?page=$p" >/dev/null 2>&1
  agent-browser wait 2500 >/dev/null 2>&1
  echo "== $p (vw=$(agent-browser eval 'document.documentElement.clientWidth' 2>/dev/null | tr -d '\"'))"
  agent-browser eval "$EVAL" 2>/dev/null
  echo
done
