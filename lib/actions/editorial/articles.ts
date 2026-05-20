"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/admin/guard"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export type ArticleActionState =
  | { success: true; id?: string; slug?: string }
  | { error: string }
  | null

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createArticleAction(
  _prev: ArticleActionState,
  formData: FormData
): Promise<ArticleActionState> {
  await requireAdmin()

  const title = formData.get("title")?.toString().trim() ?? ""
  const slugInput = formData.get("slug")?.toString().trim()
  const subtitle = formData.get("subtitle")?.toString().trim() || null
  const body = formData.get("body")?.toString().trim() || null
  const authorName = formData.get("author_name")?.toString().trim() || "The BLACQList Team"
  const metaDescription = formData.get("meta_description")?.toString().trim() || null
  const tagsRaw = formData.get("tags")?.toString().trim() || ""
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : null
  const publish = formData.get("action") === "publish"

  if (!title) return { error: "Title is required." }

  const slug = slugInput || slugify(title)
  if (!slug) return { error: "Could not generate a valid slug from the title." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from("editorial_articles")
    .insert({
      title,
      slug,
      subtitle,
      body,
      author_name: authorName,
      meta_description: metaDescription,
      tags,
      status: publish ? "published" : "draft",
      published_at: publish ? new Date().toISOString() : null,
      created_by: user?.id ?? null,
    })
    .select("id, slug")
    .single()

  if (error) {
    if (error.code === "23505") return { error: "An article with that slug already exists." }
    return { error: "Failed to create article. Please try again." }
  }

  revalidatePath("/blacqlight")
  revalidatePath("/admin/blacqlight")
  return { success: true, id: data.id, slug: data.slug }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateArticleAction(
  _prev: ArticleActionState,
  formData: FormData
): Promise<ArticleActionState> {
  await requireAdmin()

  const id = formData.get("id")?.toString() ?? ""
  const title = formData.get("title")?.toString().trim() ?? ""
  const slug = formData.get("slug")?.toString().trim() ?? ""
  const subtitle = formData.get("subtitle")?.toString().trim() || null
  const body = formData.get("body")?.toString().trim() || null
  const authorName = formData.get("author_name")?.toString().trim() || "The BLACQList Team"
  const metaDescription = formData.get("meta_description")?.toString().trim() || null
  const tagsRaw = formData.get("tags")?.toString().trim() || ""
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : null
  const action = formData.get("action")?.toString()

  if (!id) return { error: "Invalid article." }
  if (!title) return { error: "Title is required." }
  if (!slug) return { error: "Slug is required." }

  const serviceClient = createServiceClient()

  // Fetch current status to handle publish/unpublish transitions
  const { data: current } = await serviceClient
    .from("editorial_articles")
    .select("status, published_at")
    .eq("id", id)
    .single()

  let status = current?.status ?? "draft"
  let publishedAt: string | null = current?.published_at ?? null

  if (action === "publish" && status !== "published") {
    status = "published"
    publishedAt = new Date().toISOString()
  } else if (action === "unpublish") {
    status = "draft"
  }

  const { error } = await serviceClient
    .from("editorial_articles")
    .update({ title, slug, subtitle, body, author_name: authorName, meta_description: metaDescription, tags, status, published_at: publishedAt })
    .eq("id", id)

  if (error) {
    if (error.code === "23505") return { error: "An article with that slug already exists." }
    return { error: "Failed to update article. Please try again." }
  }

  revalidatePath("/blacqlight")
  revalidatePath(`/blacqlight/${slug}`)
  revalidatePath("/admin/blacqlight")
  return { success: true }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteArticleAction(
  _prev: ArticleActionState,
  formData: FormData
): Promise<ArticleActionState> {
  await requireAdmin()

  const id = formData.get("id")?.toString() ?? ""
  if (!id) return { error: "Invalid article." }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from("editorial_articles")
    .delete()
    .eq("id", id)

  if (error) return { error: "Failed to delete article. Please try again." }

  revalidatePath("/blacqlight")
  revalidatePath("/admin/blacqlight")
  return { success: true }
}
