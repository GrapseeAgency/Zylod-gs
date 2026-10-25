#!/usr/bin/env python3
"""t187: find a UI node by text/content-desc in a uiautomator dump and print
its tap-center coordinates ('x y'). Usage: uia-tap-center.py <text> <ui.xml>"""
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
    for attr in ("text", "content-desc"):
        m = re.search(
            attr + r'="[^"]*' + re.escape(text) + r'[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
            xml,
        )
        if m:
            l, t, r, b = map(int, m.groups())
            print(f"{(l + r) // 2} {(t + b) // 2}")
            return


if __name__ == "__main__":
    main()
