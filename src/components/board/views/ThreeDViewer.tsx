// The island root behind the ThreeDView gate: everything three.js lives on
// this side of the dynamic import. V1.2 ships the wiring; the scene follows.
import { useT } from '../../../i18n/I18nContext';

export default function ThreeDViewer() {
  const t = useT();
  return (
    <p className="absolute inset-0 grid place-items-center font-mono text-sm tracking-widest text-neutral-500 uppercase">
      {t('threed.boot')}
    </p>
  );
}
