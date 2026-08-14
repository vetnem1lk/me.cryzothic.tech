// The segmented-control skin: one dashed pill split in two — or three, once the
// render cluster's tone selector arrived: a middle segment is just an unrounded
// end. Accent marks the live one. Clip, character, head and tone all wear it.
export const segClass = (active: boolean, side: 'l' | 'm' | 'r') =>
  `cursor-target border border-dashed px-2 py-0.5 ${
    side === 'l' ? 'rounded-l border-r-0' : side === 'm' ? 'border-r-0' : 'rounded-r'
  } ${
    active
      ? 'border-accent/60 text-accent'
      : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
  }`;

// The other skin in the bay: a standalone dashed chip, worn by anything that is
// an independent on/off rather than one of a set — presets, bloom, auto-rotate,
// and the two head slots. Same dashed-lilac vocabulary, no shared border seam.
export const chipClass = (active: boolean) =>
  `cursor-target rounded border border-dashed px-2 py-0.5 ${
    active
      ? 'border-accent/60 text-accent'
      : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
  }`;
