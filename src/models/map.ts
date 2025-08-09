import type { LocationsProps } from "./location";
import type { MarkersProps3 as MarkersProps } from "~/models/markers";
import { type Signal } from "@builder.io/qwik";
export interface MapProps {
  // default options
  location: Signal<LocationsProps>;
  markers?: MarkersProps[];
  onMapClick$?: (e: { lat: number; lon: number }) => void;
  // add other options to customization map
}
