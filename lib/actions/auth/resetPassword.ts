"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type ResetPasswordState =
  | { error: string; field?: "password" | "confirmPassword" | "general" }
  | { success: true }
  | null

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = formData.get("password")?.toString() ?? ""
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? ""

  if (password.length < 8)
    return { error: "Password must be at least 8 characters.", field: "password" }
  if (password !== confirmPassword)
    return { error: "Passwords do not match.", field: "confirmPassword" }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    if (
      error.message.toLowerCase().includes("session") ||
      error.message.toLowerCase().includes("token") ||
      error.message.toLowerCase().includes("expired")
    ) {
      return {
        error: "Your reset link has expired. Please request a new one.",
        field: "general",
      }
    }
    return { error: "Something went wrong. Please try again.", field: "general" }
  }

  redirect("/account")
}
