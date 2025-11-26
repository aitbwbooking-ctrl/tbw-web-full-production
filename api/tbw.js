// =====================================================
// TBW AI PREMIUM NAVIGATOR – HYBRID BACKEND (Vercel)
// =====================================================
//
// Radi kao /api/tbw na Vercelu (Node 18+)
// - globalni kill switch + premium / blocked users + admin panel
// - više API-ja: OpenWeather, TomTom, AviationStack, OpenTripMap
// - Booking V3 + V4 (scraper), Airbnb, Expedia
// - demo livecam, truck, transit, city services, food, ...
// =====================================================

// -------- ENV VARS (podržava *_KEY i *_API_KEY nazive) -----

function envOr() {
  for (var i = 0; i < arguments.length; i++) {
    if (process.env[arguments[i]]) return process.env[arguments[i]];
  }
  return null;
}

const OPENWEATHER_KEY   = envOr("OPENWEATHER_KEY",   "OPENWEATHER_API_KEY")   || "YOUR_OPENWEATHER_API_KEY";
const TOMTOM_KEY        = envOr("TOMTOM_KEY",        "TOMTOM_API_KEY")        || "YOUR_TOMTOM_TRAFFIC_KEY";
const BOOKING_RAPID_KEY = envOr("BOOKING_RAPID_KEY", "BOOKING_RAPID_KEY")     || "YOUR_RAPIDAPI_BOOKING_KEY";
const AVIATIONSTACK_KEY = envOr("AVIATIONSTACK_KEY", "AVIATIONSTACK_API_KEY") || "YOUR_AVIATIONSTACK_KEY";
const OPENTRIPMAP_KEY   = envOr("OPENTRIPMAP_KEY",   "OPENTRIPMAP_API_KEY")   || "YOUR_OPENTRIPMAP_KEY";
const UNSPLASH_KEY      = envOr("UNSPLASH_KEY",      "UNSPLASH_ACCESS_KEY")   || "YOUR_UNSPLASH_ACCESS_KEY";
const GOOGLE_MAPS_API_KEY = envOr("GOOGLE_MAPS_API_KEY", "GOOGLE_DIRECTIONS_API_KEY") || "YOUR_GOOGLE_MAPS_API_KEY";

const TBW_ADMIN_TOKEN     = envOr("TBW_ADMIN_TOKEN", "ADMIN_ACCESS_TOKEN") || "CHANGE_THIS_ADMIN_TOKEN";
const TBW_KILL_SWITCH_ENV = process.env.TBW_KILL_SWITCH || "0";
const TBW_BLOCKED_USERS   = process.env.TBW_BLOCKED_USERS || "";
const TBW_PREMIUM_USERS   = process.env.TBW_PREMIUM_USERS || "";
const FOUNDER_PREMIUM_KEY = process.env.FOUNDER_PREMIUM_KEY || "";

// stvarni runtime flag (može se mijenjati preko /admin)
let killSwitchFlag = TBW_KILL_SWITCH_ENV === "1";

let blockedUsers = TBW_BLOCKED_USERS
  .split(",")
  .map(function (x) { return x.trim(); })
  .filter(function (x) { return x.length > 0; });

let premiumUsers = TBW_PREMIUM_USERS
  .split(",")
  .map(function (x) { return x.trim(); })
  .filter(function (x) { return x.length > 0; });

// =====================================================
// SIMPLE IN-MEMORY CACHE
// =====================================================

const cache = {}; // key -> { ts, ttl, data }

function cacheKey(route, params) {
  return (
    route +
    ":" +
    Object.keys(params || {})
      .sort()
      .map(function (k) {
        return k + "=" + params[k];
      })
      .join("&")
  );
}

function cacheGet(route, params) {
  const key = cacheKey(route, params);
  const item = cache[key];
  if (!item) return null;
  const now = Date.now();
  if (now - item.ts > item.ttl) {
    delete cache[key];
    return null;
  }
  return item.data;
}

function cacheSet(route, params, data, ttlMs) {
  const key = cacheKey(route, params);
  cache[key] = {
    ts: Date.now(),
    ttl: ttlMs,
    data: data
  };
}

// =====================================================
// UTIL FUNKCIJE
// =====================================================

