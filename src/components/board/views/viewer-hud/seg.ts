// The segmented-control skin: one dashed pill split in two, accent on the half
// that is live. Clip, character and head all wear it — three call sites is where
// a copied class string stops being cheaper than an import.
export const segClass = (active: boolean, side: 'l' | 'r') =>
  `cursor-target border border-dashed px-2 py-0.5 ${side === 'l' ? 'rounded-l border-r-0' : 'rounded-r'} ${
    active
      ? 'border-accent/60 text-accent'
      : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
  }`;
