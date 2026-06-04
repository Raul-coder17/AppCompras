# Documentación Técnica & Guía del Usuario: SpendWise Pro

Bienvenido a la documentación oficial de **SpendWise Pro (Gestión Financiera & Control Inteligente)**. Esta es una plataforma web progresiva (PWA) de alto rendimiento, diseñada para la planificación minuciosa de compras, el control absoluto de presupuestos personales o familiares y la automatización inteligente a través de Inteligencia Artificial multimodal (texto y visión).

La aplicación combina un diseño visual premium estilo *Apple/Google Glassmorphism* de alto contraste y legibilidad adaptada, junto con un motor financiero ultra-preciso desarrollado en React 19 y TypeScript.

---

## 1. Filosofía del Producto & Usabilidad

**SpendWise Pro** fue diseñada bajo la filosofía de **Accesibilidad y Transparencia Financiera**:
* **Control en Dos Canastas:** Separa tus finanzas de manera realista en **Efectivo en Mano** y **Tarjeta / Transferencia**. Esto evita la confusión común de mezclar dinero líquido con saldos bancarios.
* **Capital Real vs. Capital Libre:** El sistema descuenta de forma automática el dinero que tienes comprometido en tus planes de compras pendientes o resguardado en tus apartados de ahorro. Así, siempre sabes exactamente cuánto dinero *libre y real* te queda para gastar hoy.
* **Diseño Premium y Legible:** Utiliza una tipografía elegante de alta escala (Outfit y Plus Jakarta Sans) con amplias áreas interactivas táctiles y colores de alto contraste clasificados por HSL, pensados especialmente para adultos mayores o personas con fatiga visual.

---

## 2. Arquitectura de Módulos y Flujos

La aplicación está orquestada de forma centralizada a través de un estado reactivo bidireccional en `App.tsx`, garantizando que cualquier cambio en presupuestos, artículos o ingresos actualice la interfaz de manera instantánea (cero latencia de recarga).

```mermaid
graph TD
    subgraph SpendWise Pro (Core Frontend)
        App[App.tsx - Orquestador Central de Estado] --> SC[Sidebar - Menú Lateral de Navegación]
        App --> BC[BudgetCard.tsx - Módulo Capital & Apartados]
        App --> PL[PurchaseList.tsx - Tabla Interactiva, Buscador & Sub-Pestañas]
        App --> AIF[AddItemForm.tsx - Formulario Planificador de Compras]
        App --> SP[ServicePayments.tsx - Control de Pagos y Servicios]
        App --> SS[StoreSummary.tsx - Analítica de Cuentas por Lugar]
        App --> IM[IncomesManager.tsx - Historial de Ingresos del Mes]
        App --> AI[AIAssistant.tsx - Asistente Gemini Chatbot & OCR de Recibos]
    end
    
    subgraph Capa de Datos Local (Seguridad & Offline)
        App <--> LS[(Browser LocalStorage - Sincronización Inmediata)]
    end

    subgraph Capa Inteligente Externa
        AI <--> Gemini[Google Gemini REST API - Orquestación en Cascada]
    end
```

---

## 3. Guía Completa de Módulos: Para qué sirve y Cómo usar cada uno

### 3.1. Capital y Apartados (`capital`)
Módulo centralizador del dinero total del usuario. Se encarga de la visualización y distribución de tu capital neto.
* **¿Para qué sirve?**
  * Para ver cuánto dinero total tienes acumulado.
  * Para resguardar dinero en "Apartados" (cochinitos de ahorro digital) de modo que ese dinero quede protegido y se reste de tus presupuestos utilizables cotidianos.
  * Para realizar el **Cierre de Mes** e iniciar un nuevo mes financiero de forma limpia.
* **¿Cómo usarlo?**
  * **Modificar Presupuestos:** Haz clic en el icono de lápiz al lado de *Efectivo en mano* o *Tarjeta / Transferencia* para corregir tus montos actuales.
  * **Crear Apartado:** Presiona en `+ Crear Apartado` dentro de la tarjeta de efectivo o tarjeta. Dale un nombre (ej. "Pago de Renta" o "Viaje") y define tu monto meta.
  * **Depositar / Retirar de Apartados:** Haz clic en los botones `+` o `-` en la línea del apartado. Introduce la cantidad y presiona `Ok` para transferir fondos de tus presupuestos libres al apartado o viceversa.
  * **Eliminar Apartado:** Haz clic en el bote de basura. El dinero resguardado regresará automáticamente a tu saldo libre disponible.
  * **Cierre de Mes:** Cuando termine el mes calendario actual, presiona el botón negro `Cerrar Mes Actual`. El asistente te guiará para consolidar tus datos, guardar los históricos, y configurar tus saldos iniciales del nuevo mes.

