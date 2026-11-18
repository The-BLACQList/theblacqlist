'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'

/**
 * The chapters layout's client behaviour (ticket 204), ported from the
 * script in Creative's prototype v7: current-chapter tracking, the phone
 * chapter list, disclosures, Copy Code, the photo viewer, the review
 * carousel, and motion (rise-in, photo drift, count-ups, the pinned gallery
 * glide). Motion is off when the viewer asks for reduced motion, and follows
 * the setting if it changes. Everything is scoped to the root and undone on
 * unmount.
 */
export function ChaptersBehaviour({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId)
    if (!root) return
    const cleanup: (() => void)[] = []
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | Document | Window,
      type: K | string,
      fn: (e: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions
    ) => {
      el.addEventListener(type, fn as EventListener, opts)
      cleanup.push(() => el.removeEventListener(type, fn as EventListener, opts))
    }
    const $ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = root) =>
      el.querySelector<T & Element>(sel) as T | null
    const $$ = <T extends Element = HTMLElement>(sel: string, el: ParentNode = root) =>
      Array.from(el.querySelectorAll<T & Element>(sel)) as T[]
    const pad = (n: number) => String(n).padStart(2, '0')

    const RM = window.matchMedia('(prefers-reduced-motion: reduce)')
    let motionOn = !RM.matches

    // ── toast ──
    const toastEl = $('[data-toast]')
    let toastTimer = 0
    const toast = (msg: string) => {
      if (!toastEl) return
      toastEl.textContent = msg
      toastEl.classList.add('on')
      window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), 2200)
    }
    cleanup.push(() => window.clearTimeout(toastTimer))

    // ── photo viewer ──
    const lb = $<HTMLDialogElement>('[data-lb]')
    const LB: {
      set: { src: string; alt: string }[]
      i: number
      who: string
      from: HTMLElement | null
    } = {
      set: [],
      i: 0,
      who: '',
      from: null,
    }
    const lbShow = () => {
      const q = LB.set[LB.i]
      if (!lb || !q) return
      const im = $<HTMLImageElement>('[data-lb-img]', lb)
      if (im) {
        im.src = q.src
        im.alt = q.alt
      }
      const cap = $('[data-lb-cap]', lb)
      if (cap) cap.textContent = `Photo From ${LB.who}`
      const alt = $('[data-lb-alt]', lb)
      if (alt) alt.textContent = q.alt
      const n = $('[data-lb-n]', lb)
      if (n) n.textContent = `${LB.i + 1} of ${LB.set.length}`
      $$<HTMLButtonElement>('[data-lbm="-1"],[data-lbm="1"]', lb).forEach((b) => {
        b.hidden = LB.set.length < 2
      })
    }
    const lbStep = (k: number) => {
      LB.i = (LB.i + k + LB.set.length) % LB.set.length
      lbShow()
    }
    if (lb) {
      on(lb, 'close', () => {
        if (LB.from?.isConnected) LB.from.focus()
      })
      on(lb, 'click', (e: MouseEvent) => {
        const t = e.target as HTMLElement
        const b = t.closest<HTMLElement>('[data-lbm]')
        if (b) {
          if (b.dataset.lbm === 'x') lb.close()
          else lbStep(Number(b.dataset.lbm))
          return
        }
        if (t === lb) lb.close()
      })
      on(lb, 'keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') lbStep(1)
        else if (e.key === 'ArrowLeft') lbStep(-1)
      })
    }

    // ── delegated clicks: photos, Copy Code, disclosures, held links ──
    const copyTimers = new Set<number>()
    cleanup.push(() => copyTimers.forEach((t) => window.clearTimeout(t)))
    on(root, 'click', (e: MouseEvent) => {
      const t = e.target as HTMLElement
      const ph = t.closest<HTMLElement>('[data-ph]')
      if (ph && lb) {
        const ul = ph.closest<HTMLElement>('[data-set]')
        if (!ul) return
        try {
          LB.set = JSON.parse(ul.dataset.set ?? '[]')
        } catch {
          return
        }
        LB.i = Number(ph.dataset.ph)
        LB.who = ul.dataset.who ?? ''
        LB.from = ph
        lbShow()
        lb.showModal()
        return
      }
      const cp = t.closest<HTMLElement>('[data-copy]')
      if (cp) {
        const code = cp.dataset.copy ?? ''
        navigator.clipboard?.writeText(code).catch(() => {})
        // Live listings only (the root carries the listing id): the same event
        // DealCodeButton sends on today's page, for the owner's deal counts.
        const listingId = root.dataset.listing
        if (listingId && cp.dataset.deal)
          track({
            event_name: ANALYTICS_EVENTS.DEAL_CODE_COPIED,
            entity_id: listingId,
            entity_type: 'listing',
            properties: { deal_id: cp.dataset.deal },
          })
        toast(`Code ${code} copied`)
        cp.textContent = 'Copied'
        const k = window.setTimeout(() => {
          cp.textContent = 'Copy Code'
          copyTimers.delete(k)
        }, 2000)
        copyTimers.add(k)
        return
      }
      const mb = t.closest<HTMLElement>('.more-btn')
      if (mb) {
        const target = document.getElementById(mb.getAttribute('aria-controls') ?? '')
        if (!target) return
        const open = mb.getAttribute('aria-expanded') === 'true'
        mb.setAttribute('aria-expanded', String(!open))
        target.hidden = open
        const ml = $('.mb-l', mb)
        if (ml) ml.textContent = open ? 'Show the Full Menu' : 'Hide the Full Menu'
        if (!open) target.querySelectorAll('.rv').forEach((x) => x.classList.remove('pre'))
        return
      }
      const off = t.closest<HTMLElement>('[data-off]')
      if (off) {
        e.preventDefault()
        toast('Links are off on the sample page.')
      }
    })

    // ── chapter nav ──
    const chapters = $$('[data-ch]')
    const navLinks = $$('[data-nav]')
    const mbtn = $('.mnav-btn')
    const mlist = $('#mlist')
    const cnav = $('.cnav')
    const hero = $('[data-hero]')
    const titles = new Map(
      navLinks.map((a) => [a.dataset.nav ?? '', a.lastChild?.textContent ?? ''])
    )
    const order = [...new Set(navLinks.map((a) => a.dataset.nav ?? ''))]
    if (mbtn && mlist) {
      const close = () => {
        mbtn.setAttribute('aria-expanded', 'false')
        mlist.hidden = true
      }
      on(mbtn, 'click', () => {
        const open = mbtn.getAttribute('aria-expanded') === 'true'
        mbtn.setAttribute('aria-expanded', String(!open))
        mlist.hidden = open
      })
      on(mlist, 'click', (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('a')) close()
      })
      on(document, 'keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !mlist.hidden) {
          close()
          mbtn.focus()
        }
      })
    }
    const setCur = (id: string) => {
      const i = order.indexOf(id)
      if (i < 0) return
      navLinks.forEach((a) => {
        if (a.dataset.nav === id) a.setAttribute('aria-current', 'true')
        else a.removeAttribute('aria-current')
      })
      if (mbtn) {
        const n = $('.n', mbtn)
        const t = $('.t', mbtn)
        if (n) n.textContent = pad(i + 1)
        if (t) t.textContent = titles.get(id) ?? ''
      }
    }
    // Back above chapter 01, the chapter nav returns to how it first rendered:
    // no current chapter, and the phone button on 01.
    let atTop = true
    const resetCur = () => {
      navLinks.forEach((a) => a.removeAttribute('aria-current'))
      const first = order[0]
      if (mbtn && first) {
        const n = $('.n', mbtn)
        const t = $('.t', mbtn)
        if (n) n.textContent = pad(1)
        if (t) t.textContent = titles.get(first) ?? ''
      }
    }
    const checkTop = () => {
      const c0 = chapters[0]
      if (!c0) return
      const above = c0.getBoundingClientRect().top > window.innerHeight * 0.5
      if (above && !atTop) resetCur()
      atTop = above
    }
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => e.isIntersecting && setCur((e.target as HTMLElement).dataset.ch ?? '')),
      { rootMargin: '-45% 0px -50% 0px' }
    )
    chapters.forEach((c) => io.observe(c))
    cleanup.push(() => io.disconnect())
    if (hero && cnav) {
      const hio = new IntersectionObserver(
        (es) => es.forEach((e) => cnav.classList.toggle('past', !e.isIntersecting)),
        { rootMargin: '-120px 0px 0px 0px' }
      )
      hio.observe(hero)
      cleanup.push(() => hio.disconnect())
    }

    // ── glide buttons ──
    $$('.glide').forEach((gl) => {
      const tr = $('.glide-track', gl)
      const bs = $$<HTMLButtonElement>('[data-g]', gl)
      if (!tr || bs.length < 2) return
      const upd = () => {
        bs[0]!.disabled = tr.scrollLeft < 4
        bs[1]!.disabled = tr.scrollLeft > tr.scrollWidth - tr.clientWidth - 4
      }
      on(tr, 'scroll', upd, { passive: true })
      upd()
      bs.forEach((b) =>
        on(b, 'click', () =>
          tr.scrollBy({
            left: Number(b.dataset.g) * tr.clientWidth * 0.8,
            behavior: motionOn ? 'smooth' : 'auto',
          })
        )
      )
    })

    // ── review carousel: advances when the progress line fills (motion on only);
    // holds on pause, hover, focus inside a review, off screen, or while the viewer is open ──
    const fits: (() => void)[] = []
    $$('.rc').forEach((rc) => {
      const tr = $('.rc-track', rc)
      const view = $('.rc-view', rc)
      const bar = $('.rc-prog span', rc)
      const pos = $('.rc-pos', rc)
      const st = $('.rc-n', rc)
      if (!tr || !view || !bar || !pos || !st) return
      const its = Array.from(tr.children) as HTMLElement[]
      if (!its.length) return
      let i = 0
      let user = false
      let hov = false
      let foc = false
      let vis = false
      const per = () =>
        Math.max(
          1,
          Math.round((tr.clientWidth + 24) / (its[0]!.getBoundingClientRect().width + 24))
        )
      const fit = () => {
        const k = per()
        const max = Math.max(0, its.length - k)
        if (i > max) i = max
        tr.style.transform = `translateX(${-its[i]!.offsetLeft}px)`
        its.forEach((li, j) => {
          const shown = j >= i && j < i + k
          li.inert = !shown
          li.setAttribute('aria-hidden', String(!shown))
        })
        pos.textContent = k > 1 ? `${i + 1}–${Math.min(its.length, i + k)}` : `${i + 1}`
      }
      const restart = () => {
        bar.style.animation = 'none'
        void bar.offsetWidth
        bar.style.animation = ''
      }
      let fadeTimer = 0
      cleanup.push(() => window.clearTimeout(fadeTimer))
      const go = (k: number, manual: boolean) => {
        const max = Math.max(0, its.length - per())
        const wrap = k > max || k < 0
        i = k > max ? 0 : k < 0 ? max : k
        st.setAttribute('aria-live', manual ? 'polite' : 'off')
        rc.classList.toggle('rc-man', manual)
        if (wrap && motionOn) {
          tr.classList.add('rc-fade')
          fadeTimer = window.setTimeout(() => {
            tr.classList.add('rc-jump')
            fit()
            void tr.offsetWidth
            tr.classList.remove('rc-jump', 'rc-fade')
          }, 600)
        } else fit()
        restart()
      }
      const hold = () => rc.classList.toggle('hold', user || hov || foc || !vis)
      on(bar, 'animationend', () => {
        if (motionOn && !lb?.open) go(i + 1, false)
        else restart()
      })
      on(rc, 'click', (e: MouseEvent) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rc]')
        if (!b) return
        if (b.dataset.rc === 'p') {
          user = !user
          b.textContent = user ? 'Play Reviews' : 'Pause Reviews'
          hold()
          return
        }
        go(i + Number(b.dataset.rc), true)
      })
      on(view, 'pointerenter', () => {
        hov = true
        hold()
      })
      on(view, 'pointerleave', () => {
        hov = false
        hold()
      })
      on(rc, 'focusin', (e: FocusEvent) => {
        foc = !!(e.target as HTMLElement).closest('.rc-track')
        hold()
      })
      on(rc, 'focusout', (e: FocusEvent) => {
        const next = e.relatedTarget as Node | null
        if (!next || !tr.contains(next)) {
          foc = false
          hold()
        }
      })
      const o = new IntersectionObserver(
        (es) => {
          vis = !!es[0]?.isIntersecting
          hold()
        },
        { threshold: 0.35 }
      )
      o.observe(rc)
      cleanup.push(() => o.disconnect())
      fits.push(fit)
      fit()
      hold()
    })

    // ── motion ──
    let rio: IntersectionObserver | null = null
    const countObs: IntersectionObserver[] = []
    let raf = 0
    cleanup.push(() => {
      rio?.disconnect()
      countObs.forEach((o) => o.disconnect())
      if (raf) cancelAnimationFrame(raf)
    })

    const setupGlides = () => {
      $$('.glide').forEach((gl) => {
        const pinned = motionOn && window.innerWidth >= 1024
        gl.classList.toggle('pinned', pinned)
        const tr = $('.glide-track', gl)
        const pin = $('.glide-pin', gl)
        if (!tr || !pin) return
        if (pinned) {
          tr.scrollLeft = 0
          const dist = Math.max(0, tr.scrollWidth - window.innerWidth)
          gl.dataset.dist = String(dist)
          pin.style.height = `calc(${dist}px + 100svh - var(--hdr) - var(--navh))`
        } else {
          pin.style.height = ''
          tr.style.removeProperty('--gx')
        }
      })
    }

    const onScroll = () => {
      raf = 0
      const vh = window.innerHeight
      const sy = window.scrollY
      const doc = document.documentElement.scrollHeight - vh
      const p = doc > 0 ? Math.min(1, sy / doc) : 0
      $$('.prog span').forEach((s) => s.style.setProperty('--prog', String(p)))
      checkTop()
      if (!motionOn) {
        // Without motion the steps line stays full (the CSS default).
        $$('.steps').forEach((st) => st.style.removeProperty('--fill'))
        return
      }
      if (hero) {
        const top = hero.getBoundingClientRect().top + sy
        const h = hero.offsetHeight
        hero.style.setProperty('--hp', Math.max(0, Math.min(1, (sy - top) / h)).toFixed(4))
      }
      $$('.drift').forEach((f) => {
        if (f.closest('[data-hero]') && !f.classList.contains('c-a') && !f.closest('.c-hero'))
          return
        const r = f.getBoundingClientRect()
        if (r.bottom < -100 || r.top > vh + 100) return
        const c = (r.top + r.height / 2 - vh / 2) / vh
        $('img', f)?.style.setProperty('--dy', `${(c * -6).toFixed(2)}%`)
      })
      $$('.glide.pinned').forEach((gl) => {
        const st = $('.glide-sticky', gl)
        const tr = $('.glide-track', gl)
        const pin = $('.glide-pin', gl)
        if (!st || !tr || !pin) return
        const dist = Number(gl.dataset.dist) || 0
        const top = pin.getBoundingClientRect().top
        const stickTop = parseFloat(getComputedStyle(st).top) || 0
        const k = Math.max(0, Math.min(1, (stickTop - top) / Math.max(1, dist)))
        tr.style.setProperty('--gx', `${(-k * dist).toFixed(1)}px`)
      })
      // The How We Work line fills as its steps scroll through the view.
      $$('.steps').forEach((st) => {
        const r = st.getBoundingClientRect()
        const k = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.35)))
        st.style.setProperty('--fill', k.toFixed(3))
      })
    }

    const applyMotion = () => {
      root.classList.toggle('motion', motionOn)
      rio?.disconnect()
      rio = null
      const rvs = $$('.rv, .crit')
      if (motionOn && 'IntersectionObserver' in window) {
        const vh = window.innerHeight
        rvs.forEach((el) => {
          if (el.getBoundingClientRect().top > vh * 0.92) el.classList.add('pre')
        })
        const obs = new IntersectionObserver(
          (es) =>
            es.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.remove('pre')
                obs.unobserve(e.target)
              }
            }),
          { rootMargin: '0px 0px -8% 0px' }
        )
        rio = obs
        rvs.filter((el) => el.classList.contains('pre')).forEach((el) => obs.observe(el))
        $$('[data-count]').forEach((el) => {
          if (el.dataset.done) return
          const run = () => {
            el.dataset.done = '1'
            const v = parseFloat(el.dataset.count ?? '0')
            const dec = Number(el.dataset.dec ?? 0)
            const suf = el.dataset.suf ?? ''
            const fin = el.textContent
            const t0 = performance.now()
            const step = (t: number) => {
              const k = Math.min(1, (t - t0) / 1500)
              const eased = 1 - Math.pow(1 - k, 3)
              el.textContent = (v * eased).toFixed(dec) + suf
              if (k < 1 && el.isConnected) requestAnimationFrame(step)
              else el.textContent = fin
            }
            requestAnimationFrame(step)
          }
          const o = new IntersectionObserver(
            (es) => {
              if (es[0]?.isIntersecting) {
                o.disconnect()
                run()
              }
            },
            { threshold: 0.6 }
          )
          o.observe(el)
          countObs.push(o)
        })
      } else {
        rvs.forEach((el) => el.classList.remove('pre'))
      }
      setupGlides()
      onScroll()
    }

    on(
      window,
      'scroll',
      () => {
        if (!raf) raf = requestAnimationFrame(onScroll)
      },
      { passive: true }
    )
    let rt = 0
    on(window, 'resize', () => {
      window.clearTimeout(rt)
      rt = window.setTimeout(() => {
        setupGlides()
        onScroll()
        fits.forEach((f) => f())
      }, 150)
    })
    cleanup.push(() => window.clearTimeout(rt))
    const onRM = () => {
      motionOn = !RM.matches
      applyMotion()
    }
    RM.addEventListener('change', onRM)
    cleanup.push(() => RM.removeEventListener('change', onRM))

    applyMotion()
    // Marks the page hydrated and wired up; the e2e specs wait for it.
    root.dataset.ready = '1'

    return () => {
      cleanup.forEach((f) => f())
      root.classList.remove('motion')
      delete root.dataset.ready
    }
  }, [rootId])

  return null
}
