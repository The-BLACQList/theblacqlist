import type { PostJobErrors, PostJobField, PostJobValues } from '@/lib/validations/postJob'

/** What the signed-in user can hire for: their published business pages. */
export interface HiringBusiness {
  id: string
  name: string
  logoUrl: string | null
  cityName: string | null
  stateAbbr: string | null
}

export interface StepProps {
  values: PostJobValues
  errors: PostJobErrors
  set: (field: PostJobField, value: string) => void
}
