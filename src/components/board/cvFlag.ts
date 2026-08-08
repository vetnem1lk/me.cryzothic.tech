// Did the visitor take a CV? One boolean, set by the download links and read by
// the story store — its own module because the links live in the entry bundle and
// the store does not: this file is what the entry pays for, and it imports nothing.
// Session-only, like every other bit of progress here: no cookies, no storage.
let taken = false;

export const markCvDownloaded = (): void => {
  taken = true;
};

export const cvDownloaded = (): boolean => taken;

/** Test-only, and unused everywhere else — so the entry bundle tree-shakes it out. */
export const resetCvFlag = (): void => {
  taken = false;
};
