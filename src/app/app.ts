import { Component } from '@angular/core';
import { SnomedConceptDiagramComponent } from './snomed-concept-diagram/snomed-concept-diagram';
import { DiagramOptions } from './snomed-concept-diagram/concept-models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SnomedConceptDiagramComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  conceptId = ''; // Initialize empty

  loadConcept(id: string) {
    if (id) {
      this.conceptId = id;
    }
  }

  options: DiagramOptions = {
    defaultLanguage: 'en',
    selectedView: 'inferred',
    serverUrl: 'https://browser.ihtsdotools.org/snowstorm/snomed-ct',
    edition: 'MAIN',
    release: '2026-01-01',
    languages: 'en'
  };
}