---

### 3.2. Lista de Compras e Historias (`shopping-list`)
El centro interactivo de la aplicación. Agrupa la lista de compras del mes junto con las herramientas analíticas organizadas en 4 sub-pestañas:
1. **Lista Actual:**
   * **¿Para qué sirve?** Para el control en tiempo real de lo que planeas comprar y lo que ya compraste en el supermercado o tiendas.
   * **¿Cómo usarlo?**
     * **Marcar Comprado:** Haz clic en la casilla de verificación (checkbox) al lado de un artículo. Si era planificado (pendiente), pasará a estado comprado, restando de forma automática el dinero del presupuesto libre del método de pago que elegiste.
     * **Buscador & Filtros:** Escribe palabras clave en la barra de búsqueda o presiona los chips de colores para ver solo ciertas categorías (Alimentos, Hogar, Salud) o métodos de pago (Efectivo, Tarjeta, Transferencia).
     * **Edición Rápida:** Haz clic en el icono de lápiz para editar inline el precio, nombre o cantidad de un producto.
     * **Eliminación y Papelera:** Presiona el bote de basura. Si borraste algo por error, desplázate hasta la sección inferior `Artículos Eliminados (Historial)`, despliega el cajón y haz clic en la flecha de restauración para regresarlo a tu lista activa.
2. **Calendario:**
   * **¿Para qué sirve?** Para ver de forma visual en qué días del mes gastaste más dinero y auditar compras pasadas por fecha.
   * **¿Cómo usarlo?** Haz clic en cualquier día que tenga un badge monetario. Aparecerá una ventana esmerilada con el desglose exacto de los artículos y servicios pagados ese día.
3. **Gráficos:**
   * **¿Para qué sirve?** Proporciona un desglose visual mediante gráficos circulares e histogramas de tus gastos organizados por categorías de consumo. Ideal para identificar fugas de dinero.
4. **Historial:**
   * **¿Para qué sirve?** Acceso directo para auditar cualquier mes anterior cerrado (ej. "Enero 2026").
   * **¿Cómo usarlo?** Selecciona un mes en el selector para ver el reporte de balances totales de ingresos, gastos, ahorros generados y el desglose de los artículos comprados en ese periodo.

---

### 3.3. Planificar Compra (`plan-purchase`)
* **¿Para qué sirve?**
  * Para simular y cotizar compras antes de realizarlas físicamente. Te permite saber el impacto exacto que tendrá tu lista en tus presupuestos libres antes de gastar un solo centavo.
* **¿Cómo usarlo?**
  * Ingresa el nombre del producto, establecimiento, precio unitario y cantidad.
  * Selecciona el método de pago y la categoría.
  * Presiona `Añadir a la Lista`. El sistema registrará el artículo como **Pendiente (Planificado)** y te redirigirá a la Lista de Compras para que lo tengas listo al ir de compras.

---

### 3.4. Ingresos del Mes (`incomes`)
* **¿Para qué sirve?**
  * Para registrar la entrada de flujos de dinero (nóminas, transferencias, ventas extras, regalos) que incrementan directamente tus balances disponibles.
* **¿Cómo usarlo?**
  * Escribe el concepto (ej. "Quincena" o "Bono") y el monto de dinero.
  * Elige si el ingreso entra en **Efectivo** o en tu **Tarjeta / Banco**.
  * Haz clic en registrar. Tus presupuestos aumentarán de manera reactiva al instante.

---

### 3.5. Pagos de Servicio (`services`)
* **¿Para qué sirve?**
  * Para llevar una contabilidad separada de tus egresos recurrentes o fijos obligatorios (suscripciones de streaming, recibo de luz, agua, internet, viajes en Uber/Didi).
