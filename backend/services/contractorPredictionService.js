const mlBackendUrl = process.env.ML_BACKEND_URL || 'http://127.0.0.1:8000';

export async function predictContractor({ latitude, longitude, road, history }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${mlBackendUrl}/predict/contractor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        ward_num: Number.isFinite(Number(road?.kgisWardId)) ? Number(road.kgisWardId) : null,
        gis_length_m: history?.totalLengthM || null,
        Road_Type: road?.roadType || null,
        Road_Surface: road?.roadSurface || null,
        Road_Class: road?.roadClass || null
      }),
      signal: controller.signal
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}