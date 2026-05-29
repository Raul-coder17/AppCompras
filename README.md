# Cuentas Compras — Gestor de Presupuestos & Asistente Bot Gemini AI 📱✨

**Cuentas Compras** es una aplicación Web Progresiva (PWA) de alto rendimiento, diseñada con una estética *Premium Glassmorphic* (estilo Apple/Google) y optimizada con accesibilidad visual mejorada para adultos mayores. 

La aplicación permite la planificación de listas de compras y el control en tiempo real de presupuestos divididos en efectivo y tarjeta, y cuenta con un **Asistente Inteligente basado en Google Gemini** y un **Calendario Mensual interactivo** para una contabilidad visual del día a día.

---

## 🚀 Características Clave

1. **🤖 Asistente Gemini AI Multimodal:**
   - Controla el 100% de la aplicación mediante lenguaje natural (texto) o subiendo fotografías de tickets físicos.
   - **Propuesta de Tarjeta Instantánea:** Invoca las tarjetas de confirmación en el primer mensaje de forma inmediata.
   - **Failover en Cascada:** Alternancia automática de modelos (`gemini-2.5-flash` ➔ `gemini-2.0-flash` ➔ `gemini-1.5-flash` ➔ `gemini-2.5-pro` ➔ `gemini-1.5-pro`) ante la saturación de cuotas.
   - **Human-in-the-Loop:** Tarjetas editables e interactivas antes de impactar tu presupuesto.

2. **📅 Calendario de Gastos Mensual:**
   - Consolida tus compras (`bought: true`) y pagos de servicios en una cuadrícula mensual interactiva.
   - Badges monetarios diarios y desglose detallado al hacer clic en cualquier día.

3. **🎨 Diseño Premium y Accesible:**
   - Interfaz con efecto vidrio esmerilado (`backdrop-blur-md`).
   - Tipografía de alta legibilidad (*Outfit* y *Plus Jakarta Sans*) y textos oscuros de alto contraste perfectos para adultos mayores.
   - Botones y controles táctiles sobredimensionados para evitar toques erróneos.

---

## 🛠️ Requisitos Previos y Ejecución Local

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Ejecuta el servidor de desarrollo local abierto a tu red doméstica (esencial para conectarte desde tu teléfono vía Wi-Fi):
   ```bash
   npm run dev -- --host
   ```

3. Abre el enlace local proporcionado por la terminal (ej. `http://192.168.1.15:3000`) en el navegador Safari o Google Chrome de tu teléfono e instálala en tu pantalla de inicio seleccionando **"Añadir a la pantalla de inicio"**.

---

## 📖 Documentación Completa y Arquitectura

Para consultar detalles de la estructura de datos, variables reactivas, orquestación de prompts e invocación de herramientas (Tool Calling) en cascada, accede a la [Documentación Técnica Completa](file:///c:/AppCompras/DOCUMENTACION.md).
