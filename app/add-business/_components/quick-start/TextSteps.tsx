'use client'

import { firstSentence } from '@/lib/listings/draftSeed'
import { FIELD_IDS, TAGLINE_MAX, aboutMax } from '@/lib/listings/quickStart'
import { ChoiceCards } from './ChoiceCards'
import {
  CharCount,
  HINT_CLASS,
  LABEL_CLASS,
  StepError,
  StepIntro,
  fieldA11y,
  inputClass,
  textareaClass,
  type StepProps,
} from './shared'

// The short steps: ownership, what you do, one line, and the confirmation.

const OWNERSHIP_CHOICES = [
  { value: 'black_owned', title: 'Black-Owned', hint: 'Majority (51%+) Black-owned and operated.' },
  { value: 'ally', title: 'Ally', hint: 'Not Black-owned, but supports Black-owned businesses.' },
] as const

// [Decision — founder, 2026-10-08] signed-off creator copy. Legal review pending.
const CREATOR_CHOICES = [
  { value: 'black_owned', title: 'Black Creator', hint: "I'm a Black creator." },
  {
    value: 'ally',
    title: 'Ally Creator',
    hint: "I'm not Black, and I support Black-owned businesses and creators.",
  },
] as const

export function OwnershipStep({ answers, onChange, problem, mode }: StepProps) {
  const creator = mode === 'creator'
  return (
    <>
      {creator ? (
        <StepIntro title="Which describes you?">
          The BLACQList centers Black creators and Black-owned businesses. Creators who support
          the community are welcome too. Every page is clearly labeled.
        </StepIntro>
      ) : (
        <StepIntro title="Which best describes your business?">
          The BLACQList centers Black-owned businesses. Businesses that support the community are
          welcome too. Every page is clearly labeled.
        </StepIntro>
      )}
      <ChoiceCards
        name="ownership"
        legend={creator ? 'Creator label' : 'Business ownership'}
        idPrefix="qs-ownership"
        choices={creator ? CREATOR_CHOICES : OWNERSHIP_CHOICES}
        value={answers.ownership}
        onChange={(v) => onChange({ ownership: v as 'black_owned' | 'ally' })}
        describedBy={problem ? 'qs-error' : undefined}
      />
      <StepError problem={problem} />
    </>
  )
}

export function AboutStep({ answers, onChange, problem, mode }: StepProps) {
  const max = aboutMax()
  const creator = mode === 'creator'
  return (
    <>
      <StepIntro title={creator ? 'What do you make?' : 'What do you do?'}>
        {creator
          ? 'One to three sentences, in your own words. What you post about and who it is for.'
          : 'One to three sentences, in your own words. Who you serve and what makes you, you.'}
      </StepIntro>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={FIELD_IDS.about} className={LABEL_CLASS}>
          What you do
        </label>
        <textarea
          id={FIELD_IDS.about}
          rows={5}
          value={answers.about}
          onChange={(e) => onChange({ about: e.target.value })}
          placeholder={
            creator
              ? 'Weeknight recipes and Black-owned restaurant finds around Atlanta, for busy families who still want good food.'
              : "Classic cuts and fades in a calm shop on Edgewood. Walk-ins welcome, and we keep kids' cuts quick."
          }
          className={textareaClass(problem?.fieldId === FIELD_IDS.about)}
          {...fieldA11y(problem, FIELD_IDS.about, 'qs-about-hint')}
        />
        <div className="flex items-start justify-between gap-3">
          <p id="qs-about-hint" className={HINT_CLASS}>
            This becomes your About section. You can change it later.
          </p>
          <CharCount value={answers.about} max={max} />
        </div>
      </div>
      <StepError problem={problem} />
    </>
  )
}

export function TaglineStep({ answers, onChange, problem, mode }: StepProps) {
  const seed = firstSentence(answers.about)
  return (
    <>
      <StepIntro title="Your one line">
        The short line under your name. Leave it empty and we&apos;ll use your first sentence.
      </StepIntro>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={FIELD_IDS.tagline} className={LABEL_CLASS}>
          One line <span className="font-normal text-charcoal-soft">(optional)</span>
        </label>
        <input
          id={FIELD_IDS.tagline}
          type="text"
          value={answers.tagline}
          onChange={(e) => onChange({ tagline: e.target.value })}
          placeholder={seed || (mode === 'creator' ? 'Good food, real budgets.' : 'Fresh fades, no wait.')}
          maxLength={TAGLINE_MAX + 20}
          className={inputClass(problem?.fieldId === FIELD_IDS.tagline)}
          {...fieldA11y(problem, FIELD_IDS.tagline, 'qs-tagline-hint')}
        />
        <div className="flex items-start justify-between gap-3">
          <p id="qs-tagline-hint" className={HINT_CLASS}>
            {seed && !answers.tagline.trim() ? `We'll use: "${seed}"` : 'Up to 120 characters.'}
          </p>
          <CharCount value={answers.tagline} max={TAGLINE_MAX} />
        </div>
      </div>
      <StepError problem={problem} />
    </>
  )
}

