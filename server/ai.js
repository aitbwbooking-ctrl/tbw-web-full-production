// server/ai.js
// Mjesto gdje možeš kasnije spajati vlastiti OpenAI / TBW map engine

module.exports = {
  async chatNavigation(context) {
    // context npr: { city, query, traffic, weather, route }
    // Za sada vraćamo samo kratki tekst.
    return {
      reply:
        "AI navigacija je u demo modu. Kada dodaš vlastiti model, ovdje će dolaziti puni odgovori.",
    };
  },
};

