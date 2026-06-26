'use client'

import { useActionState, useState } from 'react'
import { Loader2, Trash2, Pencil, Star, CheckCircle, AlertCircle, X } from 'lucide-react'
import { updateServiceAction } from '@/lib/actions/dashboard/updateService'
import { deleteServiceAction } from '@/lib/actions/dashboard/deleteService'

interface Service {
  id: string
  name: string
  description: string | null
  price_display: string | null
  is_featured: boolean | null
  display_order: number
  group_label?: string | null
}

interface Props {
  services: Service[]
}

function DeleteServiceButton({ serviceId }: { serviceId: string }) {
  const [state, formAction, isPending] = useActionState(deleteServiceAction, null)

  return (
    <form action={formAction}>
      <input type="hidden" name="service_id" value={serviceId} />
      {state && 'error' in state && (
        <p className="font-body text-xs text-red-600 mt-1">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        aria-label="Delete service"
        onClick={(e) => {
          if (!window.confirm('Delete this service? This cannot be undone.')) {
            e.preventDefault()
          }
        }}
        className="inline-flex items-center justify-center size-8 rounded-lg text-charcoal-faint hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-4" aria-hidden="true" />
        )}
      </button>
    </form>
  )
}

function ServiceRow({ service }: { service: Service }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, isPending] = useActionState(updateServiceAction, null)

  if (editing) {
    return (
      <li className="rounded-lg border border-amber-gold/30 bg-amber-50/30 px-4 py-3">
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="service_id" value={service.id} />
          <div className="flex items-center gap-2">
            <input
              name="name"
              type="text"
              defaultValue={service.name}
              maxLength={200}
              required
              aria-label="Service name"
              className="flex-1 px-2 py-1.5 rounded-md border border-charcoal/20 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Cancel edit"
              className="inline-flex items-center justify-center size-8 rounded-lg text-charcoal-faint hover:text-charcoal hover:bg-charcoal/5 transition-colors"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <input
            name="description"
            type="text"
            defaultValue={service.description ?? ''}
            placeholder="Description (optional)"
            aria-label="Service description"
            className="w-full px-2 py-1.5 rounded-md border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
          <input
            name="price_display"
            type="text"
            defaultValue={service.price_display ?? ''}
            placeholder="Price (optional)"
            aria-label="Service price"
            className="w-full px-2 py-1.5 rounded-md border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
          <input
            name="group_label"
            type="text"
            defaultValue={service.group_label ?? ''}
            placeholder="Group / section (optional)"
            aria-label="Service group or section"
            className="w-full px-2 py-1.5 rounded-md border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_featured"
              value="true"
              defaultChecked={service.is_featured ?? false}
              className="rounded border-charcoal/30 text-amber focus:ring-amber-gold/40"
            />
            <span className="font-body text-xs text-charcoal-soft">Mark as featured</span>
          </label>

          {state && 'error' in state && (
            <div role="alert" className="flex items-center gap-1.5 text-red-600">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <p className="font-body text-xs">{state.error}</p>
            </div>
          )}
          {state && 'success' in state && (
            <div className="flex items-center gap-1.5 text-green-600">
              <CheckCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <p className="font-body text-xs">Saved.</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-xs hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-start gap-3 rounded-lg border border-charcoal/8 bg-white px-4 py-3 hover:border-charcoal/15 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-subhead font-semibold text-sm text-brand-black truncate">
            {service.name}
          </p>
          {service.is_featured && (
            <Star className="size-3.5 text-amber shrink-0" aria-label="Featured" />
          )}
        </div>
        {service.description && (
          <p className="font-body text-xs text-charcoal-soft mt-0.5 line-clamp-2">
            {service.description}
          </p>
        )}
        {service.price_display && (
          <p className="font-body text-xs text-charcoal-soft mt-1">{service.price_display}</p>
        )}
        {service.group_label && (
          <p className="font-subhead text-[10px] uppercase tracking-wide text-charcoal-faint mt-1">
            {service.group_label}
          </p>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit service"
          className="inline-flex items-center justify-center size-8 rounded-lg text-charcoal-faint hover:text-charcoal hover:bg-charcoal/5 transition-colors"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
        <DeleteServiceButton serviceId={service.id} />
      </div>
    </li>
  )
}

export function OfferingsList({ services }: Props) {
  if (services.length === 0) {
    return (
      <p className="font-body text-sm text-charcoal-soft text-center py-6">
        No services added yet. Add your first one below.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {services.map((service) => (
        <ServiceRow key={service.id} service={service} />
      ))}
    </ul>
  )
}
