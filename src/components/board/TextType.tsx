// React Bits "TextType" trimmed to its one job here: loop-type a single label
// string (type → pause → delete → retype), which is how the terminal's empty
// input still reads as alive. Multi-text arrays and the rest of the donor's
// options are gone — nothing in this site needed them.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';

interface TextTypeProps {
  text: string;
  className?: string;
  typingSpeed?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  variableSpeed?: { min: number; max: number };
  cursorCharacter?: string;
  cursorBlinkDuration?: number;
}

// ponytail: `reduced` is read per render (not subscribed); a live OS toggle
// applies on the next remount (mode switch / route) — fine for a decorative label.
export default function TextType({
  text,
  className = '',
  typingSpeed = 85,
  pauseDuration = 1700,
  deletingSpeed = 50,
  variableSpeed,
  cursorCharacter = '_',
  cursorBlinkDuration = 0.5,
}: TextTypeProps) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(reduced ? text : '');
  const [deleting, setDeleting] = useState(false);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const scope = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (reduced || !cursorRef.current) return;
      gsap.to(cursorRef.current, {
        opacity: 0,
        duration: cursorBlinkDuration,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
      });
    },
    { scope },
  );

  useEffect(() => {
    if (reduced) return;
    let t: ReturnType<typeof setTimeout>;
    if (deleting) {
      t = setTimeout(() => {
        setShown((s) => s.slice(0, -1));
        if (shown.length <= 1) setDeleting(false);
      }, deletingSpeed);
    } else if (shown.length < text.length) {
      const speed = variableSpeed
        ? Math.random() * (variableSpeed.max - variableSpeed.min) + variableSpeed.min
        : typingSpeed;
      t = setTimeout(() => setShown(text.slice(0, shown.length + 1)), speed);
    } else {
      t = setTimeout(() => setDeleting(true), pauseDuration);
    }
    return () => clearTimeout(t);
  }, [shown, deleting, text, reduced, typingSpeed, deletingSpeed, pauseDuration, variableSpeed]);

  return (
    <span ref={scope} className={className} aria-hidden="true">
      <span className="bg-linear-to-r from-accent to-sep-mint bg-clip-text text-transparent">
        {shown}
      </span>
      {!reduced && (
        <span ref={cursorRef} className="ml-0.5 inline-block text-accent">
          {cursorCharacter}
        </span>
      )}
    </span>
  );
}
