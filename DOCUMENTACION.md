# Documentación Técnica Completa: Cuentas Compras — Gestor de Presupuestos & Asistente Inteligente IA

Esta documentación describe la arquitectura, tecnologías, lógica interna, estructura de datos y despliegue de **Cuentas Compras**, una Aplicación Web Progresiva (PWA) de alto rendimiento diseñada para la planificación de compras, control estricto de presupuestos financieros y automatización inteligente mediante inteligencia artificial multimodal.

---

## 1. Módulos y Arquitectura de la Aplicación

La aplicación se compone de cinco módulos interactivos de alta fidelidad, sincronizados reactivamente en el estado de React (`App.tsx`) y con persistencia inmediata en el `localStorage` del dispositivo para funcionamiento offline.

```mermaid
graph TD
    subgraph Frontend App (React 19 & Vite 6)
        App[App.tsx - Central State Orchestrator] --> BC[BudgetCard.tsx - Presupuesto & Metas]
        App --> PL[PurchaseList.tsx - Tabla Interactiva & Filtros]
        App --> AIF[AddItemForm.tsx - Añadir Manual & Categorías]
        App --> SP[ServicePayments.tsx - Uber/Didi & Servicios Recurrentes]
        App --> SS[StoreSummary.tsx - Resumen Financiero por Tienda]
        App --> EC[ExpenseCalendar.tsx - Calendario Mensual de Gastos]
        App --> AI[AIAssistant.tsx - Chatbot & OCR Multimodal Gemini]
    end
    
    subgraph Local Storage
        App <--> LS[(Browser LocalStorage - Datos Persistentes)]
    end

    subgraph External APIs
        AI <--> Gemini[Google Gemini API - Modelos Flash/Pro en Cascada]
    end
```

### Detalle de Módulos Principales:
* **Gestión de Presupuestos (`BudgetCard.tsx`):** Divide el capital total disponible en dos canastas: **Efectivo** y **Tarjeta/Transferencia**. Muestra en tiempo real estadísticas de capital total comprometido, restante, gastado directo y planificado. Cuenta con atajos táctiles rápidos para agregar fondos.
* **Formulario de Adición Inteligente (`AddItemForm.tsx`):** Permite registrar artículos indicando nombre, precio, cantidad, categoría, establecimiento y método de pago. Ofrece sugerencias de autocompletado en tiempo real basadas en compras pasadas.
* **Filtro y Listado General (`PurchaseList.tsx`):** Controla el estado comprado/pendiente del artículo con un solo toque. Incluye barra de búsqueda por texto, filtrado rápido por chips de categorías de alto contraste, ordenamiento inteligente por fecha/precio, y un historial/papelera de reciclaje para restaurar artículos borrados.
* **Resumen Financiero por Tienda (`StoreSummary.tsx`):** Agrupa matemáticamente los artículos para calcular el monto exacto comprometido en cada establecimiento y permite hacer clic en el nombre de una tienda para filtrar el listado global instantáneamente.
* **Calendario Mensual de Gastos (`ExpenseCalendar.tsx`):** Apartado temporal interactivo. Consolida compras (`bought: true`) y pagos de servicios por día en una cuadrícula mensual limpia, mostrando badges de gasto diario y un cajón esmerilado que detalla los artículos comprados al hacer clic en un día.
* **Asistente Inteligente IA (`AIAssistant.tsx`):** Panel deslizable estilo lateral (*drawer*) que permite controlar el 100% de la aplicación mediante lenguaje natural (texto) o escaneo OCR de fotografías de tickets físicos.

---

## 2. Pila Tecnológica (Tech Stack)

La aplicación utiliza tecnologías modernas para garantizar tiempos de carga instantáneos (menos de 300ms) y compatibilidad PWA multiplataforma:

1. **Core:**
   - **React 19 (React-DOM):** Renderizado de alto rendimiento basado en reconciliación reactiva.
   - **TypeScript 5:** Tipado estricto para evitar errores sintácticos o en tiempo de ejecución.
   - **Vite 6:** Motor de construcción ultrarrápido con soporte nativo de HMR (Hot Module Replacement).
2. **Estilos y Experiencia Visual (Aesthetics):**
   - **Tailwind CSS v4:** Motor de estilos JIT optimizado que aprovecha variables CSS nativas.
   - **Glassmorphism y Backdrop Filters:** Uso extensivo del efecto vidrio translúcido (`.glass-card` con `backdrop-blur-md` y reflejos suavizados).
   - **Tipografía Google Fonts:** Integración de **Outfit** y **Plus Jakarta Sans** para máxima legibilidad tipográfica.
3. **Persistencia e Instalación:**
   - **Service Workers & PWA:** Configurado vía `vite-plugin-pwa` para almacenar en caché los activos estáticos y permitir la ejecución 100% offline e instalación en móviles como app nativa.
   - **Almacenamiento Local:** Sincronización del estado con `localStorage`.

---

## 3. Lógica del Asistente Gemini IA (`AIAssistant.tsx`)

El asistente implementa una lógica avanzada de orquestación de prompts e invocación de herramientas (Tool Calling) a través de la API REST de Google Gemini:

```
[Usuario escribe o sube Foto] 
         │
         ▼
[AIAssistant.tsx - API Call] ──(Pasa State de compras, presupuestos, tiendas y categorías)
         │
         ▼
[Google Gemini Model] ──(Aplica Reglas de Negocio)
         │
         ├──► [Caso Conversacional/Directo] ──► Retorna texto breve al chat
         │
         └──► [Caso Acción/Registro] ──► Retorna Tool Call (Lanza Tarjeta de Confirmación)
```

