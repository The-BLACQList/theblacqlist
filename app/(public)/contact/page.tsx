import type { Metadata } from 'next'
import { Mail, MessageSquare, Briefcase, Shield } from 'lucide-react'
import { Section } from '@/components/layout/section'
import { PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = {
  title: 'Contact | The BLACQList',
  description: "Reach the team behind The BLACQList. We'd love to hear from you.",
}

const CONTACT_CHANNELS = [
  {
    icon: MessageSquare,
    heading: 'General inquiries',
    body: 'Questions about the platform, feedback, or anything else.',
    email: 'hello@theblacqlist.com',
    label: 'hello@theblacqlist.com',
  },
  {
    icon: Briefcase,
    heading: 'Business support',
    body: 'Help claiming your page, editing your listing, or navigating your dashboard.',
    email: 'business@theblacqlist.com',
    label: 'business@theblacqlist.com',
  },
  {
    icon: Mail,
    heading: 'Press & media',
    body: 'Press inquiries, interview requests, and media kit.',
    email: 'press@theblacqlist.com',
    label: 'press@theblacqlist.com',
  },
  {
    icon: Shield,
    heading: 'Privacy & legal',
    body: 'Data requests, privacy concerns, and legal inquiries.',
    email: 'privacy@theblacqlist.com',
    label: 'privacy@theblacqlist.com',
  },
]

export default function ContactPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="Contact Us"
          subtitle="We're a small team building something important. We read every message."
        />
      </Section>

      <Section variant="white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
          {CONTACT_CHANNELS.map(({ icon: Icon, heading, body, email, label }) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="group flex flex-col gap-3 rounded-2xl border border-charcoal/10 bg-white p-6 hover:border-amber-gold/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pale-lavender group-hover:bg-amber-gold/10 transition-colors">
                  <Icon className="size-4 text-brand-black" aria-hidden="true" />
                </span>
                <h2 className="font-headline text-base text-brand-black">{heading}</h2>
              </div>
              <p className="font-body text-sm text-charcoal leading-relaxed">{body}</p>
              <span className="font-subhead text-sm font-semibold text-brand-black group-hover:text-amber-gold transition-colors mt-auto">
                {label}
              </span>
            </a>
          ))}
        </div>
      </Section>

      <Section variant="cream">
        <div className="max-w-2xl">
          <h2 className="font-headline text-2xl text-brand-black">Response times</h2>
          <div className="mt-6 space-y-4">
            {[
              { type: 'Business support', time: 'Within 48 hours' },
              { type: 'General inquiries', time: 'Within 3–5 business days' },
              { type: 'Press requests', time: 'Within 2 business days' },
              { type: 'Privacy requests', time: 'Within 30 days' },
            ].map(({ type, time }) => (
              <div
                key={type}
                className="flex items-center justify-between border-b border-charcoal/10 pb-4 last:border-0 last:pb-0"
              >
                <span className="font-subhead text-sm text-charcoal">{type}</span>
                <span className="font-subhead text-sm font-semibold text-brand-black">{time}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  )
}
