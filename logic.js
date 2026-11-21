
/* =========================================================
   CAMPUS GPS TRACKER
   FILE: script.js

   PROJECT FEATURES:

   1. Leaflet map initialization.
   2. Full Plus Code decoding.
   3. Campus boundary generation.
   4. Polygon and boundary marker rendering.
   5. Live user GPS marker.
   6. GPS accuracy circle.
   7. 1D Kalman filtering.
   8. Point-in-polygon detection.
   9. Continuous GPS monitoring.

   EXTERNAL DEPENDENCY:
   Leaflet.js version 1.9.4

   The Leaflet library is loaded separately in index.html.
========================================================= */



/* =========================================================
   SECTION 1: MAP INITIALIZATION
========================================================= */

/*
   PURPOSE:

   Initialize the Leaflet map and load the
   OpenStreetMap geographical tile layer.

   The map is initially centred around the
   reference geographical coordinates.
*/


/*
   REFERENCE COORDINATES

   These coordinates define the initial map position.

   Latitude  = 22.7378
   Longitude = 88.4565

   IMPORTANT:

   These are only the initial map coordinates.

   They are NOT the live GPS coordinates.

   Actual user coordinates are received later
   through the browser's Geolocation API.
*/

const referenceLat = 22.7378;

const referenceLng = 88.4565;


/*
   CREATE LEAFLET MAP

   L.map('map')
   Creates an interactive map inside the HTML
   element whose ID is "map".

   setView([latitude, longitude], zoom)
   Defines the initial geographical position
   and zoom level.

   Zoom level 17 provides a detailed campus-level view.
*/

const map = L.map('map').setView(
    [referenceLat, referenceLng],
    17
);


/*
   ADD OPENSTREETMAP TILE LAYER

   OpenStreetMap provides the geographical map data.

   URL STRUCTURE:

   {s} = Tile server subdomain.
   {z} = Zoom level.
   {x} = Horizontal tile coordinate.
   {y} = Vertical tile coordinate.

   Leaflet automatically requests the required
   map tiles based on the visible map area.
*/

L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {

        // Maximum supported zoom level.
        maxZoom: 20,

        // Required OpenStreetMap attribution.
        attribution: '&copy; OpenStreetMap contributors'

    }
).addTo(map);




/* =========================================================
   SECTION 2: OPEN LOCATION CODE / PLUS CODE DECODER
========================================================= */

/*
   WHAT IS A PLUS CODE?

   A Plus Code is a geographical location identifier.

   It represents a geographical location using
   a combination of letters and numbers.

   Example:

   7MJCPFR4+7X7

   Instead of directly storing:

   Latitude  = 22.737...
   Longitude = 88.456...

   We can store the location using a Plus Code.

   PURPOSE OF THIS SECTION:

   Convert each full Plus Code into its corresponding
   latitude and longitude.

   No external Plus Code decoding library is used.
*/


/*
   OPEN LOCATION CODE ALPHABET

   The Open Location Code system uses a restricted
   alphabet containing 20 characters.

   Alphabet:

   23456789CFGHJMPQRVWX

   Every character represents a numerical value
   from 0 to 19.

   For example:

   '2' = 0
   '3' = 1
   '4' = 2

   indexOf() is used later to obtain these values.
*/

const OLC_ALPHABET = '23456789CFGHJMPQRVWX';


/*
   FULL PLUS CODE VALIDATION PATTERN

   This regular expression checks whether the
   supplied string follows the expected full
   Plus Code format.

   It checks:

   1. Eight valid characters before '+'.
   2. The '+' separator.
   3. Valid characters after the separator.

   The i flag allows uppercase and lowercase input.

   This pattern is intended for the full-code format
   used in this project.
*/

const OLC_FULL_PATTERN =
    /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]*$/i;



/*
   FUNCTION: decodeFullPlusCode(code)

   PURPOSE:

   Decode a full Plus Code into geographical coordinates.

   INPUT:
   A full Plus Code string.

   OUTPUT:
   An object containing:

   {
       lat: latitude,
       lng: longitude
   }

   The returned coordinates represent the centre
   of the decoded geographical cell.
*/

