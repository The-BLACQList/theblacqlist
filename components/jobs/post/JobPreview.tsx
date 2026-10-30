import { JobCard } from '@/components/jobs/JobCard'
import { buildJobPlace } from '@/lib/listings/jobCard'
import { endOfDayEastern, isVolunteer, type PostJobValues } from '@/lib/validations/postJob'
import type { JobCardData } from '@/types'
import type { HiringBusiness } from './types'

interface Props {
  values: PostJobValues
  business: HiringBusiness | null
}

const MONEY = /^\d{1,9}(\.\d{1,2})?$/

function num(v: string): number | null {
  const t = v.trim()
  return MONEY.test(t) ? Number(t) : null
}

/** The live card, built from what the poster has typed so far. */
export function previewCardData(values: PostJobValues, business: HiringBusiness | null): JobCardData {
  const volunteer = isVolunteer(values.employmentType)
  const closes = values.closesAt.trim()
  const closesOk = /^\d{4}-\d{2}-\d{2}$/.test(closes)
  return {
    id: 'preview',
    href: '#',
    title: values.name.trim() || 'Your job title',
    businessName: business?.name ?? null,
    businessLogoUrl: business?.logoUrl ?? null,
    place: buildJobPlace(
      business?.cityName ? { name: business.cityName, state_abbr: business.stateAbbr } : null,
      values.workplaceType
    ),
    employmentType: values.employmentType || null,
    workplaceType: values.workplaceType || null,
    salaryMin: volunteer ? null : num(values.salaryMin),
    salaryMax: volunteer ? null : num(values.salaryMax),
    salaryPeriod: volunteer ? null : values.salaryPeriod || null,
    closesAt: closesOk ? endOfDayEastern(closes) : null,
  }
}

export function JobPreview({ values, business }: Props) {
  return (
    <div>
      <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-charcoal-soft mb-2">
        How it will look
      </p>
      {/* inert: the card is a link, and a preview should not be a tab stop or a click target. */}
      <div inert>
        <JobCard job={previewCardData(values, business)} />
      </div>
    </div>
  )
}
