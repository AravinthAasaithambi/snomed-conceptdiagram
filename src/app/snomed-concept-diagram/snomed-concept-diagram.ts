import { ChangeDetectorRef, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import * as d3 from 'd3';
import { Concept, DiagramOptions, Relationship, Axiom } from './concept-models';

@Component({
  selector: 'snomed-concept-diagram',
  standalone: true,
  template: `
    <div class="concept-diagram-wrapper">
      @if (isLoading) {
        <div class="loader-container">
          <div class="spinner"></div>
        </div>
      }
      <div [style.display]="isLoading ? 'none' : 'block'">
        @if (concept) {
          <div class="controls">
            <div class="btn-group">
              <button [class.active]="options.selectedView === 'stated'" (click)="toggleView('stated')">Stated</button>
              <button [class.active]="options.selectedView === 'inferred'" (click)="toggleView('inferred')">Inferred</button>
            </div>
            <button (click)="saveAsSvg()">Save as SVG</button>
            <button (click)="saveAsPng()">Save as PNG</button>
          </div>
        }
        <div #diagramContainer class="concept-diagram-container" [id]="divId"></div>
      </div>
    </div>
  `,
  styleUrls: ['./snomed-concept-diagram.css'],
  encapsulation: ViewEncapsulation.None
})
export class SnomedConceptDiagramComponent implements OnChanges {
  @Input() concept: Concept | undefined;
  @Input() conceptId: string = '';
  @Input() options: DiagramOptions = {
    defaultLanguage: 'en',
    selectedView: 'inferred', // 'stated' or 'inferred'
    serverUrl: '',
    edition: '',
    release: '',
    languages: 'en'
  };
  @Input() divId: string = 'diagram-canvas';
  ungroupedAttributesData: any = [];
  isLoading: boolean = false;

  @ViewChild('diagramContainer', { static: true }) diagramContainer!: ElementRef;

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['concept'] || changes['options'] || changes['conceptId']) {
      this.initDiagram();
    }
  }

  private initDiagram() {
    if ((!this.concept && !this.conceptId) || !this.options) return;

    if (this.conceptId) {
      this.loadAllData(this.conceptId);
    } else if (this.concept) {
      this.renderDiagram(this.concept, this.diagramContainer.nativeElement, this.options, []);
    }
  }

  private loadAllData(id: string) {
    this.isLoading = true;
    let branch = this.options.edition;
    if (this.options.release && this.options.release.length > 0 && this.options.release !== 'None') {
      branch = branch + "/" + this.options.release;
    }
    const baseUrl = this.options.serverUrl;
    const browserUrl = `${baseUrl}/browser/${branch}`;
    const coreUrl = `${baseUrl}/${branch}`;

    const form = this.options.selectedView;

    // 1. Concept (using browser endpoint)
    const concept$ = this.http.get<any>(`${browserUrl}/concepts/${id}?descendantCountForm=${form}`);
    // 2. Parents
    const parents$ = this.http.get<any>(`${browserUrl}/concepts/${id}/parents?form=${form}`);
    // 3. Children
    const children$ = this.http.get<any>(`${browserUrl}/concepts/${id}/children?form=${form}`);
    // 4. Ungrouped Attributes (Core) - using referenceSet
    const ungroupedAttrs$ = this.http.get<any>(`${coreUrl}/members?referenceSet=723561005&offset=0&limit=500&active=true&expand=referencedComponent(expand(fsn()))`);
    // 5. Members Check (Limit 1) - Browser
    const membersCheck$ = this.http.get<any>(`${browserUrl}/members?active=true&limit=1`);
    // 6. Code Systems - Global
    const codeSystems$ = this.http.get<any>(`${baseUrl}/codesystems/SNOMEDCT/versions?showFutureVersions=false&showInternalReleases=false`);

    forkJoin({
      concept: concept$,
      parents: parents$,
      children: children$,
      ungroupedAttributes: ungroupedAttrs$,
      membersCheck: membersCheck$,
      codeSystems: codeSystems$
    }).subscribe({
      next: (results) => {
        console.log('All data loaded:', results);
        this.concept = results.concept;
        this.ungroupedAttributesData = results.ungroupedAttributes;
        this.isLoading = false;
        this.cd.detectChanges();

        // Pass ungroupedAttributes to render logic
        setTimeout(() => {
          if (this.concept) {
            this.renderDiagram(this.concept, this.diagramContainer.nativeElement, this.options, this.ungroupedAttributesData);
          }
        }, 100);
      },
      error: (err) => {
        console.error('Error loading diagram data', err);
        this.isLoading = false;
      }
    });
  }

  renderDiagram(concept: Concept, div: HTMLElement, options: DiagramOptions, ungroupedAttributesRaw: any) {
    // Process ungroupedAttributes
    let ungroupedAttributes: any[] = [];
    if (ungroupedAttributesRaw && ungroupedAttributesRaw.items) {
      ungroupedAttributes = ungroupedAttributesRaw.items.filter((attribute: any) => {
        return attribute.additionalFields
          && attribute.additionalFields.hasOwnProperty('grouped')
          && attribute.additionalFields.grouped !== "1";
      });
    }

    // Clear previous SVG
    d3.select(div).selectAll('*').remove();

    var svgIsaModel: Relationship[] = [];
    var svgAttrModel: Relationship[] = [];
    var axioms: Axiom[] = [];

    if (options.selectedView == "stated") {
      if (concept.statedRelationships) {
        concept.statedRelationships.forEach((field: Relationship) => {
          if (field.active == true) {
            if (field.type.conceptId == '116680003') {
              svgIsaModel.push(field);
            } else {
              svgAttrModel.push(field);
            }
          }
        });
      }
      if (concept.classAxioms) {
        concept.classAxioms.forEach((axiom: any) => {
          if (axiom.active) {
            axiom.relationships.forEach((field: any) => {
              if (field.type.conceptId == '116680003') {
                svgIsaModel.push(field);
              } else {
                svgAttrModel.push(field);
              }
            });
          }
        });
      }
      if (concept.gciAxioms) {
        concept.gciAxioms.forEach((axiom: any) => {
          if (axiom.active) {
            axiom.relationships.forEach((field: any) => {
              if (field.type.conceptId == '116680003') {
                svgIsaModel.push(field);
              } else {
                svgAttrModel.push(field);
              }
            });
          }
        });
      }
    } else {
      if (concept.relationships) {
        concept.relationships.forEach((field: Relationship) => {
          if (field.active == true) {
            // 116680003 is 'Is a'
            if (field.type.conceptId == '116680003') {
              svgIsaModel.push(field);
            } else {
              svgAttrModel.push(field);
            }
          }
        });
      }
    }

    // Calculate dimensions similar to JS code
    var height = 350;
    var width = 700;

    svgIsaModel.forEach(() => { height += 50; width += 80; });
    svgAttrModel.forEach(() => { height += 65; width += 110; });



    // Create SVG
    const svg = d3.select(div)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('xmlns', 'http://www.w3.org/2000/svg');

    this.loadDefs(svg);

    // Initial position
    var x = 10;
    var y = 10;
    var maxX = 10;
    var sctClass = "";
    if (concept.definitionStatus === "PRIMITIVE") {
      sctClass = "sct-primitive-concept";
    } else {
      sctClass = "sct-defined-concept";
    }

    // Determine default term
    var pt: any = {};
    if (concept.descriptions) {
      concept.descriptions.forEach((description) => {
        if (description.type === 'SYNONYM' && description.lang == options.defaultLanguage && description.active) {
          for (let key in description.acceptabilityMap) {
            if (description.acceptabilityMap[key] === "PREFERRED") pt = description;
          }
        }
      });
    }

    if (pt.lang === options.defaultLanguage && options.defaultLanguage != 'en' && concept.fsn?.lang != options.defaultLanguage) {
      concept.defaultTerm = pt.term;
    }
    else {
      concept.defaultTerm = concept.fsn ? concept.fsn.term : (concept.pt ? concept.pt.term : concept.conceptId);
    }

    // Draw Root Concept
    var rect1 = this.drawSctBox(svg, x, y, concept.defaultTerm || '', concept.conceptId, sctClass);
    // BBox logic
    let rect1Box = rect1.node()!.getBBox();

    x = x + 90;
    y = y + rect1Box.height + 40;

    var circle2: any;

    if ((options.selectedView === 'stated' && svgIsaModel && svgIsaModel.length > 0) || options.selectedView != 'stated') {
      var circle1;
      if (concept.definitionStatus == "PRIMITIVE") {
        circle1 = this.drawSubsumedByNode(svg, x, y); // 'subsumed by'
      } else {
        circle1 = this.drawEquivalentNode(svg, x, y); // 'equivalent to'
      }
      this.connectElements(svg, rect1, circle1, 'bottom-shifted', 'left', 'BlackTriangle');

      // circle1 is likely a selection.
      x = x + 70; // Increased to show line
      circle2 = this.drawConjunctionNode(svg, x, y); // 'and' node
      this.connectElements(svg, circle1, circle2, 'right', 'center'); // 'right' of c1 to 'center' of c2 (overlap)
      x = x + 60;
    }

    if (!svgIsaModel || svgIsaModel.length === 0) {
      x = x + 20;
      y = y + 3;
    }

    maxX = ((maxX < x) ? x : maxX);

    // Load parents (ISA)
    if (svgIsaModel) {
      svgIsaModel.forEach((relationship) => {
        if (relationship.concreteValue) {
          sctClass = "concrete-domain";
        } else if (relationship.target && relationship.target.definitionStatus == "PRIMITIVE") {
          sctClass = "sct-primitive-concept";
        } else {
          sctClass = "sct-defined-concept";
        }
        let label = relationship.concreteValue
          ? (relationship.concreteValue.dataType === 'STRING' ? "\"" + relationship.concreteValue.value + "\"" : "#" + relationship.concreteValue.value)
          : this.getDefautTermForRelationShip(relationship.target || relationship.destination, options); // sometimes target/destination differ in API

        let targetId = relationship.target ? relationship.target.conceptId : (relationship.destination ? relationship.destination.conceptId : '');

        var rectParent = this.drawSctBox(svg, x, y, label, targetId, sctClass);

        if (circle2) this.connectElements(svg, circle2, rectParent, 'center', 'left', 'ClearTriangle');

        y = y + rectParent.node()!.getBBox().height + 35;
        maxX = ((maxX < x + rectParent.node()!.getBBox().width + 50) ? x + rectParent.node()!.getBBox().width + 50 : maxX);
      });
    }

    // Helper for role groups
    let isUngroupAttribute = (id: string) => {
      for (var i = 0; i < ungroupedAttributes.length; i++) {
        if (ungroupedAttributes[i].referencedComponentId === id) {
          return true;
        }
      }
      return false;
    };

    // Load Attributes
    var roleGroups: number[] = [];
    if (svgAttrModel) {
      svgAttrModel.forEach((relationship) => {
        // Determine class
        if (relationship.concreteValue) {
          sctClass = "concrete-domain";
        } else if (relationship.target && relationship.target.definitionStatus == "PRIMITIVE") {
          sctClass = "sct-primitive-concept";
        } else {
          sctClass = "sct-defined-concept";
        }

        if (relationship.groupId == 0) {
          // Group 0 (Ungrouped)
          let typeLabel = this.getDefautTermForRelationShip(relationship.type, options);
          let targetLabel = relationship.concreteValue
            ? (relationship.concreteValue.dataType === 'STRING' ? "\"" + relationship.concreteValue.value + "\"" : "#" + relationship.concreteValue.value)
            : this.getDefautTermForRelationShip(relationship.target, options);
          let typeId = relationship.type.conceptId;
          let targetId = relationship.target ? relationship.target.conceptId : '';

          if (!isUngroupAttribute(typeId)) {
            var circleSelfgroupAttr = this.drawAttributeGroupNode(svg, x, y);
            if (circle2) this.connectElements(svg, circle2, circleSelfgroupAttr, 'center', 'left', 'BlackTriangle');

            let x2 = x + circleSelfgroupAttr.node()!.getBBox().width + 35;

            var rectAttr = this.drawSctBox(svg, x2, y, typeLabel, typeId, "sct-attribute");
            this.connectElements(svg, circleSelfgroupAttr, rectAttr, 'right', 'left', 'BlackTriangle');

            x2 = x2 + rectAttr.node()!.getBBox().width + 35;
            var rectTarget = this.drawSctBox(svg, x2, y, targetLabel, targetId, sctClass);
            this.connectElements(svg, rectAttr, rectTarget, 'right', 'left', 'BlackTriangle');

            y = y + rectTarget.node()!.getBBox().height + 35;
            // MaxX update ...
          } else {
            var rectAttr = this.drawSctBox(svg, x, y, typeLabel, typeId, "sct-attribute");
            if (circle2) this.connectElements(svg, circle2, rectAttr, 'center', 'left');

            let xOffset = x + rectAttr.node()!.getBBox().width + 35;
            var rectTarget = this.drawSctBox(svg, xOffset, y, targetLabel, targetId, sctClass);
            this.connectElements(svg, rectAttr, rectTarget, 'right', 'left', 'BlackTriangle');

            y = y + rectTarget.node()!.getBBox().height + 35;
          }
        } else {
          if (roleGroups.indexOf(relationship.groupId) === -1) {
            roleGroups.push(relationship.groupId);
          }
        }
      });
    }

    y = y + 30;
    roleGroups.sort((a, b) => a - b);

    roleGroups.forEach((groupId) => {
      var groupNode = this.drawAttributeGroupNode(svg, x, y);
      if (circle2) this.connectElements(svg, circle2, groupNode, 'center', 'left', 'BlackTriangle');
      var conjunctionNode = this.drawConjunctionNode(svg, x + 75, y);
      this.connectElements(svg, groupNode, conjunctionNode, 'right', 'left', 'BlackTriangle');

      svgAttrModel.forEach((relationship) => {
        if (relationship.groupId == groupId) {
          // ... logic for grouped attributes
          let typeLabel = this.getDefautTermForRelationShip(relationship.type, options);
          let targetLabel = relationship.concreteValue
            ? (relationship.concreteValue.dataType === 'STRING' ? "\"" + relationship.concreteValue.value + "\"" : "#" + relationship.concreteValue.value)
            : this.getDefautTermForRelationShip(relationship.target, options);

          if (relationship.concreteValue) sctClass = "concrete-domain";
          else if (relationship.target && relationship.target.definitionStatus == "PRIMITIVE") sctClass = "sct-primitive-concept";
          else sctClass = "sct-defined-concept";

          var rectRole = this.drawSctBox(svg, x + 130, y, typeLabel, relationship.type.conceptId, "sct-attribute");
          this.connectElements(svg, conjunctionNode, rectRole, 'center', 'left', 'BlackTriangle');

          let xTarget = x + 130 + rectRole.node()!.getBBox().width + 35;
          var rectRole2 = this.drawSctBox(svg, xTarget, y, targetLabel, relationship.target ? relationship.target.conceptId : '', sctClass);
          this.connectElements(svg, rectRole, rectRole2, 'right', 'left', 'BlackTriangle');

          y = y + rectRole2.node()!.getBBox().height + 25;
        }
      });
    });

    // Handle Axioms
    // Similar logic to above ...

    // Resize SVG to fit content
    svg.attr('height', y + 50);
    svg.attr('width', maxX + 400); // Add some padding
  }

  // --- Helper Functions in Class ---

  getDefautTermForRelationShip(concept: Concept | undefined, options: DiagramOptions) {
    if (!concept) return "URKN";
    if (concept.pt && concept.pt.lang === options.defaultLanguage && options.defaultLanguage != 'en' && concept.fsn?.lang != options.defaultLanguage) {
      return concept.pt.term;
    }
    return concept.fsn ? concept.fsn.term : (concept.pt ? concept.pt.term : "");
  }

  loadDefs(svg: any) {
    const defs = svg.append('defs');

    // Filled Triangle (Black Arrowhead)
    const marker = defs.append('marker')
      .attr('id', 'BlackTriangle')
      .attr('refX', 10)
      .attr('refY', 5)
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('orient', 'auto');
    marker.append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .style('fill', 'black');

    // Clear Triangle (Open Arrowhead for 'Is a')
    const clearTriangle = defs.append('marker')
      .attr('id', 'ClearTriangle')
      .attr('refX', 10)
      .attr('refY', 5)
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('orient', 'auto');
    clearTriangle.append('path')
      .attr('d', 'M 0 0 L 10 5 L 0 10 z')
      .style('fill', 'white')
      .style('stroke', 'black');
  }

  drawSctBox(svg: any, x: number, y: number, label: string, id: string, cssClass: string) {
    const g = svg.append('g')
      .attr('class', 'sct-box ' + cssClass)
      .attr('transform', `translate(${x}, ${y})`);

    // Determine shape style
    const isDefined = cssClass.includes('sct-defined-concept');
    const isAttribute = cssClass.includes('sct-attribute');

    // Radius: 0 for normal rects (sharp), 18 for attributes (pill)
    const radius = isAttribute ? 18 : 0;

    // Text Padding
    const padding = 10;

    // --- Draw ID Text ---
    const idText = g.append('text')
      .attr('class', 'sct-id')
      .attr('x', 10)
      .attr('y', 16)
      .style('font-size', '10px')
      .text(id || '');

    // --- Draw Label Text ---
    const labelText = g.append('text')
      .attr('class', 'sct-label')
      .attr('x', 10)
      .attr('y', 33) // Adjust for ID
      .style('font-size', '12px')
      .text(label);

    // Calculate dimensions
    const idBBox = idText.node().getBBox();
    const labelBBox = labelText.node().getBBox();

    // Width is max of either text + padding
    const contentWidth = Math.max(idBBox.width, labelBBox.width);
    const contentHeight = 35; // Fixed height for 2 lines essentially

    const width = contentWidth + padding * 2;
    // Dynamic height based on layout? Or fixed? Reference looks structured.
    // Let's use fixed reasonable height for 2 lines.
    const height = contentHeight + padding;

    // --- Draw Outer Rect ---
    const rect = g.insert('rect', 'text') // Insert before texts
      .attr('rx', radius)
      .attr('ry', radius)
      .attr('width', width)
      .attr('height', height);

    // --- Draw Inner Rect (Double Border) ---
    // If Defined or Attribute, draw the inner line
    if (isDefined || isAttribute) {
      // 1. Force Outer Rect to be WHITE fill to create the gap effect
      rect.style('fill', 'white');

      // 2. Draw Inner Rect (This will inherit the CSS class color)
      const offset = 3;
      g.insert('rect', 'text')
        .attr('rx', Math.max(0, radius - offset))
        .attr('ry', Math.max(0, radius - offset))
        .attr('x', offset)
        .attr('y', offset)
        .attr('width', width - offset * 2)
        .attr('height', height - offset * 2)
        .attr('class', 'inner-rect')
        .style('stroke-width', '1px');
    }

    return g;
  }


  drawSubsumedByNode(svg: any, x: number, y: number) {
    const g = this.drawCircleNode(svg, x, y, 'isa-node', '');
    // Draw 'Subsumed By' symbol (⊑) manually
    // Coordinates relative to center (25,25)

    const cx = 25;
    const cy = 25;
    const s = 12; // Increased size for r=25

    // Top Line
    g.append('line').attr('x1', cx - s).attr('y1', cy - 7).attr('x2', cx + s).attr('y2', cy - 7)
      .attr('stroke', 'black').attr('stroke-width', 2);
    // Bottom Line (of U)
    g.append('line').attr('x1', cx - s).attr('y1', cy + 5).attr('x2', cx + s).attr('y2', cy + 5)
      .attr('stroke', 'black').attr('stroke-width', 2);
    // Left Line
    g.append('line').attr('x1', cx - s).attr('y1', cy - 7).attr('x2', cx - s).attr('y2', cy + 5)
      .attr('stroke', 'black').attr('stroke-width', 2);
    // Underline
    g.append('line').attr('x1', cx - s).attr('y1', cy + 10).attr('x2', cx + s).attr('y2', cy + 10)
      .attr('stroke', 'black').attr('stroke-width', 2);

    return g;
  }

  drawEquivalentNode(svg: any, x: number, y: number) {
    const g = this.drawCircleNode(svg, x, y, 'isa-node', '');

    // Draw '≡' manually
    const cx = 25;
    const cy = 25;
    const w = 12;

    // Top
    g.append('line').attr('x1', cx - w).attr('y1', cy - 7).attr('x2', cx + w).attr('y2', cy - 7)
      .attr('stroke', 'black').attr('stroke-width', 2);
    // Middle
    g.append('line').attr('x1', cx - w).attr('y1', cy).attr('x2', cx + w).attr('y2', cy)
      .attr('stroke', 'black').attr('stroke-width', 2);
    // Bottom
    g.append('line').attr('x1', cx - w).attr('y1', cy + 7).attr('x2', cx + w).attr('y2', cy + 7)
      .attr('stroke', 'black').attr('stroke-width', 2);

    return g;
  }

  drawConjunctionNode(svg: any, x: number, y: number) {
    const g = svg.append('g')
      .attr('class', 'conjunction-node')
      .attr('transform', `translate(${x}, ${y})`);
    // Official looks like a filled black circle r=10
    // cy=25 to align center with isa-node (which is r=25, cy=25)
    g.append('circle').attr('r', 10).attr('cx', 10).attr('cy', 25).style('fill', 'black').style('stroke', 'none');
    return g;
  }

  drawAttributeGroupNode(svg: any, x: number, y: number) {
    const g = svg.append('g')
      .attr('class', 'attribute-group-node')
      .attr('transform', `translate(${x}, ${y})`);
    // Center at 20,25 to match alignment, Increased r to 20
    g.append('circle').attr('r', 20).attr('cx', 20).attr('cy', 25).style('fill', 'white').style('stroke', 'black');
    return g;
  }

  drawCircleNode(svg: any, x: number, y: number, cssClass: string, textStr: string = '') {
    const g = svg.append('g')
      .attr('class', cssClass)
      .attr('transform', `translate(${x}, ${y})`);
    // Increased to r=25 to match standard
    g.append('circle')
      .attr('r', 25)
      .attr('cx', 25)
      .attr('cy', 25);
    if (textStr) {
      g.append('text')
        .attr('x', 25)
        .attr('y', 31) // Centered-ish
        .attr('text-anchor', 'middle')
        .text(textStr)
        .style('fill', 'black')
        .style('pointer-events', 'none');
    }
    return g;
  }

  connectElements(svg: any, elem1: any, elem2: any, anchor1: string, anchor2: string, marker: string = '') {
    const t1 = this.getTranslate(elem1.attr('transform'));
    const t2 = this.getTranslate(elem2.attr('transform'));
    const b1 = elem1.node().getBBox();
    const b2 = elem2.node().getBBox();

    let x1 = t1.x + b1.x;
    let y1 = t1.y + b1.y + b1.height / 2; // Default V-Center

    if (anchor1.includes('right')) x1 = t1.x + b1.x + b1.width;
    if (anchor1.includes('center')) x1 = t1.x + b1.x + b1.width / 2;
    if (anchor1 === 'bottom-shifted') x1 = t1.x + b1.x + 35; // Custom shift for root node "Crac" alignment
    if (anchor1.includes('bottom')) y1 = t1.y + b1.y + b1.height;

    let x2 = t2.x + b2.x;
    let y2 = t2.y + b2.y + b2.height / 2; // Default V-Center

    if (anchor2.includes('right')) x2 = t2.x + b2.x + b2.width;
    if (anchor2.includes('center')) x2 = t2.x + b2.x + b2.width / 2;

    // Fixed Orthogonal Routing
    let pathD = '';
    const busOffset = 0; // Changed to 0 to drop vertically from center

    // Logic: If strictly horizontal (aligned), force straight line
    if (Math.abs(y1 - y2) <= 5) {
      const yAvg = (y1 + y2) / 2;
      pathD = `M ${x1} ${yAvg} L ${x2} ${yAvg}`;
    }
    // "L" shape logic for Parent -> Child (Bottom -> Left)
    else if (anchor1.includes('bottom') && anchor2 === 'left') {
      pathD = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
    }
    // Otherwise if moving right substantially, use standard tree bus.
    else if (x2 > x1 + busOffset + 5) {
      // Vertical down then Horizontal right
      pathD = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
    } else {
      pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    const path = svg.insert('path', ':first-child')
      .attr('d', pathD)
      .attr('class', 'link-line');

    if (marker) {
      path.attr('marker-end', `url(#${marker})`);
    } else {
      // Default to black triangle if not specified, IF it is attribute?
      // Let's assume caller handles this.
    }
  }

  getTranslate(transformStr: string) {
    if (!transformStr) return { x: 0, y: 0 };
    // Improved regex to handle spaces
    const match = /translate\s*\(\s*([^,\s]+)[,\s]+([^)\s]+)\s*\)/.exec(transformStr);
    if (match) {
      return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
    }
    return { x: 0, y: 0 };
  }

  toggleView(view: 'stated' | 'inferred') {
    this.options.selectedView = view;
    if (this.conceptId) {
      this.loadAllData(this.conceptId);
    }
  }

  saveAsSvg() {
    const svgEl = this.diagramContainer.nativeElement.querySelector('svg');
    if (svgEl) {
      // Clone the node to not disrupt the live view
      const svgClone = svgEl.cloneNode(true) as SVGElement;

      // Embed CSS styles directly into the SVG
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = `
        .sct-box rect { stroke: #333; stroke-width: 1px; fill: #fff; }
        .sct-box text { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }
        .sct-primitive-concept rect { fill: #a6d8f0; stroke: black; stroke-width: 2px; }
        .sct-defined-concept rect { fill: #dba6f0; stroke: black; stroke-width: 1px; }
        .sct-attribute rect { fill: #fdfdad; stroke: black; stroke-width: 1px; }
        .concrete-domain rect { fill: #ddd; stroke: black; stroke-width: 1px; }
        .isa-node circle { fill: white; stroke: black; stroke-width: 2px; }
        .conjunction-node circle { fill: black; }
        .attribute-group-node circle { fill: white; stroke: black; stroke-width: 2px; }
        .link-line { fill: none; stroke: black; stroke-width: 2px; }
        .inner-rect { fill: none; }
      `;
      svgClone.insertBefore(style, svgClone.firstChild);

      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgClone);
      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);

      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram-${this.concept?.conceptId || 'concept'}.svg`;
      a.click();
    }
  }

  saveAsPng() {
    const svgEl = this.diagramContainer.nativeElement.querySelector('svg');
    if (svgEl) {
      // 1. Prepare SVG String with styles (same as SVG export)
      const svgClone = svgEl.cloneNode(true) as SVGElement;
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = `
        .sct-box rect { stroke: #333; stroke-width: 1px; fill: #fff; }
        .sct-box text { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }
        .sct-primitive-concept rect { fill: #a6d8f0; stroke: black; stroke-width: 2px; }
        .sct-defined-concept rect { fill: #dba6f0; stroke: black; stroke-width: 1px; }
        .sct-attribute rect { fill: #fdfdad; stroke: black; stroke-width: 1px; }
        .concrete-domain rect { fill: #ddd; stroke: black; stroke-width: 1px; }
        .isa-node circle { fill: white; stroke: black; stroke-width: 2px; }
        .conjunction-node circle { fill: black; }
        .attribute-group-node circle { fill: white; stroke: black; stroke-width: 2px; }
        .link-line { fill: none; stroke: black; stroke-width: 2px; }
        .inner-rect { fill: none; }
      `;
      svgClone.insertBefore(style, svgClone.firstChild);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      // 2. Load into Image
      const img = new Image();
      img.onload = () => {
        // 3. Draw to Canvas
        const canvas = document.createElement('canvas');
        // Use exact dimensions from SVG or BBox
        const bbox = svgEl.getBoundingClientRect();
        canvas.width = bbox.width;
        canvas.height = bbox.height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill white background (optional, but good for PNG)
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          // 4. Download
          const pngUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `diagram-${this.concept?.conceptId || 'concept'}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      };
      img.src = url;
    }
  }
}
