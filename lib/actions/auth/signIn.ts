'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SignInField = 'email' | 'password' | 'general'

type SignInState = { error: string; field?: SignInField } | { success: true } | null

function isSafeRedirect(next: string | null): next is string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')
}

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''
  const next = formData.get('next')?.toString() ?? null

  if (!email) return { error: 'Email is required.', field: 'email' }
  if (!password) return { error: 'Password is required.', field: 'password' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.includes('Invalid login') || error.message.includes('invalid credentials')) {
      return { error: 'Incorrect email or password.', field: 'general' }
    }
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        error: 'Please verify your email first. Check your inbox.',
        field: 'general',
      }
    }
    return { error: 'Something went wrong. Please try again.', field: 'general' }
  }

  const destination = isSafeRedirect(next) ? next : '/account'
  redirect(destination)
}
