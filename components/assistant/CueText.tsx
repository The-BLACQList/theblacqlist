import type { ReactNode } from 'react'

/**
 * Cue's words on screen (ticket 169). The model writes short plain text with
 * at most a little Markdown: blank lines between paragraphs, `- ` or `1. `
 * lists, and `**bold**`. Nothing else is read as markup, and React escapes
 * every character, so no HTML from the reply ever reaches the page.
 *
 * It runs on every streamed delta. While Cue is still writing, settledCueText
 * holds back a half-written `**` so bold never flickers in as plain text.
 */

export type CueBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d{1,2}[.)]\s+(.*)$/

export function parseCueText(text: string): CueBlock[] {
  const blocks: CueBlock[] = []
  let para: string[] = []

  const endPara = () => {
    if (para.length > 0) blocks.push({ type: 'p', text: para.join(' ') })
    para = []
  }
  const addItem = (type: 'ul' | 'ol', item: string) => {
    endPara()
    const last = blocks.at(-1)
    if (last && last.type === type) last.items.push(item)
    else blocks.push({ type, items: [item] })
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    if (bullet?.[1]) addItem('ul', bullet[1])
    else if (numbered?.[1]) addItem('ol', numbered[1])
    else if (line === '') {
      endPara()
      // A blank line also ends a list, so the next list starts fresh.
      if (blocks.at(-1)?.type !== 'p') blocks.push({ type: 'p', text: '' })
    } else para.push(line)
  }
  endPara()
  return blocks.filter((b) => b.type !== 'p' || b.text !== '')
}

/** `**bold**` only. An unclosed `**` in a finished reply stays plain, minus the marks. */
export function inlineParts(text: string): Array<{ bold: boolean; text: string }> {
  const pieces = text.split('**')
  const closed = pieces.length % 2 === 1
  return pieces
    .map((piece, i) => ({ bold: i % 2 === 1 && (closed || i < pieces.length - 1), text: piece }))
    .filter((p) => p.text !== '')
}

/** The words so far, cut back to before a `**` whose pair hasn't arrived yet. */
export function settledCueText(text: string): string {
  const marks = text.split('**').length - 1
  return marks % 2 === 0 ? text : text.slice(0, text.lastIndexOf('**'))
}

/** The reply as one plain line, for a screen reader's status region. */
export function plainCueText(text: string): string {
  return parseCueText(text)
    .flatMap((b) => (b.type === 'p' ? [b.text] : b.items))
    .map((t) => t.replaceAll('**', ''))
    .join(' ')
}

function Inline({ text }: { text: string }): ReactNode {
  return inlineParts(text).map((part, i) =>
    part.bold ? (
      <strong key={i} className="font-semibold text-off-white">
        {part.text}
      </strong>
    ) : (
      <span key={i}>{part.text}</span>
    )
  )
}

export function CueText({ text }: { text: string }) {
  const blocks = parseCueText(text)
  return (
    <div className="space-y-2 font-body text-[15px] leading-relaxed text-off-white break-words [text-wrap:pretty]">
      {blocks.map((block, i) => {
        if (block.type === 'p') {
          return (
            <p key={i}>
              <Inline text={block.text} />
            </p>
          )
        }
        const List = block.type === 'ul' ? 'ul' : 'ol'
        return (
          <List
            key={i}
            className={block.type === 'ul' ? 'list-disc pl-5 space-y-1 marker:text-gold' : 'list-decimal pl-5 space-y-1 marker:text-gold'}
          >
            {block.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
