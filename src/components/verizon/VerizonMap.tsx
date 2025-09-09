import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L, { DivIcon, LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import type { VerizonVehicle } from '@/types/verizon';
import { useEffect, useState } from 'react';
import { ListGroup } from 'react-bootstrap';
import { User, Gauge, Clock, MapPin, Truck, Car, Caravan, Package, Flag, Goal } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import ReactDOMServer from 'react-dom/server';

const createVehicleIcon = (vehicleType: string | null): DivIcon => {
  let iconComponent;
  switch (vehicleType) {
    case 'Sattelzugmaschine': case 'LKW': case 'Transporter': iconComponent = <Truck color="white" size={20} />; break;
    case 'Anhänger': iconComponent = <Caravan color="white" size={20} />; break;
    case 'PKW': iconComponent = <Car color="white" size={20} />; break;
    default: iconComponent = <Truck color="white" size={20} />;
  }
  const iconHtml = ReactDOMServer.renderToString(<div style={{ backgroundColor: '#0d6efd', borderRadius: '50%', padding: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>{iconComponent}</div>);
  return L.divIcon({ html: iconHtml, className: 'custom-vehicle-icon', iconSize: [34, 34], iconAnchor: [17, 17] });
};

const createRouteMarkerIcon = (type: 'start' | 'end'): DivIcon => {
    const icon = type === 'start' ? <Flag color="white" size={16} /> : <Goal color="white" size={16} />;
    const bgColor = type === 'start' ? '#198754' : '#dc3545';
    const iconHtml = ReactDOMServer.renderToString(<div style={{ backgroundColor: bgColor, borderRadius: '50%', padding: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>{icon}</div>);
    return L.divIcon({ html: iconHtml, className: 'custom-route-marker-icon', iconSize: [30, 30], iconAnchor: [15, 30] });
}

const geocodeAddress = async (address: string): Promise<LatLngTuple | null> => { try { const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`); if (!response.ok) return null; const data = await response.json(); if (data && data.length > 0) { return [parseFloat(data[0].lat), parseFloat(data[0].lon)]; } return null; } catch (error) { console.error("Geocoding error:", error); return null; } };
const fetchRoute = async (coordinates: LatLngTuple[]): Promise<LatLngTuple[] | null> => { if (coordinates.length < 2) return null; const coordsString = coordinates.map(c => `${c[1]},${c[0]}`).join(';'); const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`; try { const response = await fetch(url); if (!response.ok) return null; const data = await response.json(); if (data.routes && data.routes.length > 0) { const routeCoords = data.routes[0].geometry.coordinates; return routeCoords.map((c: [number, number]) => [c[1], c[0]] as LatLngTuple); } return null; } catch (error) { console.error("Routing error:", error); return null; } };

type VerizonMapProps = {
  vehicles: VerizonVehicle[];
  activeOrderRoute: { origin_address: string; destination_address: string } | null;
};

const FitBoundsToMarkers = ({ positions }: { positions: LatLngBoundsExpression }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && Array.isArray(positions) && positions.length > 0) {
      map.fitBounds(positions, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
};

export const VerizonMap = ({ vehicles, activeOrderRoute }: VerizonMapProps) => {
  const [routeCoordinates, setRouteCoordinates] = useState<LatLngTuple[] | null>(null);
  const [routeEndPoints, setRouteEndPoints] = useState<[LatLngTuple, LatLngTuple] | null>(null);

  useEffect(() => {
    const fetchAndSetRoute = async () => {
      if (!activeOrderRoute?.origin_address || !activeOrderRoute?.destination_address) {
        setRouteCoordinates(null);
        setRouteEndPoints(null);
        return;
      }
      const [originCoords, destCoords] = await Promise.all([
        geocodeAddress(activeOrderRoute.origin_address),
        geocodeAddress(activeOrderRoute.destination_address)
      ]);
      if (originCoords && destCoords) {
        setRouteEndPoints([originCoords, destCoords]);
        const route = await fetchRoute([originCoords, destCoords]);
        setRouteCoordinates(route);
      }
    };
    fetchAndSetRoute();
  }, [activeOrderRoute]);

  const vehiclePositions = vehicles.filter(v => v.location?.latitude && v.location?.longitude).map(v => [v.location.latitude, v.location.longitude] as [number, number]);
  const bounds = routeEndPoints ? [...vehiclePositions, ...routeEndPoints] : vehiclePositions;

  return (
    <MapContainer center={[51.1657, 10.4515]} zoom={6} style={{ height: '70vh', width: '100%', borderRadius: '0.375rem' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
      {vehicles.map(vehicle => {
        if (!vehicle.location?.latitude || !vehicle.location?.longitude) return null;
        return (
          <Marker key={vehicle.id} position={[vehicle.location.latitude, vehicle.location.longitude]} icon={createVehicleIcon(vehicle.vehicleType)}>
            <Popup><div style={{minWidth: '250px'}}><h6 className="mb-2">{vehicle.licensePlate || vehicle.vehicleName}</h6><ListGroup variant="flush"><ListGroup.Item className="d-flex align-items-center p-1"><User size={14} className="me-2" /> {vehicle.driverName || 'Kein Fahrer'}</ListGroup.Item><ListGroup.Item className="d-flex align-items-center p-1"><Gauge size={14} className="me-2" /> {vehicle.speed.value} {vehicle.speed.unit}</ListGroup.Item><ListGroup.Item className="d-flex align-items-center p-1"><Clock size={14} className="me-2" /> {vehicle.lastContactTime ? format(parseISO(vehicle.lastContactTime), 'dd.MM HH:mm', { locale: de }) : '-'}</ListGroup.Item><ListGroup.Item className="d-flex align-items-start p-1"><MapPin size={14} className="me-2 mt-1" /> {vehicle.location.address}</ListGroup.Item></ListGroup></div></Popup>
          </Marker>
        );
      })}
      {routeCoordinates && <Polyline positions={routeCoordinates} color="blue" weight={5} opacity={0.7} />}
      {routeEndPoints && <>
        <Marker position={routeEndPoints[0]} icon={createRouteMarkerIcon('start')}><Popup>Start: {activeOrderRoute?.origin_address}</Popup></Marker>
        <Marker position={routeEndPoints[1]} icon={createRouteMarkerIcon('end')}><Popup>Ziel: {activeOrderRoute?.destination_address}</Popup></Marker>
      </>}
      <FitBoundsToMarkers positions={bounds} />
    </MapContainer>
  );
};