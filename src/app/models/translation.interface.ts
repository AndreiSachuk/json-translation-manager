export interface TranslationFile {
  language: string;
  content: { [key: string]: string | undefined };
}

export interface MissingTranslation {
  key: string;
  language: string;
  existingTranslations: { [lang: string]: string };
}
