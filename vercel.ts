import type { VercelConfig } from '@vercel/config/v1'

// Config-as-code for the Vercel project (team the-blacql-ist / theblacqlist).
// Pins only what is deliberately true today so build settings are reviewable
// and versioned instead of living solely in the dashboard. Environment
// variables stay in the dashboard (secrets never belong in the repo), and the
// Git integration (main → production, PRs → preview) is platform behavior.
export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'pnpm build',
  installCommand: 'pnpm install --frozen-lockfile',
  // Scheduled work. Crons are created for production deployments only, so a
  // preview never sweeps anything — which is the behavior we want, since the
  // sweeps write to whichever database the deployment is bound to.
  crons: [
    // 08:00 UTC, roughly 4am ET: expire unreviewed AI suggestions past their
    // window, and unpublish job postings whose paid window has closed.
    // See lib/services/expiry/sweeps.ts.
    { path: '/api/cron/expiry', schedule: '0 8 * * *' },
  ],
}

export default config
