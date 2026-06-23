interface Props {
  body: string
  className?: string
}

export function EditorialRichTextDisplay({ body, className = '' }: Props) {
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return null

  return (
    <div className={`space-y-4 ${className}`}>
      {paragraphs.map((para, i) => {
        // Headings: lines starting with ## or ###
        if (para.startsWith('### ')) {
          return (
            <h3 key={i} className="font-headline text-lg text-brand-black mt-6">
              {para.slice(4)}
            </h3>
          )
        }
        if (para.startsWith('## ')) {
          return (
            <h2 key={i} className="font-headline text-xl text-brand-black mt-8">
              {para.slice(3)}
            </h2>
          )
        }
        // Blockquote: lines starting with >
        if (para.startsWith('> ')) {
          return (
            <blockquote
              key={i}
              className="border-l-4 border-amber-gold/40 pl-4 italic font-body text-base text-charcoal-soft leading-relaxed"
            >
              {para.slice(2)}
            </blockquote>
          )
        }
        // Default paragraph — render single line breaks as <br>
        const lines = para
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        return (
          <p key={i} className="font-body text-base text-charcoal leading-relaxed">
            {lines.map((line, j) => (
              <span key={j}>
                {line}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
