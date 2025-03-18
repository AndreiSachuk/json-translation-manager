import { Injectable } from '@angular/core';
import { TranslationFile, MissingTranslation } from '../models/translation.interface';
import { BehaviorSubject, Observable } from 'rxjs';

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

  constructor() {}

  getTranslationFiles(): Observable<TranslationFile[]> {
    return this.translationFiles.asObservable();
  }

  getMissingTranslations(): Observable<MissingTranslation[]> {
    return this.missingTranslations.asObservable();
  }

  async processFiles(files: File[]): Promise<void> {
    const translations: TranslationFile[] = [];
    const errors: ValidationError[] = [];
    
    for (const file of files) {
      try {
        const content = await this.readFileContent(file);
        const language = file.name.split('.')[0];
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

        translations.push({
          language,
          content: this.flattenObject(parsedContent)
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

      this.translationFiles.next(translations);
      this.analyzeMissingTranslations(translations);
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
  }

  updateTranslation(key: string, language: string, value: string): void {
    const files = this.translationFiles.value;
    const fileIndex = files.findIndex(f => f.language === language);
    
    if (fileIndex !== -1) {
      files[fileIndex].content[key] = value;
      this.translationFiles.next([...files]);
      this.analyzeMissingTranslations(files);
    }
  }

  generateUpdatedFiles(): { [filename: string]: string } {
    const files = this.translationFiles.value;
    const result: { [filename: string]: string } = {};

    files.forEach(file => {
      result[`${file.language}.json`] = JSON.stringify(file.content, null, 2);
    });

    return result;
  }
}
