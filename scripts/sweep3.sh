#!/bin/bash
# t182 sweep v3 — sequential DOM theme detector with oklch/lab/rgb/hex parsing.
# Usage: sweep3.sh <startIdx> <endIdx> <mode: light|dark>
# light mode → flags BIG dark blocks (dark-in-light leak)
# dark mode  → flags BIG white blocks (light-in-dark leak)
IDX_START=${1:-0}
IDX_END=${2:-427}
MODE=${3:-light}
PAGES=$(node -e "const a=require('/tmp/sweep-pages.json'); console.log(a.slice($IDX_START,$IDX_END+1).map(p=>p.page).join('\n'))")

DETECTOR="(() => {
  const html = document.documentElement;
  const mode = html.classList.contains('dark') ? 'dark' : 'light';
  // probe brand colors so primary CTAs never count as 'dark blocks'
  const probeBgs = [];
  ['bg-primary','bg-secondary','bg-destructive','bg-accent'].forEach(pc => {
    try {
      const d = document.createElement('div');
      d.className = pc;
      d.style.display = 'none';
      document.body.appendChild(d);
      probeBgs.push(getComputedStyle(d).backgroundColor);
      d.remove();
    } catch(e) {}
  });
  const parseColor = (c) => {
    if (!c || c === 'transparent' || c === 'none') return null;
    c = c.trim();
    let m;
    if ((m = c.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s\/]+([\d.]+))?\)/))) {
      if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return null;
      return (0.2126*+m[1]+0.7152*+m[2]+0.0722*+m[3])/255;
    }
    if ((m = c.match(/^oklch\(([\d.]+)%?[\s,]/)) || (m = c.match(/^oklab\(([\d.]+)%?[\s,]/)) || (m = c.match(/^oklch\(([\d.]+)%?\)/)) || (m = c.match(/^oklab\(([\d.]+)%?\)/))) {
      let L = parseFloat(m[1]);
      if (c.indexOf('%') !== -1) L = L/100;
      const am = c.match(/\/\s*([\d.]+)\)/);
      if (am && parseFloat(am[1]) < 0.5) return null;
      return L;
    }
    if ((m = c.match(/^lab\(([\d.]+)%?[\s,]/)) || (m = c.match(/^lab\(([\d.]+)%?\)/))) {
      let L = parseFloat(m[1]);
      if (c.indexOf('%') !== -1) L = L/100; else L = L/100;
      const am = c.match(/\/\s*([\d.]+)\)/);
      if (am && parseFloat(am[1]) < 0.5) return null;
      return L;
    }
    if ((m = c.match(/^#([0-9a-fA-F]{6})(?:([\d.]+))?/)) || (m = c.match(/^#([0-9a-fA-F]{3})/))) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(x => x+x).join('');
      return (0.2126*parseInt(h.slice(0,2),16)+0.7152*parseInt(h.slice(2,4),16)+0.0722*parseInt(h.slice(4,6),16))/255;
    }
    return null;
  };
  const vw = innerWidth, vh = innerHeight;
  const wantMode = '$MODE';
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < vw*0.3 || r.height < 36) return;
    if (r.width*r.height < vw*vh*0.05) return;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    if (probeBgs.indexOf(bg) !== -1) return;
    const l = parseColor(bg);
    let hit = false;
    if (l !== null) {
      if (wantMode === 'dark') hit = (l > 0.9);
      else hit = (l < 0.25);
    }
    if (hit) {
      const cls = (typeof el.className === 'string') ? el.className.slice(0,80) : String(el.tagName);
      bad.push({t: el.tagName, c: cls, bg: bg, w: Math.round(r.width), h: Math.round(r.height)});
    }
  });
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const bodyL = parseColor(bodyBg);
  return JSON.stringify({mode: mode, bodyBg: bodyBg, bodyL: bodyL, n: bad.length, bad: bad.slice(0,5)});
})()"

agent-browser set viewport 375 700 > /dev/null 2>&1
agent-browser eval "localStorage.setItem('theme','$MODE')" > /dev/null 2>&1

OUT=/tmp/sw3-${MODE}-$IDX_START.jsonl
> "$OUT"
i=0
for PAGE in $PAGES; do
  i=$((i+1))
  agent-browser open "http://localhost:3000/?page=$PAGE" > /dev/null 2>&1
  agent-browser wait 700 > /dev/null 2>&1
  RES=$(agent-browser eval "$DETECTOR" 2>/dev/null)
  if [ -z "$RES" ]; then RES='{"err":"empty-eval"}'; fi
  echo "{\"page\":\"$PAGE\",\"res\":$RES}" >> "$OUT"
  if [ $((i % 40)) -eq 0 ]; then echo "[$MODE/$IDX_START] progress $i / $((IDX_END-IDX_START+1))" >&2; fi
done
echo "DONE $MODE chunk $IDX_START-$IDX_END: $(wc -l < $OUT) pages" >&2
