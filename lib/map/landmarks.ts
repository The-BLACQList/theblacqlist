/**
 * Our own map landmarks: HBCUs and Black history and culture districts in each
 * city the map flies to. They sit under the listings as context, so people can
 * find their way by places they already know.
 *
 * Every coordinate is the {{coord}} on the English Wikipedia article in
 * `source`, cross-checked against Wikidata, read 2026-10-01. The list is
 * reviewed by the founder in docs/blacqlist/design/map-landmarks-2026-10.md;
 * change both together.
 */
export type LandmarkKind =
  | 'hbcu'
  /** A predominantly Black institution: not historically Black by charter, so not an HBCU. */
  | 'pbi'
  | 'district'
  | 'museum'
  | 'memorial'

export interface Landmark {
  id: string
  /** A CITY_VIEWS slug. */
  city: string
  /** The map label. Kept short; the full name lives in the review doc. */
  name: string
  kind: LandmarkKind
  lng: number
  lat: number
  source: string
}

const WIKI = 'https://en.wikipedia.org/wiki/'

export const LANDMARKS: readonly Landmark[] = [
  // Atlanta
  { id: 'sweet-auburn', city: 'atlanta-ga', name: 'Sweet Auburn', kind: 'district', lng: -84.38131, lat: 33.75483, source: `${WIKI}Sweet_Auburn` },
  { id: 'mlk-nhp', city: 'atlanta-ga', name: 'MLK Jr. National Historical Park', kind: 'memorial', lng: -84.37222, lat: 33.755, source: `${WIKI}Martin_Luther_King_Jr._National_Historical_Park` },
  // A consortium: Clark Atlanta, Spelman, Morehouse and Morehouse School of Medicine.
  { id: 'auc', city: 'atlanta-ga', name: 'Atlanta University Center', kind: 'hbcu', lng: -84.411, lat: 33.749, source: `${WIKI}Atlanta_University_Center` },

  // Houston
  { id: 'emancipation-park', city: 'houston-tx', name: 'Emancipation Park', kind: 'memorial', lng: -95.36494, lat: 29.73578, source: `${WIKI}Emancipation_Park_(Houston)` },
  { id: 'tsu', city: 'houston-tx', name: 'Texas Southern University', kind: 'hbcu', lng: -95.36111, lat: 29.72222, source: `${WIKI}Texas_Southern_University` },
  // Freedmen's Town has no article of its own; this is the Fourth Ward's center.
  { id: 'freedmens-town', city: 'houston-tx', name: "Freedmen's Town", kind: 'district', lng: -95.381, lat: 29.756, source: `${WIKI}Fourth_Ward,_Houston` },
  { id: 'project-row-houses', city: 'houston-tx', name: 'Project Row Houses', kind: 'museum', lng: -95.3652, lat: 29.732, source: `${WIKI}Project_Row_Houses` },

  // Chicago
  // "Bronzeville, Chicago" redirects to Douglas; this is Douglas's center.
  { id: 'bronzeville', city: 'chicago-il', name: 'Bronzeville', kind: 'district', lng: -87.61806, lat: 41.83472, source: `${WIKI}Douglas,_Chicago` },
  { id: 'victory-monument', city: 'chicago-il', name: 'Victory Monument', kind: 'memorial', lng: -87.61714, lat: 41.83072, source: `${WIKI}Victory_Monument_(Chicago)` },
  { id: 'roberts-temple', city: 'chicago-il', name: 'Roberts Temple', kind: 'memorial', lng: -87.62602, lat: 41.82124, source: `${WIKI}Roberts_Temple_Church_of_God_in_Christ` },
  { id: 'dusable-museum', city: 'chicago-il', name: 'DuSable Black History Museum', kind: 'museum', lng: -87.60722, lat: 41.79194, source: `${WIKI}DuSable_Black_History_Museum` },
  { id: 'csu', city: 'chicago-il', name: 'Chicago State University', kind: 'pbi', lng: -87.609, lat: 41.718, source: `${WIKI}Chicago_State_University` },

  // Los Angeles
  // The article's Wikidata point, which sits on the Village rather than the
  // neighborhood's center about 0.5 km north.
  { id: 'leimert-park', city: 'los-angeles-ca', name: 'Leimert Park Village', kind: 'district', lng: -118.32722, lat: 34.00778, source: `${WIKI}Leimert_Park,_Los_Angeles` },
  { id: 'caam', city: 'los-angeles-ca', name: 'California African American Museum', kind: 'museum', lng: -118.28347, lat: 34.01581, source: `${WIKI}California_African_American_Museum` },
  { id: 'watts-towers', city: 'los-angeles-ca', name: 'Watts Towers', kind: 'memorial', lng: -118.24105, lat: 33.93874, source: `${WIKI}Watts_Towers` },
  // A Historically Black Graduate Institution, one of four historically Black medical schools.
  { id: 'cdrew', city: 'los-angeles-ca', name: 'Charles R. Drew University', kind: 'hbcu', lng: -118.24259, lat: 33.92563, source: `${WIKI}Charles_R._Drew_University_of_Medicine_and_Science` },

  // Washington DC
  { id: 'u-street', city: 'washington-dc', name: 'U Street', kind: 'district', lng: -77.02958, lat: 38.917, source: `${WIKI}U_Street_(Washington,_D.C.)` },
  { id: 'howard', city: 'washington-dc', name: 'Howard University', kind: 'hbcu', lng: -77.01944, lat: 38.92222, source: `${WIKI}Howard_University` },
  { id: 'nmaahc', city: 'washington-dc', name: 'National Museum of African American History and Culture', kind: 'museum', lng: -77.03278, lat: 38.89111, source: `${WIKI}National_Museum_of_African_American_History_and_Culture` },
  { id: 'aacwm', city: 'washington-dc', name: 'African American Civil War Memorial', kind: 'memorial', lng: -77.02583, lat: 38.91639, source: `${WIKI}African_American_Civil_War_Memorial_Museum` },
  { id: 'douglass-nhs', city: 'washington-dc', name: 'Frederick Douglass National Historic Site', kind: 'memorial', lng: -76.98528, lat: 38.86333, source: `${WIKI}Frederick_Douglass_National_Historic_Site` },

  // New Orleans
  { id: 'treme', city: 'new-orleans-la', name: 'Tremé', kind: 'district', lng: -90.07389, lat: 29.96833, source: `${WIKI}Trem%C3%A9` },
  { id: 'congo-square', city: 'new-orleans-la', name: 'Congo Square', kind: 'memorial', lng: -90.06833, lat: 29.96083, source: `${WIKI}Congo_Square` },
  { id: 'dillard', city: 'new-orleans-la', name: 'Dillard University', kind: 'hbcu', lng: -90.06528, lat: 29.995, source: `${WIKI}Dillard_University` },
  { id: 'xula', city: 'new-orleans-la', name: 'Xavier University of Louisiana', kind: 'hbcu', lng: -90.107, lat: 29.9652, source: `${WIKI}Xavier_University_of_Louisiana` },
  { id: 'suno', city: 'new-orleans-la', name: 'Southern University at New Orleans', kind: 'hbcu', lng: -90.0451, lat: 30.0265, source: `${WIKI}Southern_University_at_New_Orleans` },
]

export interface LandmarkFeature {
  type: 'Feature'
  id: string
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { name: string; kind: LandmarkKind }
}

export interface LandmarkCollection {
  type: 'FeatureCollection'
  features: LandmarkFeature[]
}

export function toLandmarkGeoJSON(): LandmarkCollection {
  return {
    type: 'FeatureCollection',
    features: LANDMARKS.map((l) => ({
      type: 'Feature',
      id: l.id,
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: { name: l.name, kind: l.kind },
    })),
  }
}
