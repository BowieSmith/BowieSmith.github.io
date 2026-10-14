// basement-plan.mjs -- draw the two basement drawings, a clean floor plan and
// an isometric view of the finished rooms, from one description of the plan.
//
//   node scripts/basement-plan.mjs
//
// Writes images/basement/plan.svg and images/basement/isometric.svg.
//
// The plan is described once, in feet, in the first section below. Every
// number that was written on the hand sketch (images/basement/sketch.jpg) is
// marked "written"; the rest are scaled off the photograph ("scaled") or, in
// the isometric view, imagined. Sheet directions are used throughout: x runs
// right and y runs down the sheet, with the origin at the top-left outer
// corner of the foundation. The sketch has no north arrow.
//
// No dependencies.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "images", "basement");

// ---- the plan, in feet ------------------------------------------------------

const W = 26.5;                       // written: 26'-6" overall
const H = 34.0;                       // written: 34'-0" overall
const TE = 8 / 12;                    // exterior walls, assumed 8" concrete
const TI = 4.5 / 12;                  // partitions, assumed 2x4 with drywall
const h = TI / 2;
const IN = TE;                        // inner faces of the exterior walls
const IE = W - TE;
const IS = H - TE;

const BEAM = 13.5;                    // written: 13'-6" to the wall under the beam
const OFFICE_S = 12.0;                // written: the office is 12' deep
const LANDING = 45 / 12;              // written: 45" from the wall to the stair
const STAIR_W = IN + LANDING;         // west end of the stair
const STUB = 1.0;                     // written: a 12" wall beside the stair
const STAIR_S = H - (18 + 4 / 12);    // written: the open space is 18'-4" deep
const STAIR_N = OFFICE_S + h;
const BATH_N = 4.75;                  // scaled
const SHOWER_E = W - 3.0;             // written: the electrical closet is 3' wide
const SHOWER_W = SHOWER_E - h - 3.0;  // written: the shower is 3' x 4'
const MECH_N = 9 + 4 / 12;            // written: 9'-4" from the top
const MECH_S = H - (14 + 9 / 12);     // written: 14'-9" from the bottom
const MECH_DOORS = 23.07;             // scaled: the mechanical closet's door line
const HVAC_E = 17.4;                  // scaled
const HVAC_S = 17.25;                 // scaled

const DOOR = 2 + 8 / 12;              // 2'-8" doors, assumed

// A wall is a solid rectangle. wallX runs along x, centred on y; wallY runs
// along y, centred on x. gaps are intervals left open, for doors.
function wallX(y, x0, x1, t, gaps = [], kind = "int") {
  return spans(x0, x1, gaps).map(([a, b]) => ({ x0: a, y0: y - t / 2, x1: b, y1: y + t / 2, kind }));
}
function wallY(x, y0, y1, t, gaps = [], kind = "int") {
  return spans(y0, y1, gaps).map(([a, b]) => ({ x0: x - t / 2, y0: a, x1: x + t / 2, y1: b, kind }));
}
function spans(a, b, gaps) {
  const out = [];
  let at = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > at) out.push([at, g0]);
    at = Math.max(at, g1);
  }
  if (b > at) out.push([at, b]);
  return out;
}

const DBL_DOOR = [2.0, 8.0];                       // scaled: a 6' opening, 2' from the corner
const OFFICE_DOOR = [1.6, 1.6 + DOOR];             // scaled: near the top of the beam wall
const POCKET = [7.5, 10.0];                        // scaled: the pocket door, drawn on the sketch as a thinner wall
const POCKET_CAVITY = [POCKET[0] - 2.5, POCKET[0]]; // the wall the panel slides into
const HVAC_DOOR = [13.95, 16.95];                  // scaled: 3' of bi-folds
const MECH_DOOR_A = [MECH_N + h + 0.2, 13.87];     // two pairs of bi-folds with a post between
const MECH_DOOR_B = [14.71, MECH_S - h - 0.2];

// Changes from the owner after the first drawing, none of them on the sketch:
// a fireplace centred on the open space's east wall, where two sketched
// windows are removed, and a second window in the south wall. Its position
// and the fireplace's size are assumed.
const FIRE_C = (MECH_S + h + IS) / 2;                                          // midway along the open space's east wall
const FIRE = { x0: IE - (1 + 8 / 12), y0: FIRE_C - 2.5, x1: IE, y1: FIRE_C + 2.5 };   // a 5' chase, 1'-8" deep
const FIREBOX = { x0: FIRE.x0 + 0.3, y0: FIRE.y0 + 1.0, x1: FIRE.x1 - 0.25, y1: FIRE.y1 - 1.0 };
const HEARTH = { x0: FIRE.x0 - 1.5, y0: FIRE.y0 + 0.5, x1: FIRE.x0, y1: FIRE.y1 - 0.5 };
const EJECTOR = { x: SHOWER_E + h + 1.07, y: 7.7, r: 0.85 };                   // the bathroom's ejector pit, in its 3' bay
const MECH_GEAR = [                                                            // in the mechanical closet, from its south end
  { x: 24.55, y: 18.00, r: 0.80, z: 3.6, tag: "WT" },                          // the well's pressure tank
  { x: 24.55, y: 15.90, r: 1.00, z: 4.6, tag: "WH" },                          // water heater
  { x: 24.30, y: 14.10, r: 0.50, z: 4.3, tag: "IF" },                          // iron filter
  { x: 24.55, y: 12.50, r: 0.80, z: 3.0, tag: "B" },                           // the softener's brine tank
  { x: 24.30, y: 10.90, r: 0.50, z: 4.3, tag: "S" },                           // softener
];
const UV = { x0: IE - 0.2, y0: 10.9, y1: 14.1, z0: 2.6, z1: 2.9 };              // ultraviolet light, a tube on the wall behind IF, B and S

const walls = [
  // the foundation, by which wall of the sheet it is
  ...wallX(TE / 2, 0, W, TE, [], "ext-n"),
  ...wallX(H - TE / 2, 0, W, TE, [DBL_DOOR], "ext-s"),
  ...wallY(TE / 2, TE, H - TE, TE, [], "ext-w"),
  ...wallY(W - TE / 2, TE, H - TE, TE, [], "ext-e"),
  // the partition under the beam, with the office's door to the storage and
  // its pocket door to the bathroom
  ...wallY(BEAM, IN, HVAC_S - h, TI, [OFFICE_DOOR, POCKET]),
  // the office's south wall: a 12" stub, the top of the stair, the HVAC closet
  ...wallX(OFFICE_S, STAIR_W - STUB, BEAM - h, TI),
  ...wallX(OFFICE_S, BEAM + h, HVAC_E + h, TI),
  ...wallY(HVAC_E, OFFICE_S + h, HVAC_S - h, TI),
  ...wallX(HVAC_S, BEAM - h, HVAC_E + h, TI, [HVAC_DOOR]),
  // the bathroom and the storage
  ...wallX(BATH_N, BEAM + h, SHOWER_E + h, TI),
  ...wallY(SHOWER_E, BATH_N + h, MECH_N + h, TI),
  ...wallX(MECH_N, SHOWER_W - h, SHOWER_E - h, TI),
  ...wallX(MECH_N, SHOWER_E + h, IE, TI),
  // the mechanical closet: its south wall and the jambs of its door line
  ...wallX(MECH_S, MECH_DOORS - h, IE, TI),
  ...wallY(MECH_DOORS, MECH_N + h, MECH_DOOR_A[0], TI),
  ...wallY(MECH_DOORS, MECH_DOOR_A[1], MECH_DOOR_B[0], TI),
  ...wallY(MECH_DOORS, MECH_DOOR_B[1], MECH_S - h, TI),
];

