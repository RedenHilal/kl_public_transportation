// Single source of truth for transit colors.
//
// Goals: every agency / rail line is visually distinct, NO yellow (the CARTO
// Voyager basemap uses yellow/cream/orange for roads), and one identity hue per
// agency for its stops + live vehicles. Rail keeps recognizable official brand
// colors except the conflicting ones (the three near-identical greens and the
// yellow Putrajaya line) which are reassigned.
//
// Colors are applied in the frontend only (MapLibre paint + the legend); the DB
// `route_color` is left untouched. Tweak hexes here and everything follows.

// Rapid Rail lines, keyed by route_short_name.
export const RAIL_LINE_COLORS = {
  KJL: '#E4002B', // LRT Kelana Jaya — red (official)
  AGL: '#F58220', // LRT Ampang — orange (official)
  SPL: '#7B2D3A', // LRT Sri Petaling — maroon (official)
  KGL: '#1E8449', // MRT Kajang — green (the single green)
  MRL: '#6F3FA0', // KL Monorail — violet (was lime #84bd00)
  BRT: '#546E7A', // BRT Sunway — slate (was dark green #115740)
  PYL: '#C2186A', // MRT Putrajaya — magenta (was yellow #FFCD00)
};
export const RAIL_LINE_FALLBACK = '#37474F'; // dark slate

// Rapid Bus keeps its 3 GTFS sub-groups, recolored to distinct blue shades.
// Keyed by the existing GTFS route_color value carried on the tiles.
export const BUS_GROUP_COLORS = {
  '#006CFF': '#1565C0',
  '#008716': '#1E88E5',
  '#21618C': '#0D47A1',
};
export const BUS_FALLBACK = '#1565C0';

// One identity hue per agency — used for stops, live vehicles, and the
// single-color route layers (feeder). Keys match both `agency` (route tiles)
// and `agency_name` (realtime tiles).
export const AGENCY_COLORS = {
  ktmb: '#8D6E63',        // brown — KTM intercity (stops + vehicles)
  'rapid-bus': '#1565C0', // blue — Rapid Bus identity (stops + vehicles)
  'rapid-mrt': '#00897B', // teal — MRT Feeder (routes + stops + vehicles)
  'rapid-rail': '#37474F',// dark slate — rail stops (rail is multi-line)
};

export const STATION_COLOR = '#37474F';

// Builds a MapLibre `match` expression coloring rail lines by route_short_name.
export function railLineMatchExpr() {
  const stops = Object.entries(RAIL_LINE_COLORS).flat();
  return ['match', ['get', 'route_short_name'], ...stops, RAIL_LINE_FALLBACK];
}

// Builds a MapLibre `match` expression remapping the GTFS bus route_color groups.
export function busGroupMatchExpr() {
  const stops = Object.entries(BUS_GROUP_COLORS).flat();
  return ['match', ['get', 'route_color'], ...stops, BUS_FALLBACK];
}

// Resolves the legend swatch color for a route, matching what the map draws.
export function legendColor({ agency, shortName, routeColor }) {
  if (agency === 'rapid-rail') return RAIL_LINE_COLORS[shortName] || RAIL_LINE_FALLBACK;
  if (agency === 'rapid-bus') return BUS_GROUP_COLORS[routeColor] || BUS_FALLBACK;
  return AGENCY_COLORS[agency] || RAIL_LINE_FALLBACK;
}

// Returns true if a fill is light enough to need a dark outline (else white).
export function isLight(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Rec. 601 luma
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}
