// Generates docs/architecture/code-city.svg (and code-city.png with --png).
//
// A "code city" of the repository drawn as an engineering site plan:
// each island is an architectural layer, each building a source module whose
// height is its line count (one floor = 100 lines), tanks are data stores and
// bridges are the interfaces a query crosses. Line counts are read live from
// the source files, so rerunning the script keeps the figure current.
//
//   node docs/architecture/build-code-city.mjs          # SVG only
//   node docs/architecture/build-code-city.mjs --png    # SVG + 3840x2160 PNG (needs Chrome)

import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'node:fs'
import { resolve, dirname, basename, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const lines = (p) => {
  const t = readFileSync(resolve(root, p), 'utf8')
  return t.split('\n').length - (t.endsWith('\n') ? 1 : 0)
}
const count = (dir, re) =>
  readdirSync(resolve(root, dir)).filter((f) => re.test(f)).length
const fmt = (n) => n.toLocaleString('en-US')

// ---------------------------------------------------------------- palette
const NAVY = '#011936'
const SLATE = '#465362'
const MUTED = '#7C8A97'
const RULE = '#C9D2D9'
const WATER = '#DDE9F0'
const WATER_INK = '#86A9BD'
const FONT = "'IBM Plex Sans','Segoe UI',Arial,sans-serif"
const MONO = "'Roboto Mono',Consolas,monospace"

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) =>
  '#' +
  rgb(a)
    .map((v, i) => Math.round(v + (rgb(b)[i] - v) * t))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')

// ---------------------------------------------------------------- geometry
const W = 1920
const H = 1080
const C = Math.cos(Math.PI / 6)
const S = 0.5
const s = 27 // pixels per grid unit
const LINE = 0.005 // height units per line of code: 100 lines = 1 floor = 0.5 units
const DECK = 0.3 // island top
const ISLAND = 7
let ox = 0
let oy = 0
const P = (gx, gy, z = 0) => [ox + (gx - gy) * C * s, oy + (gx + gy) * S * s - z * s]
const pts = (...ps) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
const poly = (fill, stroke, ...ps) =>
  `<polygon points="${pts(...ps)}" fill="${fill}" stroke="${stroke}" stroke-width="0.6" stroke-linejoin="round"/>`
const seg = (a, b, stroke, width = 1, extra = '') =>
  `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"${extra}/>`
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')

function box(x0, y0, x1, y1, z0, z1, f) {
  return [
    poly(f.left, f.stroke, P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)),
    poly(f.right, f.stroke, P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)),
    poly(f.top, f.stroke, P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)),
  ].join('')
}
const shades = (c) => ({
  top: mix(c, '#ffffff', 0.38),
  left: c,
  right: mix(c, '#000000', 0.28),
  stroke: mix(c, '#000000', 0.42),
})

// Text painted flat on the ground plane, reading along +gx (or up along -gy).
const groundText = (gx, gy, z, size, text, fill, weight = 700, along = 'x', spacing = 0.08) => {
  const [X, Y] = P(gx, gy, z)
  const m =
    along === 'x'
      ? [C * s, S * s, -C * s, S * s]
      : [C * s, -S * s, C * s, S * s]
  return `<text transform="matrix(${m.map((v) => v.toFixed(3)).join(' ')} ${X.toFixed(1)} ${Y.toFixed(1)})" font-family="${FONT}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="${fill}">${esc(text)}</text>`
}

// ---------------------------------------------------------------- the city
const be = (f) => `backend/src/${f}.mjs`
const frontend = readdirSync(resolve(root, 'src'))
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => `src/${f}`)
const standards =
  count('public/documents', /\.pdf$/i) + count('backend/references', /\.pdf$/i)
const projectPdfs = count('backend/output/pdf', /\.pdf$/i)
const ifcModels =
  count('backend/output/models', /\.ifc$/i) + count('backend/IFC', /\.ifc$/i)

