'use client'

import React from 'react'

/* ════════════════════════════════════════════════════════════════════
   HeroProductsGraphic — Handcrafted, high-level native vector artwork
   representing wholesale goods (textiles, jute bag, terracotta vase,
   and botanical plant) tailored to the Zylod wholesale marketplace.

   100% native SVG vector code:
   • Crisp on all displays (Retina, 4K, 1080p, mobile)
   • Zero image compression artifacts or blurry crops
   • Zero pre-baked badges or text (eliminates ghosting / double text)
   • Seamlessly matches the pale-pink gradient #FFF7F7 -> #FDF0F1
   ════════════════════════════════════════════════════════════════════ */

export function HeroProductsGraphic() {
  return (
    <div className="relative h-full w-full flex items-center justify-center overflow-hidden pointer-events-none select-none">
      <svg
        viewBox="0 0 520 400"
        className="h-full w-full object-contain max-h-[200px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Subtle ambient light glow */}
          <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEE2E2" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#FDF0F1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FDF0F1" stopOpacity="0" />
          </radialGradient>

          {/* Jute bag gradient */}
          <linearGradient id="jute-body" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#E2BA84" />
            <stop offset="50%" stopColor="#D4A368" />
            <stop offset="100%" stopColor="#B37E43" />
          </linearGradient>

          {/* Fabric gradients */}
          <linearGradient id="fab-mustard" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="70%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#CA8A04" />
          </linearGradient>

          <linearGradient id="fab-crimson" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="65%" stopColor="#E31C3D" />
            <stop offset="100%" stopColor="#BE123C" />
          </linearGradient>

          <linearGradient id="fab-denim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="60%" stopColor="#E31C3D" />
            <stop offset="100%" stopColor="#BE123C" />
          </linearGradient>

          <linearGradient id="fab-teal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="70%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#115E59" />
          </linearGradient>

          {/* Shadows */}
          <filter id="hero-soft-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#B91C1C" floodOpacity="0.10" />
          </filter>
          <filter id="hero-card-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.07" />
          </filter>
        </defs>

        {/* Ambient Warm Circle Glow */}
        <circle cx="340" cy="210" r="170" fill="url(#hero-glow)" />

        {/* Soft Ground Shadow on Floor */}
        <ellipse cx="330" cy="342" rx="170" ry="16" fill="#F1B7BF" opacity="0.45" />

        {/* ── 1. Terracotta / Ceramic Vase & Stems (Back Right) ── */}
        <g filter="url(#hero-card-shadow)">
          {/* Vase Ground Shadow */}
          <ellipse cx="425" cy="305" rx="22" ry="7" fill="#C2410C" opacity="0.25" />
          {/* Vase Body */}
          <path
            d="M408 300 C404 265 400 235 418 210 C421 206 427 206 430 210 C448 235 444 265 440 300 Z"
            fill="#EA580C"
          />
          <ellipse cx="424" cy="210" rx="10" ry="3.5" fill="#C2410C" />
          <ellipse cx="424" cy="300" rx="16" ry="5" fill="#C2410C" />
          {/* Dried Pampas / Floral Sprigs */}
          <path d="M424 210 Q418 140 398 95" stroke="#78716C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M424 210 Q430 130 450 85" stroke="#78716C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M424 210 Q424 120 422 75" stroke="#78716C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Fluffy Grass Tips */}
          <ellipse cx="396" cy="95" rx="6" ry="12" transform="rotate(-15 396 95)" fill="#A8A29E" opacity="0.75" />
          <ellipse cx="452" cy="85" rx="6" ry="12" transform="rotate(18 452 85)" fill="#A8A29E" opacity="0.75" />
          <ellipse cx="422" cy="75" rx="5" ry="14" fill="#A8A29E" opacity="0.8" />
        </g>

        {/* ── 2. Potted Green Houseplant (Middle Left) ── */}
        <g filter="url(#hero-card-shadow)">
          {/* Lush Green Monstera / Ficus Leaves */}
          <path d="M190 260 C165 210 145 190 120 200 C130 235 168 250 190 260 Z" fill="#16A34A" />
          <path d="M198 252 C192 190 205 155 228 150 C234 180 222 225 198 252 Z" fill="#22C55E" />
          <path d="M205 260 C238 215 260 205 272 222 C250 244 222 254 205 260 Z" fill="#15803D" />
          {/* Pot Shadow */}
          <ellipse cx="198" cy="316" rx="18" ry="4" fill="#64748B" opacity="0.2" />
          {/* Modern White Planter */}
          <path d="M176 260 L220 260 L212 314 L184 314 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
          <ellipse cx="198" cy="260" rx="22" ry="5.5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
          <ellipse cx="198" cy="314" rx="14" ry="3.5" fill="#E2E8F0" />
        </g>

        {/* ── 3. Stack of Folded Wholesale Fabrics (Center) ── */}
        <g filter="url(#hero-card-shadow)">
          {/* Layer 1: Indigo Denim Fabric (Bottom) */}
          <path
            d="M255 285 C255 273 275 273 385 273 C400 273 410 282 410 291 C410 300 400 309 385 309 L272 309 C260 309 255 301 255 291 Z"
            fill="url(#fab-denim)"
          />
          <ellipse cx="272" cy="291" rx="17" ry="14" fill="#BE123C" />
          <line x1="289" y1="283" x2="385" y2="283" stroke="#60A5FA" strokeWidth="1" opacity="0.4" />
          <line x1="289" y1="299" x2="385" y2="299" stroke="#9F1239" strokeWidth="1" opacity="0.5" />

          {/* Layer 2: Crimson Red Cotton Fabric */}
          <path
            d="M265 258 C265 246 285 246 390 246 C405 246 414 255 414 264 C414 273 405 282 390 282 L282 282 C270 282 265 274 265 264 Z"
            fill="url(#fab-crimson)"
          />
          <ellipse cx="282" cy="264" rx="17" ry="14" fill="#BE123C" />
          <line x1="299" y1="256" x2="390" y2="256" stroke="#FB7185" strokeWidth="1" opacity="0.4" />

          {/* Layer 3: Mustard Yellow Printed Fabric */}
          <path
            d="M260 231 C260 219 280 219 380 219 C395 219 404 228 404 237 C404 246 395 255 380 255 L276 255 C264 255 260 247 260 237 Z"
            fill="url(#fab-mustard)"
          />
          <ellipse cx="276" cy="237" rx="16" ry="14" fill="#CA8A04" />
          {/* Subtle Geometric Pattern on Mustard Fabric */}
          <circle cx="310" cy="237" r="2.5" fill="#854D0E" opacity="0.45" />
          <circle cx="330" cy="237" r="2.5" fill="#854D0E" opacity="0.45" />
          <circle cx="350" cy="237" r="2.5" fill="#854D0E" opacity="0.45" />
          <circle cx="370" cy="237" r="2.5" fill="#854D0E" opacity="0.45" />

          {/* Layer 4: Emerald / Teal Silk Roll (Top) */}
          <path
            d="M270 204 C270 192 290 192 370 192 C385 192 394 201 394 210 C394 219 385 228 370 228 L286 228 C274 228 270 220 270 210 Z"
            fill="url(#fab-teal)"
          />
          <ellipse cx="286" cy="210" rx="16" ry="14" fill="#0D9488" />
          <line x1="302" y1="202" x2="370" y2="202" stroke="#5EEAD4" strokeWidth="1" opacity="0.5" />
        </g>

        {/* ── 4. Natural Jute Tote Bag (Foreground) ── */}
        <g filter="url(#hero-soft-shadow)">
          {/* Back Handle */}
          <path
            d="M330 190 C330 120 370 120 370 190"
            stroke="#713F12"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />

          {/* Front Handle */}
          <path
            d="M295 185 C295 105 342 105 342 185"
            stroke="#854D0E"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M293 185 C293 107 340 107 340 185"
            stroke="#A16207"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />

          {/* Bag Body */}
          <path
            d="M272 190 L378 190 L390 326 C390 334 382 340 374 340 L280 340 C272 340 264 334 264 326 Z"
            fill="url(#jute-body)"
          />

          {/* Woven Burlap / Jute Grid Lines */}
          <path
            d="M270 215 L380 215 M268 245 L382 245 M266 275 L384 275 M264 305 L386 305"
            stroke="#9A6B32"
            strokeWidth="1.2"
            opacity="0.35"
          />
          <path
            d="M295 190 L295 340 M325 190 L325 340 M355 190 L355 340"
            stroke="#9A6B32"
            strokeWidth="1.2"
            opacity="0.35"
          />

          {/* White Canvas Front Pocket */}
          <rect
            x="292"
            y="230"
            width="72"
            height="76"
            rx="5"
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth="1.5"
          />
          {/* Decorative Wholesale Label on Pocket */}
          <rect x="304" y="248" width="48" height="4" rx="2" fill="#E31C3D" />
          <rect x="304" y="258" width="36" height="3" rx="1.5" fill="#94A3B8" />
          <rect x="304" y="267" width="42" height="3" rx="1.5" fill="#CBD5E1" />
          {/* Green Eco Certified Stamp */}
          <circle cx="348" cy="282" r="7" fill="#DCFCE7" stroke="#86EFAC" strokeWidth="1" />
          <path
            d="M345 282 L347.5 284.5 L352 279.5"
            stroke="#16A34A"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* ── 5. Wholesale Quality Verified Pill Badge ── */}
        <g filter="url(#hero-card-shadow)">
          <rect
            x="200"
            y="105"
            width="125"
            height="34"
            rx="17"
            fill="#FFFFFF"
            stroke="#FEE2E2"
            strokeWidth="1.5"
          />
          <circle cx="218" cy="122" r="9" fill="#E31C3D" />
          <path
            d="M214 122 L217 125 L222 119"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="234"
            y="126"
            fontSize="11.5"
            fontWeight="700"
            fill="#27272A"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            100% Export
          </text>
        </g>
      </svg>
    </div>
  )
}