function decodeFullPlusCode(code) {


    /* -----------------------------------------------
       STEP 1: CONVERT CODE TO UPPERCASE
    ------------------------------------------------ */

    /*
       Ensures that the decoder handles uppercase
       and lowercase Plus Codes consistently.
    */

    const upper = code.toUpperCase();



    /* -----------------------------------------------
       STEP 2: VALIDATE THE PLUS CODE
    ------------------------------------------------ */

    /*
       Check whether the supplied Plus Code follows
       the expected format.

       If validation fails, throw an error.

       The surrounding try-catch block will handle
       the error during campus boundary decoding.
    */

    if (!OLC_FULL_PATTERN.test(upper)) {

        throw new Error(
            `Not a valid full Plus Code: ${code}`
        );

    }



    /* -----------------------------------------------
       STEP 3: CONVERT CHARACTERS INTO NUMBERS
    ------------------------------------------------ */

    /*
       Remove the '+' separator.

       split('')
       Separates the string into individual characters.

       map()
       Converts every character into its numerical
       position in OLC_ALPHABET.

       Example:

       Character sequence: 2345

       Numerical result: [0, 1, 2, 3]
    */

    const digits = upper
        .replace('+', '')
        .split('')
        .map(ch => OLC_ALPHABET.indexOf(ch));



    /* -----------------------------------------------
       STEP 4: INITIALIZE GLOBAL COORDINATE RANGE
    ------------------------------------------------ */

    /*
       Global latitude range:

       -90 degrees to +90 degrees.

       Global longitude range:

       -180 degrees to +180 degrees.

       The decoder starts from the south-western
       corner of the global coordinate system.

       Every decoded character progressively narrows
       the geographical region.
    */

    let lat = -90;

    let lng = -180;



    /* -----------------------------------------------
       STEP 5: DECODE THE FIRST TEN DIGITS
    ------------------------------------------------ */

    /*
       The first ten characters use pair encoding.

       Every pair contains:

       First character  = Latitude.
       Second character = Longitude.

       Pair resolutions:

       Pair 1 = 20 degrees.
       Pair 2 = 1 degree.
       Pair 3 = 0.05 degrees.
       Pair 4 = 0.0025 degrees.
       Pair 5 = 0.000125 degrees.

       Math.min() ensures that no more than
       ten digits are processed here.
    */

    const pairCount = Math.min(digits.length, 10);


    /*
       Iterate over the first ten decoded digits.

       Each digit updates either latitude or longitude.
    */

    for (let i = 0; i < pairCount; i++) {


        /*
           Calculate the current pair index.

           Math.floor(i / 2) groups two digits together.

           i = 0, 1 -> Pair 0.
           i = 2, 3 -> Pair 1.
           i = 4, 5 -> Pair 2.
        */

        const pairIndex = Math.floor(i / 2);


        /*
           Calculate geographical resolution.

           Formula:

           resolution = 20^(1 - pairIndex)

           The resolution becomes progressively
           smaller for each pair.
        */

        const res = Math.pow(20, 1 - pairIndex);


        /*
           EVEN INDEX:

           Update latitude.

           ODD INDEX:

           Update longitude.
        */

        if (i % 2 === 0) {

            // Move north by the decoded latitude amount.
            lat += digits[i] * res;

        } else {

            // Move east by the decoded longitude amount.
            lng += digits[i] * res;

        }

    }



    /* -----------------------------------------------
       STEP 6: GRID REFINEMENT
    ------------------------------------------------ */

    /*
       Characters after the first ten digits use
       a grid refinement system.

       Each additional character subdivides the
       geographical cell into:

       5 rows x 4 columns.

       Row calculation:

       row = floor(digit / 4)

       Column calculation:

       col = digit % 4

       Each new character increases the precision
       of the decoded geographical position.
    */

    let latCell = 0.000125;

    let lngCell = 0.000125;


    /*
       Process all additional digits.

       The loop starts at index 10 because the
       first ten digits were already decoded above.
    */

    for (let i = 10; i < digits.length; i++) {


        /*
           Divide the current cell dimensions.

           Latitude is divided into five rows.

           Longitude is divided into four columns.
        */

        latCell /= 5;

        lngCell /= 4;


        /*
           Calculate the grid row and column
           represented by the current character.
        */

        const row = Math.floor(digits[i] / 4);

        const col = digits[i] % 4;


        /*
           Update the south-western corner of
           the smaller geographical cell.
        */

        lat += row * latCell;

        lng += col * lngCell;

    }



    /* -----------------------------------------------
       STEP 7: RETURN CELL CENTRE COORDINATES
    ------------------------------------------------ */

    /*
       The calculated lat and lng currently represent
       the south-western corner of the final cell.

       Add half of each cell dimension to obtain
       the geographical centre.

       Return the coordinates as an object.
    */

    return {

        lat: lat + latCell / 2,

        lng: lng + lngCell / 2

    };

}




