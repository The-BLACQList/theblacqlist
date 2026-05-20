'use server'

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { WelcomeEmail } from '@/lib/email/templates/welcome'

type SignUpField = 'email' | 'password' | 'displayName' | 'general'

type SignUpState = { error: string; field?: SignUpField } | { success: true; email: string } | null

export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const displayName = formData.get('displayName')?.toString().trim() ?? ''
  const role = formData.get('role')?.toString() ?? 'supporter'
  const onboardingIntent = formData.get('onboardingIntent')?.toString() ?? ''

  if (!displayName) return { error: 'Display name is required.', field: 'displayName' }
  if (displayName.length > 100)
    return {
      error: 'Display name must be 100 characters or fewer.',
      field: 'displayName',
    }
  if (!email) return { error: 'Email is required.', field: 'email' }
  if (!password) return { error: 'Password is required.', field: 'password' }
  if (password.length < 8)
    return {
      error: 'Password must be at least 8 characters.',
      field: 'password',
    }

  const supabase = await createClient()

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback`

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        display_name: displayName,
        // Maps to DB role on first onboarding step; stored in metadata until
        // schema migration runs and setOnboardingRole can write to user_roles.
        onboarding_role: role,
        onboarding_intent: onboardingIntent,
      },
    },
  })

  if (error) {
    if (
      error.message.toLowerCase().includes('already registered') ||
      error.message.toLowerCase().includes('already been registered') ||
      error.message.toLowerCase().includes('user already exists')
    ) {
      return {
        error: 'That email is already registered. Sign in instead.',
        field: 'email',
      }
    }
    return { error: 'Something went wrong. Please try again.', field: 'general' }
  }

  void sendEmail({
    to: email,
    subject: 'Welcome to The BLACQList',
    react: WelcomeEmail({ displayName }),
  })

  return { success: true, email }
}