const districts = [
  {
    name: 'Workspace',
    role: 'Browser: React 19, TypeScript, PDF.js viewer',
    color: '#3B7EA1',
    at: [0, 4.75],
    files: frontend.filter((f) => lines(f) >= 50),
  },
  {
    name: 'Gateway & API',
    short: 'API',
    role: 'Keyless gateway, project API, storage, launcher',
    color: '#1F3A5F',
    at: [11, 0],
    files: [
      'backend/control.mjs',
      be('project-api'),
      be('server'),
      be('project-store'),
      'backend/demo-gateway.mjs',
      be('reference-collections'),
      be('project-imports'),
      be('config'),
      be('project-evidence'),
    ],
  },
  {
    name: 'Answer engine',
    role: 'Cited answers, synthesis, numeric and applicability checks',
    color: '#B08A1E',
    at: [20.5, 0],
    files: [
      be('answer'),
      be('local-synthesis'),
      be('applicability'),
      be('ifc-comparison'),
      be('clarify'),
      be('calculations'),
      be('local-evidence'),
      be('claude'),
      be('model'),
      be('entailment'),
      be('query-suggestions'),
    ],
  },
  {
    name: 'Retrieval',
    role: 'Ranks provisions, table rows and editions',
    color: '#4F7F63',
    at: [30, 0],
    files: [be('lookup'), be('search'), be('catalog'), be('retrieval-plan'), be('source-lookup')],
  },
  {
    name: 'Indexing',
    role: 'PDF text, geometry, tables and OCR to evidence units',
    color: '#9A6145',
    at: [30, 9.5],
    files: [
      be('indexer'),
      be('units'),
      be('evidence-units'),
      'backend/extract.py',
      'backend/native-table-layout.py',
    ],
  },
  {
    name: 'Documents',
    role: 'Reference standards, project packages, IFC models',
    color: '#6A5A8C',
    at: [20.5, 9.5],
    tanks: [
      ['Standards', `${standards} PDFs`],
      ['Project PDFs', `${projectPdfs} PDFs`],
      ['IFC models', `${ifcModels} files`],
    ],
  },
]
// Tour order: Project state comes straight after the API, the island it is bridged to.
districts.splice(2, 0, {
  name: 'Project state',
  role: 'JSON persistence, query history and caches',
  color: '#6E7F8D',
  at: [11, 9.5],
  tanks: [
    ['projects.json', ''],
    ['Query history', ''],
    ['PDF cache', ''],
    ['Imports', ''],
  ],
})
for (const d of districts) {
  d.items = (d.files || []).map((f) => ({
    name: basename(f).replace(/\.(mjs|tsx?|py)$/, ''),
    loc: lines(f),
  }))
  d.items.sort((a, b) => b.loc - a.loc)
  d.total = d.items.reduce((n, i) => n + i.loc, 0)
}

// Bridges: [number, kind, axis, from, to, cross, label]
const bridges = [
  // Bridge n leads into district n (the tour order above), so the numbers follow the tour.
  [1, 'suspension', 'x', 7, 11, 5.9, 'Browser to API', 'HTTPS via Vercel rewrite and tunnel; keyless /local-api gateway adds the device key'],
  [2, 'truss', 'y', 7, 9.5, 17.1, 'API to project state', 'Projects, findings, query history and imports as JSON on disk'],
  [3, 'truss', 'x', 18, 20.5, 3.5, 'API to answer engine', 'Pollable query job over an index scoped to the active project'],
  [4, 'truss', 'x', 27.5, 30, 3.5, 'Answer engine to retrieval', 'Lookup and ranking of provisions, table rows and editions'],
  [5, 'truss', 'y', 7, 9.5, 36.1, 'Retrieval to indexing', 'Evidence units: verbatim rows and sentences with PDF regions'],
  [6, 'truss', 'x', 27.5, 30, 13, 'Indexing to documents', 'PyMuPDF extraction, table recovery, Tesseract OCR, edition catalog'],
]

// ---------------------------------------------------------------- placement
// Centre the site in the drawing area below the title.
{
  const corners = [P(-1, -1), P(38.5, -1), P(38.5, 18), P(-1, 18)]
  const minX = Math.min(...corners.map((p) => p[0]))
  const maxX = Math.max(...corners.map((p) => p[0]))
  const maxY = Math.max(...corners.map((p) => p[1]))
  ox = (W - (maxX - minX)) / 2 - minX + 10
  oy = H - 36 - maxY
}

const ground = []
const scene = [] // { depth, svg }
const labels = []
const badges = []

