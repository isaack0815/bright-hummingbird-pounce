import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { TourStop } from '@/types/tour';

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
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
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
  const [coordinates, setCoordinates] = useState<LatLngTuple[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCoordinates = async () => {
      if (stops.length === 0) {
        setCoordinates([]);
        return;
      }
      setIsLoading(true);
      const coords: LatLngTuple[] = [];
      for (const stop of stops) {
        const coord = await geocodeAddress(stop.address);
        if (coord) {
          coords.push(coord);
        }
        // To respect Nominatim's usage policy (max 1 req/sec)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setCoordinates(coords);
      setIsLoading(false);
    };

    fetchCoordinates();
  }, [stops]);

  if (isLoading) {
    return <div className="d-flex justify-content-center align-items-center h-100 p-4">Lade Kartendaten...</div>;
  }

  if (stops.length > 0 && coordinates.length === 0 && !isLoading) {
    return <div className="d-flex justify-content-center align-items-center h-100 p-4">Keine Koordinaten für die angegebenen Adressen gefunden.</div>;
  }

  return (
    <MapContainer center={[51.1657, 10.4515]} zoom={6} style={{ height: '400px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {coordinates.map((coord, index) => (
        <Marker key={index} position={coord}>
          <Popup>
            <strong>{stops[index].name}</strong><br />
            {stops[index].address}
          </Popup>
        </Marker>
      ))}
      {coordinates.length > 1 && (
        <Polyline positions={coordinates} color="blue" />
      )}
      <FitBounds coordinates={coordinates} />
    </MapContainer>
  );
};