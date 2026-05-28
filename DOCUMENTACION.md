# Documentación: Cuentas Compras — Gestor de Presupuestos

## 1. ¿Cómo funciona la aplicación?

**Cuentas Compras** es una aplicación Web Progresiva (PWA) diseñada para planificar compras, hacer listas y llevar un control estricto del presupuesto antes y durante la ida al supermercado o tienda. 

Está diseñada para ser completamente utilizable sin conexión gracias a que guarda los datos localmente en el dispositivo del usuario (`localStorage`).

La aplicación se compone de los siguientes módulos principales:
- **Gestión de Presupuesto (`BudgetCard`):** Permite fijar un presupuesto máximo. En tiempo real va sumando lo que ya se gastó (artículos marcados como comprados) y lo que está planificado, mostrando visualmente cuánto dinero queda libre.
- **Formulario de Adición (`AddItemForm`):** Un formulario inteligente para añadir productos. Sugiere automáticamente nombres de tiendas basándose en los lugares introducidos anteriormente.
- **Lista de Compras (`PurchaseList`):** Permite ver todos los artículos, marcarlos como "comprados" con un solo toque, editarlos o eliminarlos.
- **Resumen por Tiendas (`StoreSummary`):** Agrupa matemáticamente cuánto se va a gastar por cada tienda. Permite además filtrar la lista global para ver solo lo que corresponde comprar en un lugar específico.
- **Exportación:** Un botón superior permite descargar toda la lista actual en formato Microsoft Excel/CSV para respaldo.

---

## 2. Cambios y Características Tecnológicas

La aplicación ha sido modernizada con los siguientes cambios:
- **Tecnologías Core:** Migrado a React 19 y Vite 6 con TypeScript para asegurar rapidez y bajo consumo de recursos.
- **Diseño Móvil y Responsivo:** Uso extensivo de Tailwind CSS v4 para adaptar las tarjetas perfectamente a tamaños largos de celular y acomodarlo como Dashboard en Desktop.
- **Persistencia de Datos (Offline):** Todo se guarda inmediatamente en el almacenamiento local del dispositivo. No requiere base de datos ni internet para funcionar una vez abierta (ni para guardar compras ni actualizar precios).
- **Iconografía:** Integración fluida con `lucide-react`.
- **Soporte PWA (Progressive Web App):** Se ha integrado `vite-plugin-pwa` junto con todos los íconos necesarios y un manifiesto web para permitir la instalación nativa de la app en teléfonos saltándose las tiendas de aplicaciones (App Store / Google Play).

---

## 3. Cómo correr la App y probarla localmente

Para desarrollar o correr la app en tu propia computadora:

1. **Requisitos Previos:** Debes tener Node.js instalado en tu equipo.
2. Abre la terminal en VSC o tu línea de comandos y navega a la carpeta del proyecto.
3. Instala las dependencias:
   ```bash
   npm install
   ```
4. Corre el entorno de desarrollo abriendo tu equipo a tu red local (esencial para probar en el teléfono por Wifi):
   ```bash
   npm run dev -- --host
   ```
5. La terminal te dará una dirección de red (ej. `http://192.168.x.x:3000`). Entra ahí en tu computadora o vía el celular conectado al mismo Wi-Fi.

### Reiniciar o cerrar el servidor local

- **Cerrar (detener) el servidor:** en la terminal donde está corriendo, presiona `Ctrl + C`.
- **Reiniciar el servidor:** vuelve a ejecutar el comando `npm run dev -- --host`.

---

## 4. Cómo instalar la Aplicación en Teléfonos (Android / iPhone)

Para poderla instalar de forma permanente como una App nativa offline, primero debe ser "publicada" en un servidor gratuito para obtener el candado de seguridad `https://` (ej. vía Vercel). Una vez subida y con tu enlace en mano, se instala así:

### 🍏 En iPhone / iOS
1. Abre el navegador **Safari** y visita la URL segura de tu aplicación (ej. `https://tu-app.vercel.app`).
2. Toca el botón físico de **Compartir** (el icono de un cuadro con una flecha hacia arriba, en la parte inferior de Safari).
3. Desliza las opciones hacia abajo y selecciona **"Añadir a la pantalla de inicio"** (Add to Home Screen).
4. Dale a confirmar ("Añadir"). La aplicación aparecerá junto a tus otras apps en el menú de escritorio, abriendo a pantalla completa como cualquier app nativa.

### 🤖 En Android
1. Abre el navegador **Google Chrome** y visita la URL de tu aplicación.
2. En la parte inferior suele aparecer automáticamente un aviso flotante que dice: **"Añadir Cuentas Compras a la pantalla de inicio"**. Pulsa en él.
3. Si el aviso no aparece, da un toque sobre los tres puntos de opciones de Chrome en la esquina superior derecha.
4. Selecciona la opción **"Instalar aplicación"** o "Añadir a pantalla de inicio".
5. Confirma y espera unos segundos. La App quedará permanentemente instalada para abrirla cuantas veces quieras y organizar tus finanzas sin gastar datos ni WiFi.