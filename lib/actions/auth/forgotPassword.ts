"use server"

import { createClient } from "@/lib/supabase/server"

export type ForgotPasswordState =
  | { error: string; field?: "email" | "general" }
  | { success: true; email: string }
  | null

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = formData.get("email")?.toString().trim() ?? ""
  if (!email) return { error: "Email is required.", field: "email" }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password`

  const supabase = await createClient()
  // Supabase silently succeeds even for unknown emails — prevents email enumeration
  await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  return { success: true, email }
}
