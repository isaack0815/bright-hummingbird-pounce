export type TourStop = {
  id: number;
  name: string;
  address: string;
  created_at: string;
};

export type Tour = {
  id: number;
  name: string;
};

export type TourDetails = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  vehicle_id: number | null;
  stops: (TourStop & { position: number; route_point_id: number })[];
};