// Water and river.
ground.push(poly(WATER, 'none', P(-1, -1), P(38.5, -1), P(38.5, 18), P(-1, 18)))
for (let gy = -0.4; gy < 17.6; gy += 0.9)
  ground.push(seg(P(7.6, gy), P(10.4, gy), '#CFDFE8', 0.8))
ground.push(groundText(9.35, 17.2, 0, 0.5, 'PUBLIC INTERNET · HTTPS', WATER_INK, 600, 'y', 0.12))

for (const d of districts) {
  const [x0, y0] = d.at
  const x1 = x0 + ISLAND
  const y1 = y0 + ISLAND
  ground.push(
    box(x0, y0, x1, y1, 0, DECK, {
      top: mix(d.color, '#ffffff', 0.86),
      left: '#C7CFD6',
      right: '#AAB5BE',
      stroke: '#97A3AD',
    }),
  )
  ground.push(groundText(x0 + 0.35, y1 - 0.38, DECK, 0.56, (d.short || d.name).toUpperCase(), mix(d.color, NAVY, 0.25)))

  // Building plots: tallest at the back so nothing hides behind them.
  const n = d.items.length || d.tanks.length
  const g = Math.ceil(Math.sqrt(n))
  const ax0 = x0 + 0.35
  const ay0 = y0 + 0.35
  const cw = (ISLAND - 0.7) / g
  const ch = (ISLAND - 1.55) / g
  const slots = []
  for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) slots.push([i, j])
  slots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]))
  const center = ([i, j]) => [ax0 + cw * (i + 0.5), ay0 + ch * (j + 0.5)]

  if (d.items.length) {
    const fp = Math.min(cw, ch) * 0.62
    const f = shades(d.color)
    const floorInk = mix(d.color, '#ffffff', 0.3)
    d.items.forEach((item, k) => {
      const [cx, cy] = center(slots[k])
      const bx0 = cx - fp / 2
      const by0 = cy - fp / 2
      const bx1 = cx + fp / 2
      const by1 = cy + fp / 2
      const top = DECK + item.loc * LINE
      let svg = box(bx0, by0, bx1, by1, DECK, top, f)
      for (let z = DECK + 0.5; z < top - 0.05; z += 0.5)
        svg +=
          seg(P(bx0, by1, z), P(bx1, by1, z), floorInk, 0.7, ' opacity="0.55"') +
          seg(P(bx1, by0, z), P(bx1, by1, z), floorInk, 0.7, ' opacity="0.55"')
      scene.push({ depth: cx + cy, svg })
      if (k < 4) {
        const [lx, ly] = P(cx, cy, top)
        labels.push(
          `<text x="${lx.toFixed(1)}" y="${(ly - 9).toFixed(1)}" text-anchor="middle" class="bl">${esc(item.name)}</text>`,
        )
      }
    })
  } else {
    const r = Math.min(cw, ch) * 0.36
    const rx = r * s * Math.SQRT2 * C
    const ry = r * s * Math.SQRT2 * S
    const hgt = 1.25
    d.tanks.forEach(([name, sub], k) => {
      const [cx, cy] = center(slots[k])
      const [bx, by] = P(cx, cy, DECK)
      const [, ty] = P(cx, cy, DECK + hgt)
      const id = `t${districts.indexOf(d)}`
      let svg = `<path d="M${bx - rx},${ty} L${bx - rx},${by} A${rx},${ry} 0 0 0 ${bx + rx},${by} L${bx + rx},${ty} Z" fill="url(#${id})" stroke="${mix(d.color, '#000000', 0.42)}" stroke-width="0.6"/>`
      for (const t of [0.33, 0.66]) {
        const yy = by - t * hgt * s
        svg += `<path d="M${bx - rx},${yy} A${rx},${ry} 0 0 0 ${bx + rx},${yy}" fill="none" stroke="${mix(d.color, '#ffffff', 0.35)}" stroke-width="0.7" opacity="0.7"/>`
      }
      svg += `<ellipse cx="${bx}" cy="${ty}" rx="${rx}" ry="${ry}" fill="${mix(d.color, '#ffffff', 0.45)}" stroke="${mix(d.color, '#000000', 0.42)}" stroke-width="0.6"/>`
      scene.push({ depth: cx + cy, svg })
      labels.push(
        `<text x="${bx.toFixed(1)}" y="${(ty - ry - (sub ? 19 : 7)).toFixed(1)}" text-anchor="middle" class="bl">${esc(name)}</text>` +
          (sub
            ? `<text x="${bx.toFixed(1)}" y="${(ty - ry - 6).toFixed(1)}" text-anchor="middle" class="bs">${esc(sub)}</text>`
            : ''),
      )
    })
    d.tankGradient = `<linearGradient id="t${districts.indexOf(d)}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${mix(d.color, '#ffffff', 0.15)}"/><stop offset="0.55" stop-color="${d.color}"/><stop offset="1" stop-color="${mix(d.color, '#000000', 0.3)}"/></linearGradient>`
  }
}

