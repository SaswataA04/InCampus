/* =====================================================
   0. SHOW ANY ERROR ON SCREEN
===================================================== */

window.addEventListener('error', function (event) {
  const el = document.getElementById('status');
  if (el) {
    el.innerText = 'ERROR: ' + event.message;
    el.style.background = '#991b1b';
  }
});

if (typeof L === 'undefined') {
  const el = document.getElementById('status');
  el.innerText = 'LEAFLET FAILED TO LOAD (check internet / unpkg.com)';
  el.style.background = '#991b1b';
  throw new Error('Leaflet not loaded');
}
















/* =====================================================
   1. MAP INITIALIZATION
===================================================== */

const referenceLat = 22.7378;
const referenceLng = 88.4565;

const map = L.map('map').setView([referenceLat, referenceLng], 17);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


/* =====================================================
   2. OPEN LOCATION CODE DECODER (built in, no library)
   Implements the Open Location Code specification.
   Full codes only: 8 characters, '+', then optional
   extra pairs and grid refinement.
===================================================== */

const OLC_ALPHABET = '23456789CFGHJMPQRVWX';
const OLC_FULL_PATTERN = /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]*$/i;

function decodeFullPlusCode(code) {
  const upper = code.toUpperCase();

  if (!OLC_FULL_PATTERN.test(upper)) {
    throw new Error(`Not a valid full Plus Code: ${code}`);
  }

  const digits = upper
    .replace('+', '')
    .split('')
    .map(ch => OLC_ALPHABET.indexOf(ch));

  // Latitude and longitude pairs (first 10 digits)
  // Pair k has resolution 20^(1-k) degrees
  let lat = -90;
  let lng = -180;

  const pairCount = Math.min(digits.length, 10);

  for (let i = 0; i < pairCount; i++) {
    const pairIndex = Math.floor(i / 2);
    const res = Math.pow(20, 1 - pairIndex);

    if (i % 2 === 0) {
      lat += digits[i] * res;
    } else {
      lng += digits[i] * res;
    }
  }

  // Grid refinement: 5 rows x 4 columns per digit
  let latCell = 0.000125;
  let lngCell = 0.000125;

  for (let i = 10; i < digits.length; i++) {
    latCell /= 5;
    lngCell /= 4;

    const row = Math.floor(digits[i] / 4);
    const col = digits[i] % 4;

    lat += row * latCell;
    lng += col * lngCell;
  }

  // Return the centre of the final cell
  return {
    lat: lat + latCell / 2,
    lng: lng + lngCell / 2
  };
}


/* =====================================================
   3. CAMPUS BOUNDARY - FULL PLUS CODES
   Order preserved. Closing point and consecutive
   duplicate removed. Leaflet closes the polygon.
===================================================== */

const campusBoundaryPlusCodes = [
  "7MJCPFR4+7X7",
  "7MJCPFR4+8V9",
  "7MJCPFR4+9RM",
  "7MJCPFR4+CPQ",
  "7MJCPFR4+9PF",
  "7MJCPFR4+8PF",
  "7MJCPFR4+7PF",
  "7MJCPFR4+6PF",
  "7MJCPFR4+5P7",
  "7MJCPFR4+3P3",
  "7MJCPFR4+2P2",

  "7MJCPFQ4+WP2",
  "7MJCPFQ4+RPR",
  "7MJCPFQ4+QPJ",
  "7MJCPFQ4+MPR",
  "7MJCPFQ4+HMP",
  "7MJCPFQ4+HJH",
  "7MJCPFQ4+HHG",
  "7MJCPFQ4+HFH",
  "7MJCPFQ4+HCF",
  "7MJCPFQ4+H6H",
  "7MJCPFQ4+H3J",
  "7MJCPFQ4+P29",
  "7MJCPFQ4+R2H",

  "7MJCPFQ3+WXW",
  "7MJCPFQ3+QRQ",
  "7MJCPFQ3+PRH",
  "7MJCPFQ3+MMH",
  "7MJCPFQ3+JG6",
  "7MJCPFQ3+H72",
  "7MJCPFQ3+J6R",
  "7MJCPFQ3+J52",
  "7MJCPFQ3+C66",
  "7MJCPFQ3+768",
  "7MJCPFQ3+38R",
  "7MJCPFQ3+2CX",

  "7MJCPFP3+VF9",
  "7MJCPFP3+PHX",
  "7MJCPFP3+MGC",
  "7MJCPFP3+HF9",
  "7MJCPFP3+FF4",
  "7MJCPFP3+CH4",
  "7MJCPFP3+CQF",
  "7MJCPFP3+CW5",

  "7MJCPFP4+93P",
  "7MJCPFP4+84G",
  "7MJCPFP4+868",
  "7MJCPFP4+66W",
  "7MJCPFP4+65J",
  "7MJCPFP4+52R",
  "7MJCPFP4+32F",
  "7MJCPFP4+38R",
  "7MJCPFP4+388",

  "7MJCPFM4+XCG",
  "7MJCPFM4+WF2",
  "7MJCPFM4+WJM",
  "7MJCPFM4+XRJ",

  "7MJCPFP4+3X8",
  "7MJCPFP5+54H",
  "7MJCPFP5+84Q",
  "7MJCPFP4+HXQ",

  "7MJCPFP5+P6H",
  "7MJCPFP5+W6Q",

  "7MJCPFQ5+27V",
  "7MJCPFQ5+77F",
  "7MJCPFQ5+H6X",
  "7MJCPFQ5+P65",
  "7MJCPFQ5+P9F",

  "7MJCPFR5+283",
  "7MJCPFR5+53C"
];


