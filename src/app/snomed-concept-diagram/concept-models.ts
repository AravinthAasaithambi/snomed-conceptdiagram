export interface Concept {
    conceptId: string;
    fsn?: Description;
    pt?: Description;
    defaultTerm?: string;
    definitionStatus: string; // 'PRIMITIVE' | 'FULLY_DEFINED'
    active?: boolean;
    relationships?: Relationship[];
    statedRelationships?: Relationship[];
    classAxioms?: Axiom[];
    gciAxioms?: Axiom[];
    descriptions?: Description[];
}

export interface Description {
    term: string;
    lang: string;
    type: string;
    active: boolean;
    acceptabilityMap: { [key: string]: string };
}

export interface Relationship {
    active: boolean;
    type: Concept;
    target?: Concept; // API specific
    destination?: Concept; // API specific
    groupId: number;
    concreteValue?: ConcreteValue;
    characteristicType?: string; // 'STATED_RELATIONSHIP' | 'INFERRED_RELATIONSHIP'
}

export interface Axiom {
    active: boolean;
    relationships: Relationship[];
}

export interface ConcreteValue {
    dataType: string;
    value: string;
}

export interface DiagramOptions {
    defaultLanguage: string;
    selectedView: 'stated' | 'inferred';
    serverUrl: string;
    edition: string;
    release: string;
    languages: string;
}

export interface UngroupedAttributes {
    items: any[]; // Specific structure for members/referenceSets
}