// Bridges.
const STEEL = '#4A5B6B'
const deckFaces = { top: '#E3E8EC', left: '#A3AEB7', right: '#86929C', stroke: '#76828C' }
for (const [num, kind, axis, a0, a1, c] of bridges) {
  const Q = (a, cc, z) => (axis === 'x' ? P(a, cc, z) : P(cc, a, z))
  const deck = (w) =>
    axis === 'x'
      ? box(a0, c - w, a1, c + w, DECK - 0.12, DECK + 0.06, deckFaces)
      : box(c - w, a0, c + w, a1, DECK - 0.12, DECK + 0.06, deckFaces)
  let svg = ''
  if (kind === 'truss') {
    const w = 0.42
    const side = (cc) => {
      const lo = DECK + 0.06
      const hi = DECK + 0.62
      const p0 = a0 + 0.12
      const p1 = a1 - 0.12
      let out = seg(Q(p0, cc, hi), Q(p1, cc, hi), STEEL, 1.5)
      const panels = 5
      const step = (p1 - p0) / panels
      for (let k = 0; k <= panels; k++) {
        const a = p0 + k * step
        out += seg(Q(a, cc, lo), Q(a, cc, hi), STEEL, 0.9)
        if (k < panels)
          out += seg(Q(a, cc, k % 2 ? hi : lo), Q(a + step, cc, k % 2 ? lo : hi), STEEL, 0.9)
      }
      return out
    }
    svg = side(c - w) + deck(w) + side(c + w)
    const mid = (a0 + a1) / 2
    badges.push([num, ...Q(mid, c, DECK + 1.45)])
  } else {
    const w = 0.5
    const t1 = a0 + 0.62
    const t2 = a1 - 0.62
    const top = 2.55
    const sag = 0.8
    const cableZ = (a) => {
      if (a <= t1) return DECK + 0.1 + ((top - DECK - 0.1) * (a - a0)) / (t1 - a0)
      if (a >= t2) return DECK + 0.1 + ((top - DECK - 0.1) * (a1 - a)) / (a1 - t2)
      const u = (a - (t1 + t2) / 2) / ((t2 - t1) / 2)
      return sag + (top - sag) * u * u
    }
    const cable = (cc) => {
      const ps = []
      for (let a = a0; a <= a1 + 1e-9; a += 0.05) ps.push(Q(a, cc, cableZ(a)))
      let out = `<polyline points="${pts(...ps)}" fill="none" stroke="${STEEL}" stroke-width="1.6" stroke-linejoin="round"/>`
      for (let a = t1 + 0.22; a < t2 - 0.1; a += 0.22)
        out += seg(Q(a, cc, cableZ(a)), Q(a, cc, DECK + 0.06), STEEL, 0.55)
      return out
    }
    const towerFaces = shades('#6B7B89')
    const tower = (a, cc) =>
      axis === 'x'
        ? box(a - 0.12, cc - 0.12, a + 0.12, cc + 0.12, 0, top + 0.12, towerFaces)
        : box(cc - 0.12, a - 0.12, cc + 0.12, a + 0.12, 0, top + 0.12, towerFaces)
    const beam = (a) =>
      axis === 'x'
        ? box(a - 0.08, c - w - 0.12, a + 0.08, c + w + 0.12, top - 0.2, top - 0.04, towerFaces)
        : box(c - w - 0.12, a - 0.08, c + w + 0.12, a + 0.08, top - 0.2, top - 0.04, towerFaces)
    svg =
      cable(c - w) +
      tower(t1, c - w) +
      tower(t2, c - w) +
      deck(w) +
      tower(t1, c + w) +
      tower(t2, c + w) +
      cable(c + w) +
      beam(t1) +
      beam(t2)
    badges.push([num, ...Q((a0 + a1) / 2, c, top + 0.75)])
  }
  const mid = (a0 + a1) / 2
  scene.push({ depth: axis === 'x' ? mid + c : c + mid, svg })
}

