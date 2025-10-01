export type VerizonVehicle = {
  id: string;
  vehicleName: string;
  vehicleType: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  licensePlate?: string | null;
  vin?: string | null;
  driverName: string | null;
  speed: {
    value: number;
    unit: string;
  };
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  lastContactTime: string;
};