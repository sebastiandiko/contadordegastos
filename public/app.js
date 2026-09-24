const form = document.getElementById("form-gasto");
const input = document.getElementById("input-texto");
const btn = document.getElementById("btn-agregar");
const mensajeError = document.getElementById("mensaje-error");
const listaEl = document.getElementById("lista-gastos");
const totalGeneralEl = document.getElementById("total-general");
const cantidadGastosEl = document.getElementById("cantidad-gastos");
const sinDatosEl = document.getElementById("sin-datos");
const ctxGrafico = document.getElementById("grafico");

const COLORES = [
  "#6c8cff", "#40c4a0", "#ffb84c", "#ff6b6b",
  "#c792ea", "#4dd0e1", "#f06292", "#9ccc65", "#bdbdbd",
];

let chart = null;

function formatoPesos(n) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

async function cargarTodo() {
  const [gastos, resumen] = await Promise.all([
    fetch("/api/gastos").then((r) => r.json()),
    fetch("/api/resumen").then((r) => r.json()),
  ]);

  renderResumen(resumen);
  renderLista(gastos);
  renderGrafico(resumen.totalPorCategoria);
}

function renderResumen(resumen) {
  totalGeneralEl.textContent = formatoPesos(resumen.totalGeneral);
  cantidadGastosEl.textContent = resumen.cantidadGastos;
}

function renderLista(gastos) {
  listaEl.innerHTML = "";
  for (const g of gastos) {
    const li = document.createElement("li");
    li.className = "gasto-item";
    li.innerHTML = `
      <div class="gasto-info">
        <span class="gasto-desc">${escapeHtml(g.descripcion)}</span>
        <span class="gasto-cat">${escapeHtml(g.categoria)}</span>
      </div>
      <span class="gasto-monto">${formatoPesos(g.monto)}</span>
      <button class="gasto-borrar" title="Borrar" data-id="${g.id}">✕</button>
    `;
    listaEl.appendChild(li);
  }

  listaEl.querySelectorAll(".gasto-borrar").forEach((b) => {
    b.addEventListener("click", async () => {
      await fetch(`/api/gastos/${b.dataset.id}`, { method: "DELETE" });
      cargarTodo();
    });
  });
}

function renderGrafico(totalPorCategoria) {
  const categorias = Object.keys(totalPorCategoria);
  const valores = Object.values(totalPorCategoria);

  sinDatosEl.style.display = categorias.length ? "none" : "block";
  ctxGrafico.style.display = categorias.length ? "block" : "none";

  if (chart) chart.destroy();
  if (!categorias.length) return;

  chart = new Chart(ctxGrafico, {
    type: "doughnut",
    data: {
      labels: categorias,
      datasets: [
        {
          data: valores,
          backgroundColor: categorias.map((_, i) => COLORES[i % COLORES.length]),
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#e8e9ed", padding: 14, font: { size: 12 } },
        },
      },
    },
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const texto = input.value.trim();
  if (!texto) return;

  mensajeError.textContent = "";
  btn.disabled = true;
  btn.textContent = "Clasificando...";

  try {
    const res = await fetch("/api/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Error al agregar el gasto.");

    input.value = "";
    await cargarTodo();
  } catch (err) {
    mensajeError.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Agregar";
    input.focus();
  }
});

cargarTodo();
