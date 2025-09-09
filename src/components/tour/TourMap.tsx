import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { TourStop } from '@/types/tour';
import { supabase } from '@/lib/supabase';

// Fix for default icon issue with webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

type LatLngTuple = [number, number];

type MapProps = {
  stops: TourStop[];
};

const geocodeAddress = async (address: string): Promise<LatLngTuple | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: { address },
    });
    if (error) throw error;
    if (data && data.lat && data.lng) {
      return [data.lat, data.lng];
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

const fetchRoute = async (coordinates: LatLngTuple[]): Promise<LatLngTuple[] | null> => {
  if (coordinates.length < 2) return null;
  
  const coordsString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const routeCoords = data.routes[0].geometry.coordinates;
      return routeCoords.map((c: [number, number]) => [c[1], c[0]] as LatLngTuple);
    }
    return null;
  } catch (error) {
    console.error("Routing error:", error);
    return null;
  }
};

const FitBounds = ({ coordinates }: { coordinates: LatLngTuple[] }) => {
  const map = useMap();
  useEffect(() => {
    if (coordinates.length > 0) {
      map.fitBounds(coordinates);
    }
  }, [coordinates, map]);
  return null;
};

export const TourMap = ({ stops }: MapProps) => {
  const [markerCoordinates, setMarkerCoordinates] = useState<LatLngTuple[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLngTuple[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCoordinatesAndRoute = async () => {
      if (stops.length === 0) {
        setMarkerCoordinates([]);
        setRouteCoordinates([]);
        return;
      }
      setIsLoading(true);
      
      const coordsPromises = stops.map(stop => geocodeAddress(stop.address));
      const coordsResults = await Promise.all(coordsPromises);
      const coords = coordsResults.filter((c): c is LatLngTuple => c !== null);
      
      setMarkerCoordinates(coords);

      if (coords.length > 1) {
        const route = await fetchRoute(coords);
        setRouteCoordinates(route || coords);
      } else {
        setRouteCoordinates([]);
      }
      
      setIsLoading(false);
    };

    fetchCoordinatesAndRoute();
  }, [stops]);

  if (isLoading) {
    return <div className="d-flex justify-content-center align-items-center h-100 p-4">Lade Kartendaten...</div>;
  }

  if (stops.length > 0 && markerCoordinates.length === 0 && !isLoading) {
    return <div className="d-flex justify-content-center align-items-center h-100 p-4">Keine Koordinaten für die angegebenen Adressen gefunden.</div>;
  }

  return (
    <MapContainer center={[51.1657, 10.4515]} zoom={6} style={{ height: '400px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {markerCoordinates.map((coord, index) => (
        <Marker key={index} position={coord}>
          <Popup>
            <strong>{stops[index].name}</strong><br />
            {stops[index].address}
          </Popup>
        </Marker>
      ))}
      {routeCoordinates.length > 1 && (
        <Polyline positions={routeCoordinates} color="blue" />
      )}
      <FitBounds coordinates={markerCoordinates} />
    </MapContainer>
  );
};