// TBW AI PREMIUM NAVIGATOR – FRONTEND
// Radi uz backend /api/tbw (tbw.js)

const API_BASE = "/api/tbw";

// Globalni state
let currentCity = "Split";
let tickerTimer = null;
let micActive = false;
let recognition = null;
let pendingEmergencyPrompt = false;

// trial/premium/demo mode
let tbwMode = "trial"; // "trial" | "demo" | "premium"
const TRIAL_DAYS = 3;

// localStorage keys
const LS_TRIAL_START = "tbw_trial_start";
const LS_PREMIUM_STATUS = "tbw_premium_status";
const LS_FOUNDER_KEY = "tbw_founder_key";
const LS_LEGAL_ACCEPTED = "tbw_legal_accepted";
const LS_LOC_PROMPTED = "tbw_loc_prompted";
const LS_USER_ID = "tbw_user_id";
const SOS_KEY = "tbw_sos_profile";
const ICE_KEY = "tbw_ice_contacts";

// ---------------------------------------------
// POMOĆNE FUNKCIJE
// ---------------------------------------------
function $(selector) {
  return document.querySelector(selector);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function nowMs() {
  return Date.now();
}

// API poziv
async function callRoute(route, params = {}) {
  const url = new URL(API_BASE, window.location.origin);
  url.searchParams.set("route", route);

  const city = params.city || currentCity;
  if (city) url.searchParams.set("city", city);

  Object.keys(params).forEach((k) => {
    if (k !== "city" && params[k] != null && params[k] !== "") {
      url.searchParams.set(k, params[k]);
    }
  });

  const headers = {};

  // Founder key header
  const founderKey = localStorage.getItem(LS_FOUNDER_KEY);
  if (founderKey) {
    headers["x-founder-key"] = founderKey;
  }

  // Jedinstveni userId header (za premium i blocked)
  let userId = localStorage.getItem(LS_USER_ID);
  if (!userId) {
    userId = "user-" + Math.random().toString(36).slice(2);
    localStorage.setItem(LS_USER_ID, userId);
  }
  headers["x-user-id"] = userId;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`API ${route} error ${res.status}`);
  return res.json();
}

