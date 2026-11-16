// US places reference list (ticket 230).
//
// Pure helpers shared by the build script (scripts/geo/build-us-places.ts), the
// suggest route (app/api/places/suggest/route.ts) and the tests. The list comes
// from the Census Gazetteer national places file, so a person can type any US
// city or town in onboarding, not just the few BLACQList cities.

/**
 * The words the Census puts after a place name to say what kind of place it
 * is ("Abbeville city", "Abanda CDP", "Nashville-Davidson metropolitan
 * government (balance)"). Longest first, so the longer form wins.
 */
const CENSUS_SUFFIXES = [
  ' metropolitan government (balance)',
  ' consolidated government (balance)',
  ' unified government (balance)',
  ' metro government (balance)',
  ' city (balance)',
  ' metropolitan government',
  ' consolidated government',
  ' unified government',
  ' city and borough',
  ' metro township',
  ' urban county',
  ' municipality',
  ' corporation',
  ' zona urbana',
  ' (balance)',
  ' comunidad',
  ' borough',
  ' village',
  ' city',
  ' town',
  ' CDP',
] as const

/**
 * Consolidated city-counties carry their legal name in the Census file
 * ("Nashville-Davidson", "Louisville/Jefferson County"). Nobody types that, so
 * these show the name people use. Keyed by GEOID so a rename can never touch a
 * different place.
 */
const COMMON_NAMES: Record<string, string> = {
  '1303440': 'Athens', // Athens-Clarke County
  '1304204': 'Augusta', // Augusta-Richmond County
  '1321017': 'Cusseta', // Cusseta-Chattahoochee County
  '1332528': 'Georgetown', // Georgetown-Quitman County
  '1349008': 'Macon', // Macon-Bibb County
  '1571550': 'Honolulu', // Urban Honolulu
  '2146027': 'Lexington', // Lexington-Fayette
  '2148006': 'Louisville', // Louisville/Jefferson County
  '3001675': 'Anaconda', // Anaconda-Deer Lodge County
  '3011397': 'Butte', // Butte-Silver Bow
  '4732742': 'Hartsville', // Hartsville/Trousdale County
  '4744382': 'Lynchburg', // Lynchburg, Moore County
  '4752006': 'Nashville', // Nashville-Davidson
}

/**
 * "Abbeville city" -> "Abbeville". A name with no known suffix is kept as it
 * is. Pass the GEOID to get the common name for a consolidated city-county.
 */
export function cleanPlaceName(censusName: string, geoid?: string): string {
  if (geoid && COMMON_NAMES[geoid]) return COMMON_NAMES[geoid]
  const name = censusName.trim()
  for (const suffix of CENSUS_SUFFIXES) {
    if (name.endsWith(suffix) && name.length > suffix.length) {
      return name.slice(0, -suffix.length).trim()
    }
  }
  return name
}

/**
 * The form both sides of a match are compared in: lower case, accents removed,
 * apostrophes dropped ("Coeur d'Alene" -> "coeur dalene"), and every other
 * run of punctuation or spaces turned into one space ("Winston-Salem" ->
 * "winston salem", "St. Louis" -> "st louis").
 *
 * The SQL side stores this in us_places.search and never normalizes again, so
 * the route must send a query through here before calling suggest_us_places.
 */
export function normalizePlaceSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** "Decatur", "GA" -> "Decatur, GA". */
export function placeLabel(name: string, stateCode: string): string {
  return `${name}, ${stateCode}`
}

/** A Census place GEOID: 2-digit state + 5-digit place. */
export const PLACE_GEOID_PATTERN = /^\d{7}$/

/**
 * Splits what someone typed into the name part and an optional state part.
 * "Houston, T" -> { name: "houston", state: "T" }. "Austin TX" -> also offers
 * { name: "austin", state: "TX" } as a second reading, because people type a
 * state without the comma. The SQL function takes both and unions them.
 */
export function splitPlaceQuery(raw: string): {
  name: string
  state: string
  altName: string
  altState: string
} {
  const comma = raw.indexOf(',')
  if (comma >= 0) {
    return {
      name: normalizePlaceSearch(raw.slice(0, comma)),
      state: raw
        .slice(comma + 1)
        .replace(/[^a-z]/gi, '')
        .toUpperCase()
        .slice(0, 2),
      altName: '',
      altState: '',
    }
  }
  const name = normalizePlaceSearch(raw)
  const m = /^(.*\S)\s+([a-z]{2})$/.exec(name)
  return {
    name,
    state: '',
    altName: m?.[1] ?? '',
    altState: (m?.[2] ?? '').toUpperCase(),
  }
}

export interface UsPlaceRow {
  geoid: string
  name: string
  state_code: string
  label: string
  lat: number
  lng: number
  /**
   * Land area in square miles. nearest_us_place() uses it to tell a big city
   * from the small town next door: midtown Manhattan is miles from New York's
   * centre point but well inside the city.
   */
  land_sq_mi: number
  population: number | null
  search: string
}

