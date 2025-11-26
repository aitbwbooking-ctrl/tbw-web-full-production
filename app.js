// TBW AI PREMIUM NAVIGATOR – FRONTEND LOGIKA
// Radi uz tbw.js backend na /api/tbw

const API_BASE = "/api/tbw";

let currentCity = "Split";
let tickerTimer = null;
let micActive = false;
let recognition = null;

// pamti zadnju “AI rutu” za navigacijsku karticu
let lastRouteInfo = null;

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

function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "hr-HR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.error("speech error", e);
  }
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
// INTRO A + C
// ---------------------------------------------
function runIntro() {
  const full = $("#intro-full");
  const mini = $("#intro-mini");

  const keyFull = "tbw_intro_full_shown";
  const alreadyFull = localStorage.getItem(keyFull) === "1";

  if (!alreadyFull && full) {
    full.classList.remove("hidden");
    setTimeout(() => {
      full.classList.add("hidden");
      localStorage.setItem(keyFull, "1");
      if (mini) {
        mini.classList.remove("hidden");
        setTimeout(() => mini.classList.add("hidden"), 1500);
      }
    }, 6000);
  } else if (mini) {
    mini.classList.remove("hidden");
    setTimeout(() => mini.classList.add("hidden"), 1500);
  }
}

// ---------------------------------------------
// LEGAL OVERLAY + LOKACIJA
// ---------------------------------------------
function setupLegalOverlay() {
  const overlay = $("#legal-overlay");
  const chkTerms = $("#agree-terms");
  const chkRobot = $("#agree-robot");
  const btn = $("#legal-accept-btn");

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
  const modal = $("#location-modal");
  if (!modal) return;

  const already = localStorage.getItem("tbw_loc_prompted") === "1";
  if (already) return;

  const allowBtn = $("#location-allow");
  const denyBtn = $("#location-deny");

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
  const overlay = $("#fullscreen-overlay");
  const exitBtn = $("#fullscreen-exit");
  const content = $("#fullscreen-content");
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
  const el = $("#ticker");
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
  // svaka 69 sekundi, po dogovoru
  tickerTimer = setInterval(updateTicker, 69 * 1000);
}

// ---------------------------------------------
// PUNJENJE KARTICA
// ---------------------------------------------
async function loadHero() {
  try {
    const data = await callRoute("hero");
    const img = $("#hero-img");
    const pill = $("#hero-city-pill");
    if (pill) pill.textContent = data.city || currentCity;
    if (img && data.images && data.images.length > 0) {
      img.src = data.images[0];
    }
  } catch (e) {
    console.error("hero", e);
  }
}

async function loadWeather() {
  try {
    const data = await callRoute("weather");
    setText("weather-temp", data.temp != null ? `${data.temp.toFixed(1)}°C` : "--°C");
    setText("weather-cond", data.condition || "Nema podataka.");
  } catch (e) {
    console.error("weather", e);
    setText("weather-cond", "Greška pri dohvaćanju vremena.");
  }
}

