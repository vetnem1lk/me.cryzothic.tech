// The chip at the foot of a sector: one link on to the next one, so the case can be
// read straight through without going back up to the nav strip. Where it points is
// commands.ts' NEXT_SECTOR, and what it is called is the same nav label the strip
// uses — this file adds no copy of its own.
import { Link } from 'wouter';
import { useT } from '../../../i18n/I18nContext';
import { NAV_KEY, NEXT_SECTOR, type RoutePath } from '../commands';

export default function NextSector({ route }: { route: RoutePath }) {
  const t = useT();
  const next = NEXT_SECTOR[route];
  if (!next) return null; // dead in practice; TS requires it for Partial
  return (
    // The href is base-relative on purpose: the Router base is what carries '/ru',
    // so a path written bare here is already the Russian one over there.
    <Link
      href={next}
      className="cursor-target self-start font-mono text-sm text-neutral-400 hover:text-neutral-200"
    >
      → {t(NAV_KEY[next])}
    </Link>
  );
}
