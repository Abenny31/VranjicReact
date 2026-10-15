export interface ContentFormContext {
    initialAreaId?: number;
    initialTagIds?: number[];
    initialPerspective?: import('./types').ContentTimePerspective;
    returnTo?: string;
    onCreated?: (content: { id: number }) => void;
}
