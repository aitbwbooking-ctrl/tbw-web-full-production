const API_BASE = "/api/tbw";

function qs(id) { return document.getElementById(id); }
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

function getCityFromInput() {
  const val = qs("main-search-input").value.trim();
  if (!val) return "Split";
  const parts = val.split(" ");
  return parts[parts.length - 1];
}

// LEGAL OVERLAY
(function setupLegalOverlay() {
  const overlay = qs("legal-overlay");
  const btn = qs("legal-accept-btn");
  const chkTerms = qs("agree-terms");
  const chkRobot = qs("agree-robot");
  const intro = qs("intro-screen");
  const shell = qs("app-shell");

  function refresh() {
    if (chkTerms.checked && chkRobot.checked) {
      btn.classList.add("enabled");
      btn.disabled = false;
    } else {
      btn.classList.remove("enabled");
      btn.disabled = true;
    }
  }

  chkTerms.addEventListener("change", refresh);
  chkRobot.addEventListener("change", refresh);

  btn.addEventListener("click", () => {
    if (!chkTerms.checked || !chkRobot.checked) return;
    overlay.classList.add("hidden");
    intro.classList.remove("hidden");
    setTimeout(() => {
      intro.classList.add("hidden");
      shell.classList.remove("hidden");
      initApp();
    }, 1800);
  });
})();

async function apiGet(route, params) {
  const url = new URL(API_BASE, window.location.origin);
  url.searchParams.set("route", route);
  if (params) {
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.set(k, params[k]);
      }
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("API error " + res.status);
  return res.json();
}

function setTicker(text) {
  const el = qs("top-ticker");
  if (el) el.textContent = text;
}

function renderTransit(data) {
  const busUl = qs("transit-bus");
  const trainUl = qs("transit-train");
  const ferryUl = qs("transit-ferry");
  busUl.innerHTML = "";
  trainUl.innerHTML = "";
  ferryUl.innerHTML = "";

  (data.bus || []).forEach(b => {
    const li = document.createElement("li");
    li.textContent =
      `Linija ${b.line} · ${b.from} → ${b.to} · polazak za ${b.nextDepartureMinutes} min` +
      (b.delayMinutes ? ` (kašnjenje ${b.delayMinutes} min)` : "");
    busUl.appendChild(li);
  });

  (data.train || []).forEach(t => {
    const li = document.createElement("li");
    li.textContent =
      `${t.line} · ${t.from} → ${t.to} · ${t.departureTime}` +
      (t.delayMinutes ? ` (+${t.delayMinutes} min)` : "");
    trainUl.appendChild(li);
  });

  (data.ferry || []).forEach(f => {
    const li = document.createElement("li");
    li.textContent =
      `${f.line} · ${f.from} → ${f.to} · ${f.departureTime}` +
      (f.delayMinutes ? ` (+${f.delayMinutes} min)` : "");
    ferryUl.appendChild(li);
  });
}

function renderSimpleList(elId, items) {
  const el = qs(elId);
  if (!el) return;
  el.innerHTML = "";
  (items || []).forEach(it => {
    const li = document.createElement("li");
    li.textContent = it;
    el.appendChild(li);
  });
}

function cloneCardForFullscreen(card) {
  const clone = card.cloneNode(true);
  clone.querySelectorAll("[data-card-full]").forEach(btn => btn.remove());
  return clone;
}

function setupFullscreenCards() {
  const overlay = qs("card-full-overlay");
  const inner = qs("card-full-content");
  const exitBtn = qs("card-full-exit");

  $all("[data-card-full]").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      if (!card) return;
      inner.innerHTML = "";
      inner.appendChild(cloneCardForFullscreen(card));
      overlay.classList.remove("hidden");
    });
  });

  exitBtn.addEventListener("click", () => overlay.classList.add("hidden"));
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
}

async function refreshAll(city) {
  city = city || "Split";
  qs("hero-city-pill").textContent = city;
  qs("nav-city").textContent = city;
  qs("booking-city").textContent = city;

  try {
    const [
      weatherData,
      alertsData,
      trafficData,
      bookingData,
      airportData,
      seaData,
      servicesData,
      transitData,
      landmarksData,
      foodData,
      extendedData
    ] = await Promise.all([
      apiGet("weather", { city }),
      apiGet("alerts", { city }),
      apiGet("traffic", { city }),
      apiGet("booking", { city }),
      apiGet("airport", { city }),
      apiGet("sea", { city }),
      apiGet("services", { city }),
      apiGet("transit", { city }),
      apiGet("landmarks", { city }),
      apiGet("food", { city }),
      apiGet("extendedCity", { city })
    ]);

    qs("weather-temp").textContent =
      weatherData && weatherData.temp != null ? Math.round(weatherData.temp) + "°C" : "--°C";
    qs("weather-desc").textContent =
      (weatherData && weatherData.condition) || "Nema podataka";

    qs("alerts-text").textContent =
      (alertsData && alertsData.alert) || "Nema posebnih upozorenja.";

    qs("traffic-status").textContent =
      (trafficData && trafficData.status) || "Nema podataka o prometu.";

    if (bookingData) {
      qs("booking-dates").textContent = bookingData.dates || "";
      qs("booking-price").textContent = bookingData.price || "";
      qs("booking-open").onclick = () => {
        if (bookingData.url) window.open(bookingData.url, "_blank");
      };
    }

    qs("airport-status").textContent =
      (airportData && airportData.status) || "Nema podataka o letovima.";

    qs("sea-state").textContent =
      (seaData && seaData.state) || "Nema podataka o stanju mora.";

    renderSimpleList("services-list", (servicesData && servicesData.list) || []);
    renderTransit(transitData || {});
    renderSimpleList("landmarks-list", (landmarksData && landmarksData.list) || []);

    renderSimpleList("food-restaurants", (foodData && foodData.restaurants) || []);
    renderSimpleList("food-cafes", (foodData && foodData.cafes) || []);
    renderSimpleList("food-clubs", (foodData && foodData.clubs) || []);

    renderSimpleList("city-shops", (extendedData && extendedData.shops) || []);
    const fuelItems = [].concat(
      (extendedData && extendedData.fuel) || [],
      (extendedData && extendedData.ev) || []
    );
    renderSimpleList("city-fuel", fuelItems);

    const tickerText =
      `Grad: ${city} · Temp: ` +
      (weatherData && weatherData.temp != null
        ? Math.round(weatherData.temp) + "°C"
        : "--°C") +
      " · " +
      (trafficData && trafficData.status ? trafficData.status : "Promet N/A") +
      " · " +
      (alertsData && alertsData.alert ? alertsData.alert : "Nema posebnih upozorenja");
    setTicker(tickerText);
  } catch (e) {
    console.error(e);
    setTicker("Greška pri dohvaćanju podataka – provjeri vezu ili API ključeve.");
  }
}

function initSearch() {
  const input = qs("main-search-input");
  const goBtn = qs("search-go-btn");

  function runSearch() {
    const city = getCityFromInput();
    refreshAll(city);
  }

  goBtn.addEventListener("click", runSearch);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") runSearch();
  });
}

function initApp() {
  setupFullscreenCards();
  initSearch();
  refreshAll("Split");
}
