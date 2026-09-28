/**
 * Token-driven MapLibre style builder.
 *
 * The basemap is ASSEMBLED from the site's own theme tokens at runtime
 * (read from CSS custom properties), not downloaded as a finished style —
 * so a light map in light mode and a dark map in dark mode come from the
 * same tokens that style the rest of the page, and any future theme gets a
 * matching basemap for free.
 *
 * The tiles still come from a provider — that is the licensed part:
 *   OpenFreeMap (default) — free for commercial use, no API key, serves
 *   OpenMapTiles-schema vector tiles + glyphs. Attribution "© OpenStreetMap
 *   contributors © OpenFreeMap" is rendered by MapLibre's control.
 *   See MAPS.md for licensing details and how to swap providers.
 *
 * The layer list is deliberately short — the set that still reads as a map
 * at any zoom: ground, water, green space, buildings, roads, boundaries,
 * place labels. Every colour comes from a token.
 */
import type { StyleSpecification } from 'maplibre-gl'

export interface ThemeTokens {
  background: string
  foreground: string
  card: string
  muted: string
  mutedForeground: string
  border: string
  primary: string
  primaryForeground: string
  accent: string
}

/** Read the site's CSS custom properties from the document root. */
export function readThemeTokens(): ThemeTokens {
  if (typeof window === 'undefined') {
    // SSR fallback — real values are read again on the client before use.
    return {
      background: '#ffffff',
      foreground: '#171717',
      card: '#ffffff',
      muted: '#f4f4f2',
      mutedForeground: '#6b6b66',
      border: '#e8e8e5',
      primary: '#c0392b',
      primaryForeground: '#ffffff',
      accent: '#c0392b',
    }
  }
  const s = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => {
    const val = s.getPropertyValue(name).trim()
    return val.length > 0 ? val : fallback
  }
  return {
    background: v('--background', '#ffffff'),
    foreground: v('--foreground', '#171717'),
    card: v('--card', v('--background', '#ffffff')),
    muted: v('--muted', '#f4f4f2'),
    mutedForeground: v('--muted-foreground', '#6b6b66'),
    border: v('--border', '#e8e8e5'),
    primary: v('--primary', '#c0392b'),
    primaryForeground: v('--primary-foreground', '#ffffff'),
    accent: v('--accent', v('--primary', '#c0392b')),
  }
}

/**
 * The OpenFreeMap TileJSON endpoint (vector tiles, OpenMapTiles schema).
 * Override with NEXT_PUBLIC_MAP_TILE_URL to bring your own provider
 * (MapTiler, self-hosted OpenMapTiles, …) without touching the style code.
 */
export function tileSourceUrl(): string {
  return process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tiles.openfreemap.org/planet'
}

export function mapGlyphsUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_GLYPHS_URL ||
    'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
  )
}

export function mapAttribution(): string {
  return (
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
    '© OpenStreetMap contributors · © OpenFreeMap'
  )
}

const ROAD_MAJOR = ['motorway', 'trunk', 'primary']
const ROAD_MINOR = ['secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service']

/**
 * Build the full style from tokens. `t` comes from readThemeTokens() on the
 * client; colours re-resolve whenever the theme changes.
 */
export function buildMapStyle(t: ThemeTokens): StyleSpecification {
  return {
    version: 8,
    glyphs: mapGlyphsUrl(),
    sources: {
      basemap: {
        type: 'vector',
        url: tileSourceUrl(),
        attribution: mapAttribution(),
      },
    },
    layers: [
      // ground
      { id: 'ground', type: 'background', paint: { 'background-color': t.muted } },

      // green space
      {
        id: 'green',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland']]],
        paint: { 'fill-color': t.muted, 'fill-opacity': 0.6 },
      },

      // water
      {
        id: 'water',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'water',
        paint: { 'fill-color': t.border, 'fill-opacity': 0.9 },
      },

      // buildings
      {
        id: 'buildings',
        type: 'fill',
        source: 'basemap',
        'source-layer': 'building',
        minzoom: 12,
        paint: { 'fill-color': t.border, 'fill-opacity': 0.55 },
      },

      // roads — minor first, major on top
      {
        id: 'roads-minor',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ROAD_MINOR]],
        minzoom: 10,
        paint: {
          'line-color': t.border,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 2.5, 18, 8],
          'line-opacity': 0.9,
        },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'basemap',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ROAD_MAJOR]],
        paint: {
          'line-color': t.mutedForeground,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 2, 18, 12],
          'line-opacity': 0.7,
        },
      },

      // boundaries
      {
        id: 'boundaries',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 4],
        paint: { 'line-color': t.mutedForeground, 'line-opacity': 0.35, 'line-width': 0.8 },
      },

      // place labels — the tokens that make the map findable
      {
        id: 'place-labels',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 13, 16, 16],
          'text-letter-spacing': 0.04,
        },
        paint: {
          'text-color': t.foreground,
          'text-halo-color': t.background,
          'text-halo-width': 1.4,
        },
      },
    ],
  }
}
