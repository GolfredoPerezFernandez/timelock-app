export interface MarkersProps3 {
  name: string;
  label: string;
  lat: string;
  lon: string;
  id?: number;
  selected?: boolean;
  description?: string; // Added description
  popupContent?: string; // Added popupContent for custom HTML content
}