/**
 * Builds the rows from the two Census files' contents.
 *
 * `gazetteer` is the tab-separated Gazetteer national places file. `estimates`
 * is the SUB-EST CSV; only its incorporated-place rows (SUMLEV 162) carry a
 * place population, so CDPs keep a null population and sort after the towns
 * that have one.
 *
 * Two places can clean to the same label (a city and a CDP of the same name in
 * one state). A list that shows the same words twice is a list nobody can pick
 * from, so only one is kept: the one with the larger population, then the
 * incorporated one.
 */
export function buildUsPlaceRows(gazetteer: string, estimates: string): UsPlaceRow[] {
  const population = new Map<string, number>()
  const estLines = estimates.split(/\r?\n/)
  const estHeader = (estLines[0] ?? '').split(',')
  const col = (n: string) => estHeader.indexOf(n)
  const iSum = col('SUMLEV')
  const iState = col('STATE')
  const iPlace = col('PLACE')
  const popCols = estHeader
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /^POPESTIMATE\d{4}$/.test(h))
    .sort((a, b) => a.h.localeCompare(b.h))
  const iPop = popCols.at(-1)?.i ?? -1
  if (iSum < 0 || iState < 0 || iPlace < 0 || iPop < 0) {
    throw new Error('Population file is missing SUMLEV, STATE, PLACE or POPESTIMATE columns.')
  }
  for (const line of estLines.slice(1)) {
    // The numeric columns we read sit before NAME, which is the only field
    // that could hold a comma, so a plain split is safe for them.
    const f = line.split(',')
    if (f[iSum] !== '162') continue
    const pop = Number(f[iPop])
    if (Number.isFinite(pop)) population.set(`${f[iState] ?? ''}${f[iPlace] ?? ''}`, pop)
  }

  const gazLines = gazetteer.split(/\r?\n/)
  const header = (gazLines[0] ?? '').split('\t').map((h) => h.trim())
  const g = (n: string) => header.indexOf(n)
  const iUsps = g('USPS')
  const iGeoid = g('GEOID')
  const iName = g('NAME')
  const iFunc = g('FUNCSTAT')
  const iLat = g('INTPTLAT')
  const iLng = g('INTPTLONG')
  const iLand = g('ALAND_SQMI')
  if ([iUsps, iGeoid, iName, iFunc, iLat, iLng, iLand].some((i) => i < 0)) {
    throw new Error('Gazetteer file is missing an expected column.')
  }

  const byLabel = new Map<string, UsPlaceRow & { incorporated: boolean }>()
  for (const line of gazLines.slice(1)) {
    if (!line.trim()) continue
    const f = line.split('\t').map((v) => v.trim())
    const geoid = f[iGeoid] ?? ''
    const state = f[iUsps] ?? ''
    const lat = Number(f[iLat])
    const lng = Number(f[iLng])
    const land = Number(f[iLand])
    if (!PLACE_GEOID_PATTERN.test(geoid) || !/^[A-Z]{2}$/.test(state)) continue
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(land)) continue
    const name = cleanPlaceName(f[iName] ?? '', geoid)
    const row = {
      geoid,
      name,
      state_code: state,
      label: placeLabel(name, state),
      lat,
      lng,
      land_sq_mi: land,
      population: population.get(geoid) ?? null,
      search: normalizePlaceSearch(name),
      // FUNCSTAT A = active government; S = statistical (CDP).
      incorporated: f[iFunc] !== 'S',
    }
    const seen = byLabel.get(row.label)
    if (!seen || ranksAbove(row, seen)) byLabel.set(row.label, row)
  }

  return [...byLabel.values()]
    .map(({ incorporated: _incorporated, ...row }) => row)
    .sort((a, b) => a.geoid.localeCompare(b.geoid))
}

function ranksAbove(
  a: { population: number | null; incorporated: boolean; geoid: string },
  b: { population: number | null; incorporated: boolean; geoid: string }
): boolean {
  const pa = a.population ?? -1
  const pb = b.population ?? -1
  if (pa !== pb) return pa > pb
  if (a.incorporated !== b.incorporated) return a.incorporated
  return a.geoid < b.geoid
}

/**
 * The file keeps only what came from the Census. `label` and `search` are
 * derived again on load (fromCsv), so the file stays small and the two can
 * never drift from the helpers above.
 */
const CSV_COLUMNS = [
  'geoid',
  'name',
  'state_code',
  'lat',
  'lng',
  'land_sq_mi',
  'population',
] as const

function csvField(value: string | number | null): string {
  if (value === null) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: UsPlaceRow[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvField(r[c])).join(','))
  return lines.join('\n') + '\n'
}

/** Reads the CSV that toCsv wrote. Only handles what toCsv produces. */
export function fromCsv(text: string): UsPlaceRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  const rows: UsPlaceRow[] = []
  for (const line of lines.slice(1)) {
    const f: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') quoted = false
        else cur += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',') {
        f.push(cur)
        cur = ''
      } else cur += ch
    }
    f.push(cur)
    const [geoid = '', name = '', state_code = '', lat = '', lng = '', land = '', population = ''] =
      f
    rows.push({
      geoid,
      name,
      state_code,
      label: placeLabel(name, state_code),
      lat: Number(lat),
      lng: Number(lng),
      land_sq_mi: Number(land),
      population: population === '' ? null : Number(population),
      search: normalizePlaceSearch(name),
    })
  }
  return rows
}
