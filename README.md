# Organizador de Gastos Personales con IA

Aplicación web para registrar gastos en lenguaje natural (texto libre) y que una IA
(Grok de xAI, con Google Gemini como respaldo) los clasifique automáticamente en categorías, con un resumen visual
de en qué se está gastando la plata.

Trabajo Práctico N.º 3 — Diplomatura — Universidad de Palermo.

## Problema que resuelve

Llevar un registro de gastos personales suele ser tedioso porque hay que elegir
categoría, cargar el monto y ordenar todo a mano. Esta app permite simplemente
escribir el gasto como se piensa ("compré nafta por 15000", "cena afuera 8000
pesos") y la IA se encarga de extraer el monto y asignarle una categoría, armando
en tiempo real un resumen y un gráfico de torta por categoría.

## Cómo funciona (interacción funcional)

1. El usuario escribe un gasto en texto libre en el input.
2. El backend le pide a la IA (Grok; si falla, Gemini) que devuelva un JSON estructurado con
   `descripcion`, `monto` y `categoria` (elegida de una lista fija).
3. El gasto se guarda y aparece al instante en la lista y en el gráfico.
4. Se puede borrar cualquier gasto cargado.
5. Arriba se ve el total gastado y la cantidad de gastos cargados.

## Tecnologías utilizadas

- Backend: Node.js + Express
- IA principal: xAI Grok (`grok-4.20-non-reasoning`, API compatible con OpenAI)
- IA de respaldo: Google Gemini (`gemini-3.8-flash`, vía `@google/generative-ai`),
  free tier; se usa automáticamente si Grok falla
- Frontend: HTML + CSS + JavaScript vanilla
- Gráfico: Chart.js (instalado vía npm y servido localmente)
- Persistencia: archivo JSON local (sin base de datos, para simplicidad)

## Instrucciones de uso

### 1. Requisitos

- Tener [Node.js](https://nodejs.org) instalado (v18 o superior).
- Una API key de xAI (https://console.x.ai) y/o una API key gratuita de Gemini
  (https://aistudio.google.com/apikey, no pide tarjeta). Con una sola alcanza.

### 2. Instalación

```bash
cd gastos-ia
npm install
```

### 3. Configurar la API key

```bash
cp .env.example .env
```

Abrir `.env` y pegar la/s key/s:

```
XAI_API_KEY=tu_api_key_de_xai
GEMINI_API_KEY=tu_api_key_de_gemini
```

### 4. Levantar la app

```bash
node server.js
```

Abrir en el navegador: http://localhost:3005 (o el puerto definido en `PORT`)

### 5. Probar

Escribir gastos de ejemplo como:

- "compré nafta por 15000"
- "supermercado 32000"
- "cine con amigos 6000"
- "pagué el alquiler 250000"
- "remedios en la farmacia 4500"

Cada uno se clasifica solo y se refleja en el gráfico.

## Uso de IA durante el desarrollo

- El código de este proyecto (backend, frontend y estilos) se generó con
  asistencia de Claude (Anthropic), a partir de una consigna iterativa: primero
  se definió la idea entre varias alternativas, luego se armó el plan técnico
  (endpoints, estructura de archivos) y finalmente se generó e integró el código
  completo en una sola sesión de trabajo asistido.
- La app en sí misma también usa IA en tiempo de ejecución: cada gasto que
  carga el usuario se envía a la API de Google Gemini, que lo interpreta y
  devuelve la categoría y el monto estructurado — es la parte central de la
  funcionalidad, no solo una ayuda de desarrollo.
- Se usó el free tier de Gemini (`gemini-3.8-flash`) para no incurrir en
  gastos, cumpliendo con la consigna del TP.

## Dificultades encontradas

- Lograr que el modelo devuelva siempre un JSON válido y con una categoría de
  la lista fija (se resolvió usando `responseMimeType: "application/json"` y
  validando la categoría contra la lista antes de guardar).
- El modelo original (`gemini-2.0-flash`) fue dado de baja por Google y los
  modelos anteriores no están disponibles para keys nuevas; el modelo vigente
  devolvía errores 503 por alta demanda en el free tier. Se resolvió agregando
  reintentos con backoff y una arquitectura multi-proveedor: Grok (xAI) como
  principal y Gemini como respaldo automático.
- Decidir un almacenamiento simple pero funcional para la demo, sin necesitar
  una base de datos externa (se optó por un archivo JSON local).

## Posibles mejoras futuras

- Persistencia en una base de datos real (ej. SQLite o Postgres) para
  multiusuario.
- Login por usuario para llevar gastos separados por persona.
- Filtros por fecha (semana, mes) y comparación entre períodos.
- Edición de gastos ya cargados, no solo alta y borrado.
- Exportar el resumen a Excel/PDF.
- Reconocimiento de gastos recurrentes (ej. alquiler todos los meses).

## Estructura del proyecto

```
gastos-ia/
├── server.js           # Backend Express + integración con Gemini
├── package.json
├── .env.example         # Plantilla de variables de entorno
├── public/
│   ├── index.html       # Interfaz
│   ├── style.css        # Estilos
│   └── app.js            # Lógica del frontend (fetch a la API, gráfico)
└── gastos.json          # Se crea automáticamente al cargar el primer gasto
```