scene.sort((a, b) => a.depth - b.depth)

// ---------------------------------------------------------------- sheet
const sheet = []
// Frame with zone markers, as on a drawing sheet.
sheet.push(`<rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="${NAVY}" stroke-width="1.6"/>`)
sheet.push(`<rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="none" stroke="${NAVY}" stroke-width="0.6"/>`)
for (let k = 0; k < 8; k++) {
  const x = 26 + ((W - 52) / 8) * (k + 0.5)
  for (const y of [22, H - 18])
    sheet.push(`<text x="${x}" y="${y}" text-anchor="middle" class="zone">${k + 1}</text>`)
  if (k)
    for (const [y1, y2] of [[14, 26], [H - 26, H - 14]]) {
      const xx = 26 + ((W - 52) / 8) * k
      sheet.push(seg([xx, y1], [xx, y2], NAVY, 0.6))
    }
}
for (let k = 0; k < 4; k++) {
  const y = 26 + ((H - 52) / 4) * (k + 0.5)
  for (const x of [20, W - 20])
    sheet.push(`<text x="${x}" y="${y + 3}" text-anchor="middle" class="zone">${'ABCD'[k]}</text>`)
  if (k)
    for (const [x1, x2] of [[14, 26], [W - 26, W - 14]]) {
      const yy = 26 + ((H - 52) / 4) * k
      sheet.push(seg([x1, yy], [x2, yy], NAVY, 0.6))
    }
}

// The two boxes along the top share one size and sit the same distance (GAP) inside the
// inner frame line: the title box at the top left, the title block at the top right.
const GAP = 20
const BOX_W = 600
const BOX_H = 150
const BOX_Y = 26 + GAP

// Title box, top left: the project logo (favicon.ico is a PNG; the viewBox crops its
// transparent padding), the name and a two-line description.
{
  const x = 26 + GAP
  const logo = readFileSync(resolve(root, 'favicon.ico')).toString('base64')
  sheet.push(`<rect x="${x}" y="${BOX_Y}" width="${BOX_W}" height="${BOX_H}" fill="#ffffff" stroke="${NAVY}" stroke-width="1.2"/>`)
  sheet.push(
    `<svg x="${x + 20}" y="${BOX_Y + 18}" width="47" height="58" viewBox="255 125 800 985" preserveAspectRatio="xMidYMid meet"><image href="data:image/png;base64,${logo}" width="1278" height="1230"/></svg>`,
  )
  sheet.push(`<text x="${x + 80}" y="${BOX_Y + 60}" font-family="${MONO}" font-weight="700" font-size="40" fill="${NAVY}">basis</text>`)
  sheet.push(`<text x="${x + 212}" y="${BOX_Y + 60}" font-family="${FONT}" font-weight="300" font-size="34" fill="${NAVY}">System architecture</text>`)
  sheet.push(`<text x="${x + 22}" y="${BOX_Y + 94}" class="sub">A code city of the repository, drawn as a site plan. Each building</text>`)
  sheet.push(`<text x="${x + 22}" y="${BOX_Y + 114}" class="sub">is a source module and each floor is 100 lines of code. Bridges are</text>`)
  sheet.push(`<text x="${x + 22}" y="${BOX_Y + 134}" class="sub">the interfaces a query crosses.</text>`)
}

