/**
 * Floor icons, in SILO_FLOORS order: shoppers, shops, suppliers, makers,
 * growers. One set of paths feeds the scene's icon atlas, the floor signs
 * and the gauge, so all three always match. No three.js here: the HUD
 * imports this without pulling in the scene chunk.
 */

export const FLOOR_ICON_PATHS: readonly (readonly string[])[] = [
  [
    'M12 8a3 3 0 1 1-6 0a3 3 0 1 1 6 0',
    'M18.9 9a2.4 2.4 0 1 1-4.8 0a2.4 2.4 0 1 1 4.8 0',
    'M3.5 19c0-3.2 2.5-5.2 5.5-5.2s5.5 2 5.5 5.2',
    'M15.5 14.2c2.8 0 5 1.6 5 4.6',
  ],
  [
    'M4.5 10.5V20h15v-9.5',
    'M3 7l2-3.5h14L21 7v1.2a2.8 2.8 0 0 1-5.6 0 2.8 2.8 0 0 1-5.6 0 2.8 2.8 0 0 1-5.6 0z',
    'M10 20v-5h4v5',
  ],
  [
    'M2.5 6h11v10h-11z',
    'M13.5 9.5h4l3 3.5v3h-7',
    'M8.8 18a1.8 1.8 0 1 1-3.6 0a1.8 1.8 0 1 1 3.6 0',
    'M18.8 18a1.8 1.8 0 1 1-3.6 0a1.8 1.8 0 1 1 3.6 0',
  ],
  [
    'M15.2 12a3.2 3.2 0 1 1-6.4 0a3.2 3.2 0 1 1 6.4 0',
    'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  ],
  ['M5 19.5C5 11 10 5.5 19.5 4.5 19.5 14 14 19.5 5 19.5z', 'M5 19.5l8-8'],
]

/** A floor's icon as inline SVG, stroked in the current text color. Decorative. */
export function FloorIcon({ floor, className }: { floor: number; className?: string }) {
  const paths = FLOOR_ICON_PATHS[floor] ?? FLOOR_ICON_PATHS[0]!
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
