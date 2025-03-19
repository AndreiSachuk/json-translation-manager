import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-preview-modal',
  templateUrl: './file-preview-modal.component.html',
  styleUrl: './file-preview-modal.component.scss',
  standalone: true,
  imports: [CommonModule]
})
export class FilePreviewModalComponent {
  @Input() show = false;
  @Input() fileName = '';
  @Input() content: any;
  @Output() showChange = new EventEmitter<boolean>();

  formattedContent(): string {
    return JSON.stringify(this.content, null, 2);
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.show = false;
    this.showChange.emit(false);
  }
}
