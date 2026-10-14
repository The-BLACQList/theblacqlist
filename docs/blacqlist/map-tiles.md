# Map tiles

For whoever next rebuilds or replaces the map's basemap files.
Last updated: 2026-10-14.

The map draws from two PMTiles files in the public `map-tiles` storage bucket. The browser never reads them directly. It asks our route for plain tiles, `/api/map/tiles/<version>/<file>/{z}/{x}/{y}`, and the route reads each tile out of the file. Those tile responses are kept by Vercel's CDN for a year, so a tile costs a storage read once per CDN region, not once per visitor. (The map used to read the files with byte-Range requests, which the CDN never caches. That was the slow map of 2026-10-14.)

| File | Zooms | What it draws | Tile URL |
|---|---|---|---|
| `blacqlist-us-lowzoom.pmtiles` | 0 to 6 | The lower 48 and its edges: coasts, state lines, big city names | `/api/map/tiles/v1/us/{z}/{x}/{y}` |
| `blacqlist-metros.pmtiles` | up to 14 | Streets and landmarks around the cities we cover | `/api/map/tiles/v1/metros/{z}/{x}/{y}` |

The route is `app/api/map/tiles/[version]/[archive]/[z]/[x]/[y]/route.ts`, and the URL rules live in `lib/map/tileUrls.ts`. The old Range route at `/api/map/tiles` is only for tabs opened before that change.

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

Uploading to storage is a production write. Get the founder's OK first. Upload to staging, check `/map` on a Preview, then upload to prod under the same name.

**When you replace a file that is already live, bump `TILES_VERSION` in `lib/map/tileUrls.ts` (v1 → v2) in the same PR.** The CDN keeps tiles for a year and browsers for a day, so without new URLs visitors keep seeing the old tiles. Uploading a file for the first time needs no bump.

## Overrides

- `MAP_TILES_UPSTREAM_URL`: a different metro file.
- `MAP_TILES_US_UPSTREAM_URL`: a different country file. Point it at a local static server to test a new file without uploading.