/* =========================================================
   SECTION 3: CAMPUS BOUNDARY - FULL PLUS CODES
========================================================= */

/*
   This array stores the geographical points that
   define the campus boundary.

   Each element is a full Plus Code.

   IMPORTANT:

   The sequence of points must follow the actual
   campus boundary in the correct order.

   Leaflet connects each point to the next point.

   If the order is incorrect, the resulting polygon
   may cross itself or represent the wrong area.

   The final point is automatically connected to
   the first point when Leaflet renders the polygon.
*/


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




/* =========================================================
   SECTION 4: DECODE BOUNDARY AND DRAW CAMPUS POLYGON
========================================================= */

/*
   PURPOSE:

   Convert all campus boundary Plus Codes into
   latitude-longitude coordinates.

   Then use those coordinates to draw the campus
   boundary on the Leaflet map.
*/


/* -----------------------------------------------
   STEP 1: DECODE ALL PLUS CODES
------------------------------------------------ */

/*
   decodedBoundary will store the final decoded
   geographical coordinates.

   Initially, it is undefined because decoding
   has not yet been performed.
*/

let decodedBoundary;


/*
   TRY-CATCH ERROR HANDLING

   Every Plus Code is decoded inside a try block.

   If one code is invalid, an error is thrown.

   The catch block:
   - Displays an error message.
   - Changes the status background to red.
   - Prints the error in the console.
   - Stops execution because the boundary is incomplete.
*/

try {

    /*
       map() iterates over every Plus Code.

       For each code:

       1. Decode the Plus Code.
       2. Extract latitude and longitude.
       3. Store the original Plus Code.
       4. Store its sequential point number.
    */

    decodedBoundary = campusBoundaryPlusCodes.map(
        (code, index) => {

            // Convert the current Plus Code into coordinates.
            const point = decodeFullPlusCode(code);


            // Return a structured boundary point.
            return {

                code: code,

                lat: point.lat,

                lng: point.lng,

                // Array indices start at 0, so add 1.
                index: index + 1

            };

        }
    );


} catch (error) {

    // Find the status element in the HTML document.
    const statusEl = document.getElementById('status');


    // Display the error message.
    statusEl.innerText =
        'BOUNDARY ERROR: ' + error.message;


    // Change the status background to red.
    statusEl.style.background = '#991b1b';


    // Print the error for debugging.
    console.error(error);


    // Stop execution because the boundary is invalid.
    throw error;

}



/* -----------------------------------------------
   STEP 2: CONVERT TO LEAFLET COORDINATE FORMAT
------------------------------------------------ */

/*
   Leaflet expects geographical coordinates in
   the following format:

   [
       [latitude1, longitude1],
       [latitude2, longitude2],
       [latitude3, longitude3]
   ]

   decodedBoundary contains objects.

   map() extracts only latitude and longitude
   from each object.
*/

const campusBoundary = decodedBoundary.map(
    p => [p.lat, p.lng]
);



/* -----------------------------------------------
   STEP 3: DRAW CAMPUS POLYGON
------------------------------------------------ */

/*
   L.polygon() connects all geographical boundary
   points to create a closed geographical area.

   OPTIONS:

   color       = Border colour.
   weight      = Border thickness.
   fillColor   = Interior fill colour.
   fillOpacity = Interior transparency.

   addTo(map) displays the polygon.
*/

const campusPolygon = L.polygon(
    campusBoundary,
    {

        color: '#1e3a8a',

        weight: 3,

        fillColor: '#3b82f6',

        fillOpacity: 0.15

    }
).addTo(map);



/* -----------------------------------------------
   STEP 4: CREATE BOUNDARY POINT MARKERS
------------------------------------------------ */

/*
   Create a Leaflet layer group.

   This group will contain all individual
   campus boundary markers.

   Grouping markers makes it easier to manage
   them collectively.
*/

const boundaryMarkers = L.layerGroup();



