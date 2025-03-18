import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
  imports: [CommonModule],
  standalone: true
})
export class FileUploadComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  isDragging = false;
  isProcessing = false;
  files: File[] = [];

  constructor(private translationService: TranslationService) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = Array.from(event.dataTransfer?.files || []);
    this.handleFiles(files);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  removeFile(index: number): void {
    this.files = this.files.filter((_, i) => i !== index);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  openFileInput(): void {
    this.fileInput?.nativeElement?.click();
  }

  private async handleFiles(files: File[]): Promise<void> {
    const jsonFiles = files.filter(file => file.name.endsWith('.json'));
    if (jsonFiles.length === 0) {
      alert('Please select JSON files only');
      return;
    }

    try {
      this.isProcessing = true;
      this.files = jsonFiles;
      await this.translationService.processFiles(jsonFiles);
    } catch (error) {
      console.error('Error processing files:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
