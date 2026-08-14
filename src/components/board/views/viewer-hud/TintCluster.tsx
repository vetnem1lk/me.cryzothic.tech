// Outfit tint: five curated presets, plus a custom editor that edits ONE module
// at a time. That last part is the scope fuse — five modules × three zones is
// eighteen pickers, and a panel with eighteen pickers is a paint program, not a
// telemetry bay. `custom` is a state the chips fall out of, never a chip.
import type { Dispatch } from 'react';
import { useT } from '../../../../i18n/I18nContext';
import type { ViewerHandle } from '../../../../three/createViewer';
import { MODULE_IDS, PRESETS, type ModuleId } from '../../../../three/tint';
import type { HudAction, HudState } from './hudState';
import { chipClass } from './seg';

const PRESET_IDS = Object.keys(PRESETS);
const ZONES = [0, 1, 2] as const;

export default function TintCluster({
  hud,
  dispatch,
  viewer,
}: {
  hud: HudState;
  dispatch: Dispatch<HudAction>;
  viewer: ViewerHandle;
}) {
  const t = useT();
  const zones = hud.tintZones[hud.tintModule];

  return (
    <section className="space-y-2 border-t border-dashed border-neutral-800 pt-2 first:border-0 first:pt-0">
      <h3 className="sticky top-[41px] z-10 bg-neutral-950/95 text-[10px] tracking-widest text-neutral-500 uppercase md:static md:bg-transparent">{t('threed.tint')}</h3>
      {/* One scrolling row, not a wrapping block: five chips wrapped to three
          lines and the panel paid for every one — CommandRow's scroller. */}
      <div
        role="group"
        aria-label={t('threed.tint')}
        className="scroll-hide flex flex-nowrap gap-1 overflow-x-auto whitespace-nowrap"
      >
        {PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={hud.tintPreset === id}
            onClick={() => {
              viewer.tint?.applyPreset(id);
              dispatch({ type: 'setTintPreset', value: id });
            }}
            className={chipClass(hud.tintPreset === id)}
          >
            {t(`threed.preset.${id}`)}
          </button>
        ))}
      </div>
      {/* Native select and native colour inputs: the UA chrome is the whole
          point — keyboard, touch and screen readers all come for free. */}
      <select
        name="tint-module"
        value={hud.tintModule}
        aria-label={t('threed.tint')}
        onChange={(event) =>
          dispatch({ type: 'setTintModule', value: event.target.value as ModuleId })
        }
        className="cursor-target w-full rounded border border-dashed border-neutral-700 bg-transparent px-1 py-0.5 text-neutral-400"
      >
        {MODULE_IDS.map((module) => (
          <option key={module} value={module} className="bg-neutral-900">
            {t(`threed.mod.${module}`)}
          </option>
        ))}
      </select>
      {/* Three swatches, one row, one caption. Each picker carries the zone
          index in its own accessible name — a <label> can only name one
          control, so the caption is a plain span and the numbering lives in
          aria-label, joined here and never as interpolation in content.json. */}
      <div className="flex items-center gap-2">
        <span className="text-neutral-400">{t('threed.zone')}</span>
        {ZONES.map((zone) => (
          <input
            key={zone}
            type="color"
            value={zones[zone]}
            aria-label={`${t('threed.zone')} ${zone + 1}`}
            onChange={(event) => {
              const hex = event.target.value;
              viewer.tint?.setZoneColor(hud.tintModule, zone, hex);
              dispatch({ type: 'setTintZone', module: hud.tintModule, zone, hex });
            }}
            className="cursor-target h-8 w-12 border border-dashed border-neutral-700 bg-transparent md:h-5 md:w-10"
          />
        ))}
      </div>
    </section>
  );
}
