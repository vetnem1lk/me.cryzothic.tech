// The only dictionary on the entry path: FastPath strip copy. Everything else lives
// in content.json inside the lazy Board chunk. Keep this file tiny — every byte here
// is paid by a visitor who may never scroll past the header.
//
// The two CV menu labels are NOT here on purpose: «English · PDF» / «Русский · PDF»
// name the language of the *file*, not of the site, so they read the same either way.
import type { Lang } from './locale';

export const STRIP: Record<
  Lang,
  { name: string; role: string; cvMenu: string; quickActions: string; email: string }
> = {
  en: {
    name: 'Vladislav Klimentev',
    role: 'C++ Developer · Tools / Gameplay',
    cvMenu: 'CV language',
    quickActions: 'Quick actions',
    email: 'Email',
  },
  ru: {
    name: 'Владислав Климентьев',
    role: 'C++ разработчик · инструменты / геймплей',
    cvMenu: 'Язык резюме',
    quickActions: 'Быстрые действия',
    email: 'Почта',
  },
} as const;
