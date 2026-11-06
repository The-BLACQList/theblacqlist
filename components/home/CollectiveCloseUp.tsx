import { Pause, Play } from 'lucide-react'

import {
  CLOSE_UP_DESK,
  CLOSE_UP_PHONE,
  buildCloseUp,
  closeUpLineCount,
  type CloseUpArt,
  type CloseUpView,
} from '@/lib/spend/collective-closeup'
import { cn } from '@/lib/utils'

interface Props {
  purchases: number
  businesses: number
}

const GAP_HEX = '#ff8ccf'

const DESK_FADE =
  'linear-gradient(90deg, var(--color-deep-bg) 435px, transparent 640px, transparent 1250px, var(--color-deep-bg) 1340px)'

const PHONE_FADE = [
  'linear-gradient(0deg, var(--color-deep-bg) 0%, transparent 10%)',
  'linear-gradient(90deg, var(--color-deep-bg) 0, transparent 60px, transparent 607px, var(--color-deep-bg) 667px)',
].join(', ')

/**
 * A close-up of a section of the Silo for the home band. It's a drawing, so
 * the art is hidden from screen readers and the real totals stay in the band's
 * text. Pulses run on SVG animation, which keeps this a Server Component.
 */
export function CollectiveCloseUp({ purchases, businesses }: Props) {
  const lineCount = closeUpLineCount(purchases, businesses)

  return (
    <>
      <div className="group absolute inset-0 mx-auto hidden max-w-7xl lg:block">
        <Art
          art={buildCloseUp(lineCount, CLOSE_UP_DESK)}
          view={CLOSE_UP_DESK}
          fade={DESK_FADE}
          boxClassName="left-0"
          pauseClassName="bottom-3 right-14"
        />
      </div>
      <div className="group relative h-[390px] overflow-hidden lg:hidden">
        <Art
          art={buildCloseUp(lineCount, CLOSE_UP_PHONE)}
          view={CLOSE_UP_PHONE}
          fade={PHONE_FADE}
          boxClassName="left-1/2 -translate-x-1/2"
          pauseClassName="bottom-0 right-3"
        />
      </div>
    </>
  )
}

interface ArtProps {
  art: CloseUpArt
  view: CloseUpView
  fade: string
  boxClassName: string
  pauseClassName: string
}

function Art({ art, view, fade, boxClassName, pauseClassName }: ArtProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cn('absolute top-0', boxClassName)}
        style={{ width: view.width, height: view.height }}
      >
        <svg
          className="absolute inset-0"
          width={view.width}
          height={view.height}
          viewBox={`0 0 ${view.width} ${view.height}`}
          fill="none"
          focusable="false"
        >
          {art.floors.map((floor) => (
            <path
              key={floor.d}
              d={floor.d}
              className="stroke-gold"
              strokeOpacity={floor.opacity}
              strokeWidth={1.25}
            />
          ))}
          <path d={art.walls} className="stroke-gold" strokeOpacity={0.1} />

          {art.lines.map((line) => (
            <path
              key={line.d}
              d={line.d}
              stroke={line.color}
              strokeOpacity={0.72}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          ))}

          {art.dots.map((dot) => (
            <g key={`${dot.x}-${dot.y}`} fill={dot.color}>
              {dot.lit && <circle cx={dot.x} cy={dot.y} r={dot.r * 1.9} opacity={0.22} />}
              <circle cx={dot.x} cy={dot.y} r={dot.r} opacity={dot.lit ? 1 : 0.42} />
            </g>
          ))}

          {art.gaps.map((gap) => (
            <rect
              key={gap.x}
              x={gap.x - gap.size / 2}
              y={gap.y - gap.size / 2}
              width={gap.size}
              height={gap.size}
              stroke={GAP_HEX}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          ))}

          <g className="group-has-checked:hidden motion-reduce:hidden">
            {art.pulses.map((pulse) => (
              <g key={pulse.d} className="fill-gold">
                <circle r={pulse.r * 2} opacity={0.3} />
                <circle r={pulse.r} />
                <animateMotion
                  path={pulse.d}
                  dur={`${pulse.seconds}s`}
                  begin={`-${pulse.offsetSeconds}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.08;0.92;1"
                  dur={`${pulse.seconds}s`}
                  begin={`-${pulse.offsetSeconds}s`}
                  repeatCount="indefinite"
                />
              </g>
            ))}
          </g>
          <g className="hidden fill-gold group-has-checked:block motion-reduce:block">
            {art.pulses.map((pulse) => (
              <g key={pulse.d}>
                <circle cx={pulse.still.x} cy={pulse.still.y} r={pulse.r * 2} opacity={0.3} />
                <circle cx={pulse.still.x} cy={pulse.still.y} r={pulse.r} />
              </g>
            ))}
          </g>
        </svg>
        <div className="absolute inset-0" style={{ backgroundImage: fade }} />
      </div>

      <div aria-hidden="true">
        {art.tags.map((tag) => (
          <span
            key={tag.name}
            className="absolute bg-deep-bg/70 px-1.5 py-0.5 font-subhead text-xs font-semibold text-off-white/80"
            style={{ left: view.tagLeft, top: tag.y }}
          >
            {tag.name}
          </span>
        ))}
      </div>

      {art.pulses.length > 0 && <PauseMotion className={pauseClassName} />}
    </>
  )
}

/** A checkbox, so stopping the pulses needs no client JavaScript. */
function PauseMotion({ className }: { className: string }) {
  return (
    <label
      className={cn(
        'absolute z-20 inline-flex h-11 cursor-pointer items-center gap-1.5 px-2 font-subhead text-xs text-off-white/70 transition-colors duration-150 hover:text-white has-focus-visible:outline-2 has-focus-visible:outline-gold motion-reduce:hidden',
        className
      )}
    >
      <input type="checkbox" className="sr-only" />
      <Pause className="size-3.5 group-has-checked:hidden" aria-hidden="true" />
      <Play className="hidden size-3.5 group-has-checked:block" aria-hidden="true" />
      Pause motion
    </label>
  )
}