async function loadTraffic() {
  try {
    const data = await callRoute("traffic");
    setText("traffic-status", data.status || "Nema podataka o prometu.");
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
    const busList = $("#transit-bus-list");
    const trainList = $("#transit-train-list");
    const ferryList = $("#transit-ferry-list");

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
    setText("airport-status", data.status || "Nema podataka o letovima.");
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

    const list = $("#services-list");
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
    const list = $("#landmarks-list");
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
    const ul = $("#truck-restrictions");
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

async function loadPremium() {
  try {
    const badge = $("#premium-badge");
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

// Booking kartica – backend route "booking" (ako ne radi, prikaži poruku)
async function loadBooking() {
  const cityEl = $("#booking-city");
  const datesEl = $("#booking-dates");
  const priceEl = $("#booking-price");
  const statusEl = $("#booking-status");
  const urlWrap = $("#booking-url-wrap");
  const urlA = $("#booking-url");

  if (cityEl) cityEl.textContent = currentCity;
  if (datesEl) datesEl.textContent = "";
  if (priceEl) priceEl.textContent = "";
  if (statusEl) statusEl.textContent = "Tražim smještaj…";
  if (urlWrap) urlWrap.classList.add("hidden");

  try {
    const data = await callRoute("booking");
    if (!data) {
      statusEl.textContent =
        "Nema dostupnih podataka o smještaju (API nije spojen).";
      return;
    }

    if (cityEl) cityEl.textContent = data.city || currentCity;
    if (datesEl) datesEl.textContent = data.dates || "–";
    if (priceEl) priceEl.textContent = data.price || "–";

    if (data.url && urlA && urlWrap) {
      urlA.href = data.url;
      urlWrap.classList.remove("hidden");
    }

    statusEl.textContent =
      data.price || data.dates
        ? "Klikni 'Otvori ponude' za detalje na Booking.com."
        : "Nema detaljnih podataka – otvorit će se rezultati pretrage.";
  } catch (e) {
    console.error("booking", e);
    if (statusEl) {
      statusEl.textContent =
        "Ne mogu dohvatiti smještaj. API možda nije konfiguriran.";
    }
  }
}

// Navigacijska kartica – prikaz zadnje rute i AI komentara
function updateNavigationCard() {
  const routeEl = $("#nav-current-route");
  const dirEl = $("#nav-direction");
  const etaEl = $("#nav-eta");
  const profileEl = $("#nav-profile");
  const aiEl = $("#nav-ai-response");

  if (!lastRouteInfo) {
    if (routeEl) routeEl.textContent = "Nema aktivne rute.";
    if (dirEl) dirEl.textContent = "–";
    if (etaEl) etaEl.textContent = "–";
    if (aiEl) aiEl.textContent = "";
    return;
  }

  if (routeEl)
    routeEl.textContent = `${lastRouteInfo.from} → ${lastRouteInfo.to}`;
  if (dirEl) dirEl.textContent = lastRouteInfo.direction || "prema " + lastRouteInfo.to;
  if (etaEl) etaEl.textContent = lastRouteInfo.eta || lastRouteInfo.duration || "procjena";
  if (profileEl) profileEl.textContent = lastRouteInfo.mode === "truck" ? "Kamion" : "Osobni";
  if (aiEl) aiEl.textContent = lastRouteInfo.aiText || "";
}

// livecam ne koristimo (layout slika), ali možemo i dalje dohvatiti YouTube URL za neke buduće potrebe
async function loadLivecam() {
  try {
    await callRoute("livecam", { mode: "sea" });
  } catch (e) {
    console.error("livecam", e);
  }
}

// ---------------------------------------------
// SIGURNOST & SOS
// ---------------------------------------------
function loadSafetyCard() {
  const raw = localStorage.getItem("tbw_sos_profile");
  let profile = null;
  try {
    profile = raw ? JSON.parse(raw) : null;
  } catch {
    profile = null;
  }

  const summaryEl = $("#sos-summary");
  const iceList = $("#ice-list");

  if (!profile) {
    if (summaryEl) summaryEl.textContent = "Nije postavljen.";
    if (iceList) iceList.innerHTML = "";
    return;
  }

  if (summaryEl) {
    summaryEl.textContent =
      (profile.blood ? `Krvna grupa: ${profile.blood} · ` : "") +
      (profile.allergies ? `Alergije: ${profile.allergies} · ` : "") +
      (profile.notes || "");
  }

  if (iceList) {
    iceList.innerHTML = "";
    (profile.ice || []).forEach((c) => {
      const li = document.createElement("li");
      li.textContent = `${c.name} – ${c.phone}`;
      iceList.appendChild(li);
    });
  }
}

function setupSafetyActions() {
  const editBtn = $("#sos-edit");
  const call112 = $("#call-112");
  const call911 = $("#call-911");

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      const blood = prompt("Unesi krvnu grupu (npr. 0+, A+…)", "");
      const allergies = prompt(
        "Alergije / lijekovi (kratko, zbog hitne):",
        ""
      );
      const notes = prompt(
        "Važne napomene (bolesti, implanti, lijekovi…):",
        ""
      );

      const ice = [];
      const count = 3;
      for (let i = 0; i < count; i++) {
        const name = prompt(
          `ICE kontakt ${i + 1} – ime (ENTER za preskoči):`,
          ""
        );
        if (!name) continue;
        const phone = prompt(`Telefon za ${name}:`, "");
        if (!phone) continue;
        ice.push({ name, phone });
      }

      const profile = { blood, allergies, notes, ice };
      localStorage.setItem("tbw_sos_profile", JSON.stringify(profile));
      loadSafetyCard();
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
}

function maybeOfferSOS(transcript) {
  const lower = transcript.toLowerCase();
  if (
    lower.includes("nesreća ispred mene") ||
    lower.includes("nesreca ispred mene") ||
    lower.includes("udarac") ||
    lower.includes("sudar") ||
    lower.includes("accident")
  ) {
    const wants = confirm(
      "Čini se da spominješ nesreću ispred sebe. Želiš li da nazovem hitne službe (112)?"
    );
    if (wants) {
      window.location.href = "tel:112";
    } else {
      speak("U redu, ne zovem hitne. Ako se situacija promijeni, reci mi.");
    }
  }
}

// ---------------------------------------------
// RUTA FORM
// ---------------------------------------------
function setupRouteForm() {
  const form = $("#route-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const from = $("#route-from").value.trim();
    const to = $("#route-to").value.trim();
    const mode = $("#route-mode").value;

    if (!from || !to) {
      setText("route-result", "Unesi polazak i odredište.");
      return;
    }

    try {
      const data = await callRoute("route", { from, to, mode });
      const text = `${data.from} → ${data.to}: ${data.distance} / ${data.duration} (${data.source})`;
      setText("route-result", text);

      lastRouteInfo = {
        from: data.from,
        to: data.to,
        mode: mode,
        duration: data.duration,
        direction: `prema ${data.to}`,
        eta: null,
        aiText: "Ruta postavljena ručno preko forme.",
      };
      updateNavigationCard();
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
  let m = query.match(/\bu\s+([A-ZČĆŠĐŽ][A-Za-zČĆŠĐŽčćšđž]+)\b/);
  if (m) return m[1];

  const words = query.split(/\s+/);
  const candidates = words.filter(
    (w) => /^[A-ZČĆŠĐŽ][A-Za-zČĆŠĐŽčćšđž]+$/.test(w)
  );
  if (candidates.length > 0) return candidates[candidates.length - 1];

  // fallback – cijeli string
  return query.trim();
}

async function doSearchFromInput() {
  const input = $("#search-input");
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;
  await handleVoiceCommand(q); // koristimo isti parser za tekst i glas
}

// jednostavan NLP parser za glasovne i tekstualne naredbe
async function handleVoiceCommand(originalText) {
  if (!originalText) return;

  let text = originalText.trim();

  // ukloni “hey tbw / hej tbw” varijante
  text = text.replace(/^(hey|hej)\s+tbw\b/i, "").trim();
  text = text.replace(/^(hey|hej)\s+te\s*be\s*ve\b/i, "").trim();

  console.log("Command:", originalText, "->", text);

  maybeOfferSOS(text);

  // 1) pitanja o prometu / vremenu / letu
  const lower = text.toLowerCase();

  // detekcija grada ako je u frazi tipa “u Zadru” ili “za Zagreb”
  let detectedCity = null;
  const mU = text.match(/\b(u|za|prema)\s+([A-ZČĆŠĐŽ][A-Za-zČĆŠĐŽčćšđž]+)\b/);
  if (mU) detectedCity = mU[2];

  // 2) booking / smještaj
  if (
    lower.includes("apartman") ||
    lower.includes("smještaj") ||
    lower.includes("smjestaj") ||
    lower.includes("hotel")
  ) {
    const city = detectedCity || parseCityFromQuery(text);
    currentCity = city;
    setText("hero-city-pill", city);
    setText("booking-city", city);
    await refreshCity(city, { skipBooking: false }); // učitava sve + booking
    speak(
      `Tražim ponude smještaja za ${city}. Kartica rezervacija će se ažurirati.`
    );
    return;
  }

  // 3) “idem prema X … kakav je promet ispred mene”
  if (
    (lower.includes("idem prema") || lower.includes("vozim prema")) &&
    lower.includes("promet")
  ) {
    const city = detectedCity || parseCityFromQuery(text);
    currentCity = city;
    await refreshCity(city);

    const traffic = await callRoute("traffic", { city });
    const weather = await callRoute("weather", { city });
    const airport = await callRoute("airport", { city });

    const spoken = `Prema ${city} je trenutno stanje: ${traffic.status ||
      "nema podatka o prometu"}. Temperatura oko ${
      weather.temp != null ? weather.temp.toFixed(0) + " stupnjeva" : "nepoznato"
    }. Letovi s aerodroma ${airport.airport || ""} – ${
      airport.status || "nema posebnih informacija"
    }.`;

    speak(spoken);

    lastRouteInfo = {
      from: "trenutna lokacija",
      to: city,
      mode: "car",
      duration: traffic.status || "procjena",
      direction: `prema ${city}`,
      eta: null,
      aiText: spoken,
    };
    updateNavigationCard();
    return;
  }

  // 4) samo promjena grada
  if (
    lower.startsWith("zagreb") ||
    lower.startsWith("split") ||
    lower.startsWith("zadar") ||
    lower.startsWith("rijeka") ||
    lower.startsWith("osijek") ||
    lower.includes("grad")
  ) {
    const city = detectedCity || parseCityFromQuery(text);
    await refreshCity(city);
    speak(`Prebacujem sve prozore na grad ${city}.`);
    return;
  }

  // 5) klasična tekstualna pretraga – samo promjena grada
  const city = parseCityFromQuery(text);
  await refreshCity(city);
}

// tekstualni search
function setupSearch() {
  const btn = $("#search-btn");
  const input = $("#search-input");

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

// glas
function setupVoice() {
  const micBtn = $("#mic-btn");
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
    const input = $("#search-input");
    if (input) input.value = transcript;
    await handleVoiceCommand(transcript);
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
      speak("Slušam. Reci Hey TBW i svoju naredbu.");
    }
  });
}

// ---------------------------------------------
// REFRESH SVEGA ZA GRAD
// ---------------------------------------------
async function refreshCity(city, options = {}) {
  if (!city) return;
  currentCity = city;
  setText("hero-city-pill", city);

  const skipBooking = options.skipBooking === true;

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
    loadLivecam(),
    loadPremium(),
    skipBooking ? Promise.resolve() : loadBooking(),
  ]);

  startTicker();
}

// ---------------------------------------------
// INIT
// ---------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  runIntro();
  setupLegalOverlay();
  setupFullscreen();
  setupRouteForm();
  setupSearch();
  setupVoice();
  setupSafetyActions();
  loadSafetyCard();

  const accepted = localStorage.getItem("tbw_legal_accepted") === "1";
  if (accepted) {
    refreshCity(currentCity);
    startTicker();
  }
});
