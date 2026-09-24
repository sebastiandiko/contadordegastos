require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "gastos.json");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
// Chart.js servido desde node_modules (no depende de un CDN externo)
app.use("/vendor", express.static(path.join(__dirname, "node_modules/chart.js/dist")));

// ---- Categorías fijas que puede usar la IA ----
const CATEGORIAS = [
  "Comida",
  "Transporte",
  "Vivienda",
  "Salud",
  "Entretenimiento",
  "Educación",
  "Ropa",
  "Servicios",
  "Otros",
];

// ---- Proveedores de IA: xAI (Grok) principal, Gemini de respaldo ----
const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL || "grok-4.20-non-reasoning";

const geminiKey = process.env.GEMINI_API_KEY;
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

async function consultarXAI(prompt) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: XAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    throw new Error(`xAI respondió ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function consultarGemini(prompt) {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });

  // Reintenta si Gemini está saturado (503) o limita por cuota (429)
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const reintentable = err.status === 503 || err.status === 429;
      if (!reintentable || intento === 3) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** intento));
    }
  }
}

const PROVEEDORES = [
  XAI_API_KEY && { nombre: `xAI (${XAI_MODEL})`, consultar: consultarXAI },
  genAI && { nombre: `Gemini (${GEMINI_MODEL})`, consultar: consultarGemini },
].filter(Boolean);

// Prueba cada proveedor en orden; si uno falla, pasa al siguiente
async function consultarIA(prompt) {
  if (PROVEEDORES.length === 0) {
    throw new Error(
      "Falta una API key. Copiá .env.example a .env y cargá XAI_API_KEY o GEMINI_API_KEY."
    );
  }
  const errores = [];
  for (const p of PROVEEDORES) {
    try {
      return await p.consultar(prompt);
    } catch (err) {
      console.error(`Falló ${p.nombre}:`, err.message);
      errores.push(`${p.nombre}: ${err.message}`);
    }
  }
  throw new Error(`Ningún proveedor de IA respondió. ${errores.join(" | ")}`);
}

async function categorizarConIA(texto) {
  const prompt = `Sos un asistente que analiza un gasto personal escrito en lenguaje natural (en español rioplatense) y devuelve datos estructurados.

Categorías posibles (usá EXACTAMENTE una de estas): ${CATEGORIAS.join(", ")}.

Texto del gasto: "${texto}"

Devolvé SOLO un JSON con este formato exacto, sin texto adicional:
{
  "descripcion": "una descripción corta y clara del gasto",
  "monto": <número, solo el valor numérico sin símbolos>,
  "categoria": "una de las categorías de la lista"
}

Si no podés identificar un monto numérico, usá 0. Si no encaja en ninguna categoría, usá "Otros".`;

  const raw = await consultarIA(prompt);
  const parsed = JSON.parse(raw);

  return {
    descripcion: parsed.descripcion || texto,
    monto: Number(parsed.monto) || 0,
    categoria: CATEGORIAS.includes(parsed.categoria) ? parsed.categoria : "Otros",
  };
}

// ---- Persistencia simple en archivo JSON ----
function leerGastos() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function guardarGastos(gastos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(gastos, null, 2));
}

// ---- Endpoints ----

// Agregar un gasto en texto libre -> lo categoriza la IA
app.post("/api/gastos", async (req, res) => {
  const { texto } = req.body;
  if (!texto || !texto.trim()) {
    return res.status(400).json({ error: "Falta el texto del gasto." });
  }

  try {
    const clasificado = await categorizarConIA(texto.trim());
    const gastos = leerGastos();
    const nuevoGasto = {
      id: Date.now(),
      textoOriginal: texto.trim(),
      ...clasificado,
      fecha: new Date().toISOString(),
    };
    gastos.unshift(nuevoGasto);
    guardarGastos(gastos);
    res.status(201).json(nuevoGasto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error al procesar el gasto." });
  }
});

// Listar todos los gastos
app.get("/api/gastos", (req, res) => {
  res.json(leerGastos());
});

// Borrar un gasto (útil para limpiar la demo)
app.delete("/api/gastos/:id", (req, res) => {
  const id = Number(req.params.id);
  const gastos = leerGastos().filter((g) => g.id !== id);
  guardarGastos(gastos);
  res.json({ ok: true });
});

// Resumen: total general + total por categoría
app.get("/api/resumen", (req, res) => {
  const gastos = leerGastos();
  const totalPorCategoria = {};
  let totalGeneral = 0;

  for (const g of gastos) {
    totalPorCategoria[g.categoria] = (totalPorCategoria[g.categoria] || 0) + g.monto;
    totalGeneral += g.monto;
  }

  res.json({ totalGeneral, totalPorCategoria, cantidadGastos: gastos.length });
});

app.listen(PORT, () => {
  console.log(`\n💰 Organizador de gastos corriendo en http://localhost:${PORT}\n`);
  console.log(`IA: ${PROVEEDORES.map((p) => p.nombre).join(" → ") || "sin proveedores configurados"}\n`);
});
