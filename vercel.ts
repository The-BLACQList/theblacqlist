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
}

export default config