// Swing doors: hinge, leaf length, and the leaf's direction (degrees, 0 = +x,
// 90 = +y) when closed and when open.
const BATH_HINGE = [SHOWER_W - h, MECH_N + h];
const BATH_LATCH = [HVAC_E + h, OFFICE_S - h];
const bathClosed = (Math.atan2(BATH_LATCH[1] - BATH_HINGE[1], BATH_LATCH[0] - BATH_HINGE[0]) * 180) / Math.PI;
const doors = [
  { name: "landing", hx: IN + 0.08, hy: OFFICE_S, len: DOOR, closed: 0, open: -90, glass: true, full: false },
  { name: "office-storage", hx: BEAM, hy: OFFICE_DOOR[1], len: DOOR, closed: -90, open: 0, full: false },
  { name: "bath", hx: BATH_HINGE[0], hy: BATH_HINGE[1], len: 3.0, closed: bathClosed, open: bathClosed - 70, full: false },
  { name: "double-a", hx: DBL_DOOR[0], hy: IS, len: 3.0, closed: 0, open: -80, full: true },
  { name: "double-b", hx: DBL_DOOR[1], hy: IS, len: 3.0, closed: 180, open: -100, full: true },
  { name: "shower", hx: SHOWER_W, hy: 7.33, len: 1.8, closed: 90, open: 150, glass: true, full: false },
];

// Bi-fold doors: the opening, and the side they fold out to (degrees).
const bifolds = [
  { x0: HVAC_DOOR[0], y0: HVAC_S, x1: HVAC_DOOR[1], y1: HVAC_S, out: 90 },
  { x0: MECH_DOORS, y0: MECH_DOOR_A[0], x1: MECH_DOORS, y1: MECH_DOOR_A[1], out: 180 },
  { x0: MECH_DOORS, y0: MECH_DOOR_B[0], x1: MECH_DOORS, y1: MECH_DOOR_B[1], out: 180 },
];

// Windows, in the south wall, drawn full size at the owner's request: 3' wide
// with the head at door height. The sketch marks one here (its centre is
// scaled from the photo) and gives no sizes; the second is added, midway
// between the double door and the first. The sketch's two windows in the
// east wall are removed for the fireplace.
const WIN_W = 3.0, WIN_SILL = 2 + 8 / 12, WIN_HEAD = 6 + 8 / 12;
const windows = [
  { wall: "s", c: 22.625 },
  { wall: "s", c: 14.875, added: true },
].map((w) => ({ ...w, a: w.c - WIN_W / 2, b: w.c + WIN_W / 2 }));

const GLASS = { x: SHOWER_W, y0: BATH_N + h, y1: 7.33 };     // the shower's fixed glass panel
const SUMP = { x: 24.3, y: 32.5, r: 0.75 };                   // scaled
const CORNER_BOX = { x: 25.3, y: 32.8, s: 0.65 };             // scaled: an unlabelled box
const POSTS = [[BEAM, BATH_N], [BEAM, 10.4], [BEAM, 16.8]];   // scaled: circles on the sketch
const PANEL = { x0: 13.9, x1: 14.9 };                         // the sub panel, on the north wall
const TREADS = 10;                                            // in the run shown
const TREAD = (BEAM - h - STAIR_W) / TREADS;

// Rooms, as polygons of their clear floor area, for areas and for the floors.
const rooms = {
  office: [[IN, IN], [BEAM - h, IN], [BEAM - h, OFFICE_S - h], [IN, OFFICE_S - h]],
  storage: [[BEAM + h, IN], [IE, IN], [IE, BATH_N - h], [BEAM + h, BATH_N - h]],
  elect: [[SHOWER_E + h, BATH_N + h], [IE, BATH_N + h], [IE, MECH_N - h], [SHOWER_E + h, MECH_N - h]],
  bath: [[BEAM + h, BATH_N + h], [SHOWER_W, BATH_N + h], [SHOWER_W, MECH_N - h], [SHOWER_W - h, MECH_N - h],
    [SHOWER_W - h, MECH_N + h], [HVAC_E + h, OFFICE_S - h], [BEAM + h, OFFICE_S - h]],
  shower: [[SHOWER_W, BATH_N + h], [SHOWER_E - h, BATH_N + h], [SHOWER_E - h, MECH_N - h], [SHOWER_W, MECH_N - h]],
  hvac: [[BEAM + h, OFFICE_S + h], [HVAC_E - h, OFFICE_S + h], [HVAC_E - h, HVAC_S - h], [BEAM + h, HVAC_S - h]],
  mech: [[MECH_DOORS + h, MECH_N + h], [IE, MECH_N + h], [IE, MECH_S - h], [MECH_DOORS + h, MECH_S - h]],
  stair: [[STAIR_W, STAIR_N], [BEAM - h, STAIR_N], [BEAM - h, STAIR_S], [STAIR_W, STAIR_S]],
  landing: [[IN, STAIR_N], [STAIR_W, STAIR_N], [STAIR_W, STAIR_S], [IN, STAIR_S]],
  open: [[IN, STAIR_S], [BEAM - h, STAIR_S], [BEAM - h, HVAC_S + h], [HVAC_E + h, HVAC_S + h],
    [HVAC_E + h, OFFICE_S - h], [SHOWER_W - h, MECH_N + h], [MECH_DOORS - h, MECH_N + h],
    [MECH_DOORS - h, MECH_S + h], [IE, MECH_S + h], [IE, IS], [IN, IS]],
};

function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

// ---- small helpers ----------------------------------------------------------

const f = (n) => (Math.round(n * 100) / 100).toString();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function el(tag, attrs = {}, inner = "") {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");
  return inner === null ? `<${tag}${a}/>` : `<${tag}${a}>${inner}</${tag}>`;
}
const rad = (deg) => (deg * Math.PI) / 180;

// 13.5 -> 13'-6"; 0.375 -> 4 1/2"
function ftin(ft) {
  const totalQuarters = Math.round(ft * 48);
  const feet = Math.floor(totalQuarters / 48);
  const quarters = totalQuarters - feet * 48;
  const inches = Math.floor(quarters / 4);
  const frac = ["", "¼", "½", "¾"][quarters % 4];
  const inch = `${inches}${frac}″`;
  if (feet === 0) return inch;
  return `${feet}′-${inch}`;
}

// ---- drawing 1: the plan ----------------------------------------------------