* **¿Cómo usarlo?**
  * Elige un servicio predefinido o introduce uno nuevo personalizado.
  * Ingresa el monto a pagar y el método de pago utilizado.
  * Indica si es un pago mensual recurrente y en qué día se realiza el cargo automático.
  * Presiona registrar. El pago se sumará al gasto consolidado total y se reflejará en tu calendario mensual.

---

### 3.6. Cuentas por Lugar (`store-summary`)
* **¿Para qué sirve?**
  * Para analizar analíticamente en qué tiendas o establecimientos estás gastando más dinero (ej. Oxxo, Walmart, Amazon, Mercadona).
* **¿Cómo usarlo?**
  * Visualiza el ranking de establecimientos con sus barras de porcentaje acumulado de gasto.
  * **Acción de Redirección:** Haz clic en cualquiera de las tarjetas de las tiendas. **SpendWise Pro** activará automáticamente el filtro por ese establecimiento y te redirigirá inmediatamente a la **Lista de Compras** mostrando únicamente los artículos comprados o planificados en esa tienda seleccionada.

---

### 3.7. Asistente Inteligente IA (`AIAssistant.tsx`)
Una de las joyas de la corona de la aplicación. Tu asistente virtual basado en Google Gemini.
* **¿Para qué sirve?**
  * Para interactuar con la aplicación mediante lenguaje natural (puedes dictar texto o hablar con tu voz).
  * Para escanear tickets de compra y recibos de supermercados mediante la cámara de tu celular, automatizando el registro completo de la compra en segundos.
* **¿Cómo usarlo?**
  * Abre el asistente presionando el botón flotante esmerilado de destellos en la esquina inferior derecha.
  * **Interacción por Voz/Texto:** Puedes escribir en el chat o presionar el icono de micrófono para hablar. Por ejemplo, dile: *"Añade pan y leche a mi lista de compras para mañana en efectivo"*, o bien: *"Registra un ingreso de $500 pesos en efectivo que me regaló mi tía"*.
  * **Escaneo de Tickets:** Presiona el botón de cámara, toma una foto nítida de un ticket de compras físico y envíalo. El asistente procesará la imagen por OCR y extraerá todos los artículos con sus precios unitarios correspondientes.
  * **Tarjetas de Confirmación Interactiva ("Human-in-the-loop"):** Ante cualquier comando de registro o escaneo, el asistente no insertará los datos a ciegas; en su lugar, desplegará una **tarjeta de confirmación interactiva** dentro del chat. Podrás revisar, editar cantidades, modificar precios o categorizaciones erróneas directamente sobre la tarjeta y, finalmente, presionar **Confirmar e Insertar** para aplicarlo a la base de datos de forma segura.

---

### 3.7.1. 🔑 GUÍA FÁCIL: ¿Cómo activar el Asistente Inteligente (API Key de Google)?
> [!NOTE]
> **¿Qué es la API Key?**
> Imagina que es una "llave digital" o contraseña personal de cortesía que Google te regala. Esta llave le permite a tu celular conectarse directamente con el "cerebro inteligente" de Google Gemini para procesar tus fotos y entender tus palabras. **¡Es 100% gratuita para tu uso personal!**

