import { Injectable } from '@angular/core';
import { TranslationFile, MissingTranslation } from '../models/translation.interface';
import { BehaviorSubject, Observable } from 'rxjs';
import JSZip from 'jszip';

interface ValidationError {
  type: 'structure' | 'duplicate' | 'case';
  message: string;
  key?: string;
  files?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private translationFiles = new BehaviorSubject<TranslationFile[]>([]);
  private missingTranslations = new BehaviorSubject<MissingTranslation[]>([]);
  private validationErrors = new BehaviorSubject<ValidationError[]>([]);
  private hasChanges = new BehaviorSubject<boolean>(false);
  private changedTranslations = new Set<string>();
  private translationChanges = new Map<string, { key: string; language: string; oldValue: string; newValue: string; }>();

  constructor() {}

  getTranslationFiles(): Observable<TranslationFile[]> {
    return this.translationFiles.asObservable();
  }



  getMissingTranslations(): Observable<MissingTranslation[]> {
    return this.missingTranslations.asObservable();
  }

  async processFiles(files: File[]): Promise<void> {
    console.log('Processing files:', files);
    const translations: TranslationFile[] = [];
    const errors: ValidationError[] = [];
    this.changedTranslations.clear();
    this.hasChanges.next(false);

    for (const file of files) {
      try {
        console.log('Processing file:', file.name);
        const content = await this.readFileContent(file);
        const language = file.name.split('.')[0];
        console.log('File content:', content);
        const parsedContent = JSON.parse(content);

        // Validate JSON structure
        if (!this.isValidStructure(parsedContent)) {
          errors.push({
            type: 'structure',
            message: `Invalid JSON structure in file ${file.name}. All values must be strings.`,
            files: [file.name]
          });
          continue;
        }

        const flattenedContent = this.flattenObject(parsedContent);
        console.log('Flattened content:', flattenedContent);
        translations.push({
          language,
          content: flattenedContent
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          type: 'structure',
          message: `Error processing file ${file.name}: ${errorMessage}`,
          files: [file.name]
        });
      }
    }

    if (translations.length > 0) {
      // Check for case sensitivity issues and duplicates
      const caseErrors = this.validateCaseSensitivity(translations);
      errors.push(...caseErrors);

      // Sort translations by language
      const sortedTranslations = translations.sort((a, b) => a.language.localeCompare(b.language));

      console.log('Setting translation files:', sortedTranslations);
      this.translationFiles.next(sortedTranslations);
      this.analyzeMissingTranslations(sortedTranslations);
    }

    this.validationErrors.next(errors);
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  getValidationErrors(): Observable<ValidationError[]> {
    return this.validationErrors.asObservable();
  }

  getHasChanges(): Observable<boolean> {
    return this.hasChanges.asObservable();
  }

  getChangedTranslationsCount(): number {
    return this.changedTranslations.size;
  }

  clearChanges(): void {
    this.changedTranslations.clear();
    this.translationChanges.clear();
    this.hasChanges.next(false);
  }

  getTranslationChanges(): { key: string; language: string; oldValue: string; newValue: string; }[] {
    return Array.from(this.translationChanges.values());
  }

  undoTranslation(key: string, language: string): void {
    const historyKey = `${key}_${language}`;
    const change = this.translationChanges.get(historyKey);

    if (change) {
      this.updateTranslation(key, language, change.oldValue);
      this.changedTranslations.delete(historyKey);
      this.translationChanges.delete(historyKey);
      this.hasChanges.next(this.changedTranslations.size > 0);
    }
  }

  private isValidStructure(obj: any, path: string = ''): boolean {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (!this.isValidStructure(value, path ? `${path}.${key}` : key)) {
          return false;
        }
      } else if (typeof value !== 'string') {
        return false;
      }
    }
    return true;
  }

  private flattenObject(obj: any, prefix: string = ''): { [key: string]: string } {
    const flattened: { [key: string]: string } = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value as string;
      }
    }

    return flattened;
  }

  private unflattenObject(obj: { [key: string]: string | undefined }): any {
    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const parts = key.split('.');
        let current = result;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (i === parts.length - 1) {
            current[part] = value;
          } else {
            current[part] = current[part] || {};
            current = current[part];
          }
        }
      }
    }

    return result;
  }

  private validateCaseSensitivity(files: TranslationFile[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const keyMap = new Map<string, string[]>();

    files.forEach(file => {
      Object.keys(file.content).forEach(key => {
        const lowerKey = key.toLowerCase();
        const existing = keyMap.get(lowerKey) || [];
        if (!existing.includes(key)) {
          existing.push(key);
          keyMap.set(lowerKey, existing);
        }
      });
    });

    keyMap.forEach((keys, lowerKey) => {
      if (keys.length > 1) {
        errors.push({
          type: 'case',
          message: `Case sensitivity issue detected for keys: ${keys.join(', ')}`,
          key: lowerKey
        });
      }
    });

    return errors;
  }

  private analyzeMissingTranslations(files: TranslationFile[]): void {
    const allKeys = new Set<string>();
    files.forEach(file => {
      Object.keys(file.content).forEach(key => allKeys.add(key));
    });

    const missing: MissingTranslation[] = [];

    allKeys.forEach(key => {
      files.forEach(file => {
        if (!file.content[key]) {
          const existingTranslations: { [lang: string]: string } = {};
          files.forEach(otherFile => {
            if (otherFile.content[key]) {
              existingTranslations[otherFile.language] = otherFile.content[key];
            }
          });

          missing.push({
            key,
            language: file.language,
            existingTranslations
          });
        }
      });
    });

    this.missingTranslations.next(missing);
    this.hasChanges.next(this.changedTranslations.size > 0);
  }

  updateTranslation(key: string, language: string, value: string): void {
    const files = this.translationFiles.value;
    const fileIndex = files.findIndex(f => f.language === language);

    if (fileIndex !== -1) {
      const historyKey = `${key}_${language}`;
      const oldValue = files[fileIndex].content[key];
      const trimmedValue = value?.trim() || '';

      // Only mark as changed if the value is different
      if (oldValue !== trimmedValue) {
        // If we're setting an empty value and there was no old value, don't track it
        if (!(trimmedValue === '' && !oldValue)) {
          this.changedTranslations.add(historyKey);
          this.translationChanges.set(historyKey, {
            key,
            language,
            oldValue: oldValue || '',
            newValue: trimmedValue
          });
          this.hasChanges.next(this.changedTranslations.size > 0);
        }
      }

      files[fileIndex].content[key] = trimmedValue || undefined;
      this.translationFiles.next([...files]);
      this.analyzeMissingTranslations(files);
    }
  }

  generateUpdatedFiles(): { [filename: string]: string } {
    const files = this.translationFiles.value;
    const result: { [filename: string]: string } = {};

    files.forEach(file => {
      // Filter out undefined values before unflattening
      const definedContent: { [key: string]: string } = {};
      for (const [key, value] of Object.entries(file.content)) {
        if (value !== undefined) {
          definedContent[key] = value;
        }
      }

      const unflattened = this.unflattenObject(definedContent);
      result[`${file.language}.json`] = JSON.stringify(unflattened, null, 2);
    });

    return result;
  }

  getFilePreview(language: string): any {
    console.log('Getting preview for language:', language);
    console.log('Current translation files:', this.translationFiles.value);
    
    const file = this.translationFiles.value.find(f => f.language === language);
    console.log('Found file:', file);
    
    if (!file) return null;
    
    const definedContent: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(file.content)) {
      if (value !== undefined) {
        definedContent[key] = value;
      }
    }
    
    const result = this.unflattenObject(definedContent);
    console.log('Preview result:', result);
    return result;
  }

  async generateZipFile(): Promise<Blob> {
    const zip = new JSZip();
    const files = this.generateUpdatedFiles();

    for (const [filename, content] of Object.entries(files)) {
      zip.file(filename, content);
    }

    return await zip.generateAsync({ type: 'blob' });
  }
}