// Title block, top right.
{
  const w = BOX_W
  const x = W - 26 - GAP - w
  const y = BOX_Y
  const rows = [
    [['PROJECT', 'basis: document traceability for civil engineering', 1]],
    [['DRAWING', 'System architecture: code city', 0.62], ['DWG NO.', 'A-001', 0.38]],
    [['SCALE', '1 floor = 100 lines of code', 0.62], ['REV', '0', 0.16], ['DATE', '2026-11-08', 0.22]],
    [['PREPARED BY', 'Team Streichholzschachtel · natHacks 2026', 0.62], ['STATUS', 'Issued for presentation', 0.38]],
  ]
  const rh = BOX_H / rows.length
  sheet.push(`<rect x="${x}" y="${y}" width="${w}" height="${rh * rows.length}" fill="#ffffff" stroke="${NAVY}" stroke-width="1.2"/>`)
  rows.forEach((row, r) => {
    let cx = x
    const ry = y + r * rh
    if (r) sheet.push(seg([x, ry], [x + w, ry], NAVY, 0.6))
    row.forEach(([k, v, frac], i) => {
      if (i) sheet.push(seg([cx, ry], [cx, ry + rh], NAVY, 0.6))
      sheet.push(`<text x="${cx + 9}" y="${ry + 14}" class="tbk">${k}</text>`)
      sheet.push(`<text x="${cx + 9}" y="${ry + 32}" class="tbv">${esc(v)}</text>`)
      cx += w * frac
    })
  })
}

// Legend, bottom left: its last line sits GAP above the inner frame, matching the top boxes.
{
  const x = 26 + GAP
  let y = H - 26 - GAP - 7 * 46 - 30
  sheet.push(`<text x="${x}" y="${y}" class="h">DISTRICTS</text>`)
  y += 16
  for (const d of districts) {
    const f = shades(d.color)
    // Small isometric swatch.
    const sx = x + 14
    const sy = y + 22
    const q = 9
    sheet.push(
      `<polygon points="${sx},${sy - q * 0.5 - 12} ${sx + q * C},${sy - 12} ${sx},${sy + q * 0.5 - 12} ${sx - q * C},${sy - 12}" fill="${f.top}" stroke="${f.stroke}" stroke-width="0.6"/>` +
        `<polygon points="${sx - q * C},${sy - 12} ${sx},${sy + q * 0.5 - 12} ${sx},${sy + q * 0.5 + 4} ${sx - q * C},${sy + 4}" fill="${f.left}" stroke="${f.stroke}" stroke-width="0.6"/>` +
        `<polygon points="${sx + q * C},${sy - 12} ${sx},${sy + q * 0.5 - 12} ${sx},${sy + q * 0.5 + 4} ${sx + q * C},${sy + 4}" fill="${f.right}" stroke="${f.stroke}" stroke-width="0.6"/>`,
    )
    const stats = d.items.length
      ? `${d.items.length} modules · ${fmt(d.total)} lines`
      : 'data store'
    sheet.push(`<text x="${x + 34}" y="${y + 16}" class="ln">${esc(d.name)}<tspan class="ls" dx="8">${stats}</tspan></text>`)
    sheet.push(`<text x="${x + 34}" y="${y + 33}" class="ld">${esc(d.role)}</text>`)
    y += 46
  }
  // Symbols.
  y += 14
  sheet.push(`<text x="${x}" y="${y}" class="ld">Building = module (≥ 50 lines)  ·  Floor line = 100 lines  ·  Tank = data store  ·  Bridge = interface</text>`)
}

// Request path, bottom right.
{
  const x = W - 26 - GAP - BOX_W
  let y = BOX_Y + BOX_H + 44
  sheet.push(`<text x="${x}" y="${y}" class="h">REQUEST PATH</text>`)
  y += 14
  for (const [num, kind, , , , , title, detail] of bridges) {
    sheet.push(`<circle cx="${x + 12}" cy="${y + 16}" r="11" fill="${NAVY}"/>`)
    sheet.push(`<text x="${x + 12}" y="${y + 20.5}" text-anchor="middle" class="bn">${num}</text>`)
    sheet.push(`<text x="${x + 32}" y="${y + 14}" class="ln">${esc(title)}<tspan class="ls" dx="8">${kind === 'suspension' ? 'suspension bridge' : 'truss bridge'}</tspan></text>`)
    sheet.push(`<text x="${x + 32}" y="${y + 31}" class="ld">${esc(detail)}</text>`)
    y += 40
  }
}

// Height scale beside the site.
{
  const [bx, by] = P(-1, 18)
  const x = bx + 40
  const y0 = by - 6
  const per = 0.5 * s
  sheet.push(seg([x, y0], [x, y0 - per * 12], NAVY, 1))
  for (let k = 0; k <= 12; k++) {
    const yy = y0 - per * k
    sheet.push(seg([x - (k % 5 ? 3 : 6), yy], [x, yy], NAVY, k % 5 ? 0.6 : 1))
    if (k % 5 === 0)
      sheet.push(`<text x="${x - 10}" y="${yy + 4}" text-anchor="end" class="bs">${fmt(k * 100)}</text>`)
  }
  sheet.push(`<text x="${x + 8}" y="${y0 - per * 12 + 4}" class="bs">lines</text>`)
}

