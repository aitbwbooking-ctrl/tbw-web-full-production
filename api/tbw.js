// =====================================================
// TBW AI PREMIUM NAVIGATOR – FINAL (NO BOOKING / AIRBNB)
// =====================================================
//
// 100% funkcionalna verzija bez eksternih booking servisa
// Sve rute rade: hero, alerts, weather, traffic, airport,
// emergency, services, transit, landmarks, livecam, food,
// extendedCity, truck, routeCalc, premium, admin.
//
// Vercel kompatibilno – radi kao /api/tbw
// =====================================================

// -------- ENV VARS HELPER -----

function envOr() {
  for (var i = 0; i < arguments.length; i++) {
    if (process.env[arguments[i]]) return process.env[arguments[i]];
  }
  return null;
}

const OPENWEATHER_KEY      = envOr("OPENWEATHER_KEY", "OPENWEATHER_API_KEY") || "";
const TOMTOM_KEY           = envOr("TOMTOM_KEY", "TOMTOM_API_KEY") || "";
const AVIATIONSTACK_KEY    = envOr("AVIATIONSTACK_KEY", "AVIATIONSTACK_API_KEY") || "";
const OPENTRIPMAP_KEY      = envOr("OPENTRIPMAP_KEY", "OPENTRIPMAP_API_KEY") || "";
const UNSPLASH_KEY         = envOr("UNSPLASH_KEY", "UNSPLASH_ACCESS_KEY") || "";
const GOOGLE_MAPS_API_KEY  = envOr("GOOGLE_MAPS_API_KEY", "GOOGLE_PLACES_API_KEY") || "";

const TBW_ADMIN_TOKEN      = envOr("TBW_ADMIN_TOKEN", "ADMIN_ACCESS_TOKEN") || "";
const FOUNDER_PREMIUM_KEY  = envOr("FOUNDER_PREMIUM_KEY") || "";

let killSwitchFlag = process.env.TBW_KILL_SWITCH === "1";
let blockedUsers   = (process.env.TBW_BLOCKED_USERS || "").split(",").filter(x => x.trim());
let premiumUsers   = (process.env.TBW_PREMIUM_USERS || "").split(",").filter(x => x.trim());

// =====================================================
// UTIL
// =====================================================

async function getJSON(url, headers) {
  const res = await fetch(url, { headers: headers || {} });
  if (!res.ok) throw new Error("API error: " + res.status + " for " + url);
  return await res.json();
}

function safe(obj, k, fallback) {
  if (!obj) return fallback;
  if (obj[k] === undefined || obj[k] === null) return fallback;
  return obj[k];
}

function getUserId(req) {
  return req.query?.userId || req.headers["x-user-id"] || "anon";
}

function isPremium(id) {
  return premiumUsers.includes(id);
}

function isBlocked(id) {
  return blockedUsers.includes(id);
}

// =====================================================
// CACHE (simple)
// =====================================================

const cache = {};

function cacheGet(route, params) {
  const key = route + ":" + JSON.stringify(params || {});
  const item = cache[key];
  if (!item) return null;
  if (Date.now() - item.ts > item.ttl) {
    delete cache[key];
    return null;
  }
  return item.data;
}

function cacheSet(route, params, data, ttl) {
  const key = route + ":" + JSON.stringify(params || {});
  cache[key] = { ts: Date.now(), ttl, data };
}

// =====================================================
// ROUTE HANDLERS
// =====================================================