/*
   Iterate through every decoded boundary point.

   Each point receives a small circular marker.

   bindTooltip() displays the point number and
   its original Plus Code when the user hovers
   over the marker.
*/

decodedBoundary.forEach(point => {

    L.circleMarker(
        [point.lat, point.lng],
        {

            radius: 3,

            color: '#dc2626',

            fillColor: '#ef4444',

            fillOpacity: 1,

            weight: 1

        }
    )

    .bindTooltip(
        `Point ${point.index}: ${point.code}`
    )

    .addTo(boundaryMarkers);

});



/*
   Add the complete boundary marker group to the map.
*/

boundaryMarkers.addTo(map);



/* -----------------------------------------------
   STEP 5: AUTOMATICALLY FIT MAP TO CAMPUS
------------------------------------------------ */

/*
   getBounds()

   Calculates the geographical bounding rectangle
   containing all campus polygon coordinates.

   fitBounds()

   Automatically adjusts the map's centre and zoom
   so that the entire campus boundary is visible.

   padding: [35, 35]

   Adds 35 pixels of spacing around the boundary.
*/

map.fitBounds(
    campusPolygon.getBounds(),
    {
        padding: [35, 35]
    }
);



/* -----------------------------------------------
   STEP 6: DISPLAY BOUNDARY POINT COUNT
------------------------------------------------ */

/*
   Update the information panel with the total
   number of decoded campus boundary points.
*/

document.getElementById('boundaryCount').innerText =
    `Boundary points: ${campusBoundary.length}`;



/* -----------------------------------------------
   STEP 7: DEBUGGING
------------------------------------------------ */

/*
   console.table() displays the decoded boundary
   in a readable table.

   Useful fields:

   - Original Plus Code
   - Latitude
   - Longitude
   - Point index

   Open Developer Tools -> Console to inspect it.
*/

console.table(decodedBoundary);




/* =========================================================
   SECTION 5: USER GPS MARKER AND ACCURACY CIRCLE
========================================================= */

/*
   PURPOSE:

   Create the visual elements representing the user's
   current GPS location.

   Two elements are created:

   1. User location marker.
   2. GPS accuracy circle.

   Both are updated whenever a new GPS measurement
   is received.
*/


/* -----------------------------------------------
   STEP 1: CREATE CUSTOM USER LOCATION ICON
------------------------------------------------ */

/*
   L.icon() creates a custom Leaflet marker icon.

   iconUrl:
   URL of the marker image.

   iconSize:
   Width and height of the marker image.

   iconAnchor:
   The position within the image that represents
   the actual geographical coordinate.

   [21, 42] means the anchor is at the bottom centre.
*/

const userIcon = L.icon({

    iconUrl:
        'https://static.vecteezy.com/system/resources/thumbnails/029/166/580/small/icon-location-map-ai-generative-png.png',

    iconSize: [42, 42],

    iconAnchor: [21, 42]

});



/* -----------------------------------------------
   STEP 2: CREATE USER LOCATION MARKER
------------------------------------------------ */

/*
   L.marker() creates a geographical marker.

   Initially, the marker is placed at the reference
   coordinates.

   When GPS tracking starts, setLatLng() will
   continuously update its position.

   We update the existing marker instead of creating
   a new marker for every GPS measurement.
*/

const userMarker = L.marker(
    [referenceLat, referenceLng],
    {
        icon: userIcon
    }
).addTo(map);



/* -----------------------------------------------
   STEP 3: CREATE GPS ACCURACY CIRCLE
------------------------------------------------ */

/*
   The accuracy circle visually represents the
   estimated horizontal uncertainty of the GPS reading.

   Example:

   GPS accuracy = 10 metres.

   Circle radius = 10 metres.

   The circle is updated whenever a new GPS position
   is received.

   IMPORTANT:

   This circle represents the GPS provider's reported
   accuracy. It is not a guarantee that the actual
   location lies within the circle.
*/

const accuracyCircle = L.circle(
    [referenceLat, referenceLng],
    {

        // Initial radius is zero until GPS data arrives.
        radius: 0,

        color: '#2563eb',

        fillColor: '#60a5fa',

        fillOpacity: 0.12,

        weight: 1

    }
).addTo(map);




/* =========================================================
   SECTION 6: KALMAN FILTER IMPLEMENTATION
========================================================= */

