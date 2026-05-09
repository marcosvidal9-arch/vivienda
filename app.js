proj4.defs(
  "EPSG:32718",
  "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs"
);

const map = L.map("map").setView([-37.4697, -72.3537], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap"
}).addTo(map);

let candidatosLayer;
let candidatosData;

const layerControl = L.control.layers(null, null).addTo(map);

const capas = {
  limite: "data/limite_urbano.geojson",
  supermercados: "data/supermercados.geojson",
  cesfam: "data/cesfam.geojson",
  gym: "data/gym.geojson",
  candidatos: "data/candidatos.geojson"
};

function convertir32718a4326(geojson) {
  function convertirCoord(coord) {
    const [lon, lat] = proj4("EPSG:32718", "EPSG:4326", coord);
    return [lon, lat];
  }

  function convertirCoords(coords, type) {
    if (type === "Point") return convertirCoord(coords);

    if (type === "LineString" || type === "MultiPoint") {
      return coords.map(convertirCoord);
    }

    if (type === "Polygon" || type === "MultiLineString") {
      return coords.map(ring => ring.map(convertirCoord));
    }

    if (type === "MultiPolygon") {
      return coords.map(poly =>
        poly.map(ring =>
          ring.map(convertirCoord)
        )
      );
    }

    return coords;
  }

  geojson.features.forEach(feature => {
    if (!feature.geometry) return;

    feature.geometry.coordinates = convertirCoords(
      feature.geometry.coordinates,
      feature.geometry.type
    );
  });

  return geojson;
}

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

  return (
    Number(props.sc_trab || 0) * pesos.trabajo +
    Number(props.sc_super || 0) * pesos.super +
    Number(props.sc_cesfam || 0) * pesos.cesfam +
    Number(props.sc_gym || 0) * pesos.gym
  );
}

function colorPorScore(score) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#facc15";
  if (score >= 25) return "#fb923c";
  return "#ef4444";
}

function radioPorScore(score) {
  return Math.max(8, 8 + score / 10);
}

function cargarCapaSimple(url, opciones, nombre) {
  fetch(url)
    .then(res => res.json())
    .then(data => {
      data = convertir32718a4326(data);

      const layer = L.geoJSON(data, {
        style: {
          color: opciones.color,
          weight: opciones.weight || 2,
          fillColor: opciones.fillColor || opciones.color,
          fillOpacity: opciones.fillOpacity ?? 0.5
        },

        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: opciones.radius || 6,
            color: opciones.color,
            fillColor: opciones.fillColor || opciones.color,
            fillOpacity: opciones.fillOpacity ?? 0.9,
            weight: 2
          });
        },

        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};

          const nombreElemento =
            props.name ||
            props.nombre ||
            props.Name ||
            props.NOMBRE ||
            nombre;

          layer.bindPopup(`<strong>${nombreElemento}</strong><br>${nombre}`);
        }
      }).addTo(map);

      layerControl.addOverlay(layer, nombre);
    })
    .catch(err => console.error(`Error cargando ${nombre}:`, err));
}

function cargarCandidatos() {
  fetch(capas.candidatos)
    .then(res => res.json())
    .then(data => {
      candidatosData = convertir32718a4326(data);
      dibujarCandidatos();
    })
    .catch(err => console.error("Error cargando candidatos:", err));
}

function dibujarCandidatos() {
  if (!candidatosData) return;

  if (candidatosLayer) {
    map.removeLayer(candidatosLayer);
    layerControl.removeLayer(candidatosLayer);
  }

  candidatosLayer = L.geoJSON(candidatosData, {
    pointToLayer: (feature, latlng) => {
      const score = calcularScore(feature.properties);

      return L.circleMarker(latlng, {
        radius: radioPorScore(score),
        color: "#111827",
        fillColor: colorPorScore(score),
        fillOpacity: 0.95,
        weight: 2
      });
    },

    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const score = calcularScore(p).toFixed(1);
      const id = p.id || p.ID || p.Id || "";

      layer.bindPopup(`
        <strong>Candidato ${id}</strong><br>
        Score final: <strong>${score}/100</strong><br><br>
        Trabajo: ${Number(p.sc_trab || 0).toFixed(1)}<br>
        Supermercado: ${Number(p.sc_super || 0).toFixed(1)}<br>
        CESFAM: ${Number(p.sc_cesfam || 0).toFixed(1)}<br>
        Gym: ${Number(p.sc_gym || 0).toFixed(1)}
      `);
    }
  }).addTo(map);

  layerControl.addOverlay(candidatosLayer, "Candidatos");

  actualizarRanking();

  try {
    map.fitBounds(candidatosLayer.getBounds(), {
      padding: [30, 30]
    });
  } catch (e) {
    console.warn("No se pudo ajustar vista a candidatos");
  }
}

function actualizarRanking() {
  const lista = document.getElementById("rankingList");
  lista.innerHTML = "";

  const candidatos = candidatosData.features
    .map((f, i) => ({
      id: f.properties.id || f.properties.ID || i + 1,
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
  document.getElementById(id).addEventListener("input", () => {
    actualizarLabels();
    dibujarCandidatos();
  });
});

document.getElementById("recalcular").addEventListener("click", () => {
  actualizarLabels();
  dibujarCandidatos();
});

cargarCapaSimple(capas.limite, {
  color: "#111827",
  weight: 3,
  fillOpacity: 0
}, "Límite urbano");

cargarCapaSimple(capas.supermercados, {
  color: "#0284c7",
  fillColor: "#38bdf8",
  fillOpacity: 0.45,
  radius: 6
}, "Supermercados");

cargarCapaSimple(capas.cesfam, {
  color: "#be123c",
  fillColor: "#fb7185",
  fillOpacity: 0.9,
  radius: 7
}, "CESFAM");

cargarCapaSimple(capas.gym, {
  color: "#6d28d9",
  fillColor: "#a78bfa",
  fillOpacity: 0.9,
  radius: 7
}, "Gym");

cargarCandidatos();
