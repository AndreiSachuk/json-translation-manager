export interface TranslationFile {
  language: string;
  content: { [key: string]: string };
}

export interface MissingTranslation {
  key: string;
  language: string;
  existingTranslations: { [lang: string]: string };
}
