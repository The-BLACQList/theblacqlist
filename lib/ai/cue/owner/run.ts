/**
 * One owner message through the shared loop (ticket 203). The loop
 * (lib/ai/cue/loop.ts) brings the bounds, the streaming and TextGuard; this
 * adds the owner's tools and tidies the reply.
 */

import type Anthropic from '@anthropic-ai/sdk'

import { cleanReply, lastFullSentence } from '@/lib/ai/cue/guard'
import {
  runToolLoop,
  type CueModelCall,
  type CueProgressEvent,
  type CueStop,
  type CueUsage,
} from '@/lib/ai/cue/loop'

import type { OwnerDraft, OwnerLink } from './events'
import { OWNER_CUE_TOOLS, ownerStatusFor, runOwnerCueTool, type OwnerCueContext } from './tools'

/** Words from separate model calls are separate paragraphs, never run together. */
const OWNER_PART_BREAK = '\n\n'

/** Said when a draft or buttons came back but no words did. */
export const OWNER_SEE_BELOW = 'Here you go.'

export interface OwnerCueResult {
  text: string
  drafts: OwnerDraft[]
  links: OwnerLink[]
  stop: CueStop
  usage: CueUsage
  calls: number
}

export async function runOwnerCue(args: {
  call: CueModelCall
  model: string
  system: Anthropic.TextBlockParam[]
  messages: Anthropic.MessageParam[]
  ctx: OwnerCueContext
  emit: (event: CueProgressEvent) => void
  signal: AbortSignal
}): Promise<OwnerCueResult> {
  const { ctx } = args
  const loop = await runToolLoop({
    call: args.call,
    model: args.model,
    system: args.system,
    messages: args.messages,
    tools: OWNER_CUE_TOOLS,
    runTool: (name, input) => runOwnerCueTool(name, input, ctx),
    statusFor: (name) => ownerStatusFor(name),
    emit: args.emit,
    signal: args.signal,
    partBreak: OWNER_PART_BREAK,
  })

  let text = cleanReply(loop.replyParts.join(OWNER_PART_BREAK))
  if (loop.stop === 'refusal') text = ''
  else if (loop.stop !== 'end') text = lastFullSentence(text)
  const { drafts, links } = ctx.state
  if (!text && (drafts.length > 0 || links.length > 0)) text = OWNER_SEE_BELOW

  return { text, drafts, links, stop: loop.stop, usage: loop.usage, calls: loop.calls }
}
