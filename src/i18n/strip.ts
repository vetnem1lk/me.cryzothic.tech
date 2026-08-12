// The only dictionary on the entry path: FastPath strip copy plus the one line that
// covers the wait for the board. Everything else lives in content.json inside the lazy
// Board chunk — which is exactly why `loading` is here and not there: it is the label
// shown *while that chunk is still in flight*. Keep this file tiny — every byte here
// is paid by a visitor who may never scroll past the header.
//
// The two CV menu labels are NOT here on purpose: «English · PDF» / «Русский · PDF»
// name the language of the *file*, not of the site, so they read the same either way.
// «Tools / Gameplay» is left untranslated in the RU role: it is the trade's own name.
import type { Lang } from './locale';

export const STRIP: Record<
  Lang,
  {
    name: string;
    role: string;
    cvMenu: string;
    quickActions: string;
    email: string;
    loading: string;
  }
> = {
  en: {
    name: 'Vladislav Klimentev',
    role: 'C++ Developer · Tools / Gameplay',
    cvMenu: 'CV language',
    quickActions: 'Quick actions',
    email: 'Email',
    loading: 'loading board…',
  },
  ru: {
    name: 'Владислав Климентьев',
    role: 'C++ разработчик · Tools / Gameplay',
    cvMenu: 'Язык резюме',
    quickActions: 'Быстрые действия',
    email: 'Почта',
    loading: 'загрузка панели…',
  },
};
