# Plan de Implementación: Asistente Bot con Google Gemini

Este documento contiene la investigación y el plan paso a paso para añadir un asistente inteligente basado en texto y visión (cámara) a la aplicación "Cuentas Compras", permitiendo realizar acciones mediante lenguaje natural y análisis de fotografías de recibos. Al ser para uso personal, funcionará al 100% desde el cliente (navegador) inyectando la API Key del usuario.

## 1. Investigación de Modelos (Ecosistema Gemini)

Para que un bot funcione como asistente ejecutor de código, necesita tener un excelente soporte para **Function Calling** (Llamada a Herramientas/Funciones), **Capacidades Multimodales** (Visión artificial para leer tickets) y responder con rapidez. En el ecosistema de Google, destacan dos opciones hoy en día:

### A. Gemini 1.5 Flash (Recomendado)
* **Por qué es ideal:** Está optimizado para tareas multimodales (texto + imagen) de baja latencia y alta frecuencia. Su motor de visión es impresionante para leer textos irregulares como tickets arrugados o pantallas.
* **Function calling & JSON:** Excelente. Entiende perfectamente un esquema JSON, sabe qué parámetros extraer de tu texto y puede cruzar eso con la información obtenida de una fotografía.
* **Costo/Acceso:** Para uso personal, la capa gratuita (Free Tier) de Google AI Studio es más que suficiente.
* **Conclusión:** Es el modelo perfecto. Es extremadamente veloz para convertir una foto de un recibo comercial en un JSON estructurado con el monto, la tienda y los artículos.

### B. Gemini 1.5 Pro
* **Por qué no usarlo por defecto:** Es el modelo top-tier de Google. Es más lento y está pensado para tareas de razonamiento complejo (escribir código, analizar miles de páginas de documentos). Para parsear intenciones simples, es un uso excesivo (overkill).

*(Nota: En otras plataformas, equivalentes ideales serían GPT-4o-mini de OpenAI o Claude 3.5 Haiku de Anthropic. Todos soportan Function Calling y son baratísimos/gratuitos para uso personal).*

---

## 2. Plan de Implementación (Paso a Paso)

El sistema constará de tres pilares principales: La Interfaz (Chat + Ajustes de API), El Motor de Gemini (SDK web) y el Puente de Funciones (conectar App.tsx con el Bot).

### Paso 1: Gestión de API Key y UI del Asistente
1. **Settings / Configuración:**
   * Crear un componente o modal `SettingsModal` donde el usuario ingrese su credencial de `Gemini API Key`.
   * Esta llave se guardará de forma segura en `localStorage` (ej. `cobuy_gemini_api_key`).
2. **Chat UI:**
   * Agregar un botón flotante (FAB) en la esquina inferior derecha con un icono de un Robot o Sparkles (✨).
   * Al hacer clic, despliega un panel lateral o modal pequeño simulando un chat, donde se muestren los mensajes del usuario y las respuestas o confirmaciones del bot.

### Paso 2: Definición de las "Tools" (Esquema de Funciones para Gemini)
Se configurará el SDK de Gemini enviando un arreglo de herramientas para que el modelo sepa de qué es capaz. Algunos ejemplos del esquema JSON:
* `add_item(name, place, price, quantity, category, paymentMethod)`
* `toggle_item_bought(itemName)` (El bot buscará en la lista que le proveamos o requerirá el id)
* `add_service_payment(serviceName, amount, paymentMethod)`
* `add_funds(budgetType, amount)` (Para sumar fondos, ej: `add_funds("cash", 500)`)

### Paso 3: Contexto y conexión del estado (El "Cerebro")
* En `App.tsx` (o un Hook nuevo `useAssistant`), crearemos una función que tome el mensaje del usuario y arme el prompt de sistema.
* **Prompt del sistema:** *"Eres un asistente financiero dentro de una app web. Vas a recibir comandos naturales y tu objetivo es mapear el pedido del usuario con tus funciones disponibles. Aquí está el estado actual: {presupuesto(), articulos_pendientes()}."*

### Paso 4: Bucle de Ejecución (El flujo real)
1. **User input:** *"Me gasté $500 en Uber con tarjeta"*
2. **Request a Gemini:** Se envía a la API (`@google/genai` o fetch raw).
3. **Respuesta LLM:** Gemini detecta que debe llamar a la función `add_service_payment` con `{serviceName: "Uber", amount: 500, paymentMethod: "tarjeta"}`.
4. **Ejecución Local:** Nuestra lógica en React captura esa intención y simplemente invoca `handleAddServicePayment(data)` en milisegundos.
5. **Confirmación:** Le enviamos a Gemini el éxito de la función y obtenemos un mensaje amigable: *"¡Listo! Registré tu pago de servicio en Uber por $500."*
6. **UI Update:** El mensaje se muestra en el chat y el dashboard se actualiza mágicamente.

### Paso 5: Flujo de Cámara y Escaneo de Recibos (OCR + Visión)
Esta será la función estrella para registrar compras físicas sin teclear nada.
1. **Interfaz de Cámara:** Agregar un botón "📷 Escanear" en el chat. Al usarse en móvil, se invoca `<input type="file" accept="image/*" capture="environment" />` para abrir directamente la cámara.
2. **Análisis Multimodal:** Se envía la foto a Gemini junto al prompt *"Extrae los detalles de esta compra en formato JSON (Lugar, Total, Posible Categoría). Si el recibo no indica método de pago, déjalo vacío."*
3. **Seguridad y Validación (Human-in-the-loop):** Es **crítico** no inyectar basura en la base de datos si la foto fue borrosa. 
   * En lugar de ejecutar la función inmediatamente, la UI de React atrapará el JSON inferido de Gemini y desplegará una **"Tarjeta de Confirmación"** en el chat.
   * Si falta un campo obligatorio (por ejemplo, Gemini dice `"paymentMethod": null`), el formulario dentro de la tarjeta obligará al usuario a elegir uno manualmente antes de poder presionar "Aprobar Guardado".
   * El asistente también puede preguntar verbalmente: *"Veo que compraste en Oxxo por $150, pero no logro ver cómo pagaste. ¿Fue efectivo o tarjeta?"* y esperar la respuesta antes de consolidar el registro.

### Paso 6: Manejo de Errores y Casos Límite
* Qué pasa si el usuario pide cancelar ("Deshacer lo que acabo de agregar"): Añadir tool `delete_item_by_name`.
* Expiar / Ocultar conversaciones muy viejas del asistente en el localStorage para que el texto enviado en el payload no exceda los límites de tokens o alente el proceso.
* Manejar el error HTTP `401 Unauthorized` por si la API key caducó o es incorrecta invitando al usuario a volver a ingresarla.