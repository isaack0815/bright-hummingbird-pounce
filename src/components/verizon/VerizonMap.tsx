import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Tooltip } from 'react-leaflet';
import L, { DivIcon, LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import type { VerizonVehicle } from '@/types/verizon';
import { ListGroup } from 'react-bootstrap';
import { User, Gauge, Clock, MapPin, Truck, Car, Caravan, Flag, Goal } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import ReactDOMServer from 'react-dom/server';
import { supabase } from '@/lib/supabase';
import './VerizonMap.css';

// Fix for default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

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

const createRouteMarkerIcon = (type: 'start' | 'end' | 'waypoint'): DivIcon => {
    const icon = type === 'start' ? <Flag color="white" size={16} /> : type === 'end' ? <Goal color="white" size={16} /> : <MapPin color="white" size={16} />;
    const bgColor = type === 'start' ? '#198754' : type === 'end' ? '#dc3545' : '#6c757d';
    const iconHtml = ReactDOMServer.renderToString(<div style={{ backgroundColor: bgColor, borderRadius: '50%', padding: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid white', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>{icon}</div>);
    return L.divIcon({ html: iconHtml, className: 'custom-route-marker-icon', iconSize: [30, 30], iconAnchor: [15, 30] });
}

const geocodeAddress = async (address: string): Promise<LatLngTuple | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('geocode-address', { body: { address } });
    if (error) throw error;
    if (data && data.lat && data.lng) return [data.lat, data.lng];
    return null;
  } catch (error) { console.error("Geocoding error:", error); return null; }
};

const fetchRoute = async (coordinates: LatLngTuple[]): Promise<{ route: LatLngTuple[], duration: number } | null> => {
  if (coordinates.length < 2) return null;
  const coordsString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const routeCoords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as LatLngTuple);
      const durationInSeconds = data.routes[0].duration;
      return { route: routeCoords, duration: durationInSeconds };
    }
    return null;
  } catch (error) { console.error("Routing error:", error); return null; }
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatStopTime = (stop: any): string => {
    let parts = [stop.stop_type];
    if (stop.stop_date) parts.push(format(parseISO(stop.stop_date), 'dd.MM.yy'));
    if (stop.time_start) parts.push(stop.time_start);
    return parts.join(' ');
}

type RouteSegment = { path: LatLngTuple[], midpoint: LatLngTuple, durationText: string };
type StopMarker = { pos: LatLngTuple, type: 'start' | 'end' | 'waypoint', label: string, timeInfo: string };

const FitBoundsToMarkers = ({ positions }: { positions: LatLngBoundsExpression }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && Array.isArray(positions) && positions.length > 0) {
      map.fitBounds(positions, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
};

export const VerizonMap = ({ vehicles, tourChain }: { vehicles: VerizonVehicle[], tourChain: any[] }) => {
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [stopMarkers, setStopMarkers] = useState<StopMarker[]>([]);

  useEffect(() => {
    const fetchAndSetRoutes = async () => {
      if (tourChain.length === 0) {
        setRouteSegments([]);
        setStopMarkers([]);
        return;
      }

      const newSegments: RouteSegment[] = [];
      const newMarkers: StopMarker[] = [];
      const allStopCoords: { stop: any, coords: LatLngTuple | null }[] = [];

      // 1. Geocode all stops first
      for (const order of tourChain) {
        for (const stop of order.freight_order_stops) {
          const coords = await geocodeAddress(stop.address);
          allStopCoords.push({ stop, coords });
        }
      }

      // 2. Create stop markers
      allStopCoords.forEach(({ stop, coords }, index) => {
        if (coords) {
          const isFirst = index === 0;
          const isLast = index === allStopCoords.length - 1;
          newMarkers.push({
            pos: coords,
            type: isFirst ? 'start' : isLast ? 'end' : 'waypoint',
            label: `${stop.address}`,
            timeInfo: formatStopTime(stop)
          });
        }
      });

      // 3. Create route segments between stops
      for (let i = 0; i < allStopCoords.length - 1; i++) {
        const start = allStopCoords[i];
        const end = allStopCoords[i + 1];
        if (start.coords && end.coords) {
          const routeData = await fetchRoute([start.coords, end.coords]);
          if (routeData) {
            const midpointIndex = Math.floor(routeData.route.length / 2);
            newSegments.push({
              path: routeData.route,
              midpoint: routeData.route[midpointIndex],
              durationText: formatDuration(routeData.duration),
            });
          }
        }
      }
      
      setStopMarkers(newMarkers);
      setRouteSegments(newSegments);
    };
    fetchAndSetRoutes();
  }, [tourChain]);

  const vehiclePositions = vehicles.filter(v => v.location?.latitude && v.location?.longitude).map(v => [v.location.latitude, v.location.longitude] as [number, number]);
  const bounds = [...vehiclePositions, ...stopMarkers.map(p => p.pos)];

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
      
      {routeSegments.map((segment, index) => (
        <Polyline key={index} positions={segment.path} color="#0d6efd" weight={5} opacity={0.7}>
          <Tooltip direction="center" permanent className="map-label-tooltip">
            {segment.durationText}
          </Tooltip>
        </Polyline>
      ))}
      
      {stopMarkers.map((marker, index) => (
          <Marker key={index} position={marker.pos} icon={createRouteMarkerIcon(marker.type)}>
              <Popup>{marker.label}</Popup>
              <Tooltip direction="bottom" offset={[0, 20]} permanent className="map-label-tooltip">
                {marker.timeInfo}
              </Tooltip>
          </Marker>
      ))}

      <FitBoundsToMarkers positions={bounds} />
    </MapContainer>
  );
};