const badgeSvg = badges
  .map(
    ([n, x, y]) =>
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="${NAVY}" stroke="#ffffff" stroke-width="2"/>` +
      `<text x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}" text-anchor="middle" class="bn">${n}</text>`,
  )
  .join('')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>basis system architecture: code city</title>
<defs>${districts.map((d) => d.tankGradient || '').join('')}
<style>
text{font-family:${FONT}}
.sub{font-size:16px;fill:${SLATE}}
.h{font-size:12px;font-weight:700;letter-spacing:0.14em;fill:${NAVY}}
.ln{font-size:14px;font-weight:600;fill:${NAVY}}
.ls{font-size:12px;font-weight:400;fill:${MUTED}}
.ld{font-size:12.5px;fill:${SLATE}}
.bl{font-size:12px;font-weight:600;fill:${NAVY};paint-order:stroke;stroke:#ffffff;stroke-width:3.5px;stroke-linejoin:round}
.bs{font-size:10.5px;fill:${SLATE};paint-order:stroke;stroke:#ffffff;stroke-width:3px;stroke-linejoin:round}
.bn{font-family:${MONO};font-size:13px;font-weight:700;fill:#ffffff}
.tbk{font-size:9.5px;font-weight:700;letter-spacing:0.12em;fill:${MUTED}}
.tbv{font-size:14px;font-weight:500;fill:${NAVY}}
.zone{font-size:9px;fill:${NAVY}}
</style></defs>
<rect width="${W}" height="${H}" fill="#ffffff"/>
${ground.join('\n')}
${scene.map((e) => e.svg).join('\n')}
${badgeSvg}
${labels.join('\n')}
${sheet.join('\n')}
</svg>
`

const svgPath = resolve(here, 'code-city.svg')
writeFileSync(svgPath, svg)
console.log('Wrote', svgPath)

// Same layout for the animated 3D view (code-city-3d.html). A classic script
// rather than JSON so the page also works when opened straight from disk.
const data = {
  districts: districts.map((d) => ({
    name: d.name,
    short: d.short || d.name,
    role: d.role,
    color: d.color,
    at: d.at,
    items: d.items,
    total: d.total,
    tanks: d.tanks || null,
  })),
  bridges: bridges.map(([num, kind, axis, a0, a1, cross, title, detail]) => ({
    num, kind, axis, a0, a1, cross, title, detail,
  })),
}
const dataPath = resolve(here, 'code-city-data.js')
writeFileSync(dataPath, `// Generated by build-code-city.mjs. Do not edit.\nwindow.CITY = ${JSON.stringify(data, null, 1)}\n`)
console.log('Wrote', dataPath)

if (process.argv.includes('--png')) {
  const { chromium } = await import(pathToFileURL(resolve(root, 'node_modules/playwright/index.mjs')).href).catch(
    () => import('@playwright/test'),
  )
  const fonts = [
    '@fontsource/ibm-plex-sans/300.css',
    '@fontsource/ibm-plex-sans/400.css',
    '@fontsource/ibm-plex-sans/500.css',
    '@fontsource/ibm-plex-sans/600.css',
    '@fontsource/ibm-plex-sans/700.css',
    '@fontsource/roboto-mono/700.css',
  ]
    .map((f) => `<link rel="stylesheet" href="${pathToFileURL(resolve(root, 'node_modules', f)).href}">`)
    .join('')
  const dir = mkdtempSync(join(tmpdir(), 'code-city-'))
  const page = join(dir, 'page.html')
  writeFileSync(page, `<!doctype html><meta charset="utf-8">${fonts}<style>html,body{margin:0}</style>${svg}`)
  const browser = await chromium.launch({ channel: 'chrome' })
  const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
  await tab.goto(pathToFileURL(page).href)
  await tab.evaluate(() => document.fonts.ready)
  const pngPath = resolve(here, 'code-city.png')
  await tab.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: W, height: H } })
  await browser.close()
  console.log('Wrote', pngPath)
}
