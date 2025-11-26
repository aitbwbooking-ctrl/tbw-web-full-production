// TBW AI PREMIUM NAVIGATOR – FRONTEND LOGIKA
// Radi uz tbw.js backend na /api/tbw

const API_BASE = "/api/tbw";

let currentCity = "Split";
let tickerTimer = null;
let micActive = false;
let recognition = null;

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
    if (k !== "city" && params[k] != null) {
      url.searchParams.set(k, params[k]);
    }
  });

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API ${route} error ${res.status}`);
  }
  return res.json();
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
    refreshCity(currentCity);
    showLocationModalOnce();
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

  // kartice
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

  // fullscreen kamere
  const heroFullBtn = document.getElementById("hero-fullscreen");
  const livecamFrame = document.getElementById("livecam-frame");

  if (heroFullBtn && livecamFrame) {
    heroFullBtn.addEventListener("click", () => {
      content.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.src = livecamFrame.src;
      iframe.className = "fullscreen-iframe";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      content.appendChild(iframe);
      overlay.classList.remove("hidden");
    });
  }
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
  tickerTimer = setInterval(updateTicker, 60 * 1000);
}

// ---------------------------------------------
// PUNJENJE KARTICA
// ---------------------------------------------
async function loadWeather() {
  try {
    const data = await callRoute("weather");
    setText("weather-temp", data.temp != null ? `${data.temp.toFixed(1)}°C` : "--°C");
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
        } min${b.delayMinutes ? ` (kašnjenje ${b.delayMinutes} min)` : ""}`;
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
  // ništa ne radi dok user ne unese rutu, ali osiguravamo prazan tekst
  setText("route-result", "");
}

// livecam header
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

    // jednostavan ID uređaja na bazi localStorage
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
    } catch (err) {
      console.error("route", err);
      setText("route-result", "Greška pri računanju rute.");
    }
  });
}

// ---------------------------------------------
// PRETRAGA + GLAS
// ---------------------------------------------
function parseCityFromQuery(query) {
  // vrlo jednostavan parser: traži "u Grad" ili zadnju riječ s velikim početnim slovom
  let m = query.match(/\bu\s+([A-ZČĆŠĐŽ][A-Za-zČĆŠĐŽčćšđž]+)\b/);
  if (m) return m[1];

  const words = query.split(/\s+/);
  const candidates = words.filter(
    (w) => /^[A-ZČĆŠĐŽ][A-Za-zČĆŠĐŽčćšđž]+$/.test(w)
  );
  if (candidates.length > 0) return candidates[candidates.length - 1];

  return query.trim();
}

async function doSearchFromInput() {
  const input = document.getElementById("search-input");
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;

  const city = parseCityFromQuery(q);
  await refreshCity(city);
}

function setupSearch() {
  const btn = document.getElementById("search-btn");
  const input = document.getElementById("search-input");

  if (btn) btn.addEventListener("click", doSearchFromInput);
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doSearchFromInput();
      }
    });
  }
}

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
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", async (event) => {
    const transcript =
      event.results[0] && event.results[0][0]
        ? event.results[0][0].transcript
        : "";
    const input = document.getElementById("search-input");
    if (input) input.value = transcript;
    await doSearchFromInput();
  });

  recognition.addEventListener("end", () => {
    micActive = false;
    micBtn.classList.remove("mic-on");
  });

  micBtn.addEventListener("click", () => {
    if (micActive) {
      recognition.stop();
      micActive = false;
      micBtn.classList.remove("mic-on");
    } else {
      micActive = true;
      micBtn.classList.add("mic-on");
      recognition.start();
    }
  });
}

// ---------------------------------------------
// REFRESH SVEGA ZA GRAD
// ---------------------------------------------
async function refreshCity(city) {
  if (!city) return;
  currentCity = city;
  setText("current-city", city);

  await Promise.all([
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
    loadLivecam(),
    loadPremium(),
  ]);

  startTicker();
}

// ---------------------------------------------
// INIT
// ---------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupLegalOverlay();
  setupFullscreen();
  setupRouteForm();
  setupSearch();
  setupVoice();

  // ako je već prihvatio prije, legal overlay će odmah pozvati refreshCity
  const accepted = localStorage.getItem("tbw_legal_accepted") === "1";
  if (accepted) {
    refreshCity(currentCity);
    startTicker();
  }
});