// TTS
function speakOut(text) {
  if (!("speechSynthesis" in window)) return;
  if (!text) return;

  const utter = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices() || [];
  // pokušaj pronaći lokalni jezik, inače eng
  const lang = navigator.language || "hr-HR";
  const langLower = lang.toLowerCase();

  let best = voices.find(
    (v) => v.lang && v.lang.toLowerCase().startsWith(langLower.slice(0, 2))
  );
  if (!best) {
    best = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  }
  if (best) utter.voice = best;

  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

// ---------------------------------------------
// TRIAL / DEMO / PREMIUM MODE
// ---------------------------------------------
function evaluateMode(premiumStatus) {
  const premiumFlag =
    premiumStatus === "premium" || premiumStatus === "lifetime";

  if (premiumFlag) {
    tbwMode = "premium";
    localStorage.setItem(LS_PREMIUM_STATUS, "premium");
    const badge = document.getElementById("premium-badge");
    if (badge) {
      badge.textContent = "Premium";
      badge.classList.add("premium-on");
    }
    return;
  }

  // Nije premium → trial ili demo
  const trialStartRaw = localStorage.getItem(LS_TRIAL_START);
  const now = nowMs();

  if (!trialStartRaw) {
    // pokrećemo trial
    localStorage.setItem(LS_TRIAL_START, String(now));
    tbwMode = "trial";
  } else {
    const start = parseInt(trialStartRaw, 10);
    const diffDays = (now - start) / (1000 * 60 * 60 * 24);
    if (diffDays < TRIAL_DAYS) {
      tbwMode = "trial";
    } else {
      tbwMode = "demo";
    }
  }

  const badge = document.getElementById("premium-badge");
  if (!badge) return;

  if (tbwMode === "trial") {
    badge.textContent = "Free trial";
    badge.classList.remove("premium-on");
  } else if (tbwMode === "demo") {
    badge.textContent = "Demo mode";
    badge.classList.remove("premium-on");
  }
}

// Klik na badge → unesi founder key
function setupPremiumBadgeClick() {
  const badge = document.getElementById("premium-badge");
  if (!badge) return;

  badge.addEventListener("click", () => {
    const val = prompt(
      "Founder / Premium key (ostavi prazno za brisanje):",
      localStorage.getItem(LS_FOUNDER_KEY) || ""
    );
    if (val === null) return;

    const trimmed = val.trim();
    if (!trimmed) {
      localStorage.removeItem(LS_FOUNDER_KEY);
      alert("Founder key obrisan.");
    } else {
      localStorage.setItem(LS_FOUNDER_KEY, trimmed);
      alert("Founder key spremljen. Pokušavam osvježiti premium status…");
      loadPremium();
    }
  });
}

// ---------------------------------------------
// INTRO A + C
// ---------------------------------------------
function playIntroSequence() {
  const fullIntro = document.getElementById("intro-full");
  const miniIntro = document.getElementById("intro-mini");
  if (!fullIntro || !miniIntro) return;

  const hasShownFull =
    localStorage.getItem("tbw_intro_full_shown") === "1";

  function showMini() {
    miniIntro.classList.remove("hidden");
    setTimeout(() => {
      miniIntro.classList.add("hidden");
    }, 2000);
  }

  if (!hasShownFull) {
    fullIntro.classList.remove("hidden");
    setTimeout(() => {
      fullIntro.classList.add("hidden");
      localStorage.setItem("tbw_intro_full_shown", "1");
      showMini();
    }, 4500);
  } else {
    showMini();
  }
}

// ---------------------------------------------
// LEGAL OVERLAY + LOKACIJA
// ---------------------------------------------
function setupLegalOverlay() {
  const overlay = document.getElementById("legal-overlay");
  const chkTerms = document.getElementById("agree-terms");
  const chkRobot = document.getElementById("agree-robot");
  const btn = document.getElementById("legal-accept-btn");

  if (!overlay || !chkTerms || !chkRobot || !btn) return;

  const accepted = localStorage.getItem(LS_LEGAL_ACCEPTED) === "1";

  function updateBtn() {
    btn.disabled = !(chkTerms.checked && chkRobot.checked);
  }

  chkTerms.addEventListener("change", updateBtn);
  chkRobot.addEventListener("change", updateBtn);

  btn.addEventListener("click", () => {
    localStorage.setItem(LS_LEGAL_ACCEPTED, "1");
    overlay.classList.add("hidden");
    showLocationModalOnce();
    refreshCity(currentCity);
  });

  if (accepted) {
    overlay.classList.add("hidden");
    showLocationModalOnce();
    refreshCity(currentCity);
  } else {
    overlay.classList.remove("hidden");
  }
}

function showLocationModalOnce() {
  const modal = document.getElementById("location-modal");
  if (!modal) return;

  const already = localStorage.getItem(LS_LOC_PROMPTED) === "1";
  if (already) return;

  const allowBtn = document.getElementById("location-allow");
  const denyBtn = document.getElementById("location-deny");

  modal.classList.remove("hidden");

  function close() {
    modal.classList.add("hidden");
    localStorage.setItem(LS_LOC_PROMPTED, "1");
  }

  allowBtn.addEventListener("click", () => {
    close();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          // Ovdje ide reverse geocoding → grad, za sada ostavljamo currentCity
        },
        () => {}
      );
    }
  });

  denyBtn.addEventListener("click", close);
}

// ---------------------------------------------
// FULLSCREEN PROZORI
// ---------------------------------------------
function setupFullscreen() {
  const overlay = document.getElementById("fullscreen-overlay");
  const exitBtn = document.getElementById("fullscreen-exit");
  const content = document.getElementById("fullscreen-content");

  if (!overlay || !exitBtn || !content) return;

  function closeFullscreen() {
    overlay.classList.add("hidden");
    content.innerHTML = "";
  }

  exitBtn.addEventListener("click", closeFullscreen);

  document.querySelectorAll(".card-expand").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      if (!card) return;
      content.innerHTML = "";
      const clone = card.cloneNode(true);
      clone.querySelectorAll(".card-expand").forEach((b) => b.remove());
      content.appendChild(clone);
      overlay.classList.remove("hidden");
    });
  });
}

