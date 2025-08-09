import {
  component$,
  noSerialize,
  useSignal,
  useStyles$,
  useVisibleTask$,
} from "@builder.io/qwik";
import type { MapProps } from "~/models/map";
import leafletStyles from "leaflet/dist/leaflet.css?inline";

export const LeafletMap = component$<MapProps>(
  ({ location, markers: treeMarkers, onMapClick$ }) => {
    useStyles$(
      leafletStyles +
        `
      .marker-label {
        background-color: rgba(255, 255, 255, 0.8);
        border-radius: 4px;
        padding: 2px 5px;
        font-weight: bold;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        color: #333; /* Default text color for labels */
      }
      /* Ensure leaflet-div-icon itself doesn't add unwanted background/border for SVG icons */
      .leaflet-div-icon {
        background: none;
        border: none;
      }
      .user-location-pin {
        /* Specific styles for the red pin SVG, if any, beyond fill="red" */
      }
    `
    );

    const mapInstanceSig = useSignal<L.Map>();
    // No need for L_module if L is scoped to useVisibleTask$

    useVisibleTask$(async ({ track }) => {
      track(location);
      if (treeMarkers) track(treeMarkers);

      // Debug: log locationData to verify marker
      const { value: locationData } = location;
      console.log('[LeafletMap] locationData:', locationData);
      if (!locationData || !locationData.point || locationData.point.length !== 2) {
        console.error('[LeafletMap] locationData.point is invalid:', locationData?.point);
        return;
      }

      // Dynamically import Leaflet to ensure it's client-side only and L is defined
      const L = (await import("leaflet")).default;

      if (mapInstanceSig.value) {
        mapInstanceSig.value.remove(); // Remove previous map instance if re-running
      }

      const centerPosition: L.LatLngTuple = [
        locationData.point[0],
        locationData.point[1],
      ];

      const map = L.map("map").setView(centerPosition, locationData.zoom || 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Markers for registered trees (custom color and popup)
      if (treeMarkers) {
        treeMarkers.forEach((marker) => {
          const color = marker.selected ? '#FFD600' : '#E53935'; // amarillo si seleccionado, rojo si no
          const treeIcon = L.divIcon({
            className: "leaflet-div-icon",
            html: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32'><circle cx='16' cy='16' r='13' fill='${color}' stroke='#333' stroke-width='2'/><text x='16' y='22' text-anchor='middle' font-size='16' font-family='Arial' fill='#333' font-weight='bold'>${marker.label}</text></svg>`
          });
          const popupHtml = marker.popupContent || `<div style='min-width:180px'><b>${marker.name}</b></div>`;
          L.marker([
            parseFloat(marker.lat),
            parseFloat(marker.lon)
          ], { icon: treeIcon })
            .bindPopup(popupHtml)
            .addTo(map);
        });
      }

      // User's selected location marker (RED PIN for manual selection only)
      if (locationData.marker) {
        console.log('[LeafletMap] Drawing user marker at', locationData.point);
        const redPinIcon = L.divIcon({
          html: `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red" width="32px" height="32px" class="user-location-pin">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          `,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });
        L.marker(locationData.point, { icon: redPinIcon })
          .bindPopup(locationData.name || "Ubicación Seleccionada")
          .addTo(map);
      }

      // Handle map click for selecting location
      if (onMapClick$) {
        map.on('click', (e: any) => {
          // Directly call the function if it's a function
          if (typeof onMapClick$ === 'function') {
            onMapClick$({ lat: e.latlng.lat, lon: e.latlng.lng });
          }
        });
      }

      // Set boundary box if provided (string: 'swLat,swLng,neLat,neLng')
      if (locationData.boundaryBox) {
        const parts = locationData.boundaryBox.split(',').map(Number);
        if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
          const bounds = L.latLngBounds(
            [parts[0], parts[1]], // Southwest
            [parts[2], parts[3]]  // Northeast
          );
          map.fitBounds(bounds);
        }
      }

      mapInstanceSig.value = noSerialize(map);
    },
    { strategy: "document-idle" }); // Run after the document is idle

    return (
      <div
        id="map"
        style={{ height: "400px", borderRadius: "1.5rem" }}
        class="w-full shadow-lg"
      ></div>
    );
  }
);
