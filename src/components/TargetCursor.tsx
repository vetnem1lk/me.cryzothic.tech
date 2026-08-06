import { useRef, useSyncExternalStore } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

export interface TargetCursorProps {
  targetSelector?: string
  spinDuration?: number
  hoverDuration?: number
  parallaxOn?: boolean
  cursorColor?: string
  cursorColorOnTarget?: string
}

const CORNER = 12 // px — matches h-3 w-3
const BORDER = 3 // px — matches border-[3px]

// Idle corner offsets from the cursor center (TL, TR, BR, BL).
const IDLE_POS = [
  { x: -CORNER * 1.5, y: -CORNER * 1.5 },
  { x: CORNER * 0.5, y: -CORNER * 1.5 },
  { x: CORNER * 0.5, y: CORNER * 0.5 },
  { x: -CORNER * 1.5, y: CORNER * 0.5 },
]

// ponytail: naive selector — also matches button-type inputs; refine when a form
// control other than the V-Agent chat field appears.
const TEXT_ENTRY = 'input, textarea, [contenteditable="true"]'

// Mount only for precise pointers whose user accepts motion; anywhere else the
// component renders nothing and the system cursor is untouched.
const MOUNT_QUERY = '(pointer: fine) and (prefers-reduced-motion: no-preference)'
const getSnapshot = () => window.matchMedia(MOUNT_QUERY).matches
const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(MOUNT_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

export default function TargetCursor({
  targetSelector = '.cursor-target',
  spinDuration = 5,
  hoverDuration = 0.2,
  parallaxOn = true,
  cursorColor = '#ffffff',
  cursorColorOnTarget = '#5980a6',
}: TargetCursorProps) {
  const enabled = useSyncExternalStore(subscribe, getSnapshot)
  const cursorRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)

  useGSAP(
    (_context, contextSafe) => {
      const cursor = cursorRef.current
      const dot = dotRef.current
      if (!enabled || !cursor || !dot || !contextSafe) return

      const corners = Array.from(
        cursor.querySelectorAll<HTMLDivElement>('.target-cursor-corner'),
      )

      // cursor:none lives only while this effect is alive — if the component (or JS
      // as a whole) dies, the system cursor is back.
      const prevBodyCursor = document.body.style.cursor
      document.body.style.cursor = 'none'

      gsap.set(cursor, {
        xPercent: -50,
        yPercent: -50,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      // Tailwind 4 translate-* utilities emit the standalone `translate` property,
      // which would stack with GSAP's transform — so idle offsets are set here.
      corners.forEach((c, i) => gsap.set(c, IDLE_POS[i]))

      let spinTl: gsap.core.Timeline | null = null
      const startSpin = () => {
        spinTl?.kill()
        spinTl = gsap
          .timeline({ repeat: -1 })
          .to(cursor, { rotation: '+=360', duration: spinDuration, ease: 'none' })
      }
      startSpin()

      const xTo = gsap.quickTo(cursor, 'x', { duration: 0.1, ease: 'power3.out' })
      const yTo = gsap.quickTo(cursor, 'y', { duration: 0.1, ease: 'power3.out' })

      let activeTarget: Element | null = null
      let currentLeave: (() => void) | null = null
      let cornerTargets: { x: number; y: number }[] | null = null
      let hiddenForText = false
      const strength = { value: 0 }

      // While locked: each frame nudge corners toward the target rect relative to the
      // live cursor position — the lag against the dot is the parallax feel.
      const tick = () => {
        const ct = cornerTargets
        if (!ct || strength.value === 0) return
        const cx = gsap.getProperty(cursor, 'x') as number
        const cy = gsap.getProperty(cursor, 'y') as number
        corners.forEach((corner, i) => {
          const curX = gsap.getProperty(corner, 'x') as number
          const curY = gsap.getProperty(corner, 'y') as number
          const s = strength.value
          const finalX = curX + (ct[i].x - cx - curX) * s
          const finalY = curY + (ct[i].y - cy - curY) * s
          const duration = s >= 0.99 ? (parallaxOn ? 0.2 : 0) : 0.05
          gsap.to(corner, {
            x: finalX,
            y: finalY,
            duration,
            ease: duration === 0 ? 'none' : 'power1.out',
            overwrite: 'auto',
          })
        })
      }

      const paint = (color: string) => {
        gsap.to(corners, { borderColor: color, duration: 0.15, ease: 'power2.out' })
        gsap.to(dot, { backgroundColor: color, duration: 0.15, ease: 'power2.out' })
      }

      const enter = contextSafe((e: MouseEvent) => {
        const el = e.target as Element

        // System I-beam over text entry: fade the whole custom cursor out.
        const overText = !!el.closest?.(TEXT_ENTRY)
        if (overText !== hiddenForText) {
          hiddenForText = overText
          gsap.to(cursor, { autoAlpha: overText ? 0 : 1, duration: 0.15 })
        }

        // Locked target left the DOM (route change) — force the leave path.
        if (activeTarget && !activeTarget.isConnected) currentLeave?.()

        const target = el.closest?.(targetSelector)
        if (!target || target === activeTarget) return
        currentLeave?.()

        activeTarget = target
        corners.forEach((c) => gsap.killTweensOf(c, 'x,y'))
        spinTl?.pause()
        gsap.set(cursor, { rotation: 0 })
        paint(cursorColorOnTarget)

        const rect = target.getBoundingClientRect()
        const ct = [
          { x: rect.left - BORDER, y: rect.top - BORDER },
          { x: rect.right + BORDER - CORNER, y: rect.top - BORDER },
          { x: rect.right + BORDER - CORNER, y: rect.bottom + BORDER - CORNER },
          { x: rect.left - BORDER, y: rect.bottom + BORDER - CORNER },
        ]
        cornerTargets = ct

        gsap.to(strength, { value: 1, duration: hoverDuration, ease: 'power2.out' })
        gsap.ticker.add(tick)

        const cx = gsap.getProperty(cursor, 'x') as number
        const cy = gsap.getProperty(cursor, 'y') as number
        corners.forEach((corner, i) => {
          gsap.to(corner, {
            x: ct[i].x - cx,
            y: ct[i].y - cy,
            duration: 0.2,
            ease: 'power2.out',
          })
        })

        const leave = contextSafe(() => {
          target.removeEventListener('mouseleave', leave)
          if (activeTarget !== target) return
          activeTarget = null
          currentLeave = null
          gsap.ticker.remove(tick)
          cornerTargets = null
          gsap.killTweensOf(strength)
          strength.value = 0
          paint(cursorColor)
          corners.forEach((c, i) => {
            gsap.killTweensOf(c, 'x,y')
            gsap.to(c, { ...IDLE_POS[i], duration: 0.3, ease: 'power3.out' })
          })
          // Rotation is always 0 while locked, so a plain restart continues the
          // spin seamlessly.
          startSpin()
        })
        currentLeave = leave
        target.addEventListener('mouseleave', leave)
      })

      const move = (e: MouseEvent) => {
        xTo(e.clientX)
        yTo(e.clientY)
      }
      const down = contextSafe(() => {
        gsap.to(dot, { scale: 0.7, duration: 0.3 })
        gsap.to(cursor, { scale: 0.9, duration: 0.2 })
      })
      const up = contextSafe(() => {
        gsap.to(dot, { scale: 1, duration: 0.3 })
        gsap.to(cursor, { scale: 1, duration: 0.2 })
      })

      window.addEventListener('mousemove', move, { passive: true })
      window.addEventListener('mouseover', enter, { passive: true })
      window.addEventListener('mousedown', down, { passive: true })
      window.addEventListener('mouseup', up, { passive: true })

      return () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseover', enter)
        window.removeEventListener('mousedown', down)
        window.removeEventListener('mouseup', up)
        gsap.ticker.remove(tick)
        spinTl?.kill()
        document.body.style.cursor = prevBodyCursor
      }
      // ponytail: no scroll/resize re-sync of a locked rect — every current and
      // planned .cursor-target lives in viewport-fixed chrome; add an
      // elementFromPoint scroll check when scrollable targets appear.
    },
    {
      dependencies: [
        enabled,
        targetSelector,
        spinDuration,
        hoverDuration,
        parallaxOn,
        cursorColor,
        cursorColorOnTarget,
      ],
    },
  )

  if (!enabled) return null

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[9999] h-0 w-0"
      style={{ willChange: 'transform' }}
    >
      <div
        ref={dotRef}
        className="absolute top-1/2 left-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ willChange: 'transform', backgroundColor: cursorColor }}
      />
      <div
        className="target-cursor-corner absolute top-1/2 left-1/2 h-3 w-3 border-[3px] border-r-0 border-b-0"
        style={{ willChange: 'transform', borderColor: cursorColor }}
      />
      <div
        className="target-cursor-corner absolute top-1/2 left-1/2 h-3 w-3 border-[3px] border-b-0 border-l-0"
        style={{ willChange: 'transform', borderColor: cursorColor }}
      />
      <div
        className="target-cursor-corner absolute top-1/2 left-1/2 h-3 w-3 border-[3px] border-t-0 border-l-0"
        style={{ willChange: 'transform', borderColor: cursorColor }}
      />
      <div
        className="target-cursor-corner absolute top-1/2 left-1/2 h-3 w-3 border-[3px] border-r-0 border-t-0"
        style={{ willChange: 'transform', borderColor: cursorColor }}
      />
    </div>
  )
}
