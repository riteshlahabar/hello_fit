/**
 * Great-circle distance in kilometres.
 *
 * Used for the matching score and the travel-charge slabs. This is
 * straight-line distance, not road distance — the spec calls for Google
 * Distance Matrix, and this is the fallback the spec's own graceful-
 * degradation rule asks for ("if Maps is unavailable, fall back to pin-code
 * matching"). Swap in the Maps call behind the same signature later.
 */
const EARTH_RADIUS_KM = 6_371;

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;

  return (
    Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 100) / 100
  );
}

/**
 * Within the geo-fence for check-in (spec 3.4). A null coordinate means the
 * device gave us no fix, which is treated as unverified rather than as a
 * failure — the teacher can still check in with a reason, and ops is alerted.
 */
export function isWithinMetres(
  a: LatLng | null,
  b: LatLng | null,
  metres: number,
): boolean {
  if (!a || !b) return false;
  return haversineKm(a, b) * 1000 <= metres;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
