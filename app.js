const map = L.map("map").setView([-37.4697, -72.3537], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap"
}).addTo(map);

let candidatosLayer;
let candidatosData;

const capas = {
  limite: "data/limite_urbano.geojson",
  supermercados: "data/supermercados.geojson",
  cesfam: "data/cesfam.geojson",
  gym: "data/gym.geojson",
  candidatos: "data/candidatos.geojson"
};

function getPesos() {
  const trabajo = Number(document.getElementById("pesoTrabajo").value);
  const superm = Number(document.getElementById("pesoSuper").value);
  const cesfam = Number(document.getElementById("pesoCesfam").value);
  const gym = Number(document.getElementById("pesoGym").value);

  const total = trabajo + superm + cesfam + gym || 1;

  return {
    trabajo: trabajo / total,
    super: superm / total,
    cesfam: cesfam / total,
    gym: gym / total
  };
}

function calcularScore(props) {
  const pesos = getPesos();

  const scTrabajo = Number(props.sc_trab || 0);
  const scSuper = Number(props.sc_super || 0);
  const scCesfam = Number(props.sc_cesfam || 0);
  const scGym = Number(props.sc_gym || 0);

  return (
    scTrabajo * pesos.trabajo +
    scSuper * pesos.super +
    scCesfam * pesos.cesfam +
    scGym * pesos.gym
  );
}

function colorPorScore(score) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#facc15";
  return "#ef4444";
}

function radioPorScore(score) {
  return 6 + score / 12;
}

function cargarCapaSimple(url, estilo, nombre) {
  fetch(url)
    .then(res => res.json())
    .then(data => {
      L.geoJSON(data, {
        style: estilo,
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 5,
            color: estilo.color,
            fillColor: estilo.color,
            fillOpacity: 0.8
          });
        }
      }).addTo(map);
    });
}

function cargarCandidatos() {
  fetch(capas.candidatos)
    .then(res => res.json())
    .then(data => {
      candidatosData = data;
      dibujarCandidatos();
    });
}

function dibujarCandidatos() {
  if (candidatosLayer) {
    map.removeLayer(candidatosLayer);
  }

  candidatosLayer = L.geoJSON(candidatosData, {
    pointToLayer: (feature, latlng) => {
      const score = calcularScore(feature.properties);

      return L.circleMarker(latlng, {
        radius: radioPorScore(score),
        color: colorPorScore(score),
        fillColor: colorPorScore(score),
        fillOpacity: 0.85,
        weight: 2
      });
    },

    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const score = calcularScore(p).toFixed(1);

      layer.bindPopup(`
        <strong>Candidato ${p.id || ""}</strong><br>
        Score final: <strong>${score}/100</strong><br><br>
        Trabajo: ${Number(p.sc_trab || 0).toFixed(1)}<br>
        Supermercado: ${Number(p.sc_super || 0).toFixed(1)}<br>
        CESFAM: ${Number(p.sc_cesfam || 0).toFixed(1)}<br>
        Gym: ${Number(p.sc_gym || 0).toFixed(1)}
      `);
    }
  }).addTo(map);

  actualizarRanking();
}

function actualizarRanking() {
  const lista = document.getElementById("rankingList");
  lista.innerHTML = "";

  const candidatos = candidatosData.features
    .map((f, i) => ({
      id: f.properties.id || i + 1,
      score: calcularScore(f.properties)
    }))
    .sort((a, b) => b.score - a.score);

  candidatos.forEach(c => {
    const li = document.createElement("li");
    li.innerHTML = `Candidato ${c.id}: <strong>${c.score.toFixed(1)}</strong>`;
    lista.appendChild(li);
  });
}

function actualizarLabels() {
  document.getElementById("trabajoVal").textContent =
    document.getElementById("pesoTrabajo").value;

  document.getElementById("superVal").textContent =
    document.getElementById("pesoSuper").value;

  document.getElementById("cesfamVal").textContent =
    document.getElementById("pesoCesfam").value;

  document.getElementById("gymVal").textContent =
    document.getElementById("pesoGym").value;
}

["pesoTrabajo", "pesoSuper", "pesoCesfam", "pesoGym"].forEach(id => {
  document.getElementById(id).addEventListener("input", actualizarLabels);
});

document.getElementById("recalcular").addEventListener("click", () => {
  actualizarLabels();
  dibujarCandidatos();
});

cargarCapaSimple(capas.limite, {
  color: "#ffffff",
  weight: 2,
  fillOpacity: 0
}, "Límite urbano");

cargarCapaSimple(capas.supermercados, {
  color: "#38bdf8",
  weight: 1,
  fillOpacity: 0.4
}, "Supermercados");

cargarCapaSimple(capas.cesfam, {
  color: "#fb7185",
  weight: 1,
  fillOpacity: 0.8
}, "CESFAM");

cargarCapaSimple(capas.gym, {
  color: "#a78bfa",
  weight: 1,
  fillOpacity: 0.8
}, "Gym");

cargarCandidatos();