function safe(obj, key, fallback) {
  if (!obj) return fallback;
  if (obj[key] === undefined || obj[key] === null) return fallback;
  return obj[key];
}

async function getJSON(url, headers) {
  const res = await fetch(url, { headers: headers || {} });
  if (!res.ok) {
    throw new Error("API error " + res.status + " for " + url);
  }
  return await res.json();
}

function getUserId(req) {
  if (req.query && req.query.userId) return String(req.query.userId);
  if (req.headers && req.headers["x-user-id"]) return String(req.headers["x-user-id"]);
  return "anon";
}

function isBlockedUser(userId) {
  if (!userId) return false;
  return blockedUsers.indexOf(userId) >= 0;
}

function isPremiumUser(userId) {
  if (!userId) return false;
  return premiumUsers.indexOf(userId) >= 0;
}

// =====================================================
// HERO – UNSPLASH
// =====================================================

async function hero(city) {
  const cached = cacheGet("hero", { city: city });
  if (cached) return cached;

  try {
    var images = [];
    if (UNSPLASH_KEY && UNSPLASH_KEY !== "YOUR_UNSPLASH_ACCESS_KEY") {
      const url =
        "https://api.unsplash.com/search/photos?query=" +
        encodeURIComponent(city + " city night skyline") +
        "&orientation=landscape&per_page=3&client_id=" +
        UNSPLASH_KEY;

      const json = await getJSON(url);
      if (json && json.results && json.results.length > 0) {
        images = json.results
          .slice(0, 3)
          .map(function (p) {
            const u = safe(p, "urls", {});
            if (u.regular) return u.regular;
            if (u.full) return u.full;
            return null;
          })
          .filter(function (x) { return !!x; });
      }
    }

    if (!images || images.length === 0) {
      images = [
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600&q=80"
      ];
    }

    const result = {
      city: city,
      images: images
    };

    cacheSet("hero", { city: city }, result, 10 * 60 * 1000);
    return result;
  } catch (e) {
    console.error("hero error", e);
    return {
      city: city,
      images: [
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1600&q=80"
      ]
    };
  }
}

// =====================================================
// WEATHER – OpenWeather
// =====================================================

async function weather(city) {
  const cached = cacheGet("weather", { city: city });
  if (cached) return cached;

  try {
    const url =
      "https://api.openweathermap.org/data/2.5/weather?q=" +
      encodeURIComponent(city) +
      "&appid=" +
      OPENWEATHER_KEY +
      "&units=metric&lang=hr";

    const json = await getJSON(url);
    const data = {
      city: city,
      temp: safe(json.main, "temp", null),
      condition:
        json && json.weather && json.weather[0]
          ? safe(json.weather[0], "description", "")
          : ""
    };

    cacheSet("weather", { city: city }, data, 5 * 60 * 1000);
    return data;
  } catch (e) {
    console.error("weather error", e);
    return { city: city, temp: null, condition: null };
  }
}

// =====================================================
// TRAFFIC – TomTom (demo za HR – možeš proširiti kasnije)
// =====================================================

async function traffic(city) {
  const cached = cacheGet("traffic", { city: city });
  if (cached) return cached;

  try {
    // demo – Zagreb koordinate, kasnije možeš mapirati grad -> lat/lon
    const url =
      "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=45.815,15.9819&key=" +
      TOMTOM_KEY;

    const json = await getJSON(url);
    const data = safe(json, "flowSegmentData", {});

    var levelText = "umjeren";
    const speed = safe(data, "currentSpeed", null);
    if (speed !== null) {
      if (speed < 20) levelText = "gust";
      else if (speed < 40) levelText = "pojačan";
      else levelText = "slab";
    }

    const result = {
      city: city,
      status: "Promet " + levelText,
      level: speed
    };

    cacheSet("traffic", { city: city }, result, 60 * 1000);
    return result;
  } catch (e) {
    console.error("traffic error", e);
    return { city: city, status: "N/A", level: null };
  }
}

// =====================================================
// ALERTS – hibridna demo logika
// =====================================================

async function alerts(city) {
  // Za sad simple tekst; kasnije možeš spojiti MeteoAlarm / Civilnu zaštitu
  return {
    city: city,
    alert: "Nema posebnih upozorenja za ovo područje."
  };
}

