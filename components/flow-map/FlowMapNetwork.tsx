// Simple SVG network placeholder.
// Renders business nodes as circles around a central "Community" node.
// Pure server-side SVG — no client JS required.
// V3 replaces this with an interactive force-directed graph.

interface NetworkNode {
  id: string
  label: string
  transactionCount: number
}

interface FlowMapNetworkProps {
  nodes: NetworkNode[]
}

const SVG_WIDTH = 640
const SVG_HEIGHT = 360
const CENTER_X = SVG_WIDTH / 2
const CENTER_Y = SVG_HEIGHT / 2
const ORBIT_RADIUS = 140
const MAX_NODE_RADIUS = 28
const MIN_NODE_RADIUS = 10
const CENTER_RADIUS = 36

function getNodeRadius(count: number, maxCount: number): number {
  if (maxCount === 0) return MIN_NODE_RADIUS
  const ratio = count / maxCount
  return MIN_NODE_RADIUS + Math.round(ratio * (MAX_NODE_RADIUS - MIN_NODE_RADIUS))
}

function truncateLabel(label: string, maxLen = 14): string {
  return label.length > maxLen ? label.slice(0, maxLen - 1) + "…" : label
}

export function FlowMapNetwork({ nodes }: FlowMapNetworkProps) {
  const hasNodes = nodes.length > 0
  const maxCount = Math.max(...nodes.map((n) => n.transactionCount), 1)

  // Position nodes evenly around the orbit circle
  const positioned = nodes.slice(0, 8).map((node, i) => {
    const angle = (i / Math.min(nodes.length, 8)) * 2 * Math.PI - Math.PI / 2
    return {
      ...node,
      x: CENTER_X + ORBIT_RADIUS * Math.cos(angle),
      y: CENTER_Y + ORBIT_RADIUS * Math.sin(angle),
      radius: getNodeRadius(node.transactionCount, maxCount),
    }
  })

  return (
    <div className="rounded-xl bg-white border border-charcoal/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-charcoal/5 flex items-center justify-between">
        <h2 className="font-headline text-base text-brand-black">Network view</h2>
        <span className="font-subhead text-xs text-charcoal/40 border border-charcoal/10 rounded-full px-2 py-0.5">
          Beta — full graph coming
        </span>
      </div>

      {!hasNodes ? (
        <div className="px-5 py-16 text-center">
          <p className="font-subhead text-sm font-semibold text-brand-black">
            No flow data yet
          </p>
          <p className="font-body text-xs text-charcoal/50 mt-1">
            As community members submit receipts, businesses will appear here as nodes.
          </p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          aria-label="Community dollar flow network — businesses shown as nodes connected to a central community node"
          role="img"
          className="w-full"
        >
          {/* Edges from center to each business node */}
          {positioned.map((node) => (
            <line
              key={`edge-${node.id}`}
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={node.x}
              y2={node.y}
              stroke="#D4A017"
              strokeOpacity={0.2}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          ))}

          {/* Business nodes */}
          {positioned.map((node) => (
            <g key={`node-${node.id}`}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill="#1A1A2E"
                fillOpacity={0.9}
              />
              <text
                x={node.x}
                y={node.y + node.radius + 12}
                textAnchor="middle"
                fontSize={9}
                fill="#1A1A2E"
                fontFamily="sans-serif"
                fillOpacity={0.6}
              >
                {truncateLabel(node.label)}
              </text>
            </g>
          ))}

          {/* Center "Community" node */}
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={CENTER_RADIUS}
            fill="#D4A017"
          />
          <text
            x={CENTER_X}
            y={CENTER_Y + 4}
            textAnchor="middle"
            fontSize={10}
            fontWeight="bold"
            fill="#1A1A2E"
            fontFamily="sans-serif"
          >
            Community
          </text>
        </svg>
      )}
    </div>
  )
}