// ---------------------------------------------
// TICKER
// ---------------------------------------------
async function updateTicker() {
  const el = document.getElementById("ticker");
  if (!el) return;

  try {
    const [alerts, traffic, sea, emergency] = await Promise.all([
      callRoute("alerts"),
      callRoute("traffic"),
      callRoute("sea"),
      callRoute("emergency"),
    ]);

    const parts = [];

    if (alerts && alerts.alert) {
      parts.push(`Upozorenje: ${alerts.alert}`);
    }
    if (traffic && traffic.status) {
      parts.push(`Promet: ${traffic.status}`);
    }
    if (sea && sea.state) {
      parts.push(`More: ${sea.state}`);
    }
    if (emergency && emergency.status) {
      parts.push(`Sigurnost: ${emergency.status}`);
    }

    el.textContent =
      parts.join(" • ") || "Nema posebnih upozorenja za ovo područje.";
  } catch (e) {
    console.error("Ticker error", e);
    el.textContent = "Ne mogu dohvatiti obavijesti. Pokušaj kasnije.";
  }
}

function startTicker() {
  if (tickerTimer) clearInterval(tickerTimer);
  updateTicker();
  tickerTimer = setInterval(updateTicker, 69 * 1000); // refresh svakih 69s
}

// ---------------------------------------------
// PUNJENJE KARTICA
// ---------------------------------------------
async function loadHero() {
  try {
    const data = await callRoute("hero");
    const img = document.getElementById("hero-img");
    const pill = document.getElementById("hero-city-pill");
    if (img && data.images && data.images.length > 0) {
      img.src = data.images[0];
    }
    if (pill) {
      pill.textContent = data.city || currentCity;
    }

    // jednostavni hero efekti – snijeg / kiša prema vremenu
    applyWeatherEffects();
  } catch (e) {
    console.error("hero", e);
  }
}

async function loadWeather() {
  try {
    const data = await callRoute("weather");
    if (typeof data.temp === "number") {
      setText("weather-temp", `${data.temp.toFixed(1)}°C`);
    } else {
      setText("weather-temp", "--°C");
    }
    setText(
      "weather-cond",
      data.condition ? data.condition : "Nema podataka."
    );
  } catch (e) {
    console.error("weather", e);
    setText("weather-cond", "Greška pri dohvaćanju vremena.");
  }
}

async function loadTraffic() {
  try {
    const data = await callRoute("traffic");
    setText(
      "traffic-status",
      data.status ? data.status : "Nema podataka o prometu."
    );
    setText(
      "traffic-level",
      data.level != null ? `Brzina: ${data.level} km/h` : ""
    );
  } catch (e) {
    console.error("traffic", e);
    setText("traffic-status", "Greška pri dohvaćanju prometa.");
  }
}

async function loadSea() {
  try {
    const data = await callRoute("sea");
    setText("sea-state", data.state || "Nema podataka o moru.");
  } catch (e) {
    console.error("sea", e);
    setText("sea-state", "Greška pri dohvaćanju stanja mora.");
  }
}

async function loadTransit() {
  try {
    const data = await callRoute("transit");
    const busList = document.getElementById("transit-bus-list");
    const trainList = document.getElementById("transit-train-list");
    const ferryList = document.getElementById("transit-ferry-list");

    if (busList) {
      busList.innerHTML = "";
      (data.bus || []).forEach((b) => {
        const li = document.createElement("li");
        li.textContent = `Linija ${b.line}: ${b.from} → ${b.to}, polazak za ${
          b.nextDepartureMinutes
        } min${
          b.delayMinutes ? ` (kašnjenje ${b.delayMinutes} min)` : ""
        }`;
        busList.appendChild(li);
      });
    }

    if (trainList) {
      trainList.innerHTML = "";
      (data.train || []).forEach((t) => {
        const li = document.createElement("li");
        li.textContent = `${t.line}: ${t.from} → ${t.to}, ${t.departureTime}${
          t.delayMinutes ? ` (+${t.delayMinutes} min)` : ""
        }`;
        trainList.appendChild(li);
      });
    }

    if (ferryList) {
      ferryList.innerHTML = "";
      (data.ferry || []).forEach((f) => {
        const li = document.createElement("li");
        li.textContent = `${f.line}: ${f.from} → ${f.to}, ${f.departureTime}${
          f.delayMinutes ? ` (+${f.delayMinutes} min)` : ""
        }`;
        ferryList.appendChild(li);
      });
    }
  } catch (e) {
    console.error("transit", e);
  }
}