// =====================================================
// SEA – DEMO
// =====================================================

async function sea(city) {
  return {
    city: city,
    state: "Umjereno valovito, dobro za kupanje."
  };
}

// =====================================================
// BOOKING – V3 + V4 HIBRID
// =====================================================

// V3 – globalni scraper + AI rank (samo search stranica)
async function bookingV3(city) {
  const searchUrl =
    "https://www.booking.com/searchresults.html?ss=" +
    encodeURIComponent(city) +
    "&lang=hr";

  const html = await fetch(searchUrl).then(function (r) { return r.text(); });

  // CIJENE
  var priceRegex = /€\s?(\d{1,4})/g;
  var prices = [];
  var m;
  while ((m = priceRegex.exec(html)) !== null) {
    prices.push(parseInt(m[1], 10));
  }

  var priceMin = prices.length ? Math.min.apply(null, prices) : null;
  var priceMax = prices.length ? Math.max.apply(null, prices) : null;
  var priceAvg = prices.length
    ? Math.round(prices.reduce(function (a, b) { return a + b; }, 0) / prices.length)
    : null;

  // IMENA HOTELA
  var nameRegex = /sr-hotel__name.*?>(.*?)</g;
  var hotels = [];
  var n;
  while ((n = nameRegex.exec(html)) !== null) {
    var h = n[1].replace(/\s+/g, " ").trim();
    if (h.length > 2) hotels.push(h);
  }

  // RATING
  var ratingRegex = /bui-review-score__badge.*?>(\d\.\d)</g;
  var ratings = [];
  var r;
  while ((r = ratingRegex.exec(html)) !== null) {
    ratings.push(parseFloat(r[1]));
  }

  var combined = hotels
    .map(function (name, i) {
      return {
        name: name,
        rating: ratings[i] || null
      };
    })
    .slice(0, 10);

  var bestHotel = null;
  if (combined.length > 0) {
    combined.sort(function (a, b) {
      return (b.rating || 0) - (a.rating || 0);
    });
    bestHotel = combined[0];
  }

  return {
    city: city,
    engine: "booking_v3",
    topHotels: combined,
    bestHotel: bestHotel,
    priceMin: priceMin ? priceMin + "€" : "N/A",
    priceAvg: priceAvg ? priceAvg + "€" : "N/A",
    priceMax: priceMax ? priceMax + "€" : "N/A",
    url: searchUrl
  };
}