### Características Clave del Motor de IA:
1. **Lógica de Cascada y Failover Automático:**
   Para prever la congestión del servidor o el agotamiento de límites de la cuota gratuita, el asistente implementa una alternancia automática en cascada de modelos en tiempo real. Si el modelo actual arroja un error `429` o similar, rota automáticamente:
   $$\text{gemini-2.5-flash} \longrightarrow \text{gemini-2.0-flash} \longrightarrow \text{gemini-1.5-flash} \longrightarrow \text{gemini-2.5-pro} \longrightarrow \text{gemini-1.5-pro}$$
2. **Análisis Multimodal de Recibos (OCR):**
   Cuando el usuario toma una foto o sube un ticket de compra, el asistente convierte la imagen a Base64 y la transmite a Gemini. El modelo analiza la imagen, extrae el nombre de la tienda, lista de productos con precios unitarios, cantidades, deduce la categoría idónea y selecciona el método de pago más factible indicado en el papel.
3. **Diferenciación de Verbos (Compra Directa vs Planificación):**
   El prompt del sistema enseña a la IA a discriminar la naturaleza del registro basándose en los tiempos verbales:
   - *Verbos pasados/efectuados:* "Compré", "Gasté", "Pagué", "Ticket escaneado" $\longrightarrow$ `bought = true` (Afecta directamente el gasto en efectivo/tarjeta del mes).
   - *Verbos futuros/intenciones:* "Añade a la lista", "Quiero comprar", "Planeo comprar" $\longrightarrow$ `bought = false` (Se registra como pendiente y reserva fondos planificados).
4. **Tarjetas de Confirmación Interactivas ("Human-in-the-Loop"):**
   Para evitar registros erróneos debidos a imágenes borrosas o ruido visual, Gemini genera un **Tool Call** (`add_item_proposed` o `add_multiple_items_proposed`). Esto despliega una tarjeta de confirmación editable en la interfaz del chat. El usuario puede refinar nombres, precios y métodos de pago antes de presionar "Confirmar e Insertar".
5. **Propuesta Instantánea al Primer Mensaje:**
   El motor de IA está optimizado bajo la directriz estricta de no entablar conversaciones extensas innecesarias. Al detectar una solicitud de registro, Gemini lanza la tarjeta interactiva de inmediato en su primer mensaje, asumiendo valores lógicos editables para priorizar la velocidad de acción.

---

## 4. Lógica de Negocio del Calendario (`ExpenseCalendar.tsx`)

El calendario organiza los egresos mensuales utilizando una cuadrícula dinámica que calcula los sumatorios de gastos diarios:

1. **Agrupamiento y Mezclado:**
   Filtra los artículos que tienen `bought = true` y los combina con los registros de pagos de servicios recurrentes (`servicePayments`). Ambos arrays tienen la marca temporal `createdAt` en formato ISO string.
2. **Mapeo de Fechas:**
   Agrupa los elementos mediante una clave diaria `YYYY-MM-DD` que corresponde estrictamente al mes y año seleccionado por el usuario en los controles de navegación.
3. **Generación de la Grilla (42 celdas):**
   - Determina el primer día del mes para calcular el retraso de celdas iniciales correspondientes al mes anterior.
   - Genera los días activos del mes en curso asociándoles la suma consolidada de dinero gastado para mostrar el badge monetario (ej: `$45`).
   - Rellena las celdas finales del mes siguiente para mantener una cuadrícula uniforme de 6 filas y evitar saltos de layout bruscos.
4. **Desglose en Drawer:**
   Al pulsar una celda activa que tiene gastos, el componente filtra el array combinado usando la clave `YYYY-MM-DD` seleccionada y expone las transacciones detalladas con tipografía de alta legibilidad para personas de la tercera edad.

---

## 5. Modelado y Estructura de Datos (`src/types.ts`)

La aplicación se rige por interfaces estrictas de TypeScript:

### 🛍️ ShoppingItem (Artículos de Compra)
```typescript
export interface ShoppingItem {
  id: string;
  name: string;
  place: string;            // Oxxo, Mercadona, Amazon, etc.
  price: number;            // Precio unitario
  quantity: number;         // Cantidad
  category: string;         // comida, hogar, tecnologia, ropa, salud, otros
  bought: boolean;          // true = Comprado, false = Planificado/Pendiente
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia';
  createdAt: string;        // ISO Date String
}
```

### 🚌 ServicePayment (Servicios Recurrentes)
```typescript
export interface ServicePayment {
  id: string;
  service: string;          // Uber, Didi, Internet, Gas, etc.
  amount: number;           // Monto pagado
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia';
  createdAt: string;        // ISO Date String
}
```

### 🗑️ ArchivedItem (Historial de Papelera)
```typescript
export interface ArchivedItem extends ShoppingItem {
  deletedAt: string;        // Fecha de archivado
}
```

---

## 6. Despliegue y Pruebas en Red Local

### Correr la App localmente:
1. Instalar dependencias necesarias:
   ```bash
   npm install
   ```
2. Iniciar el servidor local de desarrollo abierto a la red local (esencial para probar en tu teléfono celular vía Wi-Fi):
   ```bash
   npm run dev -- --host
   ```
3. Copiar la dirección de red local generada (ej: `http://192.168.1.15:3000`) e ingresarla en el navegador Safari o Google Chrome de tu teléfono inteligente para instalarla como una PWA nativa en tu pantalla de inicio mediante la opción **"Añadir a la pantalla de inicio"**.