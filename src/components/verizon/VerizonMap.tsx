import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { LatLngBoundsExpression } from 'leaflet';
import type { VerizonVehicle } from '@/types/verizon';
import { useEffect } from 'react';
import { ListGroup } from 'react-bootstrap';
import { User, Gauge, Clock, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

// Fix für das Standard-Icon-Problem mit Vite/Webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

type VerizonMapProps = {
  vehicles: VerizonVehicle[];
};

// Hilfskomponente, um die Kartengrenzen an die Marker anzupassen
const FitBoundsToMarkers = ({ positions }: { positions: LatLngBoundsExpression }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && Array.isArray(positions) && positions.length > 0) {
      map.fitBounds(positions, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
};

export const VerizonMap = ({ vehicles }: VerizonMapProps) => {
  const markerPositions = vehicles
    .filter(v => v.location?.latitude && v.location?.longitude)
    .map(v => [v.location.latitude, v.location.longitude] as [number, number]);

  return (
    <MapContainer center={[51.1657, 10.4515]} zoom={6} style={{ height: '70vh', width: '100%', borderRadius: '0.375rem' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {vehicles.map(vehicle => {
        if (!vehicle.location?.latitude || !vehicle.location?.longitude) return null;
        
        return (
          <Marker key={vehicle.id} position={[vehicle.location.latitude, vehicle.location.longitude]}>
            <Popup>
              <div style={{minWidth: '250px'}}>
                <h6 className="mb-2">{vehicle.licensePlate || vehicle.vehicleName}</h6>
                <ListGroup variant="flush">
                  <ListGroup.Item className="d-flex align-items-center p-1"><User size={14} className="me-2" /> {vehicle.driverName || 'Kein Fahrer'}</ListGroup.Item>
                  <ListGroup.Item className="d-flex align-items-center p-1"><Gauge size={14} className="me-2" /> {vehicle.speed.value} {vehicle.speed.unit}</ListGroup.Item>
                  <ListGroup.Item className="d-flex align-items-center p-1"><Clock size={14} className="me-2" /> {vehicle.lastContactTime ? format(parseISO(vehicle.lastContactTime), 'dd.MM HH:mm', { locale: de }) : '-'}</ListGroup.Item>
                  <ListGroup.Item className="d-flex align-items-start p-1"><MapPin size={14} className="me-2 mt-1" /> {vehicle.location.address}</ListGroup.Item>
                </ListGroup>
              </div>
            </Popup>
          </Marker>
        );
      })}
      <FitBoundsToMarkers positions={markerPositions} />
    </MapContainer>
  );
};