async function loadAirport() {
  try {
    const data = await callRoute("airport");
    setText("airport-code", data.airport || "---");
    setText(
      "airport-status",
      data.status || "Nema podataka o letovima."
    );
  } catch (e) {
    console.error("airport", e);
    setText("airport-status", "Greška pri dohvaćanju letova.");
  }
}

async function loadServices() {
  try {
    const [emerg, srv] = await Promise.all([
      callRoute("emergency"),
      callRoute("services"),
    ]);

    setText(
      "emergency-status",
      emerg.status || "Nema posebnih sigurnosnih informacija."
    );

    const list = document.getElementById("services-list");
    if (list) {
      list.innerHTML = "";
      (srv.list || []).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
    }
  } catch (e) {
    console.error("services", e);
  }
}

async function loadLandmarks() {
  try {
    const data = await callRoute("landmarks");
    const list = document.getElementById("landmarks-list");
    if (list) {
      list.innerHTML = "";
      (data.list || []).forEach((name) => {
        const li = document.createElement("li");
        li.textContent = name;
        list.appendChild(li);
      });
    }
  } catch (e) {
    console.error("landmarks", e);
  }
}

async function loadFood() {
  try {
    const data = await callRoute("food");

    function fillList(id, arr) {
      const ul = document.getElementById(id);
      if (!ul) return;
      ul.innerHTML = "";
      (arr || []).forEach((x) => {
        const li = document.createElement("li");
        li.textContent = x;
        ul.appendChild(li);
      });
    }

    fillList("food-restaurants", data.restaurants);
    fillList("food-cafes", data.cafes);
    fillList("food-clubs", data.clubs);
  } catch (e) {
    console.error("food", e);
  }
}

async function loadExtendedCity() {
  try {
    const data = await callRoute("extendedCity");

    function fillList(id, arr) {
      const ul = document.getElementById(id);
      if (!ul) return;
      ul.innerHTML = "";
      (arr || []).forEach((x) => {
        const li = document.createElement("li");
        li.textContent = x;
        ul.appendChild(li);
      });
    }

    fillList("shops-list", data.shops);
    fillList("malls-list", data.malls);
    const fuelEv = [];
    (data.fuel || []).forEach((f) => fuelEv.push(f));
    (data.ev || []).forEach((e) => fuelEv.push(e));
    fillList("fuel-ev-list", fuelEv);
  } catch (e) {
    console.error("extendedCity", e);
  }
}

async function loadTruck() {
  try {
    const data = await callRoute("truck", { season: "winter" });
    setText("truck-info", data.info || "");
    const ul = document.getElementById("truck-restrictions");
    if (ul) {
      ul.innerHTML = "";
      (data.restrictions || []).forEach((r) => {
        const li = document.createElement("li");
        li.textContent = r;
        ul.appendChild(li);
      });
    }
  } catch (e) {
    console.error("truck", e);
  }
}

async function loadRouteDefault() {
  setText("route-result", "");
}

async function loadBooking() {
  try {
    const data = await callRoute("booking");
    setText("booking-city", data.city || currentCity);
    setText("booking-dates", data.dates || "Datumi nisu postavljeni.");
    setText("booking-price", data.price || "—");

    const urlWrap = document.getElementById("booking-url-wrap");
    const urlEl = document.getElementById("booking-url");

    if (urlWrap && urlEl) {
      if (data.url) {
        urlEl.href = data.url;
        urlWrap.classList.remove("hidden");
      } else {
        urlWrap.classList.add("hidden");
      }
    }

    if (data.status) {
      setText("booking-status", data.status);
    } else {
      setText(
        "booking-status",
        "Za više opcija otvorit ćeš Booking ili druge servise."
      );
    }
  } catch (e) {
    console.error("booking", e);
    setText("booking-status", "Greška pri dohvaćanju ponuda.");
  }
}

// premium status
async function loadPremium() {
  try {
    const badge = document.getElementById("premium-badge");
    if (!badge) return;

    // userId već generiran u callRoute
    let userId = localStorage.getItem(LS_USER_ID);
    if (!userId) {
      userId = "user-" + Math.random().toString(36).slice(2);
      localStorage.setItem(LS_USER_ID, userId);
    }

    const url = new URL(API_BASE, window.location.origin);
    url.searchParams.set("route", "premium");
    url.searchParams.set("userId", userId);

    const headers = {};
    const founderKey = localStorage.getItem(LS_FOUNDER_KEY);
    if (founderKey) headers["x-founder-key"] = founderKey;

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error("premium error");
    const data = await res.json();

    evaluateMode(data.status);

  } catch (e) {
    console.error("premium", e);
    // Ako backend ne radi, ostavi trial/demo logiku bez premium
    const stored = localStorage.getItem(LS_PREMIUM_STATUS);
    evaluateMode(stored || "free");
  }
}

