export type VerizonVehicle = {
  id: string;
  vehicleName: string;
  vehicleMake: string;
  vehicleModel: string;
  licensePlate: string;
  vin: string;
  driverName: string;
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