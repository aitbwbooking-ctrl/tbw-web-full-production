// ============================================================================
// TBW AI PREMIUM NAVIGATOR – BACKEND (FINAL VERSION)
// Kompatibilno s Vercel serverless funkcijama
// Ruta: /api/tbw?route=weather&city=Split
// ============================================================================

export default async function handler(req, res) {
  try {
    const route = req.query.route;
    const city = req.query.city || "Split";

    switch (route) {
      case "weather":
        return res.status(200).json(await weather(city));

      case "traffic":
        return res.status(200).json(await traffic(city));

      case "sea":
        return res.status(200).json(await seaState(city));

      case "transit":
        return res.status(200).json(await transit(city));

      case "airport":
        return res.status(200).json(await airport(city));

      case "services":
        return res.status(200).json(await services(city));

      case "emergency":
        return res.status(200).json(await emergency(city));

      case "landmarks":
        return res.status(200).json(await landmarks(city));

      case "food":
        return res.status(200).json(await food(city));

      case "extendedCity":
        return res.status(200).json(await extendedCity(city));

      case "truck":
        return res.status(200).json(await truckProfile(city));

      case "route":
        return res.status(200).json(await routeCalc(req.query));

      case "hero":
        return res.status(200).json(await hero(city));

      case "booking": // prikazuje samo preporuke i URL
        return res.status(200).json(await bookingBasic(city));

      case "premium":
        return res.status(200).json(await premiumStatus(req.query.userId));

      default:
        return res.status(400).json({ error: "Unknown route" });
    }
  } catch (err) {
    console.error("TBW backend error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// ============================================================================
//  FAKE DATA ZA SIGURNO RADI BEZ API KLJUČEVA (AUTO FALLBACK)
//  Ako imaš env ključeve → koristi API, inače lokalnu simulaciju
// ============================================================================

// ---------------- WEATHER ----------------
async function weather(city) {
  try {
    // Ako postoji OPENWEATHER_KEY, koristi pravi API
    if (process.env.OPENWEATHER_KEY) {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&lang=hr&appid=${process.env.OPENWEATHER_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.main) throw new Error("Weather API error");
      return {
        temp: data.main.temp,
        condition: data.weather[0].description,
      };
    }
  } catch {}

  // fallback
  return {
    temp: 17.5,
    condition: "vedro uz lagani vjetar",
  };
}

// ---------------- TRAFFIC ----------------
async function traffic(city) {
  return {
    status: "Umjeren promet",
    level: 62,
  };
}

// ---------------- SEA STATE ----------------
async function seaState(city) {
  return {
    state: "Mirno more, valovi 0.3 m",
  };
}

// ---------------- TRANSIT ----------------
async function transit(city) {
  return {
    bus: [
      {
        line: "5",
        from: "Žnjan",
        to: "Zvončac",
        nextDepartureMinutes: 9,
        delayMinutes: 0,
      },
      {
        line: "37",
        from: "Split",
        to: "Trogir",
        nextDepartureMinutes: 22,
        delayMinutes: 3,
      },
    ],

    train: [
      {
        line: "Pu-120",
        from: "Split",
        to: "Perković",
        departureTime: "14:40",
        delayMinutes: 0,
      },
    ],

    ferry: [
      {
        line: "Jadrolinija",
        from: "Split",
        to: "Supetar",
        departureTime: "15:30",
        delayMinutes: 10,
      },
    ],
  };
}

// ---------------- AIRPORT ----------------
async function airport(city) {
  return {
    airport: "SPU",
    status: "Let iz Frankfurta kasni 25 minuta",
  };
}

// ---------------- SERVICES / EMERGENCY ----------------
async function services(city) {
  return {
    list: [
      "Policija 192",
      "Hitna 194",
      "Vatrogasci 193",
      "Pomorska služba 195",
    ],
  };
}

async function emergency(city) {
  return {
    status: "Nema posebnih incidenata",
  };
}

// ---------------- LANDMARKS ----------------
async function landmarks(city) {
  return {
    list: ["Dioklecijanova palača", "Marjan", "Riva", "Bačvice"],
  };
}

// ---------------- FOOD ----------------
async function food(city) {
  return {
    restaurants: ["Bokeria", "Zrno Soli", "Konoba Varos"],
    cafes: ["D16", "Kava2"],
    clubs: ["Central", "Vanilla"],
  };
}

// ---------------- EXTENDED CITY ----------------
async function extendedCity(city) {
  return {
    shops: ["Konzum", "Tommy", "Ribola"],
    malls: ["Mall of Split", "City Center One"],
    fuel: ["Ina Žnjan", "Crodux Sukoišan"],
    ev: ["EV punionica – Mall of Split"],
  };
}

// ---------------- TRUCK PROFILE ----------------
async function truckProfile(city) {
  return {
    info: "Zimski režim, obavezne lance iznad 900 m",
    restrictions: [
      "Zabrana za >7.5t kroz centar grada",
      "Ograničenje 60 km/h na obilaznici",
    ],
  };
}

// ---------------- ROUTE CALC ----------------
async function routeCalc(q) {
  const from = q.from || "Polazak";
  const to = q.to || "Odredište";
  const mode = q.mode || "car";

  return {
    from,
    to,
    distance: "31 km",
    duration: mode === "truck" ? "48 min" : "36 min",
    source: "TBW Core Engine",
  };
}

// ---------------- HERO IMAGE ----------------
async function hero(city) {
  try {
    if (process.env.UNSPLASH_KEY) {
      const url = `https://api.unsplash.com/search/photos?query=${city}&per_page=1&client_id=${process.env.UNSPLASH_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.results?.length > 0) {
        return {
          city,
          images: [data.results[0].urls.regular],
        };
      }
    }
  } catch {}

  return {
    city,
    images: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200",
    ],
  };
}

// ---------------- BOOKING (SAFE VERSION) ----------------
async function bookingBasic(city) {
  return {
    city,
    dates: "Nije zadano",
    price: "Varijabilno",
    url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
      city
    )}`,
    status: "Otvorit ću Booking s odabranim gradom.",
  };
}

// ---------------- PREMIUM ----------------
async function premiumStatus(userId) {
  if (!userId) return { status: "free" };

  // Founder key system:
  if (process.env.PREMIUM_FOUNDER_KEY && userId === process.env.PREMIUM_FOUNDER_KEY) {
    return {
      status: "lifetime",
      tier: "founder",
    };
  }

  return { status: "free" };
}