/*
   WHAT IS A KALMAN FILTER?

   GPS readings are not perfectly stable.

   Even if a person is standing still, GPS coordinates
   may fluctuate because of:

   - Satellite signal variation.
   - Buildings and physical obstacles.
   - Atmospheric interference.
   - Multipath signal reflection.
   - Receiver measurement noise.

   A Kalman filter estimates a more stable position
   by combining the previous estimate with the
   latest measurement.

   OUR IMPLEMENTATION:

   We use a simplified 1D Kalman filter.

   One filter processes latitude.

   Another filter processes longitude.

   Both filters operate independently.
*/


/*
   CLASS: Kalman1D

   A class acts as a blueprint for creating objects.

   Each Kalman1D object maintains its own filter state.

   PARAMETERS:

   r = Measurement noise covariance.

   q = Process noise covariance.

   p = Estimate covariance.

   x = Current estimated coordinate.
*/

class Kalman1D {


    /* -----------------------------------------------
       CONSTRUCTOR
    ------------------------------------------------ */

    /*
       The constructor executes automatically
       whenever a new Kalman1D object is created.

       Default values:

       r = 0.00001
       q = 0.0003
    */

    constructor(r = 0.00001, q = 0.0003) {

        // Measurement noise covariance.
        this.r = r;

        // Process noise covariance.
        this.q = q;

        // Initial estimate uncertainty.
        this.p = 1;

        // No previous GPS estimate initially.
        this.x = null;

    }



    /* -----------------------------------------------
       FILTER METHOD
    ------------------------------------------------ */

    /*
       FUNCTION:

       filter(z)

       INPUT:
       z = New raw GPS measurement.

       OUTPUT:
       Updated filtered coordinate.

       The method performs:

       1. Initial estimate handling.
       2. Prediction.
       3. Kalman gain calculation.
       4. Measurement update.
       5. Covariance update.
    */

    filter(z) {


        /* STEP 1: HANDLE FIRST GPS MEASUREMENT */

        /*
           If no previous estimate exists,
           initialize the filter using the first
           available GPS measurement.

           There is no earlier estimate to compare
           against at this stage.
        */

        if (this.x === null) {

            this.x = z;

            return z;

        }



        /* STEP 2: PREDICTION */

        /*
           Formula:

           P = P + Q

           P = Previous estimate covariance.

           Q = Process noise covariance.

           The process noise is added to account
           for uncertainty introduced between updates.
        */

        this.p += this.q;



        /* STEP 3: CALCULATE KALMAN GAIN */

        /*
           Formula:

           K = P / (P + R)

           P = Predicted estimate covariance.

           R = Measurement noise covariance.

           K = Kalman gain.

           The Kalman gain determines how much
           importance should be given to the new
           measurement compared with the previous
           estimate.

           Higher K:
           Greater influence from the new measurement.

           Lower K:
           Greater influence from the previous estimate.
        */

        const k = this.p / (this.p + this.r);



        /* STEP 4: UPDATE THE ESTIMATED POSITION */

        /*
           Formula:

           X = X + K(Z - X)

           X = Previous estimated coordinate.

           Z = New GPS measurement.

           K = Kalman gain.

           (Z - X) = Difference between the
                     measurement and estimate.

           The estimate moves towards the new
           measurement according to the Kalman gain.
        */

        this.x += k * (z - this.x);



        /* STEP 5: UPDATE ESTIMATE COVARIANCE */

        /*
           Formula:

           P = (1 - K)P

           Once the new measurement has been
           incorporated, the estimated uncertainty
           is reduced.
        */

        this.p *= (1 - k);



        /* STEP 6: RETURN FILTERED VALUE */

        /*
           Return the updated estimated coordinate.
        */

        return this.x;

    }

}



/* -----------------------------------------------
   CREATE TWO KALMAN FILTER OBJECTS
------------------------------------------------ */

/*
   We create two independent filter objects.

   kLat:

   Processes latitude measurements.

   kLng:

   Processes longitude measurements.

   Both use the default noise parameters
   defined in the Kalman1D constructor.
*/

const kLat = new Kalman1D();

const kLng = new Kalman1D();




/* =========================================================
   SECTION 7: POINT-IN-POLYGON ALGORITHM
========================================================= */

