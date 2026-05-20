import Link from "next/link"
import { Mail } from "lucide-react"

interface VerifyEmailPageProps {
  searchParams: Promise<{ email?: string }>
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { email } = await searchParams

  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 rounded-full bg-amber-gold/10 flex items-center justify-center mx-auto mb-4">
        <Mail className="size-7 text-amber-gold" aria-hidden="true" />
      </div>

      <h1 className="font-headline text-[22px] text-brand-black mb-2">
        Check your inbox
      </h1>

      <p className="font-subhead text-sm text-charcoal leading-relaxed">
        We sent a verification link to{" "}
        {email ? (
          <span className="font-semibold text-brand-black">{email}</span>
        ) : (
          "your email address"
        )}
        .
      </p>

      <p className="font-subhead text-sm text-charcoal/60 mt-3 leading-relaxed">
        Click the link in the email to activate your account.
        <br />
        Didn&apos;t receive it? Check your spam folder.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center w-full h-11 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
        >
          Back to sign in
        </Link>
        <Link
          href="/sign-up"
          className="font-subhead text-sm text-charcoal hover:text-brand-black underline underline-offset-2"
        >
          Sign up with a different email
        </Link>
      </div>
    </div>
  )
}
