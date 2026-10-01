import { useEffect, useState } from 'react'
import type { MapListing } from '@/lib/map/types'

interface GeoFeature {
  geometry: { coordinates: [number, number] }
  properties: Omit<MapListing, 'lng' | 'lat'>
}

/** Loads the listings GeoJSON once and flattens it. */
export function useMapListings() {
  const [listings, setListings] = useState<MapListing[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    fetch('/api/map/listings')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((geo: { features: GeoFeature[] }) => {
        setListings(
          geo.features.map((f) => ({
            ...f.properties,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
        )
        setLoaded(true)
      })
      .catch(() => setLoadError(true))
  }, [])

  return { listings, loading: !loaded && !loadError, loadError }
}