#### Paso 1: Obtener tu Llave Gratis de Google
1. **Entra a la página oficial:** Haz clic o toca este enlace desde tu celular o computadora: **[Google AI Studio (https://aistudio.google.com/)](https://aistudio.google.com/)**.
2. **Inicia Sesión:** Entra con tu correo de Gmail común (el mismo que usas en tu correo o en tu teléfono Android).
3. **Presiona el botón azul:** Busca y toca el botón que dice **`Create API Key`** (o *"Crear clave de API"* si te aparece en español).
4. **Crea y Copia la Llave:**
   * Selecciona la opción que dice *"Create API key in new project"* (Crear llave en nuevo proyecto).
   * Te aparecerá un cuadro con una clave de letras y números largos (ejemplo: `AIzaSyD5x...`).
   * Toca el botón azul que dice **`Copy`** (Copiar) para guardarla en la memoria de tu teléfono de forma automática.

#### Paso 2: Colocar la Llave en SpendWise Pro
1. Abre tu aplicación **SpendWise Pro** en tu celular o computadora.
2. Abre el chat del Asistente de IA presionando el **botón circular de destellos verdes** en la parte inferior derecha.
3. En la parte superior de la ventana del chat que se abre, busca y toca el icono de **Ajustes** (tiene la forma de un **engranaje** o rueda dentada ⚙️).
4. Verás un cuadro de texto que dice: *"API Key de Gemini"*. Toca ese cuadro, mantén presionado con tu dedo por un segundo y selecciona la opción **Pegar** (Paste) para que aparezca la clave larga que copiaste en el Paso 1.
5. Presiona el botón verde que dice **`Guardar API Key`**. 

**¡Listo!** El engranaje se cerrará y el asistente ya estará encendido. Ahora puedes hablarle presionando el icono de micrófono, escribirle, o subirle fotos de tus tickets de compras sin problemas.

---

> [!IMPORTANT]
> **🔒 Privacidad y Seguridad Absoluta:**
> Tu llave de API **solo se guarda de forma segura en la memoria interna de tu propio celular o computadora** (a través de `localStorage`). SpendWise Pro **NUNCA** comparte tu clave ni tus datos financieros con servidores externos, ni con nosotros, ni con terceros. Los datos viajan directamente de tu celular a Google de forma totalmente cifrada e intransferible.

---

### 3.8. Exportación de Datos en Formato CSV / Excel
* **¿Para qué sirve?**
  * Para realizar respaldos físicos, compartir tu lista de compras o abrir la contabilidad en programas profesionales como Microsoft Excel, Google Sheets, Numbers de Apple u otros.
* **¿Cómo usarlo?**
  * Haz clic en el botón `Exportar CSV` en la barra superior de cabecera.
  * Se desplegará un **modal de seguridad y advertencia**. El sistema te explicará exactamente qué datos se descargarán.
  * Presiona `Descargar CSV` para guardar el archivo en la memoria de tu dispositivo, o presiona `Cancelar` si deseas retractarte.

---

## 4. Modelado y Estructura de Datos (`src/types.ts`)

La coherencia de datos financieros se rige estrictamente por interfaces tipadas de TypeScript:

### 🛍️ ShoppingItem (Artículos)
```typescript
export interface ShoppingItem {
  id: string;
  name: string;
  place: string;                 // Establecimiento de compra (ej. Oxxo)
  price: number;                 // Precio unitario
  quantity: number;              // Cantidad de unidades
  category: string;              // comida, hogar, tecnologia, ropa, salud, otros
  bought: boolean;               // true = Comprado (resta saldo), false = Planificado (apartado)
  paymentMethod: PaymentMethod;  // 'efectivo' | 'tarjeta' | 'transferencia'
  createdAt: string;             // ISO Date String
}
```

### 💰 Income (Ingresos Rápidos)
```typescript
export interface Income {
  id: string;
  name: string;                  // Concepto del ingreso
  amount: number;                // Monto del flujo recibido
  paymentMethod: 'efectivo' | 'tarjeta'; // Destino del dinero
  createdAt: string;             // ISO Date String
}
```

### 🔒 Apartado (Pockets de Ahorro)
```typescript
export interface Apartado {
  id: string;
  name: string;                  // Propósito del apartado
  amount: number;                // Fondos resguardados bajo candado
  paymentMethod: 'efectivo' | 'tarjeta'; // Origen del capital resguardado
  createdAt: string;             // ISO Date String
}
```

---

## 5. Pila Tecnológica & Optimización Técnica

**SpendWise Pro** está construida sobre una pila moderna enfocada en la velocidad y el diseño táctil premium:

1. **Lenguajes Core:**
   * **TypeScript (~5.8.2):** Lenguaje principal. Sustituye a JavaScript básico definiendo el tipado robusto de todos los datos internos (artículos, apartados, transacciones), brindando máxima seguridad y evadiendo errores en tiempo de ejecución de la interfaz.
   * **HTML5 / CSS3:** Base clásica requerida para renderizado web semántico.
2. **Framework de Interfaz y Lógica (UI):**
   * **React 19 (`react` / `react-dom`):** El motor central y librería base de componentes. Permite renderizado declarativo ultrarrápido y un manejo de estado fluido global, eliminando las molestas recargas de página (Arquitectura SPA).
3. **Motor de Empaquetado de Construcción:**
   * **Vite 6:** Utilizado como servidor de entorno de desarrollo (extremadamente rápido por el uso del motor `esbuild`) y empaquetador del proyecto (bundler).
4. **Diseño, Animaciones e Íconos:**
   * **Tailwind CSS v4 & Glassmorphism:** Motor de diseño mediante clases (utility-first). Produce CSS JIT de pocos kilobytes y soporta efectos premium (`backdrop-blur-md`, texturas esmeriladas).
   * **Motion (`motion` / famer-motion):** Módulo encargado de todas las secuencias animadas fluidas de los modales, cortinas de contenido y transiciones, para una experiencia que rivaliza con apps nativas de iOS o Android.
   * **Lucide React:** Biblioteca de íconos escalables en formato SVG.
5. **Inteligencia Artificial y Motores IA:**
   * **Google Gemini API (`@google/genai`):** La plataforma base de IA multimodal que decodifica fotos y texto de usuarios.
   * **Cascada de Modelos en IA:** Entorno robusto contra topes de cuotas (HTTP 429), iterando en jerarquía:
     $$\text{gemini-2.5-flash} \longrightarrow \text{gemini-2.0-flash} \longrightarrow \text{gemini-1.5-flash} \longrightarrow \text{gemini-2.5-pro} \longrightarrow \text{gemini-1.5-pro}$$
   * **Monitoreo Local de Cuotas:** Un sistema que mide en caliente las llamadas a la IA (Tokens, RPM y RPD) apoyándose en la base de datos `localStorage`.
6. **Tecnologías de Soporte Offline (PWA):**
   * **Vite-plugin-PWA:** Inyección técnica de Service Workers. Facilita los escudos **100% offline**, permitiendo que SpendWise Pro funcione en teléfonos sin conexión (como adentro de un supermercado) y guarde un marco en la caché del entorno.

---

## 6. Despliegue, Ejecución y Desarrollo

### Correr la aplicación localmente:
1. Instala las dependencias necesarias:
   ```bash
   npm install
   ```
2. Inicia el servidor de desarrollo abierto para tu red local (indispensable para probarlo directamente en tu teléfono celular compartiendo la misma red Wi-Fi):
   ```bash
   npm run dev
   ```
3. La consola te arrojará dos enlaces:
   * **Local:** `http://localhost:3000/` (Para probar en la computadora).
   * **Network (Red Local):** `http://192.168.X.X:3000/` (Copia esta dirección física en el navegador Google Chrome o Safari de tu teléfono celular).
4. **Instalación Móvil PWA:** En tu celular, abre el menú de opciones del navegador y presiona **"Añadir a la pantalla de inicio"** (Android) o presiona el botón de compartir y selecciona **"Añadir a pantalla de inicio"** (iOS/iPhone). La aplicación se instalará como una aplicación nativa premium con icono propio en tu escritorio de SpendWise Pro.

---

### 🔍 Monitoreo y Cierre de Servidores en Ejecución (Puertos Ocupados)

En ocasiones, al intentar iniciar el servidor con `npm run dev`, es posible que aparezca un mensaje de error indicando que los puertos `3000` o `3001` ya están ocupados por otra instancia en segundo plano. A continuación, se detallan las instrucciones paso a paso para identificar y cerrar estos procesos:

#### En Windows (PowerShell - Recomendado):
1. **Identificar el proceso:** Ejecuta el siguiente comando para encontrar el identificador de proceso (PID) que está usando esos puertos:
   ```powershell
   Get-NetTCPConnection -LocalPort 3000, 3001 -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess
   ```
2. **Cerrar el proceso:** Una vez que obtengas el número del proceso (bajo la columna `OwningProcess`), ciérralo forzosamente con:
   ```powershell
   Stop-Process -Id <OwningProcess> -Force
   ```
   *(Ejemplo: `Stop-Process -Id 15068 -Force`)*

#### En Windows (Símbolo del Sistema - CMD):
1. **Identificar el proceso:**
   ```cmd
   netstat -ano | findstr :3000
   netstat -ano | findstr :3001
   ```
   El último número de la línea de resultado representa el identificador (PID) del proceso.
2. **Cerrar el proceso:**
   ```cmd
   taskkill /PID <PID> /F
   ```

#### En macOS o Linux (Terminal):
1. **Identificar el proceso:**
   ```bash
   lsof -i :3000
   lsof -i :3001
   ```
2. **Cerrar el proceso:**
   ```bash
   kill -9 <PID>
   ```