/* =====================================================
   4. DECODE BOUNDARY AND DRAW CAMPUS POLYGON
===================================================== */

let decodedBoundary;

try {
  decodedBoundary = campusBoundaryPlusCodes.map((code, index) => {
    const point = decodeFullPlusCode(code);
    return {
      code: code,
      lat: point.lat,
      lng: point.lng,
      index: index + 1
    };
  });
} catch (error) {
  const statusEl = document.getElementById('status');
  statusEl.innerText = 'BOUNDARY ERROR: ' + error.message;
  statusEl.style.background = '#991b1b';
  console.error(error);
  throw error;
}

// Leaflet expects [latitude, longitude]
const campusBoundary = decodedBoundary.map(p => [p.lat, p.lng]);

const campusPolygon = L.polygon(campusBoundary, {
  color: '#1e3a8a',
  weight: 3,
  fillColor: '#3b82f6',
  fillOpacity: 0.15
}).addTo(map);

const boundaryMarkers = L.layerGroup();

decodedBoundary.forEach(point => {
  L.circleMarker([point.lat, point.lng], {
    radius: 3,
    color: '#dc2626',
    fillColor: '#ef4444',
    fillOpacity: 1,
    weight: 1
  })
  .bindTooltip(`Point ${point.index}: ${point.code}`)
  .addTo(boundaryMarkers);
});

boundaryMarkers.addTo(map);

map.fitBounds(campusPolygon.getBounds(), { padding: [35, 35] });

document.getElementById('boundaryCount').innerText =
  `Boundary points: ${campusBoundary.length}`;

console.table(decodedBoundary);


/* =====================================================
   5. USER MARKER AND ACCURACY CIRCLE
===================================================== */

const userIcon = L.icon({
  iconUrl: 'https://static.vecteezy.com/system/resources/thumbnails/029/166/580/small/icon-location-map-ai-generative-png.png',
  iconSize: [42, 42],
  iconAnchor: [21, 42]
});

const userMarker = L.marker([referenceLat, referenceLng], { icon: userIcon }).addTo(map);

const accuracyCircle = L.circle([referenceLat, referenceLng], {
  radius: 0,
  color: '#2563eb',
  fillColor: '#60a5fa',
  fillOpacity: 0.12,
  weight: 1
}).addTo(map);


/* =====================================================
   6. KALMAN FILTER (1D, applied to lat and lng)
===================================================== */

class Kalman1D {
  constructor(r = 0.00001, q = 0.0003) {
    this.r = r;   // measurement noise
    this.q = q;   // process noise
    this.p = 1;   // estimate covariance
    this.x = null;
  }

  filter(z) {
    if (this.x === null) {
      this.x = z;
      return z;
    }

    this.p += this.q;
    const k = this.p / (this.p + this.r);
    this.x += k * (z - this.x);
    this.p *= (1 - k);

    return this.x;
  }
}

const kLat = new Kalman1D();
const kLng = new Kalman1D();


/* =====================================================
   7. POINT-IN-POLYGON (ray casting)
   point and polygon are [lat, lng] pairs
===================================================== */

function isInsideCampus(point, polygon) {
  const lat = point[0];
  const lng = point[1];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0], xi = polygon[i][1];
    const yj = polygon[j][0], xj = polygon[j][1];

    const intersect =
      ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}


/* =====================================================
   8. STATUS HELPER
===================================================== */

const statusElement = document.getElementById('status');

function updateStatus(message, color) {
  statusElement.innerText = message;
  statusElement.style.background = color;
}


/* =====================================================
   9. GPS TRACKING (RAW + KALMAN)
===================================================== */

if (!navigator.geolocation) {
  updateStatus('GPS NOT SUPPORTED BY THIS BROWSER', '#991b1b');
} else {
  navigator.geolocation.watchPosition(
    function (position) {
      const rawLat = position.coords.latitude;
      const rawLng = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy);

      const lat = kLat.filter(rawLat);
      const lng = kLng.filter(rawLng);
      const filteredPosition = [lat, lng];

      userMarker.setLatLng(filteredPosition);
      accuracyCircle.setLatLng(filteredPosition);
      accuracyCircle.setRadius(accuracy);

      const inside = isInsideCampus(filteredPosition, campusBoundary);

      updateStatus(
        inside
          ? `INSIDE CAMPUS | ±${accuracy}m`
          : `OUTSIDE CAMPUS | ±${accuracy}m`,
        inside ? '#166534' : '#991b1b'
      );

      document.getElementById('gpsAccuracy').innerText =
        `Accuracy: ±${accuracy} metres`;
      document.getElementById('coordinates').innerText =
        `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      document.getElementById('filterStatus').innerText =
        'Kalman: Active';

      console.log({
        rawLatitude: rawLat,
        rawLongitude: rawLng,
        filteredLatitude: lat,
        filteredLongitude: lng,
        accuracy: accuracy,
        campusStatus: inside ? 'INSIDE' : 'OUTSIDE'
      });
    },

    function (error) {
      let message;

      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = 'GPS PERMISSION DENIED';
          break;
        case error.POSITION_UNAVAILABLE:
          message = 'GPS POSITION UNAVAILABLE';
          break;
        case error.TIMEOUT:
          message = 'GPS REQUEST TIMEOUT';
          break;
        default:
          message = 'UNKNOWN GPS ERROR';
      }

      updateStatus(message, '#991b1b');
      console.error(error);
    },

    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000
    }
  );
}