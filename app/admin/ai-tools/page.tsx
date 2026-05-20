import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin/guard"
import { createServiceClient } from "@/lib/supabase/server"
import { PROMPT_TEMPLATES } from "@/lib/ai/prompts"

export const metadata: Metadata = { title: "AI Tools" }

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)   return "just now"
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-4">
      <p className="font-body text-xs text-charcoal/50">{label}</p>
      <p className="font-headline text-2xl text-brand-black mt-1">{value}</p>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  applied:  "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired:  "bg-charcoal/10 text-charcoal/50",
}

export default async function AdminAiToolsPage() {
  await requireAdmin()

  const serviceClient = createServiceClient()

  const [totalResult, pendingResult, approvedResult, appliedResult, recentResult] =
    await Promise.all([
      serviceClient
        .from("ai_suggestions")
        .select("id", { count: "exact", head: true }),

      serviceClient
        .from("ai_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      serviceClient
        .from("ai_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),

      serviceClient
        .from("ai_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status", "applied"),

      serviceClient
        .from("ai_suggestions")
        .select("id, listing_id, agent_type, suggestion_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ])

  const total    = totalResult.count    ?? 0
  const pending  = pendingResult.count  ?? 0
  const approved = approvedResult.count ?? 0
  const applied  = appliedResult.count  ?? 0
  const recent   = recentResult.data    ?? []

  const promptKeys = Object.keys(PROMPT_TEMPLATES) as Array<keyof typeof PROMPT_TEMPLATES>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl text-brand-black">AI Tools</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
          Platform AI system status and suggestion review.
        </p>
      </div>

      {/* System status */}
      <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-4 flex items-center gap-3">
        <div className="size-2.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-subhead text-sm font-semibold text-brand-black">
            Provider: Mock mode — No AI provider connected
          </p>
          <p className="font-body text-xs text-charcoal/50 mt-0.5">
            The Anthropic API is not configured. All suggestions are generated from mock data.
            See <span className="font-mono">docs/blacqlist/ai/ai-agent-roadmap.md</span> for
            V2 Provider phase gates.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total suggestions"    value={total.toLocaleString()} />
        <StatCard label="Pending review"       value={pending.toLocaleString()} />
        <StatCard label="Approved"             value={approved.toLocaleString()} />
        <StatCard label="Applied to listings"  value={applied.toLocaleString()} />
      </div>

      {/* Recent suggestions table */}
      <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal/10">
          <h2 className="font-subhead text-sm font-semibold text-brand-black">
            Recent suggestions (last 50)
          </h2>
        </div>

        {recent.length === 0 ? (
          <p className="px-5 py-8 font-body text-sm text-charcoal/50 text-center">
            No suggestions yet. Suggestions appear here once AI agents generate them.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-pale-lavender/30">
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/60 uppercase tracking-wide">
                    Listing
                  </th>
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/60 uppercase tracking-wide hidden md:table-cell">
                    Agent
                  </th>
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/60 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left font-subhead text-xs font-semibold text-charcoal/60 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right font-subhead text-xs font-semibold text-charcoal/60 uppercase tracking-wide">
                    When
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {recent.map((row) => (
                  <tr key={row.id} className="hover:bg-pale-lavender/10 transition-colors">
                    <td className="px-5 py-3 font-mono text-[11px] text-charcoal/40 max-w-[120px] truncate">
                      {row.listing_id ? row.listing_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-5 py-3 font-body text-xs text-charcoal/60 hidden md:table-cell">
                      {row.agent_type}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-brand-black">
                      {row.suggestion_type}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-subhead text-[11px] font-semibold ${
                          STATUS_STYLES[row.status] ?? "bg-charcoal/10 text-charcoal/50"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-body text-xs text-charcoal/50 text-right whitespace-nowrap">
                      {formatRelativeTime(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Prompt templates */}
      <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-charcoal/10">
          <h2 className="font-subhead text-sm font-semibold text-brand-black">
            Prompt templates ({promptKeys.length})
          </h2>
          <p className="font-body text-xs text-charcoal/50 mt-0.5">
            Defined in <span className="font-mono">lib/ai/prompts.ts</span> — no API calls, string constants only.
          </p>
        </div>
        <ul className="divide-y divide-charcoal/5">
          {promptKeys.map((key) => (
            <li key={key} className="px-5 py-3">
              <span className="font-mono text-xs text-brand-black">{key}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Roadmap */}
      <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-5">
        <p className="font-subhead text-sm font-semibold text-brand-black mb-2">
          AI agent roadmap
        </p>
        <div className="space-y-1.5">
          {[
            { phase: "Foundation (now)", detail: "Data model, checklist, placeholder UI, prompt templates — no API calls" },
            { phase: "V2 Mock", detail: "Hardcoded mock suggestions; approval workflow active" },
            { phase: "V2 Provider", detail: "Anthropic API connected; real generation; audit log live" },
            { phase: "V3 Autonomous", detail: "Background agents; ai_agent_runs table; continuous curation" },
          ].map(({ phase, detail }) => (
            <div key={phase} className="flex items-start gap-3">
              <span className="font-subhead text-xs font-semibold text-charcoal/50 w-36 shrink-0 mt-0.5">
                {phase}
              </span>
              <span className="font-body text-xs text-charcoal/60">{detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