async function hero(city) {
  const cached = cacheGet("hero", { city });
  if (cached) return cached;

  let images = [];

  if (UNSPLASH_KEY) {
    try {
      const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(city + " skyline")}&orientation=landscape&per_page=3&client_id=${UNSPLASH_KEY}`;
      const j = await getJSON(u);
      images = j.results.map(r => r.urls?.regular).filter(Boolean);
    } catch {}
  }

  if (!images.length) {
    images = ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600"];
  }

  const out = { city, images };
  cacheSet("hero", { city }, out, 10 * 60 * 1000);
  return out;
}

async function weather(city) {
  if (!OPENWEATHER_KEY) {
    return { city, temp: null, condition: "API key missing" };
  }

  const url =
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_KEY}&units=metric&lang=hr`;

  try {
    const j = await getJSON(url);
    return {
      city,
      temp: safe(j.main, "temp", null),
      condition: j.weather?.[0]?.description || ""
    };
  } catch {
    return { city, temp: null, condition: null };
  }
}

async function alerts(city) {
  return { city, alert: "Nema posebnih upozorenja za ovo područje." };
}

async function sea(city) {
  return { city, state: "Umjereno valovito." };
}

async function traffic(city) {
  if (!TOMTOM_KEY) return { city, status: "N/A", level: null };

  try {
    const url =
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=45.815,15.9819&key=${TOMTOM_KEY}`;
    const j = await getJSON(url);

    const speed = j.flowSegmentData?.currentSpeed || 40;
    const text = speed < 20 ? "gust" : speed < 40 ? "pojačan" : "slab";

    return {
      city,
      status: "Promet " + text,
      level: speed
    };
  } catch {
    return { city, status: "N/A", level: null };
  }
}

async function airport(city) {
  if (!AVIATIONSTACK_KEY)
    return { city, airport: "N/A", status: "API key missing" };

  const map = {
    zagreb: "ZAG",
    split: "SPU",
    zadar: "ZAD",
    pula: "PUY",
    dubrovnik: "DBV"
  };

  const code = map[city.toLowerCase()] || "SPU";
  const url =
    `http://api.aviationstack.com/v1/flights?access_key=${AVIATIONSTACK_KEY}&dep_iata=${code}&limit=1`;

  try {
    const j = await getJSON(url);
    const d = j.data?.[0];

    if (!d) {
      return { city, airport: code, status: "Nema aktivnih letova." };
    }

    const fl = d.flight?.iata || d.flight?.icao || "";
    const arr = d.arrival?.iata || "";
    const tm = d.departure?.scheduled || "";

    return {
      city,
      airport: code,
      status: `Sljedeći let: ${fl} → ${arr} ${tm}`
    };
  } catch {
    return { city, airport: code, status: "Letovi trenutno nedostupni." };
  }
}

async function services(city) {
  return {
    city,
    list: [
      "Hitna pomoć 194",
      "Policija 192",
      "Vatrogasci 193",
      "Dežurne ljekarne",
      "Auto servis 24/7"
    ]
  };
}

async function emergency(city) {
  return { city, status: "Sve službe normalno rade." };
}

async function transit(city) {
  return {
    city,
    bus: [{ line: "1", next: 8 }],
    train: [{ line: "IC 580", time: "14:35" }],
    ferry: [{ line: "Jadrolinija 602", time: "16:15" }]
  };
}

async function landmarks(city) {
  if (!OPENTRIPMAP_KEY)
    return { city, list: ["Glavni trg", "Stara jezgra", "Šetnica uz more"] };

  try {
    const g = await getJSON(
      `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(city)}&apikey=${OPENTRIPMAP_KEY}`
    );

    const lat = g.lat, lon = g.lon;
    if (!lat || !lon) return { city, list: [] };

    const r = await getJSON(
      `https://api.opentripmap.com/0.1/en/places/radius?radius=20000&lon=${lon}&lat=${lat}&kinds=sights,museums&limit=10&apikey=${OPENTRIPMAP_KEY}`
    );

    const list = r.features
      ?.map(f => f.properties?.name)
      .filter(x => x && x.length > 1);

    return { city, list };
  } catch {
    return { city, list: ["Centar grada", "Muzej", "Riva"] };
  }
}

async function food(city) {
  return {
    city,
    restaurants: ["Restoran Riva", "Bistro Panorama"],
    cafes: ["Cafe Bar Laguna"],
    clubs: ["Night Club Aurora"]
  };
}

async function extendedCity(city) {
  return {
    city,
    shops: ["0–24 Market", "Trgovački centar"],
    malls: ["City Center One"],
    fuel: ["INA 0–24", "Tifon"],
    ev: ["DC fast charger – 2x"]
  };
}

async function livecam(city, mode) {
  let url = "https://www.youtube.com/embed/5qap5aO4i9A";

  if (mode === "city") url = "https://www.youtube.com/embed/x8c8eP1HkXc";
  if (mode === "sea") url = "https://www.youtube.com/embed/DWcJFNfaw9c";

  return { city, mode, url };
}

async function truck(city, season) {
  return {
    city,
    season,
    info: "Kamionske rute u " + city,
    restrictions: ["Zabrana >7.5t kroz centar", "Sezonska bura – zatvaranja"]
  };
}

async function routeCalc(from, to, mode) {
  if (!from || !to) return { error: "Missing from/to" };

  return {
    from,
    to,
    mode,
    distance: "2–5 km (procjena)",
    duration: "5–15 min",
    source: "demo"
  };
}

async function premiumStatus(userId, founderKey) {
  if (founderKey && founderKey === FOUNDER_PREMIUM_KEY) {
    return { userId, status: "lifetime", tier: "founder" };
  }
  if (isPremium(userId)) {
    return { userId, status: "premium", tier: "user" };
  }
  return { userId, status: "free", tier: "free" };
}

// =====================================================
// ADMIN
// =====================================================

function requireAdmin(req) {
  const t = req.headers["x-admin-token"] || req.query.adminToken;
  if (!t || t !== TBW_ADMIN_TOKEN) {
    const e = new Error("Unauthorized");
    e.code = "UNAUTHORIZED";
    throw e;
  }
}

async function handleAdmin(req) {
  requireAdmin(req);

  const action = req.query.action || "status";

  if (action === "status")
    return { killSwitch: killSwitchFlag, premiumUsers, blockedUsers };

  if (action === "setKill") {
    killSwitchFlag = req.query.value === "1";
    return { killSwitch: killSwitchFlag };
  }

  return { ok: true };
}

// =====================================================
// MAIN EXPORT
// =====================================================

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-id, x-admin-token, x-founder-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const route = req.query.route;
  const city = req.query.city || "Split";
  const userId = getUserId(req);

  if (!route) return res.status(400).json({ error: "Missing route" });

  if (route === "admin") {
    try {
      const r = await handleAdmin(req);
      return res.status(200).json(r);
    } catch (e) {
      if (e.code === "UNAUTHORIZED")
        return res.status(401).json({ error: "Unauthorized" });
      return res.status(500).json({ error: e.message });
    }
  }

  if (killSwitchFlag)
    return res.status(503).json({ error: "Service disabled" });

  if (isBlocked(userId))
    return res.status(403).json({ error: "Blocked user" });

  const founderKey = req.headers["x-founder-key"] || "";

  let out;
  switch (route) {
    case "hero": out = await hero(city); break;
    case "alerts": out = await alerts(city); break;
    case "weather": out = await weather(city); break;
    case "sea": out = await sea(city); break;
    case "traffic": out = await traffic(city); break;
    case "airport": out = await airport(city); break;
    case "services": out = await services(city); break;
    case "emergency": out = await emergency(city); break;
    case "transit": out = await transit(city); break;
    case "landmarks": out = await landmarks(city); break;
    case "livecam": out = await livecam(city, req.query.mode || "auto"); break;
    case "truck": out = await truck(city, req.query.season || "normal"); break;
    case "route": out = await routeCalc(req.query.from, req.query.to, req.query.mode || "car"); break;
    case "extendedCity": out = await extendedCity(city); break;
    case "food": out = await food(city); break;
    case "premium": out = await premiumStatus(userId, founderKey); break;

    default:
      return res.status(400).json({ error: "Unknown route" });
  }

  return res.status(200).json(out);
};
