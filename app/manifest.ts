import type { MetadataRoute } from 'next'

/**
 * Web app manifest, served at /manifest.webmanifest.
 *
 * Its job here is identity, not installability: a real name, real icons, and
 * the brand ground colour for the Android status bar. Before it existed, a
 * home-screen save took a screenshot of whatever page was open.
 *
 * Why `minimal-ui` and not `standalone`
 * -------------------------------------
 * There is no service worker and no offline story. Under `standalone` a saved
 * shortcut that loads with no connection lands the user on a bare error page
 * with no address bar and no reload control — a dead end. `minimal-ui` keeps
 * the navigation affordances that make that recoverable. Chrome will not offer
 * an install prompt either way without a service worker, so this only affects
 * users who deliberately add the site to their home screen, and for them it is
 * strictly the safer mode.
 *
 * The icons are generated from the SVG masters by `pnpm brand:assets`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The BLACQList',
    short_name: 'BLACQList',
    description: 'Discover and support Black-owned businesses.',
    start_url: '/',
    display: 'minimal-ui',
    background_color: '#08080a',
    theme_color: '#08080a',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Padded to the maskable safe zone so Android's circle, squircle, and
        // rounded-square masks all crop to intact artwork.
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
