import Image from 'next/image'
import type { EntityPageData } from '@/types'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'

interface Props {
  entity: EntityPageData
  /** Story photo sits left for the professional page, right for the creative page */
  imageSide?: 'left' | 'right'
}

/**
 * Two-column editorial story (Living Commerce Index anatomy ⑤): the
 * business's real description set as editorial paragraphs beside a story
 * photo when one exists — never everything in bordered white cards.
 */
export function TemplateStory({ entity, imageSide = 'left' }: Props) {
  const description = entity.details.description?.trim()
  if (!description) return null

  const paragraphs = description.split(/\n{2,}|\n/).filter((p) => p.trim().length > 0)
  // Second gallery image (first often mirrors the cover); no image → single column
  const storyImage = entity.images[1] ?? entity.images[0] ?? null

  return (
    <section id="about" aria-labelledby="about-heading" className="scroll-mt-32">
      <TemplateSectionHeading kicker="The story" heading={`About ${entity.name}`} headingId="about-heading" />

      <div
        className={`grid grid-cols-1 gap-6 items-start ${
          storyImage
            ? imageSide === 'left'
              ? 'md:grid-cols-[5fr_7fr]'
              : 'md:grid-cols-[7fr_5fr]'
            : ''
        }`}
      >
        {storyImage && imageSide === 'left' && (
          <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-deep-bg">
            <Image
              src={storyImage.src}
              alt={storyImage.alt}
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        )}

        <div>
          {paragraphs.map((paragraph, i) => (
            <p
              key={i}
              className="font-body text-[15.5px] text-brand-black/85 leading-relaxed max-w-[62ch] mb-3.5 last:mb-0"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {storyImage && imageSide === 'right' && (
          <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-deep-bg">
            <Image
              src={storyImage.src}
              alt={storyImage.alt}
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </section>
  )
}
