/**
 * A scripted stand-in for the owner Cue's model (ticket 203), so Preview and
 * CI run the whole chat (tools, drafts, links, streaming) without a key or any
 * spend. `resolveProvider` picks it exactly as it picks the other mocks.
 *
 * The script, by what the owner typed:
 *   - "write", "draft" or "about": draft the About (or search title/description)
 *   - "plan", "price", "upgrade": the plans help
 *   - anything else: read the page, then link to the first two things missing
 */

import type Anthropic from '@anthropic-ai/sdk'

import type { CueModelCall } from '@/lib/ai/cue/loop'

function blocks(message: Anthropic.MessageParam): Anthropic.ContentBlockParam[] {
  return typeof message.content === 'string'
    ? [{ type: 'text', text: message.content }]
    : message.content
}

function ownerText(messages: readonly Anthropic.MessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.role !== 'user') continue
    const texts = blocks(m).filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
    const last = texts.at(-1)
    if (last && !last.text.startsWith('<context>')) return last.text
  }
  return ''
}

/** Every tool called so far this turn, with what came back. */
function toolsSoFar(
  messages: readonly Anthropic.MessageParam[]
): { name: string; result: string }[] {
  const out: { name: string; result: string }[] = []
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]!
    const cur = messages[i]!
    if (prev.role !== 'assistant' || cur.role !== 'user') continue
    for (const r of blocks(cur)) {
      if (r.type !== 'tool_result') continue
      const use = blocks(prev).find(
        (b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use' && b.id === r.tool_use_id
      )
      if (!use) continue
      const content =
        typeof r.content === 'string'
          ? r.content
          : (r.content ?? []).map((c) => (c.type === 'text' ? c.text : '')).join('')
      out.push({ name: use.name, result: content })
    }
  }
  return out
}

function message(
  model: string,
  content: Anthropic.ContentBlock[],
  stop: Anthropic.StopReason
): Anthropic.Message {
  return {
    id: 'msg_mock',
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  } as unknown as Anthropic.Message
}

function missingSections(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as { missing?: { section?: unknown }[] }
    const out: string[] = []
    for (const m of parsed.missing ?? []) {
      if (typeof m.section === 'string' && !out.includes(m.section)) out.push(m.section)
    }
    return out
  } catch {
    return []
  }
}

export function createMockOwnerCueCall(): CueModelCall {
  let n = 0
  const toolUses = (model: string, uses: { name: string; input: Record<string, unknown> }[]) =>
    message(
      model,
      uses.map(
        (u) =>
          ({
            type: 'tool_use',
            id: `toolu_mock_${++n}`,
            name: u.name,
            input: u.input,
          }) as Anthropic.ContentBlock
      ),
      'tool_use'
    )
  const say = (model: string, text: string, onText: (d: string) => void) => {
    for (const piece of text.split(/(?<= )/)) onText(piece)
    return message(
      model,
      [{ type: 'text', text, citations: null } as Anthropic.ContentBlock],
      'end_turn'
    )
  }

  return async (params, onText, signal) => {
    if (signal.aborted) throw new Error('aborted')
    const model = params.model
    const done = toolsSoFar(params.messages)
    const words = ownerText(params.messages).toLowerCase()

    if (/\b(write|draft|rewrite)\b/.test(words)) {
      if (done.length === 0) {
        const kind = /search title|title/.test(words)
          ? 'search_title'
          : /search description|description/.test(words) && !/about/.test(words)
            ? 'search_description'
            : 'about'
        return toolUses(model, [{ name: 'draft_text', input: { kind } }])
      }
      const result = done[0]!.result
      if (result.includes('"shown_as_card":true')) {
        return say(model, 'Your draft is below. Use it if you like it, or set it aside.', onText)
      }
      return say(model, result.replace(/^Not drafted[.:]\s*(Tell the owner:\s*)?/, ''), onText)
    }

    if (/\b(plan|plans|price|pricing|upgrade|cost)\b/.test(words)) {
      if (done.length === 0)
        return toolUses(model, [{ name: 'get_help', input: { topic: 'plans' } }])
      if (done.length === 1)
        return toolUses(model, [{ name: 'go_to', input: { section: 'upgrade' } }])
      return say(
        model,
        'Starter, Growth and Premium each add more to your page. The plans are on Upgrade.',
        onText
      )
    }

    if (done.length === 0) return toolUses(model, [{ name: 'get_my_page', input: {} }])
    if (done.length === 1) {
      const sections = missingSections(done[0]!.result).slice(0, 2)
      if (sections.length === 0)
        return say(
          model,
          'Your page has everything the strength meter looks for. Nice work.',
          onText
        )
      return toolUses(
        model,
        sections.map((section) => ({ name: 'go_to', input: { section } }))
      )
    }
    return say(model, 'A fuller page gets found more. Start with the items below.', onText)
  }
}
