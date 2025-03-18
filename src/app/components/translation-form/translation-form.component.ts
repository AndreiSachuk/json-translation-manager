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

  constructor(private translationService: TranslationService) {}

  ngOnInit(): void {
    this.translationService.getMissingTranslations().subscribe(translations => {
      this.missingTranslations = translations;
      this.initializeNewTranslations();
    });
  }

  private initializeNewTranslations(): void {
    this.missingTranslations.forEach(item => {
      this.newTranslations[`${item.key}_${item.language}`] = '';
    });
  }

  updateTranslation(key: string, language: string, value: string): void {
    this.translationService.updateTranslation(key, language, value);
  }

  downloadTranslations(): void {
    const files = this.translationService.generateUpdatedFiles();
    
    Object.entries(files).forEach(([filename, content]) => {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  hasTranslations(): boolean {
    return this.missingTranslations.length > 0;
  }
}
