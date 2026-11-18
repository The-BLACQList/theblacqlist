/**
 * The round trust marks (Creative DR-004 and DR-006 A, For Business build
 * spec v2 §4): open, then filled, then sealed. Round means trust; labels such
 * as Black-Owned stay square. The mark is decorative: always show it beside
 * the tier name, which carries the meaning.
 *
 * Tiers: 0 Unclaimed, 1 Claimed, 2 Verified, 3 Certified. `dark` is for a
 * dark surface (the Verified disc drops its rim, the rings lighten).
 */
export function TrustMark({
  tier,
  dark,
  size = 16,
  className,
}: {
  tier: 0 | 1 | 2 | 3
  dark?: boolean
  size?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {tier === 0 && (
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke={dark ? '#8a8889' : '#595758'}
          strokeWidth="1.5"
          strokeDasharray="2.3 1.9"
        />
      )}
      {tier === 1 && <circle cx="8" cy="8" r="6.2" fill="#2563EB" />}
      {tier === 2 &&
        (dark ? (
          <circle cx="8" cy="8" r="6.2" fill="#ffd867" />
        ) : (
          <circle cx="8" cy="8" r="5.6" fill="#ffd867" stroke="#8f6600" strokeWidth="2" />
        ))}
      {tier === 3 && (
        <>
          <circle
            cx="8"
            cy="8"
            r="7.1"
            fill="none"
            stroke={dark ? '#c4a065' : '#8f6600'}
            strokeWidth="1.3"
          />
          <circle cx="8" cy="8" r="4.6" fill="#c4a065" />
        </>
      )}
    </svg>
  )
}