// ---------------------------------------------
// SIGURNOST & SOS
// ---------------------------------------------
function loadSafetyPanel() {
  const sosSummary = document.getElementById("sos-summary");
  const iceList = document.getElementById("ice-list");

  const rawSos = localStorage.getItem(SOS_KEY);
  if (rawSos && sosSummary) {
    try {
      const sos = JSON.parse(rawSos);
      const parts = [];
      if (sos.name) parts.push(`Ime: ${sos.name}`);
      if (sos.blood) parts.push(`Krvna grupa: ${sos.blood}`);
      if (sos.allergies) parts.push(`Alergije: ${sos.allergies}`);
      if (sos.meds) parts.push(`Terapija: ${sos.meds}`);
      sosSummary.textContent =
        parts.join(" • ") || "SOS profil je nepotpun. Uredi za više detalja.";
    } catch {
      sosSummary.textContent = "Nije postavljen.";
    }
  } else if (sosSummary) {
    sosSummary.textContent = "Nije postavljen.";
  }

  if (iceList) {
    iceList.innerHTML = "";
    const rawIce = localStorage.getItem(ICE_KEY);
    if (rawIce) {
      try {
        const contacts = JSON.parse(rawIce);
        (contacts || []).forEach((c) => {
          const li = document.createElement("li");
          li.textContent = `${c.name} – ${c.phone}`;
          iceList.appendChild(li);
        });
      } catch {
        // ignore
      }
    }
  }
}

function setupSafetyActions() {
  const sosEdit = document.getElementById("sos-edit");
  const call112 = document.getElementById("call-112");
  const call911 = document.getElementById("call-911");

  if (sosEdit) {
    sosEdit.addEventListener("click", () => {
      const name = prompt("Ime i prezime (SOS profil):", "");
      const blood = prompt("Krvna grupa (npr. 0-, A+, 'nepoznato'):", "");
      const allergies = prompt("Alergije (ako nema, upiši 'nema'):", "");
      const meds = prompt("Važna terapija / lijekovi:", "");
      const iceRaw = prompt(
        "ICE kontakti: upiši npr. 'Ana 0911111111; Marko +38598123456'",
        ""
      );

      const sos = { name, blood, allergies, meds };
      localStorage.setItem(SOS_KEY, JSON.stringify(sos));

      if (iceRaw && iceRaw.trim()) {
        const contacts = iceRaw.split(";").map((c) => {
          const parts = c.trim().split(/\s+/);
          if (parts.length < 2) return null;
          const phone = parts.pop();
          const namePart = parts.join(" ");
          return { name: namePart, phone };
        });
        const filtered = contacts.filter(Boolean);
        localStorage.setItem(ICE_KEY, JSON.stringify(filtered));
      }

      loadSafetyPanel();
      alert("SOS profil i ICE kontakti su spremljeni na ovaj uređaj.");
    });
  }

  if (call112) {
    call112.addEventListener("click", () => {
      window.location.href = "tel:112";
    });
  }
  if (call911) {
    call911.addEventListener("click", () => {
      window.location.href = "tel:911";
    });
  }

  loadSafetyPanel();
}

function detectRegionEmergencyNumber() {
  const lang = (navigator.language || "").toLowerCase();
  if (
    lang.includes("-us") ||
    lang.includes("-ca") ||
    lang.includes("-mx") ||
    lang.includes("-ph")
  ) {
    return "911";
  }
  return "112";
}

function triggerEmergencyCallFlow() {
  const num = detectRegionEmergencyNumber();
  const msg =
    num === "112"
      ? "Označio sam nesreću. Otvaram poziv prema 112 na tvom uređaju."
      : "Označio sam nesreću. Otvaram poziv prema 911 na tvom uređaju.";
  setText("nav-ai-response", msg);
  speakOut(msg);
  window.location.href = "tel:" + num;
}

