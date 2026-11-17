// Which language the page speaks. A person who chose one in settings gets it;
// anybody else, and anybody not signed in, gets the browser's, narrowed to
// the three we have. The flag on their row tells a choice from a default.

import { createContext, useContext } from "react";
import { nearestLanguage, t as translate, type Language, type StringKey } from "../shared/strings";
import type { Me } from "../shared/types";

export const LanguageContext = createContext<Language>("en");

export function browserLanguage(): Language {
  return nearestLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

export function languageFor(me: Me | null): Language {
  return me?.languageChosen && me.language ? nearestLanguage([me.language]) : browserLanguage();
}

export function useT() {
  const language = useContext(LanguageContext);
  return {
    language,
    t: (key: StringKey, values?: Record<string, string | number>) => translate(language, key, values),
  };
}