export function AttestStep({ answers, onChange, problem, mode }: StepProps) {
  if (mode === 'creator') return <CreatorAttestStep answers={answers} onChange={onChange} problem={problem} />
  const ally = answers.ownership === 'ally'
  return (
    <>
      <StepIntro title="Last thing">
        Our team reviews every page before it goes live. Next you can add photos, hours and more,
        and see how strong your page is.
      </StepIntro>
      <label
        htmlFor={FIELD_IDS.attest}
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-charcoal/20 bg-white p-4"
      >
        <input
          id={FIELD_IDS.attest}
          type="checkbox"
          checked={answers.attested}
          onChange={(e) => onChange({ attested: e.target.checked })}
          className="mt-0.5 size-5 shrink-0 accent-brand-black"
          {...fieldA11y(problem, FIELD_IDS.attest)}
        />
        <span className="font-subhead text-sm leading-relaxed text-charcoal">
          {ally
            ? 'I own or run this business. It supports Black-owned businesses and is not itself majority Black-owned (it will be labeled "Ally"). What I entered is accurate.'
            : 'I own or run this business. It is majority Black-owned (51% or more Black or African American ownership and operational control). What I entered is accurate.'}
        </span>
      </label>
      <p className={HINT_CLASS}>
        See our{' '}
        <a
          href="/terms#business-listings"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-black underline underline-offset-2"
        >
          Terms of Service
        </a>{' '}
        for the full definition.
      </p>
      <StepError problem={problem} />
    </>
  )
}

const CHECK_CARD =
  'flex cursor-pointer items-start gap-3 rounded-xl border border-charcoal/20 bg-white p-4'
const CHECK_INPUT = 'mt-0.5 size-5 shrink-0 accent-brand-black'
const CHECK_TEXT = 'font-subhead text-sm leading-relaxed text-charcoal'

// [Decision — founder, 2026-10-08] signed-off creator copy. Legal review pending.
// The 18+ box has no column of its own; see createListing.ts.
function CreatorAttestStep({ answers, onChange, problem }: StepProps) {
  const ally = answers.ownership === 'ally'
  return (
    <>
      <StepIntro title="Last thing">
        Our team reviews every page before it goes live. Next you can add your niche, platforms
        and photos, and see how strong your page is.
      </StepIntro>
      <label htmlFor={FIELD_IDS.attest} className={CHECK_CARD}>
        <input
          id={FIELD_IDS.attest}
          type="checkbox"
          checked={answers.attested}
          onChange={(e) => onChange({ attested: e.target.checked })}
          className={CHECK_INPUT}
          {...fieldA11y(problem, FIELD_IDS.attest)}
        />
        <span className={CHECK_TEXT}>
          {ally
            ? 'This page is about me, and I run the accounts it links to. I\'m not Black, and I support Black-owned businesses and creators (it will be labeled "Ally Creator"). What I entered is accurate.'
            : 'This page is about me, and I run the accounts it links to. I\'m a Black creator (it will be labeled "Black Creator"). What I entered is accurate.'}
        </span>
      </label>
      <label htmlFor={FIELD_IDS.age} className={CHECK_CARD}>
        <input
          id={FIELD_IDS.age}
          type="checkbox"
          checked={answers.ageAttested}
          onChange={(e) => onChange({ ageAttested: e.target.checked })}
          className={CHECK_INPUT}
          {...fieldA11y(problem, FIELD_IDS.age)}
        />
        <span className={CHECK_TEXT}>I&apos;m 18 or older.</span>
      </label>
      <p className={HINT_CLASS}>
        See our{' '}
        <a
          href="/terms#creator-listings"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-black underline underline-offset-2"
        >
          Terms of Service
        </a>{' '}
        for what these labels mean.
      </p>
      <StepError problem={problem} />
    </>
  )
}
