import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"

import { Container } from "@/components/layout/container"
import { SearchBar } from "@/components/discovery/SearchBar"
import { DiscoveryGrid } from "@/components/discovery/DiscoveryGrid"
import { queryListings, LISTINGS_PAGE_SIZE } from "@/lib/listings/query"
import { buildPageUrl } from "@/lib/listings/pagination"

export const metadata: Metadata = {
  title: "Search | The BLACQList",
  description:
    "Search for Black-owned businesses by name, category, city, or keyword across The BLACQList national directory.",
}

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    type?: string
    category?: string
    city?: string
    page?: string
  }>
}

async function SearchResults({
  searchParams,
}: {
  searchParams: SearchPageProps["searchParams"]
}) {
  const params = await searchParams
  const query = params.q?.trim() ?? ""

  if (!query) {
    return (
      <div className="py-16 text-center">
        <p className="font-headline text-xl text-brand-black mb-2">
          What are you looking for?
        </p>
        <p className="font-subhead text-sm text-charcoal">
          Enter a name, category, or keyword above to search the directory.
        </p>
        <p className="font-subhead text-sm text-charcoal mt-4">
          Or{" "}
          <Link
            href="/discover"
            className="text-amber-gold underline underline-offset-2 hover:text-light-gold"
          >
            browse all businesses
          </Link>{" "}
          to explore by category or type.
        </p>
      </div>
    )
  }

  const page = parseInt(params.page ?? "1", 10)

  const result = await queryListings({
    q: query,
    type: params.type,
    category: params.category,
    city: params.city,
    page,
  })

  const nextPageUrl =
    result.total > page * LISTINGS_PAGE_SIZE
      ? buildPageUrl(params, page + 1)
      : undefined

  return (
    <DiscoveryGrid
      entities={result.entities}
      total={result.total}
      query={query}
      nextPageUrl={nextPageUrl}
      currentPage={page}
    />
  )
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <>
      {/* Search bar */}
      <div className="border-b border-charcoal/10 bg-white">
        <Container className="py-4">
          <Suspense>
            <SearchBar
              placeholder="Search businesses, categories, or cities…"
              targetPath="/search"
            />
          </Suspense>
        </Container>
      </div>

      {/* Results */}
      <Container className="py-8">
        <Suspense
          fallback={
            <DiscoveryGrid entities={[]} total={0} isLoading />
          }
        >
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  )
}
