// server/tbw.js
// Glavni backend za TBW AI PREMIUM NAVIGATOR

const cityCoords = {
  Split: { lat: 43.5089, lon: 16.4392 },
  Zagreb: { lat: 45.815, lon: 15.9819 },
  Zadar: { lat: 44.1194, lon: 15.2314 },
  Rijeka: { lat: 45.3271, lon: 14.4422 },
};

function sendJson(res, obj, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(obj));
}

async function getWeatherForCity(city) {
  const coords = cityCoords[city] || cityCoords["Split"];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("weather error");
    const data = await resp.json();
    const temp = data.current_weather?.temperature;
    const code = data.current_weather?.weathercode;

    let condition = "Promjenjivo";
    let overlay = null;
    if (code === 0) condition = "Vedro";
    if ([1, 2, 3].includes(code)) condition = "Djelomično oblačno";
    if ([45, 48].includes(code)) condition = "Magla";
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
      condition = "Kiša";
      overlay = "rain";
    }
    if ([71, 73, 75, 77, 85, 86].includes(code)) {
      condition = "Snijeg";
      overlay = "snow";
    }

    return { temp, condition, overlay };
  } catch (e) {
    console.error("weather api", e);
    return { temp: null, condition: "Nema podataka.", overlay: null };
  }
}

async function handlePremium(req) {
  const url = new URL(req.url, "http://dummy");
  const userId = url.searchParams.get("userId");
  const founderKeyProvided = url.searchParams.get("founderKey");

  const envFounderKey = process.env.FOUNDER_PREMIUM_KEY || "";
  const premiumUsersRaw = process.env.TBW_PREMIUM_USERS || "[]";

  let status = "free";
  let tier = "free";

  try {
    const premiumUsers = JSON.parse(premiumUsersRaw);
    if (Array.isArray(premiumUsers) && userId && premiumUsers.includes(userId)) {
      status = "premium";
      tier = "standard";
    }
  } catch {
    // ignore
  }

  if (founderKeyProvided && envFounderKey && founderKeyProvided === envFounderKey) {
    status = "premium";
    tier = "founder";
  }

  if (status === "free") {
    return { status: "free", tier: "free" };
  }
  return { status: "premium", tier };
}

async function handler(req, res) {
  const url = new URL(req.url, "http://dummy");
  const route = url.searchParams.get("route") || "ping";
  const city = url.searchParams.get("city") || "Split";

  try {
    switch (route) {
      case "ping":
        return sendJson(res, { ok: true });

      case "hero": {
        const weather = await getWeatherForCity(city);
        const image = "/assets/placeholder-hero.jpg";
        let overlay = weather.overlay || null;
        return sendJson(res, {
          city,
          image,
          weather: overlay,
        });
      }

      case "alerts": {
        return sendJson(res, {
          city,
          alert:
            "Promet pojačan · More: umjereno valovito · Upozorenje: Nema posebnih upozorenja za ovo područje.",
        });
      }

      case "weather": {
        const w = await getWeatherForCity(city);
        return sendJson(res, {
          city,
          temp: w.temp,
          condition: w.condition,
          overlay: w.overlay,
        });
      }

      case "traffic": {
        return sendJson(res, {
          city,
          status: "Promet pojačan",
          level: 48,
        });
      }

      case "sea": {
        return sendJson(res, {
          city,
          state: "Umjereno valovito.",
        });
      }

      case "transit": {
        return sendJson(res, {
          city,
          bus: [
            {
              line: "5",
              from: "Žnjan",
              to: "Zvončac",
              nextDepartureMinutes: 9,
              delayMinutes: 2,
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
              line: "Split – Zagreb",
              from: "Split",
              to: "Zagreb",
              departureTime: "14:40",
              delayMinutes: 10,
            },
          ],
          ferry: [
            {
              line: "Split – Supetar",
              from: "Split",
              to: "Supetar",
              departureTime: "15:30",
              delayMinutes: 0,
            },
          ],
        });
      }

      case "airport": {
        return sendJson(res, {
          city,
          airport: city === "Zagreb" ? "ZAG" : "SPU",
          status:
            city === "Zagreb"
              ? "Letovi teku prema redu letenja."
              : "Neki letovi kasne do 30 min.",
        });
      }

      case "emergency": {
        return sendJson(res, {
          city,
          status: "Nema posebnih sigurnosnih incidenata.",
        });
      }

      case "services": {
        return sendJson(res, {
          city,
          list: [
            "Hitna pomoć 194",
            "Policija 192",
            "Vatrogasci 193",
            "Pomorska služba 195",
          ],
        });
      }

      case "landmarks": {
        return sendJson(res, {
          city,
          list:
            city === "Zagreb"
              ? ["Trg bana Jelačića", "Katedrala", "Jarun", "Maksimir"]
              : [
                  "Dioklecijanova palača",
                  "Riva",
                  "Marjan",
                  "Bačvice",
                ],
        });
      }

      case "food": {
        return sendJson(res, {
          city,
          restaurants:
            city === "Zagreb"
              ? ["Agava", "Dubravkin put", "Takenoko"]
              : ["Zrno Soli", "Bokeria", "Konoba Varoš"],
          cafes:
            city === "Zagreb"
              ? ["Dežman", "Swanky", "La Bodega"]
              : ["Kava2", "D16", "Laguna"],
          clubs:
            city === "Zagreb"
              ? ["Opera", "Katran"]
              : ["Vanilla", "Central", "Hemingway"],
        });
      }

      case "extendedCity": {
        return sendJson(res, {
          city,
          shops: ["Konzum", "Tommy", "Ribola"],
          malls: ["Mall of Split", "City Center One"],
          fuel: [
            "INA Žnjan",
            "Crodux Sukošan",
          ],
          ev: ["EV punionica – Mall of Split"],
        });
      }

      case "truck": {
        return sendJson(res, {
          city,
          info: "Zimski režim, obavezne lance iznad 900 m.",
          restrictions: [
            "Zabrana >7.5t kroz centar grada",
            "Ograničenje 60 km/h na obilaznici",
          ],
        });
      }

      case "route": {
        const from = url.searchParams.get("from") || city;
        const to = url.searchParams.get("to") || "Zagreb";
        const mode = url.searchParams.get("mode") || "car";

        const distance = from === to ? "0 km" : "230 km (procjena)";
        const duration =
          mode === "truck" ? "3 h 15 min" : "2 h 45 min";

        return sendJson(res, {
          from,
          to,
          mode,
          distance,
          duration,
          source: "TBW engine (approx.)",
        });
      }

      case "booking": {
        const urlBooking = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
          city
        )}`;
        return sendJson(res, {
          city,
          dates: "Nije zadano",
          price: "Varijabilno",
          url: urlBooking,
          status:
            "Za detaljne cijene i rezervacije otvaram Booking s odabranim gradom.",
        });
      }

      case "events": {
        return sendJson(res, {
          city,
          list:
            city === "Zagreb"
              ? [
                  { name: "Advent na Zrinjevcu", date: "Večeras 19:00" },
                  { name: "Jazz u Lisinskom", date: "Petak 20:30" },
                ]
              : [
                  { name: "Koncert na Rivi", date: "Večeras 21:00" },
                  { name: "Festival vina", date: "Subota 18:00" },
                ],
        });
      }

      case "premium": {
        const data = await handlePremium(req);
        return sendJson(res, data);
      }

      default:
        return sendJson(res, { error: "Unknown route" }, 400);
    }
  } catch (e) {
    console.error("tbw handler error", e);
    return sendJson(res, { error: "Server error" }, 500);
  }
}

module.exports = handler;

