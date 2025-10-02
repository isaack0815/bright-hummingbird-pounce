import { useState, useEffect, useCallback } from 'react';

type GeolocationState = {
  permissionState: PermissionState | 'not-supported';
  coordinates: { lat: number; lon: number } | null;
  error: GeolocationPositionError | null;
};

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    permissionState: 'prompt',
    coordinates: null,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, permissionState: 'not-supported' }));
      return;
    }

    navigator.permissions.query({ name: 'geolocation' }).then(permissionStatus => {
      setState(s => ({ ...s, permissionState: permissionStatus.state }));
      permissionStatus.onchange = () => {
        setState(s => ({ ...s, permissionState: permissionStatus.state }));
      };
    });
  }, []);

  const getCurrentPosition = useCallback((): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setState(s => ({ ...s, coordinates: coords, error: null }));
          resolve(coords);
        },
        (error) => {
          setState(s => ({ ...s, error }));
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  return { ...state, getCurrentPosition };
};