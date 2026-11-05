package com.zylod.wholesale.util

/**
 * t281 5-c — the 18-char order tokens ("ORD-MW2ZRVI5OPUW") wrap MID-GLYPH on
 * 320dp screens because Compose breaks any word that exceeds the line box
 * (VLM audit of artifact 13386389669: captures 18/70/71 wrapped
 * "ORD-MW / 2ZRVI5O / PUW"). A display-only zero-width space after each dash
 * gives the wrap engine a SEGMENT boundary instead ("ORD-MW2ZR / VI5OPUW") —
 * the full token stays visible, nothing is truncated, and the rendered glyph
 * sequence is identical (the ZWSP sits between a dash and the next segment).
 */
fun breakableOrderToken(token: String): String =
    if (token.contains('-')) token.replace("-", "-\u200B") else token
