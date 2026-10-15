// Limits shared by the site import actions and the step 0 screen (ticket 127).
// They live here because a 'use server' file may export only async functions.

/** Logo, cover, and up to four gallery photos in one go. */
export const MAX_PHOTOS_PER_IMPORT = 6
