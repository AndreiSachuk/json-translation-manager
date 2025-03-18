import { Component } from '@angular/core';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { TranslationFormComponent } from './components/translation-form/translation-form.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [FileUploadComponent, TranslationFormComponent],
  standalone: true
})
export class AppComponent {
  title = 'Translation Manager';
}
