import { Skeleton } from '@/components/ui/skeleton'

/** /account overview skeleton: the dark greeting + stat strip, then the Collective panel. */
export default function AccountLoading() {
  return (
    <main className="max-w-[960px] flex flex-col gap-12" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your account
      </span>

      <div className="rounded-[4px] bg-deep-bg px-5 pt-8 pb-7 md:px-11 md:pt-11 md:pb-10">
        <Skeleton className="h-3 w-28 bg-off-white/10" />
        <Skeleton className="mt-4 h-11 w-3/4 max-w-[420px] bg-off-white/10" />
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-[#2a2a2d] pt-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-9 w-16 bg-off-white/10" />
              <Skeleton className="h-3 w-24 bg-off-white/10" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-10">
        <div className="flex flex-col gap-3.5 flex-[1_1_340px]">
          <Skeleton className="h-3 w-44 bg-hairline" />
          <Skeleton className="h-8 w-full max-w-[380px] bg-hairline" />
          <Skeleton className="h-4 w-full max-w-[420px] bg-hairline" />
          <Skeleton className="h-4 w-2/3 max-w-[300px] bg-hairline" />
          <div className="flex gap-3 pt-1.5">
            <Skeleton className="h-[46px] w-44 bg-hairline" />
            <Skeleton className="h-[46px] w-36 bg-hairline" />
          </div>
        </div>
        <Skeleton className="flex-[1_1_360px] aspect-[440/240] bg-hairline" />
      </div>
    </main>
  )
}