/*
   PURPOSE:

   Determine whether the user's current GPS location
   lies inside the campus geographical boundary.

   ALGORITHM:

   RAY CASTING ALGORITHM.

   BASIC CONCEPT:

   Imagine drawing a horizontal ray from the user's
   geographical position towards the right.

   Count how many times the ray intersects the
   polygon boundary.

   If the number of intersections is:

   ODD  -> Point is inside the polygon.

   EVEN -> Point is outside the polygon.

   This is a commonly used method for point-in-polygon
   detection.

   The implementation treats the local campus
   coordinates as planar latitude-longitude values.
*/


/*
   FUNCTION:

   isInsideCampus(point, polygon)

   INPUT:

   point:
   [latitude, longitude]

   polygon:
   Array of [latitude, longitude] coordinates.

   OUTPUT:

   true  = Location is inside the campus.

   false = Location is outside the campus.
*/

function isInsideCampus(point, polygon) {


    /* -----------------------------------------------
       STEP 1: EXTRACT USER COORDINATES
    ------------------------------------------------ */

    /*
       The current GPS location is passed as:

       [latitude, longitude]

       Extract both values separately.
    */

    const lat = point[0];

    const lng = point[1];



    /* -----------------------------------------------
       STEP 2: INITIALIZE INSIDE FLAG
    ------------------------------------------------ */

    /*
       Initially assume that the point is outside.

       Each valid ray intersection will toggle
       the inside/outside state.
    */

    let inside = false;



    /* -----------------------------------------------
       STEP 3: ITERATE THROUGH POLYGON EDGES
    ------------------------------------------------ */

    /*
       i = Current polygon vertex.

       j = Previous polygon vertex.

       Starting j at polygon.length - 1 ensures
       that we also check the edge connecting
       the final vertex to the first vertex.

       This is necessary because a polygon is closed.
    */

    for (
        let i = 0, j = polygon.length - 1;
        i < polygon.length;
        j = i++
    ) {


        /*
           Extract the geographical coordinates
           of the two vertices forming the current edge.

           yi = Current vertex latitude.
           xi = Current vertex longitude.

           yj = Previous vertex latitude.
           xj = Previous vertex longitude.
        */

        const yi = polygon[i][0];

        const xi = polygon[i][1];

        const yj = polygon[j][0];

        const xj = polygon[j][1];



        /* -------------------------------------------
           STEP 4: CHECK RAY-EDGE INTERSECTION
        -------------------------------------------- */

        /*
           CONDITION 1:

           ((yi > lat) !== (yj > lat))

           Checks whether the polygon edge crosses
           the horizontal latitude line passing
           through the user's position.

           CONDITION 2:

           lng < intersection longitude

           Checks whether the user's position lies
           to the left of the intersection.

           If both conditions are true, the ray
           intersects the current polygon edge.
        */

        const intersect =

            ((yi > lat) !== (yj > lat)) &&

            (
                lng <
                (xj - xi) * (lat - yi) / (yj - yi) + xi
            );



        /* -------------------------------------------
           STEP 5: TOGGLE INSIDE/OUTSIDE STATE
        -------------------------------------------- */

        /*
           Every intersection reverses the current state.

           false becomes true.

           true becomes false.

           After every polygon edge has been checked,
           the final state determines the result.
        */

        if (intersect) {

            inside = !inside;

        }

    }



    /* -----------------------------------------------
       STEP 6: RETURN FINAL RESULT
    ------------------------------------------------ */

    return inside;

}




/* =========================================================
   SECTION 8: STATUS UPDATE HELPER
========================================================= */

/*
   PURPOSE:

   Create a reusable function to update the GPS
   status message and its background colour.

   This avoids repeating DOM manipulation code
   throughout the application.
*/


/*
   Retrieve the HTML element with ID "status".

   document.getElementById() finds an element
   using its unique HTML ID.

   We store the reference once instead of
   searching for the element every time.
*/

const statusElement = document.getElementById('status');



/*
   FUNCTION:

   updateStatus(message, color)

   INPUT:

   message = Text to display in the status box.

   color = Background colour of the status box.

   This helper is used for:

   - Inside campus.
   - Outside campus.
   - GPS errors.
   - Unsupported GPS.
*/

function updateStatus(message, color) {

    // Update the visible status text.
    statusElement.innerText = message;

    // Update the status box background colour.
    statusElement.style.background = color;

}




/* =========================================================
   SECTION 9: LIVE GPS TRACKING
========================================================= */

