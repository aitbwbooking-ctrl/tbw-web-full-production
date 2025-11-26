// TBW AI PREMIUM NAVIGATOR – FRONTEND
// Radi uz backend /api/tbw (tbw.js)

const API_BASE = "/api/tbw";

let currentCity = "Split";
let tickerTimer = null;
let micActive = false;
let recognition = null;
let pendingEmergencyPrompt = false;

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

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${route} error ${res.status}`);
  return res.json();
}

function speakOut(text) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  // pokušaj na hr, fallback na default
  const voices = window.speechSynthesis.getVoices() || [];
  const hrVoice =
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("hr")) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("sr")) ||
    null;
  if (hrVoice) utter.voice = hrVoice;
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

// ---------------------------------------------
// INTRO A + C
// ---------------------------------------------
function playIntroSequence() {
  const fullIntro = document.getElementById("intro-full");
  const miniIntro = document.getElementById("intro-mini");
  if (!fullIntro || !miniIntro) return;

  const hasShownFull = localStorage.getItem("tbw_intro_full_shown") === "1";

  function showMini() {
    miniIntro.classList.remove("hidden");
    setTimeout(() => {
      miniIntro.classList.add("hidden");
    }, 2000);
  }

  if (!hasShownFull) {
    // Prvo pokretanje na ovom uređaju → FULL A (~4-5s)
    fullIntro.classList.remove("hidden");
    setTimeout(() => {
      fullIntro.classList.add("hidden");
      localStorage.setItem("tbw_intro_full_shown", "1");
      showMini();
    }, 4500);
  } else {
    // Svaki idući start → C
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

  const accepted = localStorage.getItem("tbw_legal_accepted") === "1";

  function updateBtn() {
    btn.disabled = !(chkTerms.checked && chkRobot.checked);
  }

  chkTerms.addEventListener("change", updateBtn);
  chkRobot.addEventListener("change", updateBtn);

  btn.addEventListener("click", () => {
    localStorage.setItem("tbw_legal_accepted", "1");
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

  const already = localStorage.getItem("tbw_loc_prompted") === "1";
  if (already) return;

  const allowBtn = document.getElementById("location-allow");
  const denyBtn = document.getElementById("location-deny");

  modal.classList.remove("hidden");

  function close() {
    modal.classList.add("hidden");
    localStorage.setItem("tbw_loc_prompted", "1");
  }

  allowBtn.addEventListener("click", () => {
    close();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          // Ovdje bi išlo reverse geocoding → grad
          // Za sada ostavljamo currentCity kakav jest.
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
  // 69 s refresh, kako si tražio
  tickerTimer = setInterval(updateTicker, 69 * 1000);
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
        "Za više opcija otvorit ćeš Booking, Airbnb ili druge servise."
      );
    }
  } catch (e) {
    console.error("booking", e);
    setText("booking-status", "Greška pri dohvaćanju ponuda.");
  }
}

// livecam za header → ali sada koristimo hero-image; ovo je fallback ako želiš YouTube
async function loadLivecam() {
  try {
    const data = await callRoute("livecam", { mode: "sea" });
    const frame = document.getElementById("livecam-frame");
    if (frame && data.url) {
      frame.src = data.url;
    }
  } catch (e) {
    console.error("livecam", e);
  }
}

// premium badge
async function loadPremium() {
  try {
    const badge = document.getElementById("premium-badge");
    if (!badge) return;

    let userId = localStorage.getItem("tbw_user_id");
    if (!userId) {
      userId = "user-" + Math.random().toString(36).slice(2);
      localStorage.setItem("tbw_user_id", userId);
    }

    const url = new URL(API_BASE, window.location.origin);
    url.searchParams.set("route", "premium");
    url.searchParams.set("userId", userId);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("premium error");
    const data = await res.json();

    if (data.status === "lifetime" || data.status === "premium") {
      badge.textContent =
        data.tier === "founder" ? "Founder premium" : "Premium";
      badge.classList.add("premium-on");
    } else {
      badge.textContent = "Free mode";
      badge.classList.remove("premium-on");
    }
  } catch (e) {
    console.error("premium", e);
  }
}

// ---------------------------------------------
// SIGURNOST & SOS (localStorage konfiguracija)
// ---------------------------------------------
const SOS_KEY = "tbw_sos_profile";
const ICE_KEY = "tbw_ice_contacts";

function loadSafetyPanel() {
  const sosSummary = document.getElementById("sos-summary");
  const iceList = document.getElementById("ice-list");

  // SOS profil
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

  // ICE kontakti
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
      const blood = prompt("Krvna grupa (npr. 0-, A+, nepoznato):", "");
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
      alert("SOS profil i ICE kontakti su spremljeni u ovom uređaju.");
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
  // default EU stil
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
// RUTA FORM (ručni unos)
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
  // probaj "u Zadru", "za Zagreb", "prema Splitu"
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
    /apartman|smještaj|hotel|booking|airbnb|expedia|noćenje/.test(lower)
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

  // PARCIJALNO DOHVAĆANJE PODATAKA
  const tasks = [];

  if (intents.includes("weather")) tasks.push(loadWeather());
  if (intents.includes("traffic")) tasks.push(loadTraffic());
  if (intents.includes("sea")) tasks.push(loadSea());
  if (intents.includes("airport")) tasks.push(loadAirport());
  if (intents.includes("booking")) tasks.push(loadBooking());
  if (intents.includes("truck")) tasks.push(loadTruck());

  // Ako je nav/route → izračunaj rutu (currentCity -> destinationCity)
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

  // SASTAVI ODGOVOR

  if (intents.includes("traffic")) {
    const trafficCard = document.getElementById("traffic-status");
    const levelEl = document.getElementById("traffic-level");
    const tStatus = trafficCard ? trafficCard.textContent : "";
    const tLevel = levelEl ? levelEl.textContent : "";
    let part = `Prema ${destinationCity} promet je: ${tStatus.toLowerCase()}.`;
    if (tLevel) part += ` Trenutna prosječna brzina je ${tLevel.replace("Brzina: ", "")}.`;
    if (routeData && routeData.duration) {
      part += ` Po tvojoj ruti, put će trajati otprilike ${routeData.duration}.`;
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
    const bCity = document.getElementById("booking-city")?.textContent || destinationCity;
    const bookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
      bCity
    )}`;
    const part =
      `Za smještaj u ${bCity} mogu ti predložiti da pogledaš aktualne ponude. ` +
      `Otvorit ću ti Booking s filtriranim gradom.`;
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

  setText("nav-ai-response", finalText);
  if (speak && finalText) speakOut(finalText);
}

// Glavna funkcija koja spaja pretragu i AI
async function handleUserQuery(rawQuery, options = {}) {
  if (!rawQuery || !rawQuery.trim()) return;
  const q = rawQuery.trim();

  // odredi grad ako se spominje
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

// VOICE / "Hey TBW" – kontinuirano dok ne klikneš opet
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
      // ponovno pokreni za kontinuirano slušanje
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

  const accepted = localStorage.getItem("tbw_legal_accepted") === "1";
  if (accepted) {
    refreshCity(currentCity);
  }
});