// ---------------------------------------------
// RUTA FORM
// ---------------------------------------------
function setupRouteForm() {
  const form = document.getElementById("route-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const from = document.getElementById("route-from").value.trim();
    const to = document.getElementById("route-to").value.trim();
    const mode = document.getElementById("route-mode").value;

    if (!from || !to) {
      setText("route-result", "Unesi polazak i odredište.");
      return;
    }

    try {
      const data = await callRoute("route", { from, to, mode });
      const text = `${data.from} → ${data.to}: ${data.distance} / ${data.duration} (${data.source})`;
      setText("route-result", text);

      setText("nav-current-route", `${data.from} → ${data.to}`);
      setText("nav-direction", data.to || "–");
      setText("nav-eta", data.duration || "–");
      setText("nav-profile", mode === "truck" ? "Kamion" : "Osobni");
    } catch (err) {
      console.error("route", err);
      setText("route-result", "Greška pri računanju rute.");
    }
  });
}

// ---------------------------------------------
// PRETRAGA + GLAS – AI NAVIGATOR
// ---------------------------------------------
function parseCityFromQuery(query) {
  let m =
    query.match(/\b(u|za|prema)\s+([A-ZČĆŠĐŽ][A-Za-zČĆŠĐŽčćšđž]+)\b/) ||
    query.match(/\b([A-ZČĆŠĐŽ][A-Za-zČĆŠĐŽčćšđž]+)\b$/);

  if (m) {
    const city = m[2] || m[1];
    return city;
  }
  return null;
}

function stripWakeWord(text) {
  let t = text.trim();
  const wakeRegex =
    /^\s*(hey|hej)\s+(tbw|tebeve|te-be-ve|t\.b\.w\.?|teve|ti bi dablju)\s*,?/i;
  t = t.replace(wakeRegex, "").trim();
  return t;
}

function detectIntents(lower) {
  const intents = [];

  if (
    /apartman|smještaj|hotel|booking|airbnb|noćenje/.test(lower)
  ) {
    intents.push("booking");
  }
  if (/promet|gužva|zastoj|traffic|kolona/.test(lower)) {
    intents.push("traffic");
  }
  if (/vrijeme|temperatur|prognoza|vremenska/.test(lower)) {
    intents.push("weather");
  }
  if (/more|valovit|sea state|valovi/.test(lower)) {
    intents.push("sea");
  }
  if (/avion|let|aerodrom|zračna luka|flight/.test(lower)) {
    intents.push("airport");
  }
  if (/ruta|put|navigiraj|navigacija|idem prema|vozim/.test(lower)) {
    intents.push("route");
  }
  if (/truck|kamion|long haul/.test(lower)) {
    intents.push("truck");
  }
  if (/nesreć|nesrece|accident|sudar/.test(lower)) {
    intents.push("emergency");
  }
  return intents;
}