/*
   PURPOSE:

   Continuously monitor the user's geographical
   position using the browser's Geolocation API.

   API:

   navigator.geolocation.watchPosition()

   This method continuously watches the user's
   location and executes callbacks when new
   position information becomes available.

   It accepts three arguments:

   1. Success callback.
   2. Error callback.
   3. GPS configuration options.

   Unlike getCurrentPosition(), watchPosition()
   continues monitoring location changes.
*/


/* -----------------------------------------------
   STEP 1: CHECK GPS SUPPORT
------------------------------------------------ */

/*
   Check whether the browser supports the
   Geolocation API.

   If unsupported, display an error message
   instead of attempting to start GPS tracking.
*/

if (!navigator.geolocation) {


    updateStatus(
        'GPS NOT SUPPORTED BY THIS BROWSER',
        '#991b1b'
    );


} else {


    /* -------------------------------------------
       STEP 2: START CONTINUOUS GPS TRACKING
    -------------------------------------------- */

    /*
       watchPosition() monitors the device's location.

       ARGUMENT 1:
       SUCCESS CALLBACK.

       Runs whenever a GPS position is received.

       ARGUMENT 2:
       ERROR CALLBACK.

       Runs if the browser cannot obtain the location.

       ARGUMENT 3:
       CONFIGURATION OPTIONS.

       Controls location accuracy, caching and timeout.
    */


    navigator.geolocation.watchPosition(



        /* =========================================
           SUCCESS CALLBACK
        ========================================== */

        function (position) {


            /* -------------------------------------
               STEP 3: EXTRACT RAW GPS DATA
            -------------------------------------- */

            /*
               position.coords.latitude:

               Latitude received from the device's
               GPS/location provider.

               position.coords.longitude:

               Longitude received from the device.

               position.coords.accuracy:

               Estimated horizontal GPS accuracy
               in metres.

               These are raw measurements before
               Kalman filtering.
            */

            const rawLat = position.coords.latitude;

            const rawLng = position.coords.longitude;

            const accuracy = Math.round(
                position.coords.accuracy
            );



            /* -------------------------------------
               STEP 4: APPLY KALMAN FILTER
            -------------------------------------- */

            /*
               Send raw latitude into the latitude filter.

               Send raw longitude into the longitude filter.

               Each filter independently estimates
               a more stable geographical coordinate.

               lat = Filtered latitude.

               lng = Filtered longitude.
            */

            const lat = kLat.filter(rawLat);

            const lng = kLng.filter(rawLng);



            /*
               Combine the filtered coordinates into
               Leaflet's required coordinate format:

               [latitude, longitude]
            */

            const filteredPosition = [lat, lng];



            /* -------------------------------------
               STEP 5: UPDATE USER LOCATION MARKER
            -------------------------------------- */

            /*
               setLatLng() moves the existing marker
               to the latest filtered GPS position.

               We update the existing marker instead
               of creating a new marker for every
               GPS measurement.

               This prevents unnecessary markers
               from accumulating on the map.
            */

            userMarker.setLatLng(filteredPosition);



            /* -------------------------------------
               STEP 6: UPDATE GPS ACCURACY CIRCLE
            -------------------------------------- */

            /*
               First, move the accuracy circle to
               the latest filtered GPS coordinates.

               Then, update its radius using the
               GPS-reported accuracy.

               Example:

               Accuracy = 8 metres.

               Circle radius = 8 metres.
            */

            accuracyCircle.setLatLng(filteredPosition);

            accuracyCircle.setRadius(accuracy);



            /* -------------------------------------
               STEP 7: CHECK CAMPUS MEMBERSHIP
            -------------------------------------- */

            /*
               Pass two arguments into isInsideCampus():

               1. Current filtered GPS coordinates.
               2. Decoded campus polygon coordinates.

               The function uses the ray casting algorithm
               to determine whether the user's location
               lies inside the campus boundary.

               Returns:

               true  = Inside campus.

               false = Outside campus.
            */

            const inside = isInsideCampus(
                filteredPosition,
                campusBoundary
            );



            /* -------------------------------------
               STEP 8: UPDATE CAMPUS STATUS
            -------------------------------------- */

            /*
               If the user is inside:

               Display:
               INSIDE CAMPUS | ±accuracy

               Background:
               Green.

               If the user is outside:

               Display:
               OUTSIDE CAMPUS | ±accuracy

               Background:
               Red.

               The accuracy value is displayed
               alongside the campus status.
            */

            updateStatus(

                inside

                    ? `INSIDE CAMPUS | ±${accuracy}m`

                    : `OUTSIDE CAMPUS | ±${accuracy}m`,

                inside

                    ? '#166534'

                    : '#991b1b'

            );



            /* -------------------------------------
               STEP 9: UPDATE GPS ACCURACY PANEL
            -------------------------------------- */

            /*
               Display the latest GPS-reported
               horizontal accuracy in metres.
            */

            document.getElementById('gpsAccuracy').innerText =

                `Accuracy: ±${accuracy} metres`;



            /* -------------------------------------
               STEP 10: UPDATE COORDINATES PANEL
            -------------------------------------- */

            /*
               Display the filtered latitude
               and longitude.

               toFixed(6):

               Limits the displayed decimal places
               to six digits.

               This only changes the displayed
               representation, not the actual
               stored coordinate values.
            */

            document.getElementById('coordinates').innerText =

                `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;



            /* -------------------------------------
               STEP 11: UPDATE KALMAN STATUS
            -------------------------------------- */

            /*
               Indicates that the GPS coordinates
               are being processed through the
               Kalman filtering stage.
            */

            document.getElementById('filterStatus').innerText =

                'Kalman: Active';



            /* -------------------------------------
               STEP 12: DEBUGGING AND LOGGING
            -------------------------------------- */

            /*
               console.log() prints the GPS information
               in the browser's Developer Tools console.

               It is useful for comparing:

               - Raw GPS coordinates.
               - Filtered GPS coordinates.
               - GPS accuracy.
               - Final campus detection result.

               Open Developer Tools -> Console.
            */

            console.log({

                // Original latitude from the GPS provider.
                rawLatitude: rawLat,

                // Original longitude from the GPS provider.
                rawLongitude: rawLng,

                // Latitude after Kalman filtering.
                filteredLatitude: lat,

                // Longitude after Kalman filtering.
                filteredLongitude: lng,

                // Reported GPS accuracy in metres.
                accuracy: accuracy,

                // Final campus membership result.
                campusStatus: inside
                    ? 'INSIDE'
                    : 'OUTSIDE'

            });

        },



        /* =========================================
           ERROR CALLBACK
        ========================================== */

        function (error) {


            /*
               This callback executes when the browser
               cannot retrieve a valid GPS position.

               The error object contains a numerical code.

               We use switch-case to identify the
               error and display a meaningful message.
            */

            let message;


            switch (error.code) {


                /*
                   ERROR 1:

                   The user denied location permission.

                   The browser cannot access the user's
                   location without permission.
                */

                case error.PERMISSION_DENIED:

                    message = 'GPS PERMISSION DENIED';

                    break;



                /*
                   ERROR 2:

                   The browser could not determine
                   the device's current geographical position.
                */

                case error.POSITION_UNAVAILABLE:

                    message = 'GPS POSITION UNAVAILABLE';

                    break;



                /*
                   ERROR 3:

                   The location request exceeded
                   the configured waiting time.
                */

                case error.TIMEOUT:

                    message = 'GPS REQUEST TIMEOUT';

                    break;



                /*
                   Any unexpected or unrecognized error.
                */

                default:

                    message = 'UNKNOWN GPS ERROR';

            }



            /*
               Display the error message in the status
               panel and change the background to red.
            */

            updateStatus(message, '#991b1b');


            /*
               Print the complete error object
               for debugging purposes.
            */

            console.error(error);

        },



        /* =========================================
           GPS CONFIGURATION OPTIONS
        ========================================== */

        {

            /*
               enableHighAccuracy: true

               Requests the most accurate location
               information available from the device.

               The browser may use GPS hardware or
               other available location technologies.

               Higher accuracy may consume more battery.
            */

            enableHighAccuracy: true,


            /*
               maximumAge: 0

               Do not accept a cached location result.

               Request a fresh location measurement
               instead of using an older cached result.
            */

            maximumAge: 0,


            /*
               timeout: 15000

               Maximum waiting time for a location
               request.

               Unit = milliseconds.

               15000 milliseconds = 15 seconds.
            */

            timeout: 15000

        }

    );

}

