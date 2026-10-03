import Link from 'next/link'

import { parseInline } from '@/lib/editorial/inline'

interface Props {
  body: string
  className?: string
  /**
   * `story` is the BLACQLight article measure: larger body type, a drop cap on
   * the first paragraph, and the pull quote set between amber rules. Guides
   * and collections keep the default.
   */
  variant?: 'default' | 'story'
}

const inlineLink =
  'text-amber underline underline-offset-4 decoration-amber/40 hover:decoration-amber transition-colors'

/** Text with `[text](href)` links. Unsafe hrefs render as their text only (lib/editorial/inline.ts). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => {
        if (t.type === 'text') return <span key={i}>{t.text}</span>
        if (t.kind === 'internal') {
          return (
            <Link key={i} href={t.href} className={inlineLink}>
              {t.text}
            </Link>
          )
        }
        return (
          <a key={i} href={t.href} rel="noopener noreferrer" className={inlineLink}>
            {t.text}
          </a>
        )
      })}
    </>
  )
}

export function EditorialRichTextDisplay({ body, className = '', variant = 'default' }: Props) {
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return null

  const story = variant === 'story'
  const firstParagraph = paragraphs.findIndex(
    (p) => !p.startsWith('## ') && !p.startsWith('### ') && !p.startsWith('> ')
  )

  return (
    <div className={`${story ? 'space-y-6' : 'space-y-4'} ${className}`}>
      {paragraphs.map((para, i) => {
        // Headings: lines starting with ## or ###
        if (para.startsWith('### ')) {
          return (
            <h3
              key={i}
              className={`font-headline text-brand-black ${story ? 'text-[22px] mt-8' : 'text-lg mt-6'}`}
            >
              {para.slice(4)}
            </h3>
          )
        }
        if (para.startsWith('## ')) {
          return (
            <h2
              key={i}
              className={`font-headline text-brand-black ${story ? 'text-[28px] leading-tight mt-10' : 'text-xl mt-8'}`}
            >
              {para.slice(3)}
            </h2>
          )
        }
        // Blockquote: lines starting with >
        if (para.startsWith('> ')) {
          return story ? (
            <blockquote
              key={i}
              className="my-10 border-y border-amber/60 py-8 font-headline text-[24px] md:text-[30px] leading-snug text-brand-black text-balance"
            >
              <Inline text={para.slice(2)} />
            </blockquote>
          ) : (
            <blockquote
              key={i}
              className="border-l-4 border-amber-gold/40 pl-4 italic font-body text-base text-charcoal-soft leading-relaxed"
            >
              <Inline text={para.slice(2)} />
            </blockquote>
          )
        }
        // Default paragraph — render single line breaks as <br>
        const lines = para
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        const dropCap =
          story && i === firstParagraph
            ? 'first-letter:float-left first-letter:mr-2 first-letter:font-headline first-letter:text-[64px] first-letter:leading-[0.9] first-letter:text-amber'
            : ''
        return (
          <p
            key={i}
            className={`font-body text-charcoal ${story ? 'text-[17px] md:text-[19px] leading-[1.75]' : 'text-base leading-relaxed'} ${dropCap}`}
          >
            {lines.map((line, j) => (
              <span key={j}>
                <Inline text={line} />
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
