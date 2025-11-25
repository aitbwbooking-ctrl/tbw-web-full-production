/* ===========================================================
   TBW AI PREMIUM NAVIGATOR – FRONTEND ENGINE
   Author: Dražen Halar
   =========================================================== */

// =========================================
// CONFIG
// =========================================
const API_URL = "/api/tbw";   // Vercel backend
let currentCity = "Split";    // default
let continuousListening = false;

// =========================================
// DOM REFERENCES
// =========================================
const tickerText = document.getElementById("ticker-text");
const livecamFeed = document.getElementById("livecam-feed");
const livecamLocation = document.getElementById("livecam-location");
const searchInput = document.getElementById("search-input");
const micBtn = document.getElementById("search-mic");

const modalOverlay = document.getElementById("modal-overlay");
const modalWindow = document.getElementById("modal-window");
const modalContent = document.getElementById("modal-content");
const modalExit = document.getElementById("modal-exit");

const legalOverlay = document.getElementById("legal-overlay");
const legalBtn = document.getElementById("legal-accept-btn");
const agreeTerms = document.getElementById("agree-terms");
const agreeRobot = document.getElementById("agree-robot");

// =========================================
// UTIL FUNCTIONS
// =========================================

async function backend(route, params = {}) {
  const url = new URL(API_URL, window.location.origin);
  url.searchParams.set("route", route);

  Object.keys(params).forEach(k => {
    url.searchParams.set(k, params[k]);
  });

  const res = await fetch(url);
  return res.json();
}

function setCity(city) {
  currentCity = city;
}

function openModal(html) {
  modalContent.innerHTML = html;
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalContent.innerHTML = "";
}

modalExit.addEventListener("click", closeModal);

// =========================================
// LEGAL OVERLAY LOGIC
// =========================================
function checkLegalReady() {
  if (agreeTerms.checked && agreeRobot.checked) {
    legalBtn.removeAttribute("disabled");
  } else {
    legalBtn.setAttribute("disabled", "true");
  }
}

agreeTerms.addEventListener("change", checkLegalReady);
agreeRobot.addEventListener("change", checkLegalReady);

legalBtn.addEventListener("click", () => {
  legalOverlay.style.display = "none";
});

// =========================================
// TICKER – refresh every 60 sec
// =========================================
async function refreshTicker() {
  try {
    const alertData = await backend("alerts", { city: currentCity });
    tickerText.textContent = alertData.alert;
  } catch (err) {
    tickerText.textContent = "Greška učitavanja obavijesti.";
  }
}

setInterval(refreshTicker, 60000);
refreshTicker();

// =========================================
// LIVE CAM HEADER
// =========================================
async function loadLiveCam() {
  try {
    const data = await backend("livecam", { city: currentCity, mode: "city" });
    livecamFeed.src = data.url || "assets/img/city-fallback.jpg";
    livecamLocation.textContent = currentCity;
  } catch (e) {
    livecamFeed.src = "assets/img/city-fallback.jpg";
  }
}

loadLiveCam();

// =========================================
// LOAD ALL MODULES
// =========================================

async function loadWeather() {
  const w = await backend("weather", { city: currentCity });
  document.getElementById("weather-summary").textContent =
    w.temp !== null ? `${w.temp}°C – ${w.condition}` : "N/A";
}

async function loadTraffic() {
  const t = await backend("traffic", { city: currentCity });
  document.getElementById("traffic-summary").textContent = t.status;
}

async function loadBooking() {
  const b = await backend("booking", { city: currentCity });
  document.getElementById("booking-summary").textContent =
    `${b.price} · ${b.dates}`;
}

async function loadAirport() {
  const a = await backend("airport", { city: currentCity });
  document.getElementById("air-summary").textContent = a.status;
}

async function loadSea() {
  const s = await backend("sea", { city: currentCity });
  document.getElementById("sea-summary").textContent = s.state;
}

async function loadTransport() {
  document.getElementById("transport-summary").textContent =
    "Bus · Vlak · Brod – Real-time raspored";
}

async function loadEvents() {
  document.getElementById("events-summary").textContent =
    "Lokalna događanja učitavam…";
}

async function loadShops() {
  document.getElementById("shops-summary").textContent =
    "Radno vrijeme trgovina…";
}

async function loadTaxi() {
  document.getElementById("taxi-summary").textContent = "Lokalni taxi operateri…";
}

async function loadMarina() {
  document.getElementById("marina-summary").textContent = "Marine i vezovi…";
}

async function loadFuel() {
  document.getElementById("fuel-summary").textContent = "Benzinske + punionice…";
}

async function loadFood() {
  document.getElementById("food-summary").textContent = "Restorani i preporuke…";
}

async function loadClubs() {
  document.getElementById("clubs-summary").textContent = "Noćni život…";
}

// INITIAL LOAD
function reloadAll() {
  loadLiveCam();
  loadWeather();
  loadTraffic();
  loadBooking();
  loadAirport();
  loadSea();
  loadTransport();
  loadEvents();
  loadShops();
  loadTaxi();
  loadMarina();
  loadFuel();
  loadFood();
  loadClubs();
}

reloadAll();

// =========================================
// CLICK → FULLSCREEN MODALS
// =========================================
document.querySelectorAll(".grid-card").forEach(card => {
  card.addEventListener("click", () => {
    const title = card.querySelector("h3").textContent;
    const summary = card.querySelector(".card-content") ||
                    card.querySelector("div[id*='summary']");

    const html = `
      <h2>${title}</h2>
      <div style="margin-top:12px;font-size:0.9rem;">
        ${summary ? summary.innerHTML : "Učitavanje…"}
      </div>
    `;
    openModal(html);
  });
});

// =========================================
// SEARCH LOGIC (TEXTUAL + COMMAND PARSING)
// =========================================
async function handleSearch(query) {

  if (!query) return;

  const lower = query.toLowerCase();

  // city detection
  if (lower.includes("split")) setCity("Split");
  if (lower.includes("zadar")) setCity("Zadar");
  if (lower.includes("zagreb")) setCity("Zagreb");
  if (lower.includes("rijeka")) setCity("Rijeka");
  if (lower.includes("dubrovnik")) setCity("Dubrovnik");

  // auto reload all modules
  reloadAll();
}

searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") handleSearch(searchInput.value);
});

// =========================================
// VOICE RECOGNITION – CONTINUOUS LISTENING
// =========================================

let recognition;
if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = "hr-HR";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = event => {
    const text = event.results[event.results.length - 1][0].transcript;
    searchInput.value = text;
    handleSearch(text);
  };

  recognition.onerror = () => {
    micBtn.classList.remove("listening");
    continuousListening = false;
  };
}

micBtn.addEventListener("click", () => {
  if (!recognition) {
    alert("Voice recognition nije podržan na ovom uređaju.");
    return;
  }

  // toggle
  if (!continuousListening) {
    recognition.start();
    micBtn.classList.add("listening");
    continuousListening = true;
  } else {
    recognition.stop();
    micBtn.classList.remove("listening");
    continuousListening = false;
  }
});

