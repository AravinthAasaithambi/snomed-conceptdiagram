import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SnomedConceptDiagramComponent } from './snomed-concept-diagram';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('SnomedConceptDiagramComponent', () => {
  let component: SnomedConceptDiagramComponent;
  let fixture: ComponentFixture<SnomedConceptDiagramComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SnomedConceptDiagramComponent, HttpClientTestingModule]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SnomedConceptDiagramComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
