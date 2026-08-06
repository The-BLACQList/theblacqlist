import Stripe from 'stripe'

// Lazy singleton behind a Proxy so importing this module never requires
// STRIPE_SECRET_KEY. `next build`'s page-data collection imports API routes
// without calling Stripe, and CI/preview builds have no business holding a
// Stripe key. The env assert runs on first actual use — a runtime concern.
let inst: Stripe | undefined

function createStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  })
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    inst ??= createStripe()
    const value = inst[prop as keyof Stripe]
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(inst)
      : value
  },
})