async function handleAiQuery(query, options = {}) {
  const { speak = true } = options;
  if (!query || !query.trim()) return;

  let text = stripWakeWord(query);
  if (!text) {
    setText(
      "nav-ai-response",
      "Slušam. Reci npr. 'idem prema Zagrebu, kakav je promet ispred mene?'"
    );
    return;
  }

  const lower = text.toLowerCase();
  const destinationCity = parseCityFromQuery(text) || currentCity;
  const intents = detectIntents(lower);

  const responses = [];

  // Emergency quick-confirm
  if (pendingEmergencyPrompt) {
    if (/^(da|može|naravno|obavijesti|zovi)/.test(lower)) {
      pendingEmergencyPrompt = false;
      triggerEmergencyCallFlow();
      return;
    }
    if (/^(ne|nije potrebno|stigli su|ne treba)/.test(lower)) {
      pendingEmergencyPrompt = false;
      const msg = "U redu, ne zovem hitne službe. Vozi oprezno.";
      setText("nav-ai-response", msg);
      if (speak) speakOut(msg);
      return;
    }
  }

  if (intents.includes("emergency")) {
    pendingEmergencyPrompt = true;
    const msg =
      "Detektirao sam prijavu nesreće ispred tebe. Želiš li da pozovem hitne službe?";
    setText("nav-ai-response", msg);
    if (speak) speakOut(msg);
    return;
  }

  const tasks = [];

  if (intents.includes("weather")) tasks.push(loadWeather());
  if (intents.includes("traffic")) tasks.push(loadTraffic());
  if (intents.includes("sea")) tasks.push(loadSea());
  if (intents.includes("airport")) tasks.push(loadAirport());
  if (intents.includes("booking")) tasks.push(loadBooking());
  if (intents.includes("truck")) tasks.push(loadTruck());

  // Ako je nav/route → izračunaj rutu
  let routeData = null;
  if (intents.includes("route") || intents.includes("traffic")) {
    try {
      const mode = intents.includes("truck") ? "truck" : "car";
      routeData = await callRoute("route", {
        from: currentCity,
        to: destinationCity,
        mode,
      });
      setText("nav-current-route", `${routeData.from} → ${routeData.to}`);
      setText("nav-direction", routeData.to || "–");
      setText("nav-eta", routeData.duration || "–");
      setText("nav-profile", mode === "truck" ? "Kamion" : "Osobni");
      setText(
        "route-result",
        `${routeData.from} → ${routeData.to}: ${routeData.distance} / ${routeData.duration} (${routeData.source})`
      );
    } catch (e) {
      console.error("route (AI)", e);
    }
  }

  await Promise.allSettled(tasks);

  // ODGOVOR KOJI ZVUČI LJUDSKO
  if (intents.includes("traffic")) {
    const tStatus = document.getElementById("traffic-status")?.textContent || "";
    const tLevel = document.getElementById("traffic-level")?.textContent || "";
    let part = `Prema ${destinationCity} promet je: ${tStatus.toLowerCase()}.`;
    if (tLevel) {
      part += ` Prosječna brzina je ${tLevel.replace("Brzina: ", "")}.`;
    }
    if (routeData && routeData.duration) {
      part += ` Na tvojoj ruti put će trajati otprilike ${routeData.duration}.`;
    }
    responses.push(part);
  }

  if (intents.includes("weather")) {
    const wt = document.getElementById("weather-temp")?.textContent || "";
    const wc = document.getElementById("weather-cond")?.textContent || "";
    responses.push(
      `Vrijeme u ${currentCity} je ${wc.toLowerCase()} s temperaturom oko ${wt}.`
    );
  }

  if (intents.includes("sea")) {
    const sea = document.getElementById("sea-state")?.textContent || "";
    responses.push(`Stanje mora: ${sea.toLowerCase()}.`);
  }

  if (intents.includes("airport")) {
    const ac = document.getElementById("airport-code")?.textContent || "";
    const as = document.getElementById("airport-status")?.textContent || "";
    responses.push(
      `Na aerodromu ${ac || "u tvom području"} status je: ${as.toLowerCase()}.`
    );
  }

  if (intents.includes("booking")) {
    const bCity =
      document.getElementById("booking-city")?.textContent || destinationCity;
    const bookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
      bCity
    )}`;
    const part =
      `Za smještaj u ${bCity} mogu ti predložiti da pogledaš aktualne ponude. ` +
      `Otvorit ću ti Booking s tim gradom.`;
    const urlEl = document.getElementById("booking-url");
    const wrap = document.getElementById("booking-url-wrap");
    if (urlEl && wrap) {
      urlEl.href = bookingUrl;
      wrap.classList.remove("hidden");
    }
    responses.push(part);
  }

  if (intents.length === 0) {
    responses.push(
      "Razumijem te. Možeš pitati za promet, vrijeme, smještaj, rutu, more, aerodrom ili prijaviti nesreću."
    );
  }

  const finalText = responses.join(" ");

  // DEMO LIMIT – blaži odgovori
  if (tbwMode === "demo") {
    const demoText =
      finalText +
      " Napomena: trenutno si u demo modu. Za potpune AI odgovore i sve funkcije aktiviraj premium pretplatu.";
    setText("nav-ai-response", demoText);
    if (speak) speakOut(demoText);
  } else {
    setText("nav-ai-response", finalText);
    if (speak) speakOut(finalText);
  }
}

async function handleUserQuery(rawQuery, options = {}) {
  if (!rawQuery || !rawQuery.trim()) return;
  const q = rawQuery.trim();

  const possibleCity = parseCityFromQuery(q);
  if (possibleCity && possibleCity !== currentCity) {
    currentCity = possibleCity;
    await refreshCity(currentCity);
  }

  await handleAiQuery(q, options);
}

// SEARCH UI
function setupSearch() {
  const btn = document.getElementById("search-btn");
  const input = document.getElementById("search-input");

  if (btn) {
    btn.addEventListener("click", async () => {
      if (!input) return;
      const q = input.value.trim();
      if (!q) return;
      await handleUserQuery(q, { speak: false });
    });
  }

  if (input) {
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        await handleUserQuery(q, { speak: false });
      }
    });
  }
}

// VOICE – kontinuirano dok ne pritisneš ponovno
function setupVoice() {
  const micBtn = document.getElementById("mic-btn");
  if (!micBtn) return;

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = "Glasovno pretraživanje nije podržano u ovom pregledniku.";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "hr-HR";
  recognition.interimResults = false;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", async (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (!res.isFinal) continue;
      const transcript = res[0]?.transcript || "";
      const input = document.getElementById("search-input");
      if (input) input.value = transcript;
      await handleUserQuery(transcript, { speak: true });
    }
  });

  recognition.addEventListener("end", () => {
    if (micActive) {
      try {
        recognition.start();
      } catch (e) {
        console.warn("Recognition restart error", e);
        micActive = false;
        micBtn.classList.remove("mic-on");
      }
    } else {
      micBtn.classList.remove("mic-on");
    }
  });

  micBtn.addEventListener("click", () => {
    if (micActive) {
      micActive = false;
      micBtn.classList.remove("mic-on");
      try {
        recognition.stop();
      } catch (e) {
        console.warn("Recognition stop error", e);
      }
    } else {
      micActive = true;
      micBtn.classList.add("mic-on");
      try {
        recognition.start();
      } catch (e) {
        console.warn("Recognition start error", e);
        micActive = false;
        micBtn.classList.remove("mic-on");
      }
    }
  });
}

// ---------------------------------------------
// HERO WEATHER EFEKTI (snijeg / kiša)
// ---------------------------------------------
function applyWeatherEffects() {
  const cond = document.getElementById("weather-cond")?.textContent || "";
  const effects = document.getElementById("hero-effects");
  if (!effects) return;
  effects.innerHTML = "";

  const c = cond.toLowerCase();
  if (!c) return;

  if (c.includes("snijeg") || c.includes("snow")) {
    for (let i = 0; i < 20; i++) {
      const flake = document.createElement("div");
      flake.className = "hero-snowflake";
      flake.style.left = Math.random() * 100 + "%";
      flake.style.animationDelay = Math.random() * 2 + "s";
      effects.appendChild(flake);
    }
  } else if (c.includes("kiša") || c.includes("rain")) {
    for (let i = 0; i < 30; i++) {
      const drop = document.createElement("div");
      drop.className = "hero-raindrop";
      drop.style.left = Math.random() * 100 + "%";
      drop.style.animationDelay = Math.random() * 1.5 + "s";
      effects.appendChild(drop);
    }
  }
}

// ---------------------------------------------
// REFRESH SVEGA ZA GRAD
// ---------------------------------------------
async function refreshCity(city) {
  if (!city) return;
  currentCity = city;

  const heroPill = document.getElementById("hero-city-pill");
  if (heroPill) heroPill.textContent = city;

  await Promise.all([
    loadHero(),
    loadWeather(),
    loadTraffic(),
    loadSea(),
    loadTransit(),
    loadAirport(),
    loadServices(),
    loadLandmarks(),
    loadFood(),
    loadExtendedCity(),
    loadTruck(),
    loadRouteDefault(),
    loadBooking(),
    loadPremium(),
  ]);

  startTicker();
}

// ---------------------------------------------
// INIT
// ---------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  playIntroSequence();
  setupLegalOverlay();
  setupFullscreen();
  setupRouteForm();
  setupSearch();
  setupVoice();
  setupSafetyActions();
  setupPremiumBadgeClick();

  // Postavi početni trial/demo/premium iz localStorage (prije prvog loadPremium)
  const storedPremium = localStorage.getItem(LS_PREMIUM_STATUS) || "free";
  evaluateMode(storedPremium);

  const accepted = localStorage.getItem(LS_LEGAL_ACCEPTED) === "1";
  if (accepted) {
    refreshCity(currentCity);
  }

  // PWA service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch((e) =>
      console.warn("SW error", e)
    );
  }
});
