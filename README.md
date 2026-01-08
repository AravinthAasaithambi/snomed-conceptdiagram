# SNOMED CT Concept Diagram Angular Project

This project is an Angular workspace that contains a **reusable library** for rendering SNOMED CT concept diagrams and a **demonstration application** to showcase its capabilities.

## 📂 Project Structure

This project is a single Angular application containing both the diagram logic and the demonstration UI.

*   **`src/app/snomed-concept-diagram`**: Contains the core logic, components, and D3.js rendering code for the SNOMED CT concept diagram.
*   **`src/app/app.ts`**: The main application component that acts as a container to demonstrate the diagram component.

## ✨ Features

*   **Dynamic SVG Rendering**: Uses D3.js to render interactive and scalable Vector Graphics of SNOMED concepts.
*   **Stated vs. Inferred Views**: capable of toggling between the Stated view (definitions) and Inferred view (relationships).
*   **SNOMED CT Integration**: Fetches data dynamically from SNOMED CT terminology servers (e.g., Snowstorm).
*   **Export Options**:
    *   **Save as SVG**: Download the diagram as a vector file.
    *   **Save as PNG**: Download the diagram as a high-quality image.
*   **Standalone Component**: Built as an Angular Standalone Component.

## 🚀 How to Run

### Prerequisites
*   Node.js (v18 or higher recommended)
*   Angular CLI

### Installation
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the App
To see the diagram in action:
```bash
ng serve
```
*   Navigate to `http://localhost:4200/`.
*   Enter a Concept ID (e.g., `50960005` for Hemorrhage).
*   Click **Generate Diagram**.

## 🛠️ Usage

The diagram logic is encapsulated in `SnomedConceptDiagramComponent`.

1.  **Import**:
    ```typescript
    import { SnomedConceptDiagramComponent } from './snomed-concept-diagram/snomed-concept-diagram';
    ```

2.  **Usage in Template**:
    ```html
    <snomed-concept-diagram
      [conceptId]="'50960005'"
      [options]="options">
    </snomed-concept-diagram>
    ```

3.  **Configuration**:
    The component accepts an `options` object (interface `DiagramOptions`) to configure the API endpoint, edition, and version.
