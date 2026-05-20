import { cn } from "@/lib/utils"
import { Container } from "@/components/layout/container"

type SectionVariant = "white" | "cream" | "deep-bg" | "pale-lavender" | "brand-black"

interface SectionProps {
  children: React.ReactNode
  variant?: SectionVariant
  id?: string
  as?: React.ElementType
  className?: string
}

const variantClasses: Record<SectionVariant, string> = {
  white: "bg-white",
  cream: "bg-cream",
  "deep-bg": "bg-deep-bg",
  "pale-lavender": "bg-pale-lavender",
  "brand-black": "bg-brand-black",
}

export function Section({
  children,
  variant = "white",
  id,
  as: Tag = "section",
  className,
}: SectionProps) {
  return (
    <Tag id={id} className={cn(variantClasses[variant], className)}>
      <Container className="py-12 md:py-16">{children}</Container>
    </Tag>
  )
}
