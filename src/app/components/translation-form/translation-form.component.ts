import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../services/translation.service';
import { MissingTranslation } from '../../models/translation.interface';

@Component({
  selector: 'app-translation-form',
  templateUrl: './translation-form.component.html',
  styleUrl: './translation-form.component.scss',
  imports: [CommonModule, FormsModule],
  standalone: true
})
export class TranslationFormComponent implements OnInit {
  protected readonly Object = Object;
  missingTranslations: MissingTranslation[] = [];
  newTranslations: { [key: string]: string } = {};
  translationHistory: { [key: string]: string[] } = {};
  changedCount = 0;
  hasChanges = false;

  constructor(private translationService: TranslationService) {}

  ngOnInit(): void {
    this.translationService.getMissingTranslations().subscribe(translations => {
      this.missingTranslations = translations;
      this.initializeNewTranslations();
    });

    this.translationService.getHasChanges().subscribe(hasChanges => {
      this.hasChanges = hasChanges;
    });

    setInterval(() => {
      this.changedCount = this.translationService.getChangedTranslationsCount();
    }, 500);
  }

  private initializeNewTranslations(): void {
    this.missingTranslations.sort((a,b) => a.language.localeCompare(b.language)).forEach(item => {
      this.newTranslations[`${item.key}_${item.language}`] = '';
    });
  }

  updateTranslation(key: string, language: string, value: string): void {
    if (!value?.trim()) return;

    const historyKey = `${key}_${language}`;
    if (!this.translationHistory[historyKey]) {
      this.translationHistory[historyKey] = [];
    }

    // Add to history only if it's different from the last entry
    const lastEntry = this.translationHistory[historyKey][0];
    if (value !== lastEntry) {
      this.translationHistory[historyKey].unshift(value);
      // Keep only last 5 translations in history
      if (this.translationHistory[historyKey].length > 5) {
        this.translationHistory[historyKey].pop();
      }
    }

    this.translationService.updateTranslation(key, language, value);
    setTimeout(() => {
      const inputs = document.getElementsByTagName('input')
      if (inputs.length) {
        inputs[0].focus();
      }
    })

  }

  restoreTranslation(key: string, language: string, value: string): void {
    this.newTranslations[`${key}_${language}`] = value;
    this.updateTranslation(key, language, value);
  }

  async downloadTranslations(): Promise<void> {
    const zipBlob = await this.translationService.generateZipFile();
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'translations.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  }

  hasTranslations(): boolean {
    return this.missingTranslations.length > 0;
  }


  getChangedTranslations(): { key: string; language: string; oldValue: string; newValue: string; }[] {
    return this.translationService.getTranslationChanges();
  }

  undoChange(change: { key: string; language: string; oldValue: string; newValue: string }): void {
    this.translationService.undoTranslation(change.key, change.language);
  }

  getKeyParts(key: string): string[] {
    return key.split('.');
  }
}
