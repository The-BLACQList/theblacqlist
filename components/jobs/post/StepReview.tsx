import { JOB_EMPLOYMENT_TYPE_META, JOB_WORKPLACE_TYPE_META } from '@/lib/constants/listing'
import type { JobEmploymentType, JobWorkplaceType } from '@/lib/constants/listing'
import { formatJobPay, formatCloseDate } from '@/lib/listings/jobPosting'
import { isVolunteer, type PostJobValues } from '@/lib/validations/postJob'
import type { JobPriceLine } from '@/lib/listings/jobPriceLine'
import { previewCardData } from './JobPreview'
import type { HiringBusiness } from './types'

interface Props {
  values: PostJobValues
  business: HiringBusiness | null
  categoryName: string | null
  priceLine: JobPriceLine
  onEdit: (step: number) => void
}

function Row({ label, value, step, onEdit }: { label: string; value: string; step: number; onEdit: (s: number) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-charcoal/10 last:border-0">
      <div className="min-w-0">
        <dt className="font-subhead text-xs text-charcoal-soft">{label}</dt>
        <dd className="font-subhead text-sm text-brand-black break-words whitespace-pre-line">{value || 'Not set'}</dd>
      </div>
      <button
        type="button"
        onClick={() => onEdit(step)}
        aria-label={`Edit ${label}`}
        className="shrink-0 min-h-11 min-w-11 px-2 font-subhead text-sm font-semibold text-brand-black underline underline-offset-2"
      >
        Edit
      </button>
    </div>
  )
}

export function StepReview({ values, business, categoryName, priceLine, onEdit }: Props) {
  const card = previewCardData(values, business)
  const volunteer = isVolunteer(values.employmentType)
  const kind = values.employmentType
    ? JOB_EMPLOYMENT_TYPE_META[values.employmentType as JobEmploymentType]?.label ?? ''
    : ''
  const where = JOB_WORKPLACE_TYPE_META[values.workplaceType as JobWorkplaceType]?.label ?? ''
  const pay =
    formatJobPay(values.employmentType, card.salaryMin, card.salaryMax, card.salaryPeriod) ??
    (volunteer ? 'Unpaid' : '')
  const closes =
    (card.closesAt ? formatCloseDate(card.closesAt) : null) ?? 'Closes 30 days after it goes live'
  const apply = [values.applyUrl.trim(), values.applyEmail.trim()].filter(Boolean).join('\n')

  return (
    <div className="flex flex-col gap-5">
      <dl className="rounded-xl border border-charcoal/15 bg-white px-4">
        <Row label="Business" value={business?.name ?? ''} step={0} onEdit={onEdit} />
        <Row label="Job title" value={values.name.trim()} step={0} onEdit={onEdit} />
        <Row label="Summary" value={values.tagline.trim()} step={0} onEdit={onEdit} />
        <Row label="Category" value={categoryName ?? ''} step={0} onEdit={onEdit} />
        <Row label="Kind of work" value={[kind, where].filter(Boolean).join(', ')} step={0} onEdit={onEdit} />
        <Row label="Pay" value={pay} step={1} onEdit={onEdit} />
        <Row label="Applications close" value={closes} step={1} onEdit={onEdit} />
        <Row label="How to apply" value={apply} step={2} onEdit={onEdit} />
        <Row label="About this role" value={values.description.trim()} step={2} onEdit={onEdit} />
      </dl>
      <p className="font-subhead text-sm text-brand-black rounded-lg bg-white border border-charcoal/15 p-3">
        {priceLine.text}
      </p>
    </div>
  )
}
