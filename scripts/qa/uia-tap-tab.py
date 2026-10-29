#!/usr/bin/env python3
"""t229g: tap a BOTTOM-BAR tab by its label text. The bottom ~12% of the
screen is exclusively the native tab bar (the Scaffold keeps WebView
content clear of it), so a text match restricted to that region is always
the TAB, never web content. Prints 'x y' for `adb shell input tap`.
Usage: uia-tap-tab.py <text> <ui.xml>"""
import re
import sys


def main() -> None:
    if len(sys.argv) < 3:
        return
    text, xml_path = sys.argv[1], sys.argv[2]
    try:
        xml = open(xml_path, encoding="utf-8", errors="ignore").read()
    except OSError:
        return
    # Screen height from the dump's root node bounds ([0,0][W,H]).
    root = re.search(r'bounds="\[0,0\]\[(\d+),(\d+)\]"', xml)
    screen_h = int(root.group(2)) if root else 2400
    threshold = int(screen_h * 0.85)
    for attr in ("text", "content-desc"):
        for m in re.finditer(
            attr + r'="[^"]*' + re.escape(text) + r'[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
            xml,
        ):
            left, top, right, bottom = map(int, m.groups())
            cy = (top + bottom) // 2
            if cy >= threshold:
                print(f"{(left + right) // 2} {cy}")
                return


if __name__ == "__main__":
    main()
