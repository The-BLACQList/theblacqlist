import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: string
  align?: "left" | "center"
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  align = "left",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      <h1 className="font-headline text-3xl md:text-4xl font-bold text-brand-black leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="font-subhead text-base md:text-lg text-charcoal mt-2">
          {subtitle}
        </p>
      )}
    </div>
  )
}
