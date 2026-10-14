# Map tiles

For whoever next rebuilds or replaces the map's basemap files.
Last updated: 2026-10-14.

The map draws from two PMTiles files in the public `map-tiles` storage bucket. The site reads both through its own proxy, so the browser never talks to storage directly.

| File | Zooms | What it draws | Proxy route |
|---|---|---|---|
| `blacqlist-us-lowzoom.pmtiles` | 0 to 6 | The lower 48 and its edges: coasts, state lines, big city names | `/api/map/tiles/us` |
| `blacqlist-metros.pmtiles` | up to 14 | Streets and landmarks around the cities we cover | `/api/map/tiles` |

The style in `components/map/mapStyle.ts` switches between them at `DETAIL_ZOOM` (7). The country file's land and water stay underneath at every zoom, so the coastline still shows outside the metros.

## Rebuild the country file

It is a slice of the public Protomaps daily build. Pick a recent date from https://maps.protomaps.com/builds and run:

```bash
pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles blacqlist-us-lowzoom.pmtiles \
  --bbox=-130,14,-60,55 --maxzoom=6
pmtiles verify blacqlist-us-lowzoom.pmtiles
```

The box reaches past the lower 48 on purpose. A phone screen is tall, so at country zoom it shows the Gulf and southern Canada too, and a tighter box left a bare strip there. The 2026-10-14 build gave a 6.0 MB file.

## Upload

Uploading to storage is a production write. Get the founder's OK first. Upload to staging, check `/map` on a Preview, then upload to prod under the same name. Replacing the file is the only way to change it. Browsers cache tile ranges for a day.

## Overrides

- `MAP_TILES_UPSTREAM_URL`: a different metro file.
- `MAP_TILES_US_UPSTREAM_URL`: a different country file. Point it at a local static server to test a new file without uploading.
