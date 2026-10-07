# Self-hosted routing stack (Phase 1)

Three local engines: **OSRM** (driving), **OpenTripPlanner 2** (transit), and
**Nominatim** (coarse town → centroid). Everything runs on your own machine/infra
so no patient-derived coordinate ever reaches a third party. Build the graphs
once, then `docker compose up`.

The backend reads these via `OSRM_URL`, `OTP2_URL`, `NOMINATIM_URL` in
`backend/.env`. Any URL left blank → that mode returns **unavailable** (never a
guessed number), so you can bring the engines up one at a time.

> **Data + attribution.** OSM data is ODbL (attribution required). NTA/TFI GTFS is
> CC BY 4.0 (attribution required; realtime needs an API key — not used here).
> Downloads must happen on a networked machine.

## 1. Get the data

```bash
cd infra
mkdir -p osrm otp nominatim/data

# Ireland OSM extract (covers RoI + NI). ~400 MB.
curl -L -o nominatim/data/ireland-and-northern-ireland-latest.osm.pbf \
  https://download.geofabrik.de/europe/ireland-and-northern-ireland-latest.osm.pbf
cp nominatim/data/ireland-and-northern-ireland-latest.osm.pbf osrm/ireland.osm.pbf
cp nominatim/data/ireland-and-northern-ireland-latest.osm.pbf otp/ireland.osm.pbf

# NTA/TFI GTFS (all-Ireland schedules). CC BY 4.0.
curl -L -o otp/nta-gtfs.zip https://www.transportforireland.ie/transitData/Data/GTFS_All.zip
```

## 2. Build the OSRM driving graph (once)

```bash
cd infra/osrm
docker run -t -v "$PWD:/data" osrm/osrm-backend:v5.27.1 osrm-extract -p /opt/car.lua /data/ireland.osm.pbf
docker run -t -v "$PWD:/data" osrm/osrm-backend:v5.27.1 osrm-partition /data/ireland.osrm
docker run -t -v "$PWD:/data" osrm/osrm-backend:v5.27.1 osrm-customize /data/ireland.osrm
```

## 3. Build the OTP2 transit graph (once)

With `otp/ireland.osm.pbf` and `otp/nta-gtfs.zip` in place:

```bash
cd infra/otp
docker run --rm -v "$PWD:/var/opentripplanner" opentripplanner/opentripplanner:2.5.0 --build --save
# produces graph.obj
```

## 4. Run

```bash
cd infra
docker compose up
# OSRM       -> http://localhost:5000
# OTP2       -> http://localhost:8081
# Nominatim  -> http://localhost:8080  (first boot imports the extract — slow, once)
```

## 5. Smoke-test in the UI

Drive the full flow from the frontend: pick orthopaedics, enter an origin town
(e.g. Ennis), toggle driving / public transport, and confirm the five hospitals
reorder by travel time with "unavailable" anywhere no route exists — never 0,
never dropped.

## Hosted fallback (opt-in only)

If self-hosting a mode is not ready, hosted ORS / Google / Mapbox can stand in
for **coarse, approved** queries — but they disclose the coordinate to the
provider, so they are opt-in, never the default, and never for a full address.