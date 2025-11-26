// TBW AI PREMIUM NAVIGATOR – FRONTEND (D – neon dark)

// Backend base URL (Vercel)
// Na produkciji radi kao /api/tbw na istom hostu.
const API_BASE = `${window.location.origin}/api/tbw`;

// Global state
const TBW_STATE = {
  city: "Split",
  userId: null,
  premiumStatus: null
};

// Small helper
function $(sel) {
  return document.querySelector(sel);
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "hr-HR";
    window.speechSynthesis.speak(u);
  } catch (e) {
    // ignore
  }
}

async function callApi(route, params = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set("route", route);
  url.searchParams.set("city", TBW_STATE.city || "Split");
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.set(key, params[key]);
    }
  });

  const headers = {
    "Content-Type": "application/json",
    "x-user-id": TBW_STATE.userId || ""
  };

  try {
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      console.error("API error", route, res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("API fetch error", route, e);
    return null;
  }
}

/* =========================
   INIT
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  initUserId();
  initLegalOverlay();
  initLocationModal();
  initSearchAndVoice();
  initFullscreenCards();

  const rememberedCity = localStorage.getItem("tbw_city");
  if (rememberedCity) TBW_STATE.city = rememberedCity;

  updateCityLabel();
  refreshAll();
  startTickerLoop();
  loadPremiumStatus();
});

function initUserId() {
  let id = localStorage.getItem("tbw_userId");
  if (!id) {
    id = "user-" + Math.random().toString(36).slice(2);
    localStorage.setItem("tbw_userId", id);
  }
  TBW_STATE.userId = id;
}

/* =========================
   LEGAL + LOCATION
   ========================= */

function initLegalOverlay() {
  const overlay = $("#legal-overlay");
  if (!overlay) return;

  if (localStorage.getItem("tbw_legal_accepted") === "1") {
    overlay.classList.add("hidden");
    return;
  }

  const agreeTerms = $("#agree-terms");
  const agreeRobot = $("#agree-robot");
  const btn = $("#legal-accept-btn");

  function updateBtn() {
    btn.disabled = !(agreeTerms.checked && agreeRobot.checked);
  }

  agreeTerms.addEventListener("change", updateBtn);
  agreeRobot.addEventListener("change", updateBtn);

  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    localStorage.setItem("tbw_legal_accepted", "1");
    overlay.classList.add("hidden");
    showLocationModal();
  });
}

function initLocationModal() {
  const allowBtn = $("#location-allow");
  const denyBtn = $("#location-deny");
  const modal = $("#location-modal");
  if (!modal) return;

  allowBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("Lokacija", pos.coords);
        speak("Lokacija je uključena. TBW navigator je spreman.");
      },
      () => {
        console.warn("Geolocation odbijen ili greška");
      }
    );
  });

  denyBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
    speak("Lokacija je ostala isključena. Možeš ju kasnije uključiti u postavkama.");
  });
}

function showLocationModal() {
  const modal = $("#location-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
}

/* =========================
   SEARCH + VOICE
   ========================= */

function initSearchAndVoice() {
  const input = $("#search-input");
  const btn = $("#search-btn");
  const micBtn = $("#mic-btn");

  btn.addEventListener("click", () => handleSearch(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch(input.value);
  });

  // Voice search (Web Speech API)
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = "none";
    return;
  }

  const recognizer = new SpeechRecognition();
  recognizer.continuous = false;
  recognizer.interimResults = false;
  recognizer.lang = "hr-HR";

  let listening = false;

  micBtn.addEventListener("click", () => {
    if (!listening) {
      listening = true;
      micBtn.classList.add("listening");
      try {
        recognizer.start();
      } catch {
        listening = false;
        micBtn.classList.remove("listening");
      }
    } else {
      listening = false;
      micBtn.classList.remove("listening");
      recognizer.stop();
    }
  });

  recognizer.addEventListener("result", (event) => {
    const text = event.results[0][0].transcript.trim();
    input.value = text;
    listening = false;
    micBtn.classList.remove("listening");
    handleSearch(text, true);
  });

  recognizer.addEventListener("end", () => {
    listening = false;
    micBtn.classList.remove("listening");
  });
}

// crude city detection
const KNOWN_CITIES = [
  "Split",
  "Zadar",
  "Zagreb",
  "Rijeka",
  "Dubrovnik",
  "Šibenik",
  "Sibenik",
  "Pula",
  "Osijek",
  "Trogir",
  "Makarska"
];

function detectCity(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const c of KNOWN_CITIES) {
    if (lower.includes(c.toLowerCase())) return c.replace("Sibenik", "Šibenik");
  }
  // fallback: last word
  const parts = text.split(/\s+/);
  const last = parts[parts.length - 1];
  if (!last) return null;
  const normalized = last[0].toUpperCase() + last.slice(1).toLowerCase();
  return normalized;
}

function handleSearch(text, fromVoice = false) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  const city = detectCity(trimmed) || TBW_STATE.city || "Split";
  TBW_STATE.city = city;
  localStorage.setItem("tbw_city", city);
  updateCityLabel();

  speak(
    `Prebacujem TBW navigator na grad ${city}. Sinkroniziram vrijeme, promet i usluge.`
  );

  refreshAll();

  if (fromVoice) {
    // eventualno dodatni odgovor kasnije (smještaj itd.)
  }
}

function updateCityLabel() {
  const el = $("#current-city");
  if (el) el.textContent = TBW_STATE.city;
}

/* =========================
   FULLSCREEN CARDS
   ========================= */

function initFullscreenCards() {
  const overlay = $("#fullscreen-overlay");
  const content = $("#fullscreen-content");
  const exitBtn = $("#fullscreen-exit");

  exitBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    content.innerHTML = "";
  });

  document.querySelectorAll(".card-expand").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      if (!card) return;
      const clone = card.cloneNode(true);
      clone.querySelectorAll(".card-expand").forEach((b) => b.remove());
      content.innerHTML = "";
      content.appendChild(clone);
      overlay.classList.remove("hidden");
    });
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
      content.innerHTML = "";
    }
  });
}

/* =========================
   DATA LOADERS
   ========================= */

async function refreshAll() {
  loadHeroLivecam();
  loadTicker(); // first tick
  loadWeather();
  loadSea();
  loadTraffic();
  loadAirport();
  loadServices();
  loadTransit();
  loadLandmarks();
  loadFood();
  loadExtendedCity();
  loadTruckInfo();
}

async function loadHeroLivecam() {
  // hero images nisu bitne za prikaz, bitan je livecam
  const live = await callApi("livecam", { mode: "sea" });
  if (live && live.url) {
    const frame = $("#livecam-frame");
    if (frame) frame.src = live.url;
  }

  const heroBtn = $("#hero-fullscreen");
  const frame = $("#livecam-frame");
  const overlay = $("#fullscreen-overlay");
  const content = $("#fullscreen-content");

  if (heroBtn && frame) {
    heroBtn.onclick = () => {
      const clone = frame.cloneNode(true);
      clone.style.height = "60vh";
      clone.style.width = "100%";
      content.innerHTML = "";
      content.appendChild(clone);
      overlay.classList.remove("hidden");
    };
  }
}

async function loadWeather() {
  const data = await callApi("weather");
  $("#weather-temp").textContent =
    data && typeof data.temp === "number" ? `${Math.round(data.temp)}°C` : "--°C";
  $("#weather-cond").textContent =
    data && data.condition ? data.condition : "Podaci trenutno nisu dostupni.";
}

async function loadSea() {
  const data = await callApi("sea");
  $("#sea-state").textContent =
    data && data.state ? data.state : "Nema podataka o moru.";
}

async function loadTraffic() {
  const data = await callApi("traffic");
  $("#traffic-status").textContent =
    data && data.status ? data.status : "Nema prometnih podataka.";
  $("#traffic-level").textContent =
    data && data.level != null ? `Brzina: ${data.level} km/h` : "";
}

async function loadAirport() {
  const data = await callApi("airport");
  $("#airport-code").textContent = data && data.airport ? data.airport : "---";
  $("#airport-status").textContent =
    data && data.status ? data.status : "Podaci o letovima nisu dostupni.";
}

async function loadServices() {
  const emergency = await callApi("emergency");
  const services = await callApi("services");

  $("#emergency-status").textContent =
    emergency && emergency.status
      ? emergency.status
      : "Status sigurnosnih službi nije dostupan.";

  const ul = $("#services-list");
  if (!ul) return;
  ul.innerHTML = "";
  if (services && Array.isArray(services.list)) {
    services.list.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      ul.appendChild(li);
    });
  }
}

async function loadTransit() {
  const data = await callApi("transit");
  renderList("#transit-bus-list", data && data.bus, (b) =>
    `Linija ${b.line}: ${b.from} → ${b.to} (za ${b.nextDepartureMinutes} min, kašnjenje ${b.delayMinutes} min)`
  );
  renderList("#transit-train-list", data && data.train, (t) =>
    `${t.line}: ${t.from} → ${t.to} u ${t.departureTime} (+${t.delayMinutes} min)`
  );
  renderList("#transit-ferry-list", data && data.ferry, (f) =>
    `${f.line}: ${f.from} → ${f.to} u ${f.departureTime} (+${f.delayMinutes} min)`
  );
}

async function loadLandmarks() {
  const data = await callApi("landmarks");
  renderList("#landmarks-list", data && data.list, (x) => x);
}

async function loadFood() {
  const data = await callApi("food");
  renderList("#food-restaurants", data && data.restaurants, (x) => x);
  renderList("#food-cafes", data && data.cafes, (x) => x);
  renderList("#food-clubs", data && data.clubs, (x) => x);
}

async function loadExtendedCity() {
  const data = await callApi("extendedCity");
  renderList("#shops-list", data && data.shops, (x) => x);
  renderList("#malls-list", data && data.malls, (x) => x);
  const fuelItems = [];
  if (data && Array.isArray(data.fuel)) fuelItems.push(...data.fuel);
  if (data && Array.isArray(data.ev)) fuelItems.push(...data.ev);
  renderList("#fuel-ev-list", fuelItems, (x) => x);
}

async function loadTruckInfo() {
  const data = await callApi("truck", { season: "winter" });
  $("#truck-info").textContent =
    data && data.info ? data.info : "Podaci o kamionskim rutama nisu dostupni.";
  renderList("#truck-restrictions", data && data.restrictions, (x) => x);
}

/* Route calc */

const routeForm = document.getElementById("route-form");
if (routeForm) {
  routeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const from = document.getElementById("route-from").value.trim();
    const to = document.getElementById("route-to").value.trim();
    const mode = document.getElementById("route-mode").value;
    if (!from || !to) return;
    const data = await callApi("route", { from, to, mode });
    const el = document.getElementById("route-result");
    if (!data || data.error) {
      el.textContent = "Ruta nije mogla biti izračunata.";
      return;
    }
    el.textContent = `${data.from} → ${data.to}: ${data.distance}, ${data.duration} (izvor: ${data.source})`;
  });
}

/* Premium badge */

async function loadPremiumStatus() {
  const data = await callApi("premium", { userId: TBW_STATE.userId });
  TBW_STATE.premiumStatus = data;
  const badge = $("#premium-badge");
  if (!badge) return;
  if (!data) {
    badge.textContent = "Free mode";
    return;
  }
  if (data.status === "lifetime" || data.tier === "founder") {
    badge.textContent = "Founder premium";
    badge.style.borderColor = "rgba(249, 115, 22, 0.8)";
  } else if (data.status === "premium") {
    badge.textContent = "Premium aktivan";
  } else {
    badge.textContent = "Free mode";
  }
}

/* Ticker loop */

async function loadTicker() {
  const [alerts, traffic, sea] = await Promise.all([
    callApi("alerts"),
    callApi("traffic"),
    callApi("sea")
  ]);

  const t = $("#ticker");
  if (!t) return;

  const parts = [];
  if (traffic && traffic.status) parts.push(`Promet: ${traffic.status}`);
  if (sea && sea.state) parts.push(`More: ${sea.state}`);
  if (alerts && alerts.alert) parts.push(`Upozorenje: ${alerts.alert}`);

  t.textContent = parts.length
    ? parts.join("  •  ")
    : "Nema posebnih upozorenja. Sretan put!";
}

function startTickerLoop() {
  loadTicker();
  setInterval(loadTicker, 60 * 1000);
}

/* Helpers */

function renderList(selector, arr, mapFn) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = "";
  if (!arr || !arr.length) {
    const li = document.createElement("li");
    li.textContent = "Nema podataka.";
    el.appendChild(li);
    return;
  }
  arr.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = mapFn(item);
    el.appendChild(li);
  });
}
