#!/bin/bash
# t182 final passes: (A) dark re-sweep of 133 timing-affected pages with 1600ms wait,
# then (B) full desktop mobile-chrome leak check at 1280px.
DETECTOR_DARK="(() => {
  const html = document.documentElement;
  const mode = html.classList.contains('dark') ? 'dark' : 'light';
  const probeBgs = [];
  ['bg-primary','bg-secondary','bg-destructive','bg-accent'].forEach(pc => {
    try {
      const d = document.createElement('div');
      d.className = pc; d.style.display = 'none';
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
    if ((m = c.match(/^oklch\(([\d.]+)%?[\s,)]/)) || (m = c.match(/^oklab\(([\d.]+)%?[\s,)]/))) {
      let L = parseFloat(m[1]);
      if (c.indexOf('%') !== -1) L = L/100;
      const am = c.match(/\/\s*([\d.]+)\)/);
      if (am && parseFloat(am[1]) < 0.5) return null;
      return L;
    }
    if ((m = c.match(/^lab\(([\d.]+)%?[\s,)]/))) {
      let L = parseFloat(m[1])/100;
      const am = c.match(/\/\s*([\d.]+)\)/);
      if (am && parseFloat(am[1]) < 0.5) return null;
      return L;
    }
    if ((m = c.match(/^#([0-9a-fA-F]{6})/)) || (m = c.match(/^#([0-9a-fA-F]{3})/))) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(x => x+x).join('');
      return (0.2126*parseInt(h.slice(0,2),16)+0.7152*parseInt(h.slice(2,4),16)+0.0722*parseInt(h.slice(4,6),16))/255;
    }
    return null;
  };
  const vw = innerWidth, vh = innerHeight;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < vw*0.3 || r.height < 36) return;
    if (r.width*r.height < vw*vh*0.05) return;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    if (probeBgs.indexOf(bg) !== -1) return;
    if (/nav-wrapper|suggested-right/.test(String(el.className))) return;
    const l = parseColor(bg);
    if (l !== null && l > 0.9) {
      const cls = (typeof el.className === 'string') ? el.className.slice(0,80) : String(el.tagName);
      bad.push({t: el.tagName, c: cls, bg: bg, w: Math.round(r.width), h: Math.round(r.height)});
    }
  });
  return JSON.stringify({mode: mode, n: bad.length, bad: bad.slice(0,4)});
})()"

DETECTOR_DESKTOP="(() => {
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const cls = typeof el.className === 'string' ? el.className : '';
    if (!cls || cls.indexOf('md:hidden') === -1) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.height > 30 && r.width > 100) {
      bad.push({t: el.tagName, c: cls.slice(0,90), h: Math.round(r.height), w: Math.round(r.width)});
    }
  });
  return JSON.stringify({vw: innerWidth, n: bad.length, bad: bad.slice(0,4)});
})()"

echo "=== PASS A: dark re-sweep 133 pages (1600ms wait) ===" >&2
agent-browser set viewport 375 700 > /dev/null 2>&1
agent-browser eval "localStorage.setItem('theme','dark')" > /dev/null 2>&1
PAGES=$(node -e "console.log(require('/tmp/resweep-dark.json').join('\n'))")
> /tmp/swA-resweep.jsonl
i=0
for PAGE in $PAGES; do
  i=$((i+1))
  agent-browser open "http://localhost:3000/?page=$PAGE" > /dev/null 2>&1
  agent-browser wait 1600 > /dev/null 2>&1
  RES=$(agent-browser eval "$DETECTOR_DARK" 2>/dev/null)
  if [ -z "$RES" ]; then RES='{"err":"empty-eval"}'; fi
  echo "{\"page\":\"$PAGE\",\"res\":$RES}" >> /tmp/swA-resweep.jsonl
  if [ $((i % 30)) -eq 0 ]; then echo "[A] $i / 133" >&2; fi
done
echo "PASS A DONE: $(wc -l < /tmp/swA-resweep.jsonl)" >&2

echo "=== PASS B: desktop 1280px mobile-chrome check, all 428 pages ===" >&2
agent-browser set viewport 1280 800 > /dev/null 2>&1
agent-browser eval "localStorage.setItem('theme','light')" > /dev/null 2>&1
ALLPAGES=$(node -e "console.log(require('/tmp/sweep-pages.json').map(p=>p.page).join('\n'))")
> /tmp/swB-desktop.jsonl
i=0
for PAGE in $ALLPAGES; do
  i=$((i+1))
  agent-browser open "http://localhost:3000/?page=$PAGE" > /dev/null 2>&1
  agent-browser wait 800 > /dev/null 2>&1
  RES=$(agent-browser eval "$DETECTOR_DESKTOP" 2>/dev/null)
  if [ -z "$RES" ]; then RES='{"err":"empty-eval"}'; fi
  echo "{\"page\":\"$PAGE\",\"res\":$RES}" >> /tmp/swB-desktop.jsonl
  if [ $((i % 40)) -eq 0 ]; then echo "[B] $i / 428" >&2; fi
done
echo "PASS B DONE: $(wc -l < /tmp/swB-desktop.jsonl)" >&2
echo "ALL PASSES COMPLETE" >&2
