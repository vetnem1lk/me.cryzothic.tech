// The engine bay: a wireframe cube that tilts under the pointer. Hand-drawn
// SVG instead of a 3D library on purpose: the whole view costs the board
// chunk almost nothing — which is the point.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import { useT } from '../../../i18n/I18nContext';

// No infinite loops here, and not a .cursor-target: it performs no action.
export default function ThreeDView() {
  const t = useT();
  const scope = useRef<HTMLElement>(null);
  const cubeRef = useRef<SVGSVGElement>(null);
  const qx = useRef<((v: number) => void) | null>(null);
  const qy = useRef<((v: number) => void) | null>(null);

  useGSAP(
    () => {
      if (!cubeRef.current) return;
      if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
      gsap.set(cubeRef.current, { transformPerspective: 600 });
      qx.current = gsap.quickTo(cubeRef.current, 'rotationX', {
        duration: 0.4,
        ease: 'power2.out',
      });
      qy.current = gsap.quickTo(cubeRef.current, 'rotationY', {
        duration: 0.4,
        ease: 'power2.out',
      });
    },
    { scope },
  );

  function tilt(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    qy.current?.(((e.clientX - r.left) / r.width - 0.5) * 12);
    qx.current?.((0.5 - (e.clientY - r.top) / r.height) * 12);
  }

  function reset() {
    qx.current?.(0);
    qy.current?.(0);
  }

  return (
    <section ref={scope} className="flex flex-col items-center gap-4 p-8">
      <div onMouseMove={tilt} onMouseLeave={reset} className="p-6">
        <svg ref={cubeRef} width="180" height="200" viewBox="0 0 180 200" aria-hidden="true">
          <g stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="6 4" fill="none">
            <path d="M90 10 L170 55 L170 145 L90 190 L10 145 L10 55 Z" />
            <path d="M90 10 L90 100 M10 55 L90 100 L170 55 M90 100 L90 190" />
          </g>
          <g fill="var(--color-accent)">
            {[
              [90, 10],
              [170, 55],
              [170, 145],
              [90, 190],
              [10, 145],
              [10, 55],
              [90, 100],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />
            ))}
          </g>
        </svg>
      </div>
      <p className="font-mono text-sm tracking-widest text-neutral-400 uppercase">
        {t('threed.mode')}
      </p>
      <p className="max-w-md text-center text-base text-neutral-400">{t('threed.note')}</p>
    </section>
  );
}