// V4 – deep scrape: pokušaj izvući i adresu, review count, district
async function bookingV4(city, checkin, checkout, adults) {
  const params = new URLSearchParams();
  params.set("ss", city);
  params.set("lang", "hr");

  if (checkin) {
    params.set("checkin", checkin); // yyyy-mm-dd
  }
  if (checkout) {
    params.set("checkout", checkout);
  }
  if (adults) {
    params.set("group_adults", String(adults));
  }

  const searchUrl = "https://www.booking.com/searchresults.html?" + params.toString();
  const html = await fetch(searchUrl).then(function (r) { return r.text(); });

  // grubi regex za blokove hotela
  var hotelBlockRegex = /data-testid="property-card".*?<\/div>\s*<\/div>/g;
  var blocks = [];
  var hb;
  while ((hb = hotelBlockRegex.exec(html)) !== null) {
    blocks.push(hb[0]);
  }

  var hotels = blocks.slice(0, 8).map(function (block) {
    // naziv
    var nameMatch = block.match(/data-testid="title".*?>(.*?)<\/div>/);
    var name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, "").trim() : null;

    // rating
    var ratingMatch = block.match(/data-testid="review-score".*?>(\d\.\d)</);
    var rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

    // reviews
    var revMatch = block.match(/data-testid="review-score".*?(\d{1,5})\s+recenzija/);
    var reviews = revMatch ? parseInt(revMatch[1], 10) : null;

    // district / lokacija
    var distMatch = block.match(/data-testid="address".*?>(.*?)<\/span>/);
    var district = distMatch ? distMatch[1].replace(/<[^>]+>/g, "").trim() : null;

    // price (jedna cifra)
    var priceMatch = block.match(/€\s?(\d{1,4})/);
    var price = priceMatch ? priceMatch[1] + "€" : null;

    return {
      name: name,
      rating: rating,
      reviews: reviews,
      district: district,
      price: price
    };
  });

  var bestHotel = null;
  if (hotels.length > 0) {
    hotels.sort(function (a, b) {
      var ra = a.rating || 0;
      var rb = b.rating || 0;
      var ca = a.reviews || 0;
      var cb = b.reviews || 0;
      // kombinirani score: rating * log(reviews+1)
      var sa = ra * Math.log(ca + 1);
      var sb = rb * Math.log(cb + 1);
      return sb - sa;
    });
    bestHotel = hotels[0];
  }

  // grubi range cijena
  var numericPrices = hotels
    .map(function (h) {
      if (!h.price) return null;
      var m = h.price.match(/(\d{1,4})/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter(function (x) { return x !== null; });

  var priceMin = numericPrices.length ? Math.min.apply(null, numericPrices) : null;
  var priceMax = numericPrices.length ? Math.max.apply(null, numericPrices) : null;
  var priceAvg = numericPrices.length
    ? Math.round(numericPrices.reduce(function (a, b) { return a + b; }, 0) / numericPrices.length)
    : null;

  return {
    city: city,
    engine: "booking_v4",
    checkin: checkin || null,
    checkout: checkout || null,
    adults: adults || null,
    hotels: hotels,
    bestHotel: bestHotel,
    priceMin: priceMin ? priceMin + "€" : "N/A",
    priceAvg: priceAvg ? priceAvg + "€" : "N/A",
    priceMax: priceMax ? priceMax + "€" : "N/A",
    url: searchUrl
  };
}

// PUBLIC booking() – probaj V4 → fallback na V3 → fallback na čisti link
async function booking(city, query) {
  const cached = cacheGet("booking_v_hybrid", { city: city, q: JSON.stringify(query || {}) });
  if (cached) return cached;

  var checkin = query && query.checkin ? query.checkin : null;
  var checkout = query && query.checkout ? query.checkout : null;
  var adults = query && query.adults ? parseInt(query.adults, 10) || null : null;

  try {
    // V4 pokušaj
    const v4 = await bookingV4(city, checkin, checkout, adults);
    cacheSet("booking_v_hybrid", { city: city, q: JSON.stringify(query || {}) }, v4, 60 * 60 * 1000);
    return v4;
  } catch (errV4) {
    console.error("BOOKING V4 FAILED, FALLBACK TO V3:", errV4);
    try {
      const v3 = await bookingV3(city);
      cacheSet("booking_v_hybrid", { city: city, q: JSON.stringify(query || {}) }, v3, 60 * 60 * 1000);
      return v3;
    } catch (errV3) {
      console.error("BOOKING V3 FAILED:", errV3);
      const fallback = {
        city: city,
        engine: "booking_fallback",
        hotels: [],
        bestHotel: null,
        priceMin: "N/A",
        priceAvg: "N/A",
        priceMax: "N/A",
        url:
          "https://www.booking.com/searchresults.html?ss=" +
          encodeURIComponent(city)
      };
      cacheSet("booking_v_hybrid", { city: city, q: JSON.stringify(query || {}) }, fallback, 30 * 60 * 1000);
      return fallback;
    }
  }
}

// =====================================================
// AIRPORT – AviationStack
// =====================================================

async function airport(city) {
  var code = "SPU";
  const l = city.toLowerCase();
  if (l.indexOf("zagreb") >= 0) code = "ZAG";
  if (l.indexOf("zadar") >= 0) code = "ZAD";
  if (l.indexOf("pula") >= 0) code = "PUY";
  if (l.indexOf("dubrovnik") >= 0) code = "DBV";

  try {
    const url =
      "http://api.aviationstack.com/v1/flights?access_key=" +
      AVIATIONSTACK_KEY +
      "&dep_iata=" +
      encodeURIComponent(code) +
      "&limit=1";

    const json = await getJSON(url);
    var statusText = "Nema aktivnih letova u prikazu.";
    if (json && json.data && json.data.length > 0) {
      const f = json.data[0];
      const flightObj = safe(f, "flight", {});
      const arrObj = safe(f, "arrival", {});
      const depObj = safe(f, "departure", {});

      const flightNo = safe(flightObj, "iata", "") || safe(flightObj, "icao", "");
      const arr = safe(arrObj, "iata", "");
      const time = safe(depObj, "scheduled", "");

      statusText = "Sljedeći let: " + flightNo + " → " + arr + " " + time;
    }

    return {
      city: city,
      airport: code,
      status: statusText
    };
  } catch (e) {
    console.error("airport error", e);
    return {
      city: city,
      airport: code,
      status: "Podaci o letovima trenutno nisu dostupni."
    };
  }
}

// =====================================================
// SERVICES / EMERGENCY / TRANSIT (bus+vlak+brod)
// =====================================================

async function services(city) {
  return {
    city: city,
    list: [
      "24/7 hitna pomoć",
      "Policija – 192",
      "Vatrogasci – 193",
      "Auto servis – 24/7",
      "HITNA VET klinika",
      "Dežurne ljekarne"
    ]
  };
}

async function emergency(city) {
  return {
    city: city,
    status: "Sve sigurnosne službe normalno djeluju."
  };
}

async function transit(city) {
  // Hibridni demo: bus + vlak + brod/ferry
  return {
    city: city,
    status: "Javni prijevoz prema redovitom voznom redu.",
    bus: [
      {
        line: "1",
        from: "Centar",
        to: "Kolodvor",
        nextDepartureMinutes: 7,
        delayMinutes: 0
      },
      {
        line: "8",
        from: "Luka",
        to: "Kolodvor",
        nextDepartureMinutes: 15,
        delayMinutes: 3
      }
    ],
    train: [
      {
        line: "IC 580",
        from: city,
        to: "Zagreb",
        departureTime: "14:32",
        delayMinutes: 5
      }
    ],
    ferry: [
      {
        line: "Jadrolinija 602",
        from: city,
        to: "Supetar",
        departureTime: "16:15",
        delayMinutes: 0
      }
    ]
  };
}

// =====================================================
// LANDMARKS / EVENTS / FOOD / SHOPS – OpenTripMap
// =====================================================

async function landmarks(city) {
  const cached = cacheGet("landmarks", { city: city });
  if (cached) return cached;

  try {
    const geoUrl =
      "https://api.opentripmap.com/0.1/en/places/geoname?name=" +
      encodeURIComponent(city) +
      "&apikey=" +
      OPENTRIPMAP_KEY;

    const g = await getJSON(geoUrl);
    const lat = safe(g, "lat", null);
    const lon = safe(g, "lon", null);
    if (lat === null || lon === null) {
      return {
        city: city,
        list: []
      };
    }

    const placesUrl =
      "https://api.opentripmap.com/0.1/en/places/radius?radius=20000&lon=" +
      lon +
      "&lat=" +
      lat +
      "&kinds=interesting_places,sights,museums,monuments&limit=10&apikey=" +
      OPENTRIPMAP_KEY;

    const json = await getJSON(placesUrl);
    var list = [];
    if (json && json.features) {
      list = json.features
        .map(function (f) {
          const props = safe(f, "properties", {});
          return safe(props, "name", null);
        })
        .filter(function (x) { return !!x; });
    }

    const data = {
      city: city,
      list: list
    };

    cacheSet("landmarks", { city: city }, data, 60 * 60 * 1000);
    return data;
  } catch (e) {
    console.error("landmarks error", e);
    return {
      city: city,
      list: [
        "Stara gradska jezgra",
        "Glavni trg",
        "Galerija / muzej",
        "Šetnica uz more"
      ]
    };
  }
}

// Food & nightlife (restorani, kafići, klubovi)
async function foodAndNightlife(city) {
  // za sada demo – može se kasnije vezati na OpenTripMap (kinds=restaurants, pubs, bars)
  return {
    city: city,
    restaurants: [
      "Restoran Riva",
      "Konoba Stari Grad",
      "Bistro Panorama"
    ],
    cafes: [
      "Cafe Bar Laguna",
      "Kavana Centar"
    ],
    clubs: [
      "Night Club Aurora",
      "Beach Club Riviera"
    ]
  };
}

// Shops / malls / fuel / EV – lagani stubovi za hibrid
async function cityServicesExtended(city) {
  return {
    city: city,
    shops: [
      "0–24 Supermarket",
      "Trgovački centar Centar",
      "Lokalne trgovine u blizini"
    ],
    malls: [
      "City Center One",
      "Mall / Outlet zona"
    ],
    fuel: [
      "INA – otvoreno 0–24",
      "Petrol",
      "Tifon"
    ],
    ev: [
      "Gradska garaža – 4x AC punjač",
      "Trg – 2x DC fast charger"
    ]
  };
}

// =====================================================
// LIVE CAM – DEMO (kasnije spojiš na live-cam proxy)
// =====================================================

async function livecam(city, mode) {
  var camUrl = "https://www.youtube.com/embed/5qap5aO4i9A"; // default chill
  if (mode === "traffic") {
    camUrl = "https://www.youtube.com/embed/5qap5aO4i9A";
  } else if (mode === "sea") {
    camUrl = "https://www.youtube.com/embed/DWcJFNfaw9c";
  } else if (mode === "city") {
    camUrl = "https://www.youtube.com/embed/x8c8eP1HkXc";
  }

  return {
    city: city,
    mode: mode || "auto",
    url: camUrl
  };
}

// =====================================================
// AIRBNB SCRAPER (light) – NO KEY
// =====================================================

async function airbnb(city) {
  const cached = cacheGet("airbnb", { city: city });
  if (cached) return cached;

  const searchUrl =
    "https://www.airbnb.com/s/" + encodeURIComponent(city) + "/homes";

  try {
    const html = await fetch(searchUrl).then(function (r) { return r.text(); });

    // vrlo grubi pattern za nazive smještaja
    var nameRegex = /"listingName":"(.*?)"/g;
    var names = [];
    var m;
    while ((m = nameRegex.exec(html)) !== null) {
      var nm = m[1].replace(/\\"/g, '"');
      if (nm.length > 2 && names.indexOf(nm) < 0) {
        names.push(nm);
      }
    }

    // rating
    var ratingRegex = /"avgRatingLocalized":"(\d\.\d)"/g;
    var ratings = [];
    var r;
    while ((r = ratingRegex.exec(html)) !== null) {
      ratings.push(parseFloat(r[1]));
    }

    var listings = names.slice(0, 10).map(function (n, i) {
      return {
        name: n,
        rating: ratings[i] || null
      };
    });

    var best = null;
    if (listings.length > 0) {
      listings.sort(function (a, b) {
        return (b.rating || 0) - (a.rating || 0);
      });
      best = listings[0];
    }

    const result = {
      city: city,
      engine: "airbnb_scrape",
      listings: listings,
      bestListing: best,
      url: searchUrl
    };

    cacheSet("airbnb", { city: city }, result, 60 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("AIRBNB SCRAPE ERROR:", err);
    const fallback = {
      city: city,
      engine: "airbnb_fallback",
      listings: [],
      bestListing: null,
      url: searchUrl
    };
    cacheSet("airbnb", { city: city }, fallback, 30 * 60 * 1000);
    return fallback;
  }
}

// =====================================================
// EXPEDIA SCRAPER (light) – NO KEY
// =====================================================

async function expedia(city) {
  const cached = cacheGet("expedia", { city: city });
  if (cached) return cached;

  const searchUrl =
    "https://www.expedia.com/Hotel-Search?destination=" +
    encodeURIComponent(city);

  try {
    const html = await fetch(searchUrl).then(function (r) { return r.text(); });

    var nameRegex = /data-stid="content-hotel-title".*?>(.*?)<\/h3>/g;
    var hotels = [];
    var m;
    while ((m = nameRegex.exec(html)) !== null) {
      var nm = m[1].replace(/<[^>]+>/g, "").trim();
      if (nm.length > 2) hotels.push(nm);
    }

    var ratingRegex = /aria-label="Guest rating .*? of 5".*?>(\d\.\d)</g;
    var ratings = [];
    var r;
    while ((r = ratingRegex.exec(html)) !== null) {
      ratings.push(parseFloat(r[1]));
    }

    var list = hotels.slice(0, 10).map(function (n, i) {
      return {
        name: n,
        rating: ratings[i] || null
      };
    });

    var best = null;
    if (list.length > 0) {
      list.sort(function (a, b) {
        return (b.rating || 0) - (a.rating || 0);
      });
      best = list[0];
    }

    const result = {
      city: city,
      engine: "expedia_scrape",
      hotels: list,
      bestHotel: best,
      url: searchUrl
    };

    cacheSet("expedia", { city: city }, result, 60 * 60 * 1000);
    return result;
  } catch (err) {
    console.error("EXPEDIA SCRAPE ERROR:", err);
    const fallback = {
      city: city,
      engine: "expedia_fallback",
      hotels: [],
      bestHotel: null,
      url: searchUrl
    };
    cacheSet("expedia", { city: city }, fallback, 30 * 60 * 1000);
    return fallback;
  }
}

// =====================================================
// TRUCK ROUTES – DEMO
// =====================================================

async function truckRoutes(city, season) {
  var seasonText = "normalni uvjeti";
  if (season === "summer") seasonText = "sezonska gužva (turistička sezona)";
  if (season === "winter") seasonText = "zimski uvjeti (snijeg/bura mogući)";

  return {
    city: city,
    season: season || "normal",
    info:
      "Kamionske rute za " +
      city +
      " uzimaju u obzir " +
      seasonText +
      ", ograničenja visine, nosivosti i sezonske zabrane. Za detaljne truck rute koristi PRO navigacijsku opciju u aplikaciji.",
    restrictions: [
      "Zabrana kamiona >7.5t kroz uži centar",
      "Sezonska zabrana za autocestu A1 u vrijeme orkanske bure",
      "Preporuka: koristiti obilaznicu i odmorišta prilagođena kamionima"
    ]
  };
}

// =====================================================
// ROUTE CALCULATOR – DEMO
// =====================================================

async function routeCalc(from, to, mode) {
  if (!from || !to) {
    return { error: "Missing from/to" };
  }

  var distance = "2–5 km (estimacija)";
  var duration = "5–15 min (estimacija)";
  var source = "Google/TomTom (demo)";

  if (mode === "truck") {
    distance = "50–600 km (ovisno o ruti kamiona)";
    duration = "2–10 h (ovisno o ograničenjima i pauzama)";
    source = "Truck routing (demo)";
  }

  return {
    from: from,
    to: to,
    distance: distance,
    duration: duration,
    mode: mode || "car",
    source: source
  };
}

// =====================================================
// PREMIUM STATUS
// =====================================================

async function premiumStatus(userId, founderKeyHeader) {
  var status = "free";
  var tier = "free";

  if (founderKeyHeader && FOUNDER_PREMIUM_KEY && founderKeyHeader === FOUNDER_PREMIUM_KEY) {
    status = "lifetime";
    tier = "founder";
  } else if (isPremiumUser(userId)) {
    status = "premium";
    tier = "user";
  }

  return {
    userId: userId,
    status: status,
    tier: tier
  };
}

// =====================================================
// ADMIN HANDLER
// =====================================================

function requireAdmin(req) {
  const tokenHeader = req.headers["x-admin-token"];
  const tokenQuery = req.query.adminToken;
  const token = tokenHeader || tokenQuery || "";
  if (!token || token !== TBW_ADMIN_TOKEN) {
    const err = new Error("Unauthorized");
    err.code = "UNAUTHORIZED";
    throw err;
  }
}

async function handleAdmin(req) {
  requireAdmin(req);
  const action = req.query.action || "status";

  if (action === "status") {
    return {
      killSwitch: killSwitchFlag,
      premiumUsers: premiumUsers.slice(),
      blockedUsers: blockedUsers.slice()
    };
  }

  if (action === "setKill") {
    const val = req.query.value || "0";
    killSwitchFlag = val === "1";
    return {
      killSwitch: killSwitchFlag,
      premiumUsers: premiumUsers.slice(),
      blockedUsers: blockedUsers.slice()
    };
  }

  if (action === "addPremium") {
    const userId = (req.query.userId || "").trim();
    if (userId && premiumUsers.indexOf(userId) < 0) {
      premiumUsers.push(userId);
    }
    return {
      killSwitch: killSwitchFlag,
      premiumUsers: premiumUsers.slice(),
      blockedUsers: blockedUsers.slice()
    };
  }

  if (action === "removePremium") {
    const userId = (req.query.userId || "").trim();
    premiumUsers = premiumUsers.filter(function (u) { return u !== userId; });
    return {
      killSwitch: killSwitchFlag,
      premiumUsers: premiumUsers.slice(),
      blockedUsers: blockedUsers.slice()
    };
  }

  if (action === "addBlocked") {
    const userId = (req.query.userId || "").trim();
    if (userId && blockedUsers.indexOf(userId) < 0) {
      blockedUsers.push(userId);
    }
    return {
      killSwitch: killSwitchFlag,
      premiumUsers: premiumUsers.slice(),
      blockedUsers: blockedUsers.slice()
    };
  }

  if (action === "removeBlocked") {
    const userId = (req.query.userId || "").trim();
    blockedUsers = blockedUsers.filter(function (u) { return u !== userId; });
    return {
      killSwitch: killSwitchFlag,
      premiumUsers: premiumUsers.slice(),
      blockedUsers: blockedUsers.slice()
    };
  }

  return {
    killSwitch: killSwitchFlag,
    premiumUsers: premiumUsers.slice(),
    blockedUsers: blockedUsers.slice()
  };
}

// =====================================================
// MAIN HANDLER – /api/tbw
// =====================================================

module.exports = async function (req, res) {
  // CORS za web + APK webview
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-id, x-admin-token, x-founder-key, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const route = req.query.route;
    const city = req.query.city || "Split";
    const userId = getUserId(req);

    if (!route) {
      res.status(400).json({ error: "Missing route" });
      return;
    }

    // ADMIN rute uvijek rade – čak i kad je killSwitch uključen
    if (route === "admin") {
      try {
        const adminResult = await handleAdmin(req);
        res.status(200).json(adminResult || {});
        return;
      } catch (adminErr) {
        if (adminErr.code === "UNAUTHORIZED") {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        throw adminErr;
      }
    }

    // Global kill switch za sve ostale rute
    if (killSwitchFlag) {
      res.status(503).json({
        error: "Service temporarily disabled by administrator.",
        code: "KILL_SWITCH"
      });
      return;
    }

    // Blockirani korisnik?
    if (isBlockedUser(userId)) {
      res.status(403).json({
        error: "Access blocked for this user.",
        code: "USER_BLOCKED"
      });
      return;
    }

    const founderKeyHeader = req.headers["x-founder-key"] || "";

    let result;

    switch (route) {
      case "hero":
        result = await hero(city);
        break;

      case "alerts":
        result = await alerts(city);
        break;

      case "weather":
        result = await weather(city);
        break;

      case "sea":
        result = await sea(city);
        break;

      case "traffic":
        result = await traffic(city);
        break;

      case "booking":
        result = await booking(city, {
          checkin: req.query.checkin,
          checkout: req.query.checkout,
          adults: req.query.adults
        });
        break;

      case "airport":
        result = await airport(city);
        break;

      case "services":
        result = await services(city);
        break;

      case "emergency":
        result = await emergency(city);
        break;

      case "transit":
        result = await transit(city);
        break;

      case "landmarks":
        result = await landmarks(city);
        break;

      case "livecam":
        result = await livecam(city, req.query.mode || "auto");
        break;

      case "truck":
        result = await truckRoutes(city, req.query.season || "normal");
        break;

      case "route":
        result = await routeCalc(req.query.from, req.query.to, req.query.mode || "car");
        break;

      case "extendedCity":
        result = await cityServicesExtended(city);
        break;

      case "food":
        result = await foodAndNightlife(city);
        break;

      case "airbnb":
        result = await airbnb(city);
        break;

      case "expedia":
        result = await expedia(city);
        break;

      case "premium":
        result = await premiumStatus(userId, founderKeyHeader);
        break;

      default:
        res.status(400).json({ error: "Unknown route" });
        return;
    }

    res.status(200).json(result || {});
  } catch (err) {
    console.error("TBW BACKEND ERROR:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
};
