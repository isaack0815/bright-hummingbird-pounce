import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L, { DivIcon, LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import type { VerizonVehicle } from '@/types/verizon';
import { useEffect, useState } from 'react';
import { ListGroup } from 'react-bootstrap';
import { User, Gauge, Clock, MapPin, Truck, Car, Caravan, Package, Flag, Goal } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import ReactDOMServer from 'react-dom/server';
import { supabase } from '@/lib/supabase';

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

const fetchRoute = async (coordinates: LatLngTuple[]): Promise<LatLngTuple[] | null> => { if (coordinates.length < 2) return null; const coordsString = coordinates.map(c => `${c[1]},${c[0]}`).join(';'); const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`; try { const response = await fetch(url); if (!response.ok) return null; const data = await response.json(); if (data.routes && data.routes.length > 0) { const routeCoords = data.routes[0].geometry.coordinates; return routeCoords.map((c: [number, number]) => [c[1], c[0]] as LatLngTuple); } return null; } catch (error) { console.error("Routing error:", error); return null; } };

type VerizonMapProps = {
  vehicles: VerizonVehicle[];
  tourChain: any[];
};

type RouteData = {
    active: LatLngTuple[] | null;
    approach: LatLngTuple[] | null;
    followUp: LatLngTuple[] | null;
    endPoints: LatLngTuple[];
}

const FitBoundsToMarkers = ({ positions }: { positions: LatLngBoundsExpression }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && Array.isArray(positions) && positions.length > 0) {
      map.fitBounds(positions, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
};

export const VerizonMap = ({ vehicles, tourChain }: VerizonMapProps) => {
  const [routes, setRoutes] = useState<RouteData>({ active: null, approach: null, followUp: null, endPoints: [] });

  useEffect(() => {
    const fetchAndSetRoutes = async () => {
      if (tourChain.length === 0) {
        setRoutes({ active: null, approach: null, followUp: null, endPoints: [] });
        return;
      }

      const newRoutes: RouteData = { active: null, approach: null, followUp: null, endPoints: [] };

      // Active Order
      const activeOrder = tourChain[0];
      const activeOrigin = await geocodeAddress(activeOrder.origin_address);
      const activeDest = await geocodeAddress(activeOrder.destination_address);
      if (activeOrigin && activeDest) {
        newRoutes.active = await fetchRoute([activeOrigin, activeDest]);
        newRoutes.endPoints.push(activeOrigin, activeDest);
      }

      // Follow-up Order and Approach
      if (tourChain.length > 1) {
        const followUpOrder = tourChain[1];
        const followUpOrigin = await geocodeAddress(followUpOrder.origin_address);
        const followUpDest = await geocodeAddress(followUpOrder.destination_address);
        
        if (activeDest && followUpOrigin) {
          newRoutes.approach = await fetchRoute([activeDest, followUpOrigin]);
        }
        if (followUpOrigin && followUpDest) {
          newRoutes.followUp = await fetchRoute([followUpOrigin, followUpDest]);
          newRoutes.endPoints.push(followUpOrigin, followUpDest);
        }
      }
      setRoutes(newRoutes);
    };
    fetchAndSetRoutes();
  }, [tourChain]);

  const vehiclePositions = vehicles.filter(v => v.location?.latitude && v.location?.longitude).map(v => [v.location.latitude, v.location.longitude] as [number, number]);
  const bounds = [...vehiclePositions, ...routes.endPoints];

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
      {routes.active && <Polyline positions={routes.active} color="blue" weight={5} opacity={0.7} />}
      {routes.approach && <Polyline positions={routes.approach} color="red" weight={5} opacity={0.7} dashArray="5, 10" />}
      {routes.followUp && <Polyline positions={routes.followUp} color="green" weight={5} opacity={0.7} />}
      
      {routes.endPoints.map((point, index) => (
          <Marker key={index} position={point} icon={createRouteMarkerIcon(index % 2 === 0 ? 'start' : 'end')}>
              <Popup>{index === 0 ? 'Start (Aktuell)' : index === 1 ? 'Ziel (Aktuell)' : index === 2 ? 'Start (Folgeauftrag)' : 'Ziel (Folgeauftrag)'}</Popup>
          </Marker>
      ))}

      <FitBoundsToMarkers positions={bounds} />
    </MapContainer>
  );
};