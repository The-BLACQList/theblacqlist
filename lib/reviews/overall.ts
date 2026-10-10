// A review's overall star rating is the average of its category ratings
// (Quality, Service, Value, Atmosphere) [Decision — founder, 2026-10-10].
// Reviewers went straight to the categories and missed the separate overall
// stars, then found the submit button greyed out with no reason given.
//
// `reviews.rating` is a whole number from 1 to 5 and feeds the listing's
// average, so the average is rounded to the nearest whole star (4.5 → 5).
// The form and createReview.ts both call this, so the stars a reviewer sees
// are the stars that get saved.

export interface OverallRating {
  /** The exact average of the category ratings, e.g. 4.25. */
  average: number
  /** The average rounded to a whole star, 1 to 5. Saved as reviews.rating. */
  stars: number
  /** How many categories were rated. */
  count: number
}

/** Averages the 1-5 values. Ignores anything else. Null when none are left. */
export function overallFromCriteria(values: readonly number[]): OverallRating | null {
  const valid = values.filter((v) => Number.isInteger(v) && v >= 1 && v <= 5)
  if (valid.length === 0) return null
  const average = valid.reduce((sum, v) => sum + v, 0) / valid.length
  return { average, stars: Math.round(average), count: valid.length }
}
