import type { Database as Generated } from './types'

// types.ts is `supabase gen types typescript --project-id <prod-ref> --schema public`
// output, never hand-edited. This file adds only what the generator can't see:
//   - listings.primary_level is filled by the listings_fill_primary_level trigger
//     (20261017000000_business_levels.sql), so inserts may leave it out.
//   - tour_enrollments.tester_number is set by the tour_enrollments_cap_and_number
//     trigger (20261014000000_shared_tester_link.sql), so inserts leave it out.
//   - find_auth_user_id_by_email is executable by service_role only, so the
//     generator skips it (20261001 one-tap tester link).
// Import Database from here, not from ./types.

type Public = Generated['public']
type Tables = Public['Tables']
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
type WithInsert<T extends { Insert: unknown }, I> = Omit<T, 'Insert'> & { Insert: I }

export type Database = Omit<Generated, 'public'> & {
  public: Omit<Public, 'Tables' | 'Functions'> & {
    Tables: Omit<Tables, 'listings' | 'tour_enrollments'> & {
      listings: WithInsert<Tables['listings'], Optional<Tables['listings']['Insert'], 'primary_level'>>
      tour_enrollments: WithInsert<
        Tables['tour_enrollments'],
        Optional<Tables['tour_enrollments']['Insert'], 'tester_number'>
      >
    }
    Functions: Public['Functions'] & {
      find_auth_user_id_by_email: {
        Args: { p_email: string }
        Returns: string
      }
    }
  }
}
