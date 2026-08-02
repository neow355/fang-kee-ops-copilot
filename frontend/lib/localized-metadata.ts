import type { Metadata } from "next";
import { getDictionary, isLocale, type Dictionary } from "./i18n";

export async function localizedMetadata(
  lang: string,
  title: (dictionary: Dictionary) => string,
): Promise<Metadata> {
  if (!isLocale(lang)) return {};
  const dictionary = await getDictionary(lang);
  return {
    title: title(dictionary),
    description: dictionary.meta.description,
  };
}
