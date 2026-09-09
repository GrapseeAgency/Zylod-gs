#!/usr/bin/env python3
"""Pattern-based desktop conversion for Zylod page components.

Applies the standard transformation from agent-ctx/desktop-ui-contract.md:
- root bottom padding hacks get md: variants
- mobile-only headers (back button + title, nothing functional) get md:hidden
  and a desktop-only page title is inserted after the header
- headers with functional controls keep the header, only the back button hides
- narrow centered containers get desktop widening
Never touches logic. Idempotent: skips files already containing md:/lg: classes
unless --force is given.
"""
import re
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

def widen_container(m):
    cls = m.group(0)
    return cls  # placeholder, real logic below

def process(path, force=False):
    src = open(path).read()
    name = os.path.basename(path)
    if not force and re.search(r'class[Nn]ame="[^"]*\b(md|lg|xl):', src):
        return (name, 'skip: already responsive')
    orig = src
    notes = []

    # 1. Root bottom padding hacks
    src, n = re.subn(r'(className="min-h-screen[^"]*?)\bpb-20\b(?! md:pb)', r'\1pb-20 md:pb-8', src)
    src, n2 = re.subn(r'(className="min-h-screen[^"]*?)\bpb-24\b(?! md:pb)', r'\1pb-24 md:pb-10', src)
    src, n3 = re.subn(r'(className="min-h-screen[^"]*?)\bpb-28\b(?! md:pb)', r'\1pb-28 md:pb-10', src)
    if n + n2 + n3:
        notes.append(f'root pb md variants x{n+n2+n3}')

    # locate header: first sticky element after return
    ret = src.find('return (')
    if ret == -1:
        return (name, 'skip: no return found')
    header_m = re.search(r'<header([^>]*)>', src[ret:])
    sticky_m = re.search(r'<div className="((?:md:hidden )?sticky[^"]*)"', src[ret:])
    header_start = None
    header_is_header_tag = False
    if header_m and (not sticky_m or header_m.start() <= sticky_m.start()):
        header_start = ret + header_m.start()
        header_cls_m = re.search(r'className="([^"]*)"', header_m.group(1) + header_m.group(0))
        header_is_header_tag = True
    elif sticky_m:
        header_start = ret + sticky_m.start()

    if header_start is None:
        return (name, 'manual: no sticky header found')

    # header end: find the matching close by scanning.
    # For <header> tags use </header>; for sticky divs count div depth.
    after = src[header_start:]
    if header_is_header_tag:
        close_rel = after.find('</header>')
        if close_rel == -1:
            return (name, 'manual: header never closed')
        zone_end = header_start + close_rel + len('</header>')
        zone = src[header_start:zone_end]
    else:
        depth = 0
        zone_end = None
        for m in re.finditer(r'<div\b|</div>', after):
            if m.group(0) == '<div':
                depth += 1
            else:
                depth -= 1
                if depth == 0:
                    zone_end = header_start + m.end()
                    break
        if zone_end is None:
            return (name, 'manual: sticky div header never closed')
        zone = src[header_start:zone_end]

    # extract title text from header zone (h1/span direct text)
    title_m = re.search(r'<h1[^>]*>([^<{]+)</h1>|<span([^>]*)>([^<{]+)</span>', zone)
    title_text = None
    if title_m:
        title_text = (title_m.group(1) or title_m.group(3) or '').strip()
        title_text = re.sub(r'\s*&[a-z]+;\s*', ' ', title_text).strip()

    # does header have functional controls (buttons besides back)?
    buttons = re.findall(r'<button[^>]*onClick=\{([^}]*)\}', zone)
    back_btns = [b for b in buttons if 'goBack' in b or 'navigate(\'home\')' in b or 'navigate("home")' in b]
    other_btns = [b for b in buttons if b not in back_btns]
    has_search_input = '<input' in zone or '<Input' in zone

    if back_btns and not other_btns and not has_search_input and title_text:
        # mobile-only header: hide entirely, insert desktop h1 after header zone
        # safety: require an explicit </header> close inside the zone
        if header_is_header_tag and '</header>' not in zone:
            return (name, 'manual: header not closed within zone')
        new_zone = zone
        # add md:hidden to the header/sticky className
        if header_is_header_tag:
            new_zone = re.sub(r'<header className="', '<header className="md:hidden ', new_zone, count=1)
        else:
            new_zone = re.sub(r'<div className="sticky', '<div className="md:hidden sticky', new_zone, count=1)
        # insert desktop h1 right after the header close
        if header_is_header_tag:
            close_idx = new_zone.rfind('</header>')
            close_end = close_idx + len('</header>')
        else:
            close_idx = new_zone.rfind('</div>')
            close_end = close_idx + len('</div>')
        insert = f'\n      <h1 className="hidden md:block text-2xl font-bold text-slate-900">{title_text}</h1>'
        src = src[:header_start] + new_zone[:close_end] + insert + new_zone[close_end:] + src[zone_end:]
        notes.append(f'mobile-only header hidden, desktop h1 "{title_text}"')
    elif back_btns:
        # hide back buttons only
        new_zone = zone
        for b in back_btns:
            if 'md:hidden' not in zone[:zone.index(b)+200] or True:
                pass
            new_zone = re.sub(r'<button className="(?![^"]*md:hidden)', '<button className="md:hidden ', new_zone, count=1)
        src = src[:header_start] + new_zone + src[zone_end:]
        notes.append('back button hidden on desktop')
    else:
        notes.append('header left as-is')

    # 2. widen narrow centered containers (first occurrence only)
    src, n = re.subn(r'className="((?:max-w-(?:md|lg|xl|2xl)) mx-auto[^"]*)"', lambda m: f'className="{m.group(1)} md:max-w-2xl md:px-6 md:py-6"' if 'md:' not in m.group(1) and 'px-4' in m.group(1) else m.group(0), src, count=1)

    if src != orig:
        open(path, 'w').write(src)
        return (name, 'converted: ' + '; '.join(notes))
    return (name, 'unchanged: ' + '; '.join(notes))

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv
    files = []
    for a in args:
        ap = os.path.join(ROOT, a)
        if os.path.isdir(ap):
            for f in sorted(os.listdir(ap)):
                if f.endswith('.tsx'):
                    files.append(os.path.join(ap, f))
        else:
            files.append(ap)
    for f in files:
        try:
            print('%-45s %s' % process(f, force))
        except Exception as e:
            print('%-45s ERROR: %s' % (os.path.basename(f), e))

if __name__ == '__main__':
    main()
