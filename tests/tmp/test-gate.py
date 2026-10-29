"""t230 — browser-verified test of the MandatoryUpdateGate.

Spoofs the native-shell environment the way the real Android WebView does:
UA suffix `ZylodAndroidNative/2.3.0` + `window.__ZYL_NATIVE__` injected at
document start (before any app code runs — the same timing as
WebShellScripts.kt). Then asserts the gate blocks the app with the update
screen, and that a current-version UA (2.4.6) does NOT block.
"""
import asyncio
import sys
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
STALE_UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) ZylodAndroidNative/2.3.0 AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"
CURRENT_UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) ZylodAndroidNative/2.4.7 AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"

async def run_ua(pw, ua: str):
    browser = await pw.chromium.launch()
    ctx = await browser.new_context(user_agent=ua, viewport={"width": 390, "height": 844})
    await ctx.add_init_script("window.__ZYL_NATIVE__ = true;")
    page = await ctx.new_page()
    await page.goto(BASE + "/?page=home", wait_until="networkidle")
    await page.wait_for_timeout(2500)
    body = await page.inner_text("body")
    r = {
        "ua": ua.split("ZylodAndroidNative/")[1].split(" ")[0],
        "blocked": "Update required" in body,
        "download_link": await page.locator("a[download]").count(),
        "version_text": "2.4.7" in body,
        "home_visible": "Featured" in body or "featured" in body.lower(),
    }
    await browser.close()
    return r

async def main():
    async with async_playwright() as pw:
        stale = await run_ua(pw, STALE_UA)
        current = await run_ua(pw, CURRENT_UA)

    print("stale-2.3.0   ->", stale)
    print("current-2.4.7 ->", current)

    ok = (stale["blocked"] and stale["download_link"] >= 1 and stale["version_text"]
          and not current["blocked"])
    print("GATE-TEST:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)

asyncio.run(main())