function drawPlan() {
  const S = 28;                                  // pixels per foot
  const OX = 175, OY = 150;                      // where the plan's origin lands
  const SHEET_W = 1600, SHEET_H = 1230;
  const X = (x) => OX + x * S, Y = (y) => OY + y * S;
  const out = [];
  const add = (s) => out.push(s);

  const INK = "#1f1f1f", MID = "#6b6b6b", LIGHT = "#9a9a9a", RULE = "#d8d8d8";
  const FONT = `font-family="Helvetica Neue, Helvetica, Arial, sans-serif"`;

  // sheet
  add(el("rect", { x: 0, y: 0, width: SHEET_W, height: SHEET_H, fill: "#ffffff" }, null));
  add(el("rect", { x: 20, y: 20, width: SHEET_W - 40, height: SHEET_H - 40, fill: "none", stroke: INK, "stroke-width": 1.5 }, null));

  // floors, faintly, so the rooms read as rooms
  const floorTone = { office: "#f6f3ec", storage: "#f1f1ef", elect: "#f1f1ef", bath: "#eef2f3", shower: "#e7edee",
    hvac: "#f1f1ef", mech: "#f1f1ef", stair: "#f6f3ec", landing: "#f6f3ec", open: "#f8f6f0" };
  for (const [name, poly] of Object.entries(rooms)) {
    add(el("polygon", { points: poly.map(([x, y]) => `${f(X(x))},${f(Y(y))}`).join(" "), fill: floorTone[name] }, null));
  }

  // the line of the beam above, dashed on the sketch, with its posts
  add(el("line", { x1: X(BEAM), y1: Y(HVAC_S + h), x2: X(BEAM), y2: Y(IS), stroke: MID, "stroke-width": 1.2, "stroke-dasharray": "10 5 2 5" }, null));

  // walls
  for (const w of walls) {
    add(el("rect", { x: X(w.x0), y: Y(w.y0), width: (w.x1 - w.x0) * S, height: (w.y1 - w.y0) * S, fill: INK }, null));
  }
  for (const [px, py] of POSTS) {
    add(el("rect", { x: X(px) - 7, y: Y(py) - 7, width: 14, height: 14, fill: "#ffffff", stroke: INK, "stroke-width": 1.2 }, null));
    add(el("circle", { cx: X(px), cy: Y(py), r: 3.6, fill: INK }, null));
  }

  // windows: a white opening in the wall with the glazing drawn as two lines
  for (const w of windows) {
    if (w.wall === "e") {
      add(el("rect", { x: X(IE) - 1, y: Y(w.a), width: TE * S + 2, height: (w.b - w.a) * S, fill: "#ffffff" }, null));
      for (const dx of [0.26, 0.4]) add(el("line", { x1: X(IE + dx), y1: Y(w.a), x2: X(IE + dx), y2: Y(w.b), stroke: INK, "stroke-width": 1 }, null));
      for (const yy of [w.a, w.b]) add(el("line", { x1: X(IE), y1: Y(yy), x2: X(W), y2: Y(yy), stroke: INK, "stroke-width": 1.2 }, null));
    } else {
      add(el("rect", { x: X(w.a), y: Y(IS) - 1, width: (w.b - w.a) * S, height: TE * S + 2, fill: "#ffffff" }, null));
      for (const dy of [0.26, 0.4]) add(el("line", { x1: X(w.a), y1: Y(IS + dy), x2: X(w.b), y2: Y(IS + dy), stroke: INK, "stroke-width": 1 }, null));
      for (const xx of [w.a, w.b]) add(el("line", { x1: X(xx), y1: Y(IS), x2: X(xx), y2: Y(H), stroke: INK, "stroke-width": 1.2 }, null));
    }
  }

  // swing doors: the leaf, open, and the arc it sweeps; glass leaves are two thin lines
  for (const d of doors) {
    const tip = (deg) => [X(d.hx + d.len * Math.cos(rad(deg))), Y(d.hy + d.len * Math.sin(rad(deg)))];
    const [ox, oy] = tip(d.open), [cx, cy] = tip(d.closed);
    const sweep = d.open > d.closed ? 1 : 0;
    if (d.glass) {
      const nx = -Math.sin(rad(d.open)) * 1.6, ny = Math.cos(rad(d.open)) * 1.6;
      for (const s of [-1, 1]) add(el("line", { x1: X(d.hx) + s * nx, y1: Y(d.hy) + s * ny, x2: ox + s * nx, y2: oy + s * ny, stroke: INK, "stroke-width": 0.9 }, null));
    } else {
      add(el("line", { x1: X(d.hx), y1: Y(d.hy), x2: ox, y2: oy, stroke: INK, "stroke-width": 2.2 }, null));
    }
    add(el("path", { d: `M ${f(cx)} ${f(cy)} A ${f(d.len * S)} ${f(d.len * S)} 0 0 ${sweep} ${f(ox)} ${f(oy)}`, fill: "none", stroke: MID, "stroke-width": 0.9 }, null));
  }

  // the pocket door: the wall it slides into drawn hollow, the panel half open
  add(el("rect", { x: X(BEAM - h) + 1.2, y: Y(POCKET_CAVITY[0]), width: TI * S - 2.4, height: (POCKET_CAVITY[1] - POCKET_CAVITY[0]) * S, fill: "#ffffff" }, null));
  add(el("rect", { x: X(BEAM) - 2, y: Y(POCKET[0] - 1.25), width: 4, height: 2.5 * S, fill: INK }, null));

  // bi-fold doors: each leaf is two panels drawn as a V
  for (const b of bifolds) {
    const L = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
    const ux = (b.x1 - b.x0) / L, uy = (b.y1 - b.y0) / L;
    const nx = Math.cos(rad(b.out)), ny = Math.sin(rad(b.out));
    const p = L / 4, a = 0.6 * p, o = 0.8 * p;
    const pt = (along, outward) => `${f(X(b.x0 + ux * along + nx * outward))},${f(Y(b.y0 + uy * along + ny * outward))}`;
    add(el("polyline", { points: [pt(0, 0), pt(a, o), pt(2 * a, 0)].join(" "), fill: "none", stroke: INK, "stroke-width": 1.6 }, null));
    add(el("polyline", { points: [pt(L, 0), pt(L - a, o), pt(L - 2 * a, 0)].join(" "), fill: "none", stroke: INK, "stroke-width": 1.6 }, null));
    add(el("line", { x1: X(b.x0), y1: Y(b.y0), x2: X(b.x1), y2: Y(b.y1), stroke: LIGHT, "stroke-width": 0.8, "stroke-dasharray": "4 3" }, null));
  }

  // the shower's fixed glass panel
  add(el("line", { x1: X(GLASS.x), y1: Y(GLASS.y0), x2: X(GLASS.x), y2: Y(GLASS.y1), stroke: INK, "stroke-width": 1.2 }, null));
  add(el("line", { x1: X(GLASS.x) + 3, y1: Y(GLASS.y0), x2: X(GLASS.x) + 3, y2: Y(GLASS.y1), stroke: INK, "stroke-width": 0.6 }, null));

  // the stair: treads, the open side, and the arrow copied from the sketch
  for (let i = 0; i <= TREADS; i++) {
    const x = STAIR_W + i * TREAD;
    add(el("line", { x1: X(x), y1: Y(STAIR_N), x2: X(x), y2: Y(STAIR_S), stroke: INK, "stroke-width": i === 0 ? 1.6 : 0.9 }, null));
  }
  add(el("line", { x1: X(STAIR_W), y1: Y(STAIR_S), x2: X(BEAM - h), y2: Y(STAIR_S), stroke: INK, "stroke-width": 1.6 }, null));
  {
    const ya = Y((STAIR_N + STAIR_S) / 2), xa = X(STAIR_W + 0.9), xb = X(BEAM - h - 0.9);
    add(el("circle", { cx: xa, cy: ya, r: 3.5, fill: "none", stroke: INK, "stroke-width": 1.4 }, null));
    add(el("line", { x1: xa + 3.5, y1: ya, x2: xb, y2: ya, stroke: INK, "stroke-width": 1.6 }, null));
    add(el("polygon", { points: `${f(xb + 1)},${f(ya)} ${f(xb - 11)},${f(ya - 5)} ${f(xb - 11)},${f(ya + 5)}`, fill: INK }, null));
  }

  // bathroom fixtures
  {
    const tc = 14.75;                                           // toilet centreline
    add(el("rect", { x: X(tc - 0.8), y: Y(BATH_N + h), width: 1.6 * S, height: 0.6 * S, fill: "#fff", stroke: INK, "stroke-width": 1 }, null));
    add(el("ellipse", { cx: X(tc), cy: Y(BATH_N + h + 0.6 + 0.85), rx: 0.62 * S, ry: 0.85 * S, fill: "#fff", stroke: INK, "stroke-width": 1 }, null));
    add(el("rect", { x: X(16.1), y: Y(BATH_N + h), width: 3.0 * S, height: 1.75 * S, fill: "#fff", stroke: INK, "stroke-width": 1 }, null));
    add(el("ellipse", { cx: X(17.6), cy: Y(BATH_N + h + 0.9), rx: 0.75 * S, ry: 0.55 * S, fill: "none", stroke: INK, "stroke-width": 0.9 }, null));
    add(el("circle", { cx: X(17.6), cy: Y(BATH_N + h + 0.22), r: 2.2, fill: INK }, null));
    const sc = [(SHOWER_W + SHOWER_E - h) / 2, (BATH_N + MECH_N) / 2];
    add(el("line", { x1: X(sc[0]) - 6, y1: Y(sc[1]) - 6, x2: X(sc[0]) + 6, y2: Y(sc[1]) + 6, stroke: INK, "stroke-width": 0.8 }, null));
    add(el("line", { x1: X(sc[0]) - 6, y1: Y(sc[1]) + 6, x2: X(sc[0]) + 6, y2: Y(sc[1]) - 6, stroke: INK, "stroke-width": 0.8 }, null));
    add(el("circle", { cx: X(sc[0]), cy: Y(sc[1]), r: 4, fill: "none", stroke: INK, "stroke-width": 0.9 }, null));
  }

  // the sump, the ejector pit, the unlabelled corner box, the sub panel
  for (const pit of [SUMP, EJECTOR]) {
    add(el("circle", { cx: X(pit.x), cy: Y(pit.y), r: pit.r * S, fill: "#fff", stroke: INK, "stroke-width": 1.2 }, null));
    add(el("circle", { cx: X(pit.x), cy: Y(pit.y), r: pit.r * S * 0.55, fill: "none", stroke: INK, "stroke-width": 0.8 }, null));
  }
  add(el("rect", { x: X(CORNER_BOX.x) - (CORNER_BOX.s * S) / 2, y: Y(CORNER_BOX.y) - (CORNER_BOX.s * S) / 2, width: CORNER_BOX.s * S, height: CORNER_BOX.s * S,
    fill: "#fff", stroke: INK, "stroke-width": 1, transform: `rotate(45 ${f(X(CORNER_BOX.x))} ${f(Y(CORNER_BOX.y))})` }, null));
  add(el("rect", { x: X(PANEL.x0), y: Y(IN), width: (PANEL.x1 - PANEL.x0) * S, height: 0.3 * S, fill: INK }, null));

  // the mechanical closet's equipment, as circles with short tags keyed at the right
  for (const g of MECH_GEAR) {
    add(el("circle", { cx: X(g.x), cy: Y(g.y), r: g.r * S, fill: "#fff", stroke: INK, "stroke-width": 1 }, null));
    add(el("text", { x: X(g.x), y: Y(g.y) + 3.5, "text-anchor": "middle", "font-size": 9.5, "font-weight": "bold", fill: INK }, g.tag));
  }
  add(el("rect", { x: X(UV.x0), y: Y(UV.y0), width: (IE - UV.x0) * S, height: (UV.y1 - UV.y0) * S, fill: "#fff", stroke: INK, "stroke-width": 1 }, null));
  add(el("text", { x: X(IE) - 1, y: Y(UV.y0 - 0.14), "text-anchor": "end", "font-size": 8.5, "font-weight": "bold", fill: INK }, "UV"));

  // the fireplace: its chase against the east wall, the firebox, and a hearth
  add(el("rect", { x: X(FIRE.x0), y: Y(FIRE.y0), width: (FIRE.x1 - FIRE.x0) * S, height: (FIRE.y1 - FIRE.y0) * S, fill: "#fff", stroke: INK, "stroke-width": 1.4 }, null));
  add(el("rect", { x: X(FIREBOX.x0), y: Y(FIREBOX.y0), width: (FIREBOX.x1 - FIREBOX.x0) * S, height: (FIREBOX.y1 - FIREBOX.y0) * S, fill: "#d9d9d9", stroke: INK, "stroke-width": 0.9 }, null));
  add(el("rect", { x: X(HEARTH.x0), y: Y(HEARTH.y0), width: (HEARTH.x1 - HEARTH.x0) * S, height: (HEARTH.y1 - HEARTH.y0) * S, fill: "none", stroke: INK, "stroke-width": 0.8, "stroke-dasharray": "3 2" }, null));

  // room labels, with a white halo so they stay legible over lines
  const halo = { stroke: "#ffffff", "stroke-width": 5, "paint-order": "stroke", "stroke-linejoin": "round" };
  const label = (x, y, name, dims, sqft, rotate) => {
    const t = rotate ? `rotate(-90 ${f(X(x))} ${f(Y(y))})` : undefined;
    add(el("text", { x: X(x), y: Y(y), "text-anchor": "middle", "font-size": 19, "font-weight": "bold", fill: INK, "letter-spacing": 1.5, transform: t, ...halo }, esc(name)));
    if (dims) add(el("text", { x: X(x), y: Y(y) + 22, "text-anchor": "middle", "font-size": 15, fill: INK, transform: t, ...halo }, esc(dims)));
    if (sqft) add(el("text", { x: X(x), y: Y(y) + (dims ? 42 : 22), "text-anchor": "middle", "font-size": 13, fill: MID, transform: t, ...halo }, esc(sqft)));
  };
  const sq = (name) => `≈ ${Math.round(area(rooms[name]))} sq ft clear`;
  label(7.0, 5.6, "OFFICE", "12′ × 13′-6″ as written", sq("office"));
  label(19.6, 2.4, "STORAGE", "sub panel on the wall", sq("storage"));
  label(16.9, 9.3, "BATH", undefined, `≈ ${Math.round(area(rooms.bath) + area(rooms.shower))} sq ft clear`);
  label(15.45, 15.0, "HVAC", undefined, sq("hvac"));
  label(20.55, 15.2, "MECHANICAL", "well tank, water heater, treatment", undefined, true);
  label(8.6, 24.6, "OPEN SPACE", "18′-4″ × 26′ as written", `≈ ${Math.round(area(rooms.open) - (FIRE.x1 - FIRE.x0) * (FIRE.y1 - FIRE.y0))} sq ft clear`);
  label(8.95, 13.55, "STAIR", undefined, undefined);
  add(el("text", { x: X(2.55), y: Y(14.1), "text-anchor": "middle", "font-size": 12, fill: MID, ...halo }, "LANDING"));
  add(el("text", { x: X(SUMP.x), y: Y(SUMP.y - 1.0), "text-anchor": "middle", "font-size": 11.5, fill: MID, ...halo }, "SUMP"));
  add(el("text", { x: X(EJECTOR.x), y: Y(5.95), "text-anchor": "middle", "font-size": 11, "font-weight": "bold", "letter-spacing": 0.5, fill: INK, ...halo }, "EJECTOR"));
  add(el("text", { x: X(EJECTOR.x), y: Y(6.4), "text-anchor": "middle", "font-size": 11, "font-weight": "bold", "letter-spacing": 0.5, fill: INK, ...halo }, "PIT"));
  add(el("text", { x: X((HEARTH.x0 + HEARTH.x1) / 2), y: Y((FIRE.y0 + FIRE.y1) / 2), "text-anchor": "middle", "font-size": 12, fill: MID, ...halo,
    transform: `rotate(-90 ${f(X((HEARTH.x0 + HEARTH.x1) / 2))} ${f(Y((FIRE.y0 + FIRE.y1) / 2))})` }, "FIREPLACE"));
  add(el("text", { x: X(PANEL.x1 + 0.25), y: Y(IN + 0.42), "font-size": 11.5, fill: MID, ...halo }, "SUB PANEL"));
  add(el("text", { x: X(BEAM) + 8, y: Y(29.3), "font-size": 11.5, fill: MID, transform: `rotate(-90 ${f(X(BEAM) + 8)} ${f(Y(29.3))})`, "text-anchor": "middle", ...halo }, "BEAM ABOVE"));

  // dimensions: the ones written on the sketch, plus a few derived ones (marked)
  const tick = (x, y, vertical) => el("line", vertical
    ? { x1: x - 5, y1: y + 5, x2: x + 5, y2: y - 5, stroke: INK, "stroke-width": 1.4 }
    : { x1: x - 5, y1: y + 5, x2: x + 5, y2: y - 5, stroke: INK, "stroke-width": 1.4 }, null);
  const dimH = (x0, x1, y, text, derived) => {
    add(el("line", { x1: X(x0), y1: y, x2: X(x1), y2: y, stroke: INK, "stroke-width": 0.9 }, null));
    add(tick(X(x0), y)); add(tick(X(x1), y));
    add(el("text", { x: (X(x0) + X(x1)) / 2, y: y - 6, "text-anchor": "middle", "font-size": 15, fill: derived ? MID : INK, "font-style": derived ? "italic" : undefined }, esc(text)));
  };
  const dimV = (y0, y1, x, text, derived) => {
    add(el("line", { x1: x, y1: Y(y0), x2: x, y2: Y(y1), stroke: INK, "stroke-width": 0.9 }, null));
    add(tick(x, Y(y0), true)); add(tick(x, Y(y1), true));
    const cy = (Y(y0) + Y(y1)) / 2;
    add(el("text", { x: x - 6, y: cy, "text-anchor": "middle", "font-size": 15, fill: derived ? MID : INK, "font-style": derived ? "italic" : undefined, transform: `rotate(-90 ${f(x - 6)} ${f(cy)})` }, esc(text)));
  };
  const ext = (x1, y1, x2, y2) => add(el("line", { x1, y1, x2, y2, stroke: LIGHT, "stroke-width": 0.7 }, null));

  // across the top
  ext(X(0), Y(0) - 6, X(0), OY - 100); ext(X(BEAM), Y(0) - 6, X(BEAM), OY - 60); ext(X(W), Y(0) - 6, X(W), OY - 100);
  dimH(0, BEAM, OY - 50, "13′-6″"); dimH(BEAM, W, OY - 50, "13′-0″ (derived)", true);
  dimH(0, W, OY - 90, "26′-6″");
  // down the right
  const RX = X(W) + 50;
  ext(X(W) + 6, Y(0), RX + 40, Y(0)); ext(X(W) + 6, Y(MECH_N), RX + 8, Y(MECH_N)); ext(X(W) + 6, Y(MECH_S), RX + 8, Y(MECH_S)); ext(X(W) + 6, Y(H), RX + 40, Y(H));
  dimV(0, MECH_N, RX, "9′-4″"); dimV(MECH_N, MECH_S, RX, "9′-11″ (derived)", true); dimV(MECH_S, H, RX, "14′-9″");
  dimV(0, H, RX + 40, "34′-0″");
  // down the left
  const LX = X(0) - 50;
  ext(X(0) - 6, Y(0), LX - 8, Y(0)); ext(X(0) - 6, Y(OFFICE_S), LX - 8, Y(OFFICE_S)); ext(X(0) - 6, Y(STAIR_S), LX - 8, Y(STAIR_S)); ext(X(0) - 6, Y(H), LX - 8, Y(H));
  dimV(0, OFFICE_S, LX, "12′-0″"); dimV(OFFICE_S, STAIR_S, LX, ftin(STAIR_S - OFFICE_S), true); dimV(STAIR_S, H, LX, "18′-4″");
  // inside
  const small = (x, y, text, derived, rotate) => add(el("text", { x: X(x), y: Y(y), "text-anchor": "middle", "font-size": 12.5, fill: derived ? MID : INK, "font-style": derived ? "italic" : undefined,
    transform: rotate ? `rotate(-90 ${f(X(x))} ${f(Y(y))})` : undefined, ...halo }, esc(text)));
  const arrowH = (x0, x1, y) => {
    add(el("line", { x1: X(x0), y1: Y(y), x2: X(x1), y2: Y(y), stroke: INK, "stroke-width": 0.8 }, null));
    add(el("polygon", { points: `${f(X(x0))},${f(Y(y))} ${f(X(x0) + 7)},${f(Y(y) - 3)} ${f(X(x0) + 7)},${f(Y(y) + 3)}`, fill: INK }, null));
    add(el("polygon", { points: `${f(X(x1))},${f(Y(y))} ${f(X(x1) - 7)},${f(Y(y) - 3)} ${f(X(x1) - 7)},${f(Y(y) + 3)}`, fill: INK }, null));
  };
  const arrowV = (y0, y1, x) => {
    add(el("line", { x1: X(x), y1: Y(y0), x2: X(x), y2: Y(y1), stroke: INK, "stroke-width": 0.8 }, null));
    add(el("polygon", { points: `${f(X(x))},${f(Y(y0))} ${f(X(x) - 3)},${f(Y(y0) + 7)} ${f(X(x) + 3)},${f(Y(y0) + 7)}`, fill: INK }, null));
    add(el("polygon", { points: `${f(X(x))},${f(Y(y1))} ${f(X(x) - 3)},${f(Y(y1) - 7)} ${f(X(x) + 3)},${f(Y(y1) - 7)}`, fill: INK }, null));
  };
  arrowH(IN, STAIR_W, 15.1); small(2.55, 14.85, "45″");
  arrowH(STAIR_W - STUB, STAIR_W, 11.55); small(STAIR_W - STUB / 2, 11.3, "12″");
  arrowH(16.1, 19.1, 7.2); small(17.6, 7.65, "36″");
  small((SHOWER_W + SHOWER_E - h) / 2, MECH_N - 0.55, "3′ × 4′");
  arrowH(MECH_DOORS + h, IE, 10.12); small(24.55, 10.02, ftin(IE - MECH_DOORS - h), true);
  arrowH(SHOWER_E, W, 5.2); small(25.1, 5.0, "3′");
  arrowH(FIRE.x0, FIRE.x1, FIRE.y0 - 0.45); small(25.0, FIRE.y0 - 0.7, ftin(FIRE.x1 - FIRE.x0), true);
  arrowV(FIRE.y0, FIRE.y1, HEARTH.x0 - 0.22); small(HEARTH.x0 - 0.45, FIRE_C, ftin(FIRE.y1 - FIRE.y0), true, true);
  for (const w of windows) { arrowH(w.a, w.b, H + 0.32); small(w.c, H + 0.8, ftin(WIN_W), true); }   // outside the wall, clear of the sump

  // numbered callouts, keyed at the right
  const callouts = [
    [1, 10.6, 12.9], [2, 1.5, 12.7], [3, 3.0, 2.4], [4, 15.3, 2.6], [5, 22.3, 1.9], [6, 24.0, 4.15],
    [7, 14.6, 7.9], [8, 19.4, 11.3], [9, 14.0, 16.5], [10, 21.85, 10.3], [11, 7.0, 21.0], [12, 5.0, 32.6],
    [13, 18.7, 32.5], [14, 22.6, 32.55], [15, 12.6, 31.6], [16, 12.55, 8.75], [17, 21.4, FIRE_C],
  ];
  for (const [n, x, y] of callouts) {
    add(el("circle", { cx: X(x), cy: Y(y), r: 11, fill: "#ffffff", stroke: INK, "stroke-width": 1.4 }, null));
    add(el("text", { x: X(x), y: Y(y) + 4.5, "text-anchor": "middle", "font-size": 12.5, "font-weight": "bold", fill: INK }, String(n)));
  }

  // the key
  const KX = 1085, KY = 70;
  add(el("text", { x: KX, y: KY, "font-size": 15, "font-weight": "bold", "letter-spacing": 3, fill: INK }, "KEY"));
  const key = [
    [1, "Stair, about 3′-6″ wide. The arrow is copied from", "the sketch, which does not label it."],
    [2, "Landing, 45″ clear, with a glass door into the office", "and a 12″ wall stub beside the stair."],
    [3, "Office, 12′ × 13′-6″ as written."],
    [4, "Door from the office into the storage."],
    [5, "Storage, with the electrical sub panel on the outside wall."],
    [6, "Ejector pit for the bathroom’s sewage pump, in a 3′ bay", "off the storage (“eject. crock” on the sketch)."],
    [7, "Bathroom: toilet, 36″ vanity, 3′ × 4′ shower. The", "shower’s single line is read as glass."],
    [8, "Bathroom door from the open space, set across the", "corner, as drawn."],
    [9, "HVAC closet with a pair of bi-fold doors."],
    [10, "Mechanical closet (“water” on the sketch), about 10′ long,", "two pairs of bi-fold doors. From the south end: WT the well’s",
      "pressure tank, WH water heater, IF iron filter, B brine tank,", "S softener. UV light on the wall behind the last three."],
    [11, "Open space, 18′-4″ × 26′ as written."],
    [12, "Double door in the outside wall, 6′ as drawn."],
    [13, "Windows in the south wall, drawn full size (3′ × 4′; the sketch", "gives no sizes): one as sketched, one added, position assumed.",
      "The two the sketch has in the east wall are removed."],
    [14, "Sump pit on the perimeter drain, and a small unlabelled", "box drawn in the corner."],
    [15, "Line of the beam above, dashed, with three posts drawn", "as circles."],
    [16, "Pocket door between the office and the bathroom, drawn", "on the sketch as a thinner length of wall."],
    [17, "Fireplace, not on the sketch, centred on the open space’s east", "wall where its windows were: a 5′ chase and hearth, size assumed."],
  ];
  let ky = KY + 30;
  for (const [n, ...lines] of key) {
    add(el("circle", { cx: KX + 10, cy: ky - 5, r: 10, fill: "#fff", stroke: INK, "stroke-width": 1.2 }, null));
    add(el("text", { x: KX + 10, y: ky - 1, "text-anchor": "middle", "font-size": 11.5, "font-weight": "bold", fill: INK }, String(n)));
    lines.forEach((line, i) => add(el("text", { x: KX + 30, y: ky + i * 17, "font-size": 13.5, fill: INK }, esc(line))));
    ky += 17 * lines.length + 11;
  }
  ky += 8;
  add(el("line", { x1: KX, y1: ky, x2: KX + 480, y2: ky, stroke: RULE, "stroke-width": 1 }, null));
  ky += 26;
  add(el("text", { x: KX, y: ky, "font-size": 15, "font-weight": "bold", "letter-spacing": 3, fill: INK }, "NOTES"));
  const notes = [
    "Redrawn from a photograph of a hand sketch, then revised with the",
    "owner’s corrections; items 13, 16 and 17 say what differs from it.",
    "Dimensions in upright type are the sketch’s own; italic ones are",
    "derived from them or scaled from the photo. Exterior walls are drawn",
    "8″ thick and partitions 4½″; the sketch gives no thicknesses. Its",
    "dimensions run to the outside of the foundation. Not field-verified.",
    "Not for construction.",
  ];
  notes.forEach((line, i) => add(el("text", { x: KX, y: ky + 22 + i * 18, "font-size": 13, fill: INK }, esc(line))));

  // scale bar, under the notes
  {
    const sx = KX, sy = ky + 22 + notes.length * 18 + 18;
    for (let i = 0; i < 10; i++) add(el("rect", { x: sx + i * S, y: sy, width: S, height: 7, fill: i % 2 ? "#fff" : INK, stroke: INK, "stroke-width": 0.8 }, null));
    for (const ft of [0, 5, 10]) add(el("text", { x: sx + ft * S, y: sy + 22, "text-anchor": "middle", "font-size": 12, fill: INK }, ft === 10 ? "10 ft" : String(ft)));
  }

  // title block
  const TB = SHEET_H - 95;
  add(el("line", { x1: 20, y1: TB, x2: SHEET_W - 20, y2: TB, stroke: INK, "stroke-width": 1.5 }, null));
  add(el("text", { x: 40, y: TB + 36, "font-size": 24, "font-weight": "bold", "letter-spacing": 4, fill: INK }, "BASEMENT · FINISH PLAN"));
  add(el("text", { x: 40, y: TB + 60, "font-size": 13, fill: MID }, "Drawing 2 of 3 · redrawn from the sketch in drawing 1, revised after the owner’s review · October 2026"));
  add(el("text", { x: SHEET_W - 40, y: TB + 36, "text-anchor": "end", "font-size": 13, fill: MID }, "drawn by Claude, from a sketch supplied by Bowie Smith"));
  add(el("text", { x: SHEET_W - 40, y: TB + 60, "text-anchor": "end", "font-size": 13, fill: MID }, "scale: see bar · sheet directions only, no north arrow on the sketch"));

  return svg(SHEET_W, SHEET_H, out.join("\n"), FONT, "Basement finish plan, redrawn from a hand sketch");
}

