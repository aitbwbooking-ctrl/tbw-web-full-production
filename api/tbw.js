// TBW AI NAVIGATOR BACKEND – A VERSION (NO BOOKING API)
// Kompatibilno sa tvojim index.html i app.js

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const route = req.query.route || "";
  const city = (req.query.city || "Split").trim();
  const userId = req.query.userId || "guest";

  try {
    switch (route) {
      case "weather":
        return res.json({
          temp: 11.3,
          condition: "blaga kiša"
        });

      case "traffic":
        return res.json({
          status: "Promet pojačan",
          level: 27
        });

      case "airport":
        return res.json({
          airport: "ZAG",
          status: "Letovi trenutno nedostupni."
        });

      case "sea":
        return res.json({
          state: "Umjereno valovito."
        });

      case "transit":
        return res.json({
          bus: [
            { line: "6", from: "Bol", to: "HNK", nextDepartureMinutes: 8 },
            { line: "17", from: "Spinut", to: "Žnjan", nextDepartureMinutes: 12 }
          ],
          train: [
            { line: "IC 502", from: "Zagreb", to: "Split", departureTime: "15:42" }
          ],
          ferry: [
            { line: "Jadrolinija 602", from: "Split", to: "Supetar", departureTime: "17:30" }
          ]
        });

      case "services":
        return res.json({
          list: [
            "Policija 192",
            "Hitna pomoć 194",
            "Vatrogasci 193",
            "Auto pomoć 1987",
            "Hrvatski autoklub HAK"
          ]
        });

      case "emergency":
        return res.json({
          status: "Sve službe normalno rade."
        });

      case "landmarks":
        return res.json({
          list: [
            "Riva",
            "Marjan",
            "Dioklecijanova palača",
            "Žnjan",
            "Park šuma Marjan"
          ]
        });

      case "food":
        return res.json({
          restaurants: ["Bokeria", "Fig", "Paradox"],
          cafes: ["Procaffe", "Kavana Bellevue"],
          clubs: ["Vanilla", "Zenta"]
        });

      case "extendedCity":
        return res.json({
          shops: ["Konzum", "Tommy", "Ribola"],
          malls: ["Mall of Split", "City Center One"],
          fuel: ["INA – Solin", "Tifon – Split"],
          ev: ["EV City Center One – 3x", "EV Mall of Split – 2x"]
        });

      case "truck":
        return res.json({
          info: "Kamionske rute u Splitu",
          restrictions: [
            "Zabrana >7.5t kroz centar",
            "Posebna ruta – zatvaranja"
          ]
        });

      case "route":
        const from = req.query.from || "Nepoznato";
        const to = req.query.to || "Nepoznato";
        return res.json({
          from,
          to,
          distance: "27 km",
          duration: "32 min",
          source: "TBW Routing"
        });

      case "livecam":
        return res.json({
          url: "https://www.youtube.com/embed/5qap5aO4i9A"
        });

      case "premium":
        return res.json({
          status: "free",
          tier: "none"
        });

      // 🔥 BOOKING – CLEAN SAFE VERSION (NO API)
      case "booking":
        const urlCity = encodeURIComponent(city);
        const today = new Date();
        const tomorrow = new Date(Date.now() + 86400000);
        const d1 = today.toISOString().split("T")[0];
        const d2 = tomorrow.toISOString().split("T")[0];

        return res.json({
          city,
          dates: `${d1} – ${d2}`,
          price: "od 60 € / noć",
          link: `https://www.booking.com/searchresults.html?ss=${urlCity}&checkin=${d1}&checkout=${d2}`,
          status: "OK"
        });

      default:
        return res.status(400).json({ error: "Unknown route" });
    }
  } catch (err) {
    console.error("TBW API ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