function svg(w, hgt, inner, font, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" ${font} role="img" aria-label="${esc(title)}">\n<title>${esc(title)}</title>\n${inner}\n</svg>\n`;
}

// ---- drawing 2: the isometric view -----------------------------------------
//
// An axonometric view from the plan's bottom-right corner, tilted steeply so
// that walls hide less of what is behind them. The two far walls stand full
// height, the partitions are cut at CUT, and the two near walls are shown as
// low stubs with their full outline ghosted in, so the windows and the double
// door can be seen.

function drawIso() {
  const S = 25;                     // pixels per foot
  const ALPHA = rad(52);            // elevation of the view
  const KX = S / Math.SQRT2, KY = (S * Math.sin(ALPHA)) / Math.SQRT2, KZ = S * Math.cos(ALPHA);
  const SHEET_W = 1600, SHEET_H = 1160;
  const X0 = 860, Y0 = 200;
  const P = (x, y, z = 0) => [X0 + (x - y) * KX, Y0 + (x + y) * KY - z * KZ];
  const pts = (list) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
  const CUT = 3.5, FAR = 8.0, NEAR = 1.0, DOOR_H = 6 + 8 / 12;
  const L = [0.345, 0.57, 0.746];   // the light; tops come out 1.05, faces toward +y 0.95, toward +x 0.82
  const out = [];
  const add = (s) => out.push(s);

  function norm(v) { const n = Math.hypot(...v); return v.map((c) => c / n); }
  const rgb = ([r, g, b]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  const scale = ([r, g, b], k) => [Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k)];
  // Lambert-ish: tops 1.08, faces toward +y 0.95, faces toward +x 0.75
  const shade = (color, n) => scale(color, 0.62 + 0.58 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]));

  // colours
  const C = {
    concrete: [201, 197, 189], drywall: [240, 238, 233], cut: [172, 168, 160], slab: [186, 183, 178],
    wood: [214, 184, 142], carpet: [205, 198, 186], tile: [226, 228, 225], showerTile: [212, 218, 216], floorConc: [202, 200, 196],
    chair: [74, 74, 74], steel: [141, 147, 155], white: [242, 242, 240], cabinet: [111, 127, 138],
    counter: [236, 233, 226], furnace: [183, 188, 194], heater: [216, 216, 212], tank: [143, 160, 173],
    door: [236, 232, 224], glass: [188, 211, 224], lid: [154, 152, 147], panel: [164, 167, 171], hearth: [196, 190, 180],
  };

  // ---- primitives: prisms with a convex base, sorted back to front -------------
  const prisms = [];
  // A prism: base polygon (x,y), from z0 to z1, side colour, optional top colour.
  function prism(base, z0, z1, color, opts = {}) {
    const xs = base.map((p) => p[0]), ys = base.map((p) => p[1]);
    prisms.push({ base, z0, z1, color, top: opts.top || color, opacity: opts.opacity, noShadow: opts.noShadow,
      min: [Math.min(...xs), Math.min(...ys), z0], max: [Math.max(...xs), Math.max(...ys), z1] });
  }
  const box = (x0, y0, x1, y1, z0, z1, color, opts) => prism([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, color, opts);
  function cylinder(cx, cy, r, z0, z1, color, opts) {
    const n = 20, base = [];
    for (let i = 0; i < n; i++) base.push([cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
    prism(base, z0, z1, color, opts);
  }
  // A thin slab standing on the floor from (x0,y0) to (x1,y1): a door leaf or a panel.
  function slab(x0, y0, x1, y1, t, z0, z1, color, opts) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const nx = (-dy / len) * (t / 2), ny = (dx / len) * (t / 2);
    prism([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], z0, z1, color, opts);
  }

  function renderPrism(p) {
    const parts = [];
    const n = p.base.length;
    // outward normal of each side, via the centroid
    const cx = p.base.reduce((s, q) => s + q[0], 0) / n, cy = p.base.reduce((s, q) => s + q[1], 0) / n;
    const op = p.opacity !== undefined ? { "fill-opacity": p.opacity } : {};
    const edge = p.opacity !== undefined ? "rgba(40,40,40,0.35)" : "rgba(40,40,40,0.45)";
    for (let i = 0; i < n; i++) {
      const a = p.base[i], b = p.base[(i + 1) % n];
      let nx = b[1] - a[1], ny = -(b[0] - a[0]);
      const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
      if (nx + ny <= 1e-9) continue;                     // faces away from the viewer
      const quad = [P(a[0], a[1], p.z0), P(b[0], b[1], p.z0), P(b[0], b[1], p.z1), P(a[0], a[1], p.z1)];
      parts.push(el("polygon", { points: pts(quad), fill: rgb(shade(p.color, [nx, ny, 0])), stroke: edge, "stroke-width": 0.5, "stroke-linejoin": "round", ...op }, null));
    }
    parts.push(el("polygon", { points: pts(p.base.map(([x, y]) => P(x, y, p.z1))), fill: rgb(shade(p.top, [0, 0, 1])), stroke: edge, "stroke-width": 0.5, "stroke-linejoin": "round", ...op }, null));
    return parts.join("");
  }

  // Painter's order. a can be drawn before b whenever a lies entirely on the
  // far side of b along some axis; the viewer is toward +x, +y, +z.
  function behind(a, b) {
    const E = 1e-6;
    if (a.max[0] <= b.min[0] + E || a.max[1] <= b.min[1] + E || a.max[2] <= b.min[2] + E) return true;
    return false;
  }
  function sorted(list) {
    const n = list.length, after = Array.from({ length: n }, () => []), indeg = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (behind(list[i], list[j]) && !behind(list[j], list[i])) { after[i].push(j); indeg[j]++; }
    }
    // Kahn's algorithm; ties broken by distance, so cycles (rare) degrade gracefully
    const key = (i) => list[i].min[0] + list[i].min[1] + list[i].min[2];
    const ready = [...Array(n).keys()].filter((i) => indeg[i] === 0).sort((p, q) => key(p) - key(q));
    const order = [], done = new Array(n).fill(false);
    while (order.length < n) {
      if (!ready.length) {           // a cycle: release the farthest remaining item
        const rest = [...Array(n).keys()].filter((i) => !done[i]).sort((p, q) => key(p) - key(q));
        ready.push(rest[0]);
      }
      const i = ready.shift();
      if (done[i]) continue;
      done[i] = true; order.push(i);
      for (const j of after[i]) if (--indeg[j] === 0 && !done[j]) { ready.push(j); ready.sort((p, q) => key(p) - key(q)); }
    }
    return order.map((i) => list[i]);
  }

  // ---- the scene --------------------------------------------------------------

  // walls
  for (const w of walls) {
    const far = w.kind === "ext-n" || w.kind === "ext-w";
    const near = w.kind === "ext-s" || w.kind === "ext-e";
    const z1 = far ? FAR : near ? NEAR : CUT;
    const color = near ? C.concrete : C.drywall;
    box(w.x0, w.y0, w.x1, w.y1, 0, z1, color, { top: far ? C.drywall : C.cut });
  }

  // doors: leaves standing open; the double door at full height
  for (const d of doors) {
    const tx = d.hx + d.len * Math.cos(rad(d.open)), ty = d.hy + d.len * Math.sin(rad(d.open));
    if (d.glass) slab(d.hx, d.hy, tx, ty, 0.04, 0, CUT, C.glass, { opacity: 0.45, noShadow: true });
    else slab(d.hx, d.hy, tx, ty, 0.12, 0, d.full ? DOOR_H : CUT, C.door);
  }
  slab(GLASS.x, GLASS.y0, GLASS.x, GLASS.y1, 0.04, 0, CUT, C.glass, { opacity: 0.45, noShadow: true });
  for (const b of bifolds) {
    const Lb = Math.hypot(b.x1 - b.x0, b.y1 - b.y0), ux = (b.x1 - b.x0) / Lb, uy = (b.y1 - b.y0) / Lb;
    const nx = Math.cos(rad(b.out)), ny = Math.sin(rad(b.out));
    const p = Lb / 4, a = 0.6 * p, o = 0.8 * p;
    const at = (along, outward) => [b.x0 + ux * along + nx * outward, b.y0 + uy * along + ny * outward];
    for (const [s0, s1, s2] of [[0, a, 2 * a], [Lb, Lb - a, Lb - 2 * a]]) {
      const q0 = at(s0, 0), q1 = at(s1, o), q2 = at(s2, 0);
      slab(q0[0], q0[1], q1[0], q1[1], 0.1, 0, CUT, C.door);
      slab(q1[0], q1[1], q2[0], q2[1], 0.1, 0, CUT, C.door);
    }
  }

  // the stair: treads rising to the right, cut with the walls; posts and a rail
  for (let i = 0; i < TREADS; i++) {
    const x0 = STAIR_W + i * TREAD, top = Math.min(CUT, (i + 1) * (7.5 / 12));
    box(x0, STAIR_N, x0 + TREAD, STAIR_S - 0.1, 0, top, C.white, { top: C.wood });
  }
  const railPosts = [STAIR_W + 0.1, STAIR_W + 3.0, STAIR_W + 6.0, BEAM - h - 0.1];
  const railAt = (x) => Math.min(CUT, Math.ceil((x - STAIR_W) / TREAD) * (7.5 / 12));
  for (const x of railPosts) box(x - 0.06, STAIR_S - 0.16, x + 0.06, STAIR_S - 0.04, railAt(x), Math.min(CUT, railAt(x) + 2.9), C.chair, { noShadow: true });

  // the pocket door's panel, half open in its opening
  slab(BEAM, POCKET[0], BEAM, POCKET[0] + 1.25, 0.12, 0, CUT, C.door);

  // what the plan calls for, and nothing else: no furniture
  // the sub panel in the storage
  box(PANEL.x0, IN, PANEL.x1, IN + 0.22, 2.0, 3.4, C.panel, { noShadow: true });

  // bathroom fixtures, and the ejector pit's lid in its bay
  box(14.75 - 0.8, BATH_N + h, 14.75 + 0.8, BATH_N + h + 0.6, 0, 2.4, C.white);
  cylinder(14.75, BATH_N + h + 1.4, 0.62, 0, 1.35, C.white);
  box(16.1, BATH_N + h, 19.1, BATH_N + h + 1.75, 0, 2.85, C.cabinet);
  box(16.0, BATH_N + h, 19.2, BATH_N + h + 1.85, 2.85, 3.0, C.counter, { noShadow: true });
  cylinder(EJECTOR.x, EJECTOR.y, EJECTOR.r, 0, 0.06, C.lid, { noShadow: true });

  // the furnace; the well tank, water heater and treatment in the mechanical closet
  box(14.1, OFFICE_S + h + 0.3, 16.3, OFFICE_S + h + 2.5, 0, CUT, C.furnace);
  for (const g of MECH_GEAR) cylinder(g.x, g.y, g.r, 0, Math.min(CUT, g.z), g.tag === "WH" ? C.heater : g.tag === "B" ? C.white : C.tank);
  box(UV.x0, UV.y0, IE, UV.y1, UV.z0, UV.z1, C.steel, { noShadow: true });

  // the fireplace chase against the east wall, with its hearth; the sump's lid
  box(FIRE.x0, FIRE.y0, FIRE.x1, FIRE.y1, 0, CUT, C.drywall, { top: C.cut });
  box(HEARTH.x0, HEARTH.y0, HEARTH.x1, HEARTH.y1, 0, 0.1, C.hearth, { noShadow: true });
  cylinder(SUMP.x, SUMP.y, SUMP.r, 0, 0.06, C.lid, { noShadow: true });

  // ---- render -----------------------------------------------------------------

  add(el("rect", { x: 0, y: 0, width: SHEET_W, height: SHEET_H, fill: "#ffffff" }, null));
  add(el("rect", { x: 20, y: 20, width: SHEET_W - 40, height: SHEET_H - 40, fill: "none", stroke: "#1f1f1f", "stroke-width": 1.5 }, null));

  // the slab, then the floors
  add(renderPrism({ base: [[0, 0], [W, 0], [W, H], [0, H]], z0: -0.5, z1: 0, color: C.slab, top: C.slab, min: [0, 0, -0.5], max: [W, H, 0] }));
  const floorColor = { office: C.carpet, storage: C.floorConc, elect: C.floorConc, bath: C.tile, shower: C.showerTile, hvac: C.floorConc,
    mech: C.floorConc, stair: C.wood, landing: C.wood, open: C.wood };
  let clipId = 0;
  for (const [name, poly] of Object.entries(rooms)) {
    const id = `floor${clipId++}`;
    const points = pts(poly.map(([x, y]) => P(x, y, 0)));
    add(el("clipPath", { id }, el("polygon", { points }, null)));
    add(el("polygon", { points, fill: rgb(shade(floorColor[name], [0, 0, 1])) }, null));
    // patterns: planks on the wood, a grid on the tile
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const [mx0, mx1, my0, my1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const lines = [];
    if (floorColor[name] === C.wood) {
      for (let y = Math.ceil(my0 * 2) / 2; y < my1; y += 0.5) lines.push([P(mx0, y), P(mx1, y)]);
    } else if (name === "bath" || name === "shower") {
      const step = name === "shower" ? 0.5 : 1.0;
      for (let y = Math.ceil(my0 / step) * step; y < my1; y += step) lines.push([P(mx0, y), P(mx1, y)]);
      for (let x = Math.ceil(mx0 / step) * step; x < mx1; x += step) lines.push([P(x, my0), P(x, my1)]);
    }
    if (lines.length) add(el("g", { "clip-path": `url(#${id})`, stroke: "rgba(60,40,20,0.10)", "stroke-width": 0.8 },
      lines.map(([a, b]) => el("line", { x1: f(a[0]), y1: f(a[1]), x2: f(b[0]), y2: f(b[1]) }, null)).join("")));
  }

  // labels lying on the floors
  const floorText = (x, y, text, size = 15) => {
    const [px, py] = P(x, y, 0.01);
    add(el("text", { "font-size": size, "font-weight": "bold", "letter-spacing": 2, fill: "rgba(40,30,20,0.38)", "text-anchor": "middle",
      transform: `matrix(${f(KX / S)} ${f(KY / S)} ${f(-KX / S)} ${f(KY / S)} ${f(px)} ${f(py)})` }, esc(text)));
  };
  floorText(7.6, 7.4, "OFFICE");
  floorText(13.2, 29.6, "OPEN SPACE", 17);
  floorText(8.5, 13.9, "STAIR", 11);

  // shadows, on the floor, away from the light
  for (const p of prisms) {
    if (p.noShadow || p.z0 > 0.5) continue;
    const hgt = p.z1 - p.z0, ox = 0.11 * hgt, oy = -0.065 * hgt;
    add(el("polygon", { points: pts(p.base.map(([x, y]) => P(x + ox, y + oy, 0))), fill: "rgba(20,15,10,0.10)" }, null));
  }

  // everything that stands, back to front
  for (const p of sorted(prisms)) add(renderPrism(p));

  // the near walls, ghosted to full height, with their windows and the double door
  const ghost = { fill: "rgba(225,223,217,0.22)", stroke: "rgba(50,50,50,0.4)", "stroke-width": 0.9 };
  add(el("polygon", { points: pts([P(W, 0, NEAR), P(W, H, NEAR), P(W, H, FAR), P(W, 0, FAR)]), ...ghost }, null));
  add(el("polygon", { points: pts([P(0, H, NEAR), P(W, H, NEAR), P(W, H, FAR), P(0, H, FAR)]), ...ghost }, null));
  const pane = { fill: "rgba(150,190,220,0.45)", stroke: "rgba(50,70,90,0.6)", "stroke-width": 0.9 };
  for (const w of windows) {
    const at = (along, z) => (w.wall === "e" ? P(W, along, z) : P(along, H, z));
    add(el("polygon", { points: pts([at(w.a, WIN_SILL), at(w.b, WIN_SILL), at(w.b, WIN_HEAD), at(w.a, WIN_HEAD)]), ...pane }, null));
    const [m0, m1] = [at(w.c, WIN_SILL), at(w.c, WIN_HEAD)];     // a mullion down the middle
    add(el("line", { x1: f(m0[0]), y1: f(m0[1]), x2: f(m1[0]), y2: f(m1[1]), stroke: "rgba(50,70,90,0.6)", "stroke-width": 0.9 }, null));
  }
  add(el("polygon", { points: pts([P(DBL_DOOR[0], H, 0), P(DBL_DOOR[1], H, 0), P(DBL_DOOR[1], H, DOOR_H), P(DBL_DOOR[0], H, DOOR_H)]),
    fill: "rgba(255,255,255,0.35)", stroke: "rgba(50,50,50,0.5)", "stroke-width": 0.9 }, null));

  // the handrail, following the stair
  add(el("polyline", { points: pts(railPosts.map((x) => P(x, STAIR_S - 0.1, Math.min(CUT, railAt(x) + 2.9)))), fill: "none", stroke: "#3a3a3a", "stroke-width": 2, "stroke-linejoin": "round" }, null));

  // tags for the small rooms, whose floors the cut walls mostly hide
  const tag = (x, y, text) => {
    const [ax, ay] = P(x, y, CUT + 0.3), [bx, by] = P(x, y, CUT + 2.6);
    add(el("line", { x1: f(ax), y1: f(ay), x2: f(bx), y2: f(by), stroke: "#3a3a3a", "stroke-width": 1 }, null));
    add(el("circle", { cx: f(ax), cy: f(ay), r: 2.2, fill: "#3a3a3a" }, null));
    add(el("text", { x: f(bx), y: f(by - 6), "text-anchor": "middle", "font-size": 12.5, "font-weight": "bold", "letter-spacing": 2, fill: "#1f1f1f",
      stroke: "#ffffff", "stroke-width": 4, "paint-order": "stroke", "stroke-linejoin": "round" }, esc(text)));
  };
  tag(19.0, 2.6, "STORAGE");
  tag(EJECTOR.x, EJECTOR.y - 0.2, "EJECTOR PIT");
  tag(16.9, 8.6, "BATH");
  tag(15.2, 15.9, "HVAC");
  tag(24.5, 18.4, "MECHANICAL");
  tag(2.5, 14.0, "LANDING");
  tag((FIRE.x0 + FIRE.x1) / 2, (FIRE.y0 + FIRE.y1) / 2, "FIREPLACE");

  // caption and title block
  const TB = SHEET_H - 95;
  add(el("line", { x1: 20, y1: TB, x2: SHEET_W - 20, y2: TB, stroke: "#1f1f1f", "stroke-width": 1.5 }, null));
  add(el("text", { x: 40, y: TB + 36, "font-size": 24, "font-weight": "bold", "letter-spacing": 4, fill: "#1f1f1f" }, "BASEMENT · THE FINISHED ROOMS"));
  add(el("text", { x: 40, y: TB + 60, "font-size": 13, fill: "#6b6b6b" }, "Drawing 3 of 3 · an axonometric view built from drawing 2 · walls cut at 3′-6″, the two near walls shown as outlines"));
  add(el("text", { x: SHEET_W - 40, y: TB + 36, "text-anchor": "end", "font-size": 13, fill: "#6b6b6b" }, "drawn by Claude, from a sketch supplied by Bowie Smith"));
  add(el("text", { x: SHEET_W - 40, y: TB + 60, "text-anchor": "end", "font-size": 13, fill: "#6b6b6b" }, "no furniture; only the floor finishes are imagined: wood, carpet in the office, tile in the bath, concrete in the closets"));

  return svg(SHEET_W, SHEET_H, out.join("\n"), `font-family="Helvetica Neue, Helvetica, Arial, sans-serif"`, "The basement as it might be finished, an axonometric view");
}

// ---- write ------------------------------------------------------------------

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "plan.svg"), drawPlan());
writeFileSync(join(outDir, "isometric.svg"), drawIso());
for (const [name, poly] of Object.entries(rooms)) console.log(`${name.padEnd(8)} ${area(poly).toFixed(1).padStart(6)} sq ft`);
console.log("wrote images/basement/plan.svg and images/basement/isometric.svg");
