/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Camera, 
  X, 
  AlertCircle, 
  Check, 
  Trash2, 
  Plus, 
  Settings, 
  RefreshCw,
  Clock,
  ArrowRight,
  HelpCircle,
  Coins,
  CreditCard,
  ShoppingBag,
  ToggleLeft,
  ToggleRight,
  Mic,
  MicOff
} from 'lucide-react';
import { ShoppingItem, ArchivedItem, ServicePayment, Category, PaymentMethod, PREDEFINED_CATEGORIES } from '../types';
import AIAssistantSettings, { GEMINI_MODELS } from './AIAssistantSettings';

// Types for Chat Messages
interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text?: string;
  image?: string; // base64 data url for preview
  status?: 'loading' | 'done' | 'error';
  modelUsed?: string;
  toolCall?: {
    name: string;
    args: any;
    status: 'pending' | 'approved' | 'rejected';
  };
}

interface AIAssistantProps {
  items: ShoppingItem[];
  archivedItems: ArchivedItem[];
  servicePayments: ServicePayment[];
  cashBudget: number;
  cardBudget: number;
  categories: Category[];
  places: string[];
  serviceOptions: string[];
  
  onAddItem: (itemData: Omit<ShoppingItem, 'id' | 'createdAt'>) => void;
  onToggleBought: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onUpdateItem: (id: string, updatedData: Partial<ShoppingItem>) => void;
  onUpdateBudget: (type: 'cash' | 'card', newBudget: number) => void;
  onAddServicePayment: (paymentData: Omit<ServicePayment, 'id' | 'createdAt'>) => void;
  onDeleteServicePayment: (id: string) => void;
  onAddCategory: (name: string) => void;
  onAddPlace: (name: string) => void;
  onAddServiceOption: (name: string) => void;
  onRestoreItem: (id: string) => void;
  onPurgeArchivedItem: (id: string) => void;
  onResetDatabase: () => void;
}

export default function AIAssistant({
  items,
  archivedItems,
  servicePayments,
  cashBudget,
  cardBudget,
  categories,
  places,
  serviceOptions,
  onAddItem,
  onToggleBought,
  onDeleteItem,
  onUpdateItem,
  onUpdateBudget,
  onAddServicePayment,
  onDeleteServicePayment,
  onAddCategory,
  onAddPlace,
  onAddServiceOption,
  onRestoreItem,
  onPurgeArchivedItem,
  onResetDatabase
}: AIAssistantProps) {
  // Assistant drawer state
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Gemini API Configuration
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('cobuy_gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('cobuy_gemini_selected_model') || 'gemini-2.5-flash');
  const [autoFailover, setAutoFailover] = useState(() => {
    const saved = localStorage.getItem('cobuy_gemini_auto_failover');
    return saved !== 'false'; // Default to true
  });
  const [assistantName, setAssistantName] = useState(() => localStorage.getItem('cobuy_gemini_assistant_name') || 'Asistente Gemini IA');

  // UI Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [failoverAlert, setFailoverAlert] = useState<string | null>(null);

  // Voice input state for Web Speech API
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'es-ES';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('El reconocimiento de voz no está soportado en este navegador. Te recomendamos usar Google Chrome o Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting recognition:', err);
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Save configurations in LocalStorage
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('cobuy_gemini_api_key', key);
    if (key) setShowSettings(false);
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('cobuy_gemini_selected_model', model);
  };

  const handleToggleFailover = (value: boolean) => {
    setAutoFailover(value);
    localStorage.setItem('cobuy_gemini_auto_failover', String(value));
  };

  const handleSaveAssistantName = (name: string) => {
    setAssistantName(name);
    localStorage.setItem('cobuy_gemini_assistant_name', name);
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, failoverAlert]);

  // Open & Welcome
  const toggleDrawer = () => {
    setIsOpen(!isOpen);
    if (!isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `¡Hola! Soy ${assistantName}, tu asistente de compras con Google Gemini. Puedes pedirme que agregue artículos, registre pagos de servicios, actualice tus presupuestos o subas una foto de un recibo para escanearlo. ¿En qué te ayudo hoy?`
        }
      ]);
    }
  };

  // Handle image upload and conversion to base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Call Gemini REST API with potential failover
  const callGemini = async (
    userText: string,
    base64Image: string | null,
    currentModel: string,
    attemptedModels: string[] = []
  ): Promise<{ responseData: any; modelUsed: string }> => {
    const modelToUse = currentModel;
    attemptedModels.push(modelToUse);

    // Build current state payload for the system instructions
    const systemInstruction = `
Eres un asistente financiero experto dentro de la aplicación 'Cuentas Compras'.
Tu objetivo es ayudar al usuario a gestionar su lista de compras, servicios y presupuestos mediante lenguaje natural, consultas analíticas, cálculos matemáticos y análisis de fotografías de recibos.
Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Estado actual de la aplicación:
- Artículos planificados/comprados (ShoppingItem): ${JSON.stringify(items.map(i => ({ id: i.id, name: i.name, place: i.place, price: i.price, quantity: i.quantity, category: i.category, bought: i.bought, paymentMethod: i.paymentMethod, createdAt: i.createdAt })))}
- Historial de artículos eliminados/archivados (ArchivedItem): ${JSON.stringify(archivedItems.map(a => ({ id: a.id, name: a.name, place: a.place, price: a.price, quantity: a.quantity, category: a.category, paymentMethod: a.paymentMethod, createdAt: a.createdAt, deletedAt: a.deletedAt })))}
- Pagos de servicios (ServicePayment): ${JSON.stringify(servicePayments)}
- Presupuesto en efectivo disponible: $${cashBudget}
- Presupuesto en tarjeta/transferencia disponible: $${cardBudget}
- Categorías de compras disponibles: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name })))}
- Lugares de compra frecuentes: ${JSON.stringify(places)}
- Servicios frecuentes: ${JSON.stringify(serviceOptions)}

Reglas importantes:
1. DISTINGUE CONSULTAS vs ACCIONES DE REGISTRO:
   - CONSULTAS (Preguntas, cálculos, históricos, presupuestos, comparaciones por fecha): Si el usuario hace preguntas sobre qué ha comprado, cuánto ha gastado en ciertas fechas o periodos (ayer, hoy, esta semana, este mes), saldos de presupuestos o cálculos generales, NO invoques ninguna herramienta ni propongas tarjetas de confirmación. Responde amigablemente por chat en lenguaje de texto natural claro, prolijo, ordenado y con números formateados. Sé servicial y haz cálculos precisos utilizando los campos 'createdAt' de los datos para agrupar gastos por fechas.
   - ACCIONES DE MUTACIÓN (Añadir, modificar, borrar, reiniciar): Si el usuario solicita explícitamente agregar un artículo/servicio, cambiar un precio/cantidad, marcar algo como comprado o borrar un registro (ej: "Agrega pan", "Compré detergente", "Borra el café"), SÍ debes proponer la tarjeta de confirmación correspondiente invocando la herramienta (tool call) de manera inmediata.
2. Analiza el lenguaje natural del usuario o las imágenes de recibos que suba. Si el usuario te da una lista rápida o menciona artículos (ej: "Agrega leche, huevos, jamón" o "lista rápida: pan y café"), invoca de inmediato 'add_multiple_items_proposed' (o 'add_item_proposed' si es un solo artículo) SIN pedirle precios, cantidades o lugares. Es de vital importancia que NUNCA le preguntes por chat el precio, cantidad o establecimiento si no los especificó; en su lugar, llama a la herramienta inmediatamente y deja que la tarjeta de confirmación se encargue de mostrarlos en pantalla.
3. Identifica rigurosamente si el usuario se refiere a una compra ya realizada (directa/comprada) o a algo que tiene planeado comprar en el futuro (pendiente/planificada) basándote en los verbos que use:
   - Ej: "Compré", "Gasté", "Pagué", "Fui a comprar" -> Directa (bought = true).
   - Ej: "Añade a la lista", "Quiero comprar", "Planeo comprar", "Tengo que comprar" -> Pendiente/planificada (bought = false).
   - Si no se puede determinar, pon comprado como false (pendiente) o true según el contexto, pero asegúrate de que el parámetro 'bought' se envíe.
4. Si el usuario sube un recibo con múltiples artículos, utiliza 'add_multiple_items_proposed' para proponerlos todos juntos en una sola tarjeta de confirmación de forma inmediata.
5. Si falta información en la solicitud del usuario (como precio, lugar, cantidad o categoría), NO le preguntes por el chat. Invoca la herramienta correspondiente de inmediato y deja que esos parámetros falten o se establezcan en valores por defecto; el usuario podrá completarlos o modificarlos cómodamente en la tarjeta interactiva de confirmación que aparecerá en su pantalla.
6. Si ejecutas una acción directa que no requiere tarjeta de confirmación compleja (como actualizar un presupuesto o borrar/marcar comprado, o restaurar del historial), describe lo que has hecho de manera extremadamente breve e interactiva.
7. Para modificar un artículo existente (ej: "cambia el precio del pan a $20" o "renombra cereal a cereal fitness"), llama a 'update_item_proposed'.
8. Si el usuario pide agregar un nuevo lugar frecuente, categoría o servicio de forma independiente, llama a 'add_place', 'add_category' o 'add_service_option' respectively.
9. Mantén un tono sumamente amigable, claro y respetuoso en español, estructurando la información con viñetas legibles y números grandes si haces cálculos para que sea muy cómodo de leer para adultos mayores.
`;

    // Tools definition
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'add_item_proposed',
            description: 'Propone añadir un artículo individual a la lista de compras.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre del artículo (ej. Leche descremada 1L)' },
                place: { type: 'STRING', description: 'Lugar o establecimiento donde se compra (ej. Oxxo, Mercadona)' },
                price: { type: 'NUMBER', description: 'Precio unitario del artículo' },
                quantity: { type: 'NUMBER', description: 'Cantidad de artículos' },
                category: { type: 'STRING', description: 'Categoría. Debe ser una de las existentes: comida, hogar, tecnologia, ropa, salud, otros. Intenta clasificarlo adecuadamente.' },
                paymentMethod: { type: 'STRING', description: 'Método de pago utilizado. Opciones: efectivo, tarjeta, transferencia. Si no se puede inferir del recibo, dejar en blanco.' },
                bought: { type: 'BOOLEAN', description: 'Si la compra ya se efectuó (true) o si es un plan futuro/pendiente (false)' }
              },
              required: ['name', 'bought']
            }
          },
          {
            name: 'add_multiple_items_proposed',
            description: 'Propone añadir múltiples artículos a la vez (ideal para escaneo de tickets completos de supermercado o listas rápidas).',
            parameters: {
              type: 'OBJECT',
              properties: {
                items: {
                  type: 'ARRAY',
                  description: 'Lista de artículos extraídos',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      name: { type: 'STRING', description: 'Nombre del artículo' },
                      place: { type: 'STRING', description: 'Lugar de compra' },
                      price: { type: 'NUMBER', description: 'Precio unitario' },
                      quantity: { type: 'NUMBER', description: 'Cantidad' },
                      category: { type: 'STRING', description: 'Categoría (comida, hogar, tecnologia, ropa, salud, otros)' },
                      paymentMethod: { type: 'STRING', description: 'Método de pago (efectivo, tarjeta, transferencia). Dejar en blanco si no se conoce.' },
                      bought: { type: 'BOOLEAN', description: 'Si la compra ya se hizo (true) o es planificada (false)' }
                    },
                    required: ['name', 'bought']
                  }
                }
              },
              required: ['items']
            }
          },
          {
            name: 'add_service_proposed',
            description: 'Propone registrar el pago de un servicio recurrente como internet, Uber, gas, etc.',
            parameters: {
              type: 'OBJECT',
              properties: {
                service: { type: 'STRING', description: 'Nombre del servicio (ej. Netflix, Uber, Celular, Internet)' },
                amount: { type: 'NUMBER', description: 'Monto total pagado por el servicio' },
                paymentMethod: { type: 'STRING', description: 'Método de pago (efectivo, tarjeta, transferencia)' }
              },
              required: ['service', 'amount']
            }
          },
          {
            name: 'add_budget_funds',
            description: 'Suma o añade dinero (fondos adicionales) a un presupuesto específico.',
            parameters: {
              type: 'OBJECT',
              properties: {
                type: { type: 'STRING', description: 'Tipo de presupuesto: "cash" para efectivo o "card" para tarjeta/transferencia' },
                amount: { type: 'NUMBER', description: 'Cantidad de fondos a sumar' }
              },
              required: ['type', 'amount']
            }
          },
          {
            name: 'set_budget',
            description: 'Establece el monto del presupuesto de efectivo o tarjeta a un valor exacto.',
            parameters: {
              type: 'OBJECT',
              properties: {
                type: { type: 'STRING', description: 'Tipo de presupuesto a modificar: "cash" o "card"' },
                amount: { type: 'NUMBER', description: 'Nuevo monto exacto total' }
              },
              required: ['type', 'amount']
            }
          },
          {
            name: 'toggle_item_bought',
            description: 'Marca un artículo planificado como comprado o viceversa, buscando por nombre.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o palabra clave del producto a cambiar de estado' }
              },
              required: ['name']
            }
          },
          {
            name: 'delete_item_by_name',
            description: 'Busca un artículo en la lista de compras por su nombre y lo elimina.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o palabra clave del producto a borrar' }
              },
              required: ['name']
            }
          },
          {
            name: 'delete_service_payment_by_name',
            description: 'Busca un registro de pago de servicio por su nombre y lo elimina.',
            parameters: {
              type: 'OBJECT',
              properties: {
                service: { type: 'STRING', description: 'Nombre o palabra clave del servicio a borrar' }
              },
              required: ['service']
            }
          },
          {
            name: 'update_item_proposed',
            description: 'Propone modificar propiedades de un artículo que ya existe en la lista activa buscando por su nombre actual.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o palabra clave del producto a modificar en la lista' },
                newName: { type: 'STRING', description: 'Opcional. Nuevo nombre del artículo si se desea renombrar' },
                place: { type: 'STRING', description: 'Opcional. Nuevo lugar de compra' },
                price: { type: 'NUMBER', description: 'Opcional. Nuevo precio unitario' },
                quantity: { type: 'NUMBER', description: 'Opcional. Nueva cantidad' },
                category: { type: 'STRING', description: 'Opcional. Nueva categoría (comida, hogar, tecnologia, ropa, salud, otros)' },
                paymentMethod: { type: 'STRING', description: 'Opcional. Nuevo método de pago (efectivo, tarjeta, transferencia)' },
                bought: { type: 'BOOLEAN', description: 'Opcional. Si ya se compró (true) o si queda pendiente (false)' }
              },
              required: ['name']
            }
          },
          {
            name: 'add_category',
            description: 'Crea una nueva categoría personalizada para clasificar productos.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre de la nueva categoría (se guardará capitalizado)' }
              },
              required: ['name']
            }
          },
          {
            name: 'add_place',
            description: 'Crea y registra un nuevo lugar de compra frecuente para autocompletar.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre del nuevo establecimiento' }
              },
              required: ['name']
            }
          },
          {
            name: 'add_service_option',
            description: 'Crea una nueva opción/tipo de servicio recurrente (ej: Disney+, Gas, etc.).',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre del nuevo servicio' }
              },
              required: ['name']
            }
          },
          {
            name: 'restore_item_by_name',
            description: 'Busca un artículo en el historial de eliminados/archivados por su nombre y lo restaura a la lista activa.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o palabra clave del producto del historial a restaurar' }
              },
              required: ['name']
            }
          },
          {
            name: 'purge_archived_item_by_name',
            description: 'Busca un artículo en el historial de eliminados/archivados y lo elimina permanentemente.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o palabra clave del artículo archivado a purgar definitivamente' }
              },
              required: ['name']
            }
          },
          {
            name: 'reset_database_proposed',
            description: 'Propone restablecer por completo la base de datos (borra compras, historial, presupuestos y regresa a demo por defecto). Requiere confirmación.',
            parameters: {
              type: 'OBJECT',
              properties: {}
            }
          }
        ]
      }
    ];

    // Build message contents for Gemini
    const contents: any[] = [];
    
    // Add history context (only last 6 messages to keep context concise and fast)
    const recentMessages = messages.filter(m => m.id !== 'welcome' && m.status !== 'loading' && m.status !== 'error').slice(-6);
    recentMessages.forEach(msg => {
      if (msg.sender === 'user') {
        const parts: any[] = [];
        if (msg.text) parts.push({ text: msg.text });
        if (msg.image) {
          const base64Data = msg.image.split(',')[1];
          const mimeType = msg.image.split(';')[0].split(':')[1];
          parts.push({ inlineData: { data: base64Data, mimeType } });
        }
        contents.push({ role: 'user', parts });
      } else if (msg.sender === 'assistant') {
        const parts: any[] = [];
        if (msg.text) parts.push({ text: msg.text });
        if (msg.toolCall) {
          parts.push({
            functionCall: {
              name: msg.toolCall.name,
              args: msg.toolCall.args
            }
          });
        }
        contents.push({ role: 'model', parts });
      }
    });

    // Add current user prompt
    const currentUserParts: any[] = [];
    if (userText) {
      currentUserParts.push({ text: userText });
    } else if (base64Image) {
      currentUserParts.push({ text: 'Analiza esta imagen de recibo, extrae la tienda, los artículos listados, el precio unitario de cada uno, cantidades, la categoría lógica para cada uno, y el método de pago si se indica. Propón agregar esta compra a la aplicación llamando a la función add_multiple_items_proposed o add_item_proposed.' });
    }
    
    if (base64Image) {
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.split(';')[0].split(':')[1];
      currentUserParts.push({ inlineData: { data: base64Data, mimeType } });
    }
    
    contents.push({ role: 'user', parts: currentUserParts });

    // Request Payload
    const requestBody = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      tools,
      toolConfig: {
        functionCallingConfig: {
          mode: 'AUTO'
        }
      }
    };

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorDetails = await response.json().catch(() => ({}));
        throw new Error(errorDetails?.error?.message || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      return { responseData, modelUsed: modelToUse };
    } catch (err: any) {
      console.warn(`Error llamando al modelo ${modelToUse}:`, err.message);

      // If auto failover is enabled and there are other models to try
      if (autoFailover) {
        const availableModels = GEMINI_MODELS.map(m => m.id);
        const nextModel = availableModels.find(m => !attemptedModels.includes(m));
        
        if (nextModel) {
          setFailoverAlert(`El modelo '${modelToUse}' falló o está saturado. Alternando automáticamente a '${nextModel}'...`);
          // Wait briefly to make alert visible
          await new Promise(resolve => setTimeout(resolve, 1500));
          setFailoverAlert(null);
          
          return callGemini(userText, base64Image, nextModel, attemptedModels);
        }
      }
      
      throw err;
    }
  };

  // Submit Text/Image message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedImage) return;
    if (!apiKey.trim()) {
      setShowSettings(true);
      return;
    }

    const currentMessageText = inputText;
    const currentMessageImage = selectedImage;
    
    // Reset inputs immediately
    setInputText('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    // Add user message
    setMessages(prev => [
      ...prev,
      {
        id: userMessageId,
        sender: 'user',
        text: currentMessageText || undefined,
        image: currentMessageImage || undefined,
        status: 'done'
      }
    ]);

    setIsSending(true);

    // Add temporary loading message for assistant
    setMessages(prev => [
      ...prev,
      {
        id: assistantMessageId,
        sender: 'assistant',
        status: 'loading'
      }
    ]);

    try {
      const { responseData, modelUsed } = await callGemini(currentMessageText, currentMessageImage, selectedModel);
      
      const candidate = responseData?.candidates?.[0];
      const modelResponseText = candidate?.content?.parts?.[0]?.text || '';
      const functionCall = candidate?.content?.parts?.[0]?.functionCall;

      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === assistantMessageId) {
            const updatedMsg: ChatMessage = {
              ...msg,
              status: 'done',
              modelUsed: GEMINI_MODELS.find(m => m.id === modelUsed)?.name || modelUsed
            };

            if (functionCall) {
              updatedMsg.toolCall = {
                name: functionCall.name,
                args: functionCall.args,
                status: 'pending'
              };
              updatedMsg.text = modelResponseText || 'Tengo una propuesta para ti. Por favor, confirma los detalles a continuación:';
            } else {
              updatedMsg.text = modelResponseText || 'Entendido. Si tienes alguna duda, dime.';
            }

            return updatedMsg;
          }
          return msg;
        })
      );

    } catch (err: any) {
      console.error(err);
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              status: 'error',
              text: `Error de conexión: ${err.message || 'Intenta de nuevo más tarde o verifica tu API Key.'}`
            };
          }
          return msg;
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  // Execution Handlers for Confirmed Tools
  const executeBudgetFunds = (args: { type: 'cash' | 'card'; amount: number }) => {
    const currentVal = args.type === 'cash' ? cashBudget : cardBudget;
    onUpdateBudget(args.type, currentVal + args.amount);
    return `Se añadieron $${args.amount} al presupuesto de ${args.type === 'cash' ? 'efectivo' : 'tarjeta'}.`;
  };

  const executeSetBudget = (args: { type: 'cash' | 'card'; amount: number }) => {
    onUpdateBudget(args.type, args.amount);
    return `Se estableció el presupuesto de ${args.type === 'cash' ? 'efectivo' : 'tarjeta'} en $${args.amount}.`;
  };

  const executeToggleItemBought = (args: { name: string }) => {
    const item = items.find(i => i.name.toLowerCase().includes(args.name.toLowerCase()));
    if (item) {
      onToggleBought(item.id);
      return `Se marcó '${item.name}' como ${!item.bought ? 'Comprado' : 'Pendiente'}.`;
    }
    return `No encontré ningún artículo que coincida con '${args.name}'.`;
  };

  const executeDeleteItem = (args: { name: string }) => {
    const item = items.find(i => i.name.toLowerCase().includes(args.name.toLowerCase()));
    if (item) {
      onDeleteItem(item.id);
      return `Se eliminó/archivó '${item.name}' correctamente.`;
    }
    return `No encontré ningún artículo para eliminar que coincida con '${args.name}'.`;
  };

  const executeDeleteServicePayment = (args: { service: string }) => {
    const payment = servicePayments.find(p => p.service.toLowerCase().includes(args.service.toLowerCase()));
    if (payment) {
      onDeleteServicePayment(payment.id);
      return `Se eliminó el pago de servicio de '${payment.service}' por $${payment.amount}.`;
    }
    return `No encontré ningún pago de servicio registrado para '${args.service}'.`;
  };

  const executeAddCategory = (args: { name: string }) => {
    onAddCategory(args.name);
    return `Se creó la categoría personalizada '${args.name}'.`;
  };

  const executeAddPlace = (args: { name: string }) => {
    onAddPlace(args.name);
    return `Se registró '${args.name}' como establecimiento frecuente.`;
  };

  const executeAddServiceOption = (args: { name: string }) => {
    onAddServiceOption(args.name);
    return `Se añadió '${args.name}' como servicio frecuente.`;
  };

  const executeRestoreItem = (args: { name: string }) => {
    const item = archivedItems.find(i => i.name.toLowerCase().includes(args.name.toLowerCase()));
    if (item) {
      onRestoreItem(item.id);
      return `Se restauró '${item.name}' a la lista de compras activa.`;
    }
    return `No encontré ningún artículo en el historial/eliminados que coincida con '${args.name}'.`;
  };

  const executePurgeArchivedItem = (args: { name: string }) => {
    const item = archivedItems.find(i => i.name.toLowerCase().includes(args.name.toLowerCase()));
    if (item) {
      onPurgeArchivedItem(item.id);
      return `Se eliminó definitivamente '${item.name}' de la papelera/historial.`;
    }
    return `No encontré ningún artículo en el historial para purgar que coincida con '${args.name}'.`;
  };

  const executeResetDatabase = () => {
    onResetDatabase();
    return `Se ha restablecido por completo la base de datos de la aplicación.`;
  };

  // Human-in-the-loop: Confirm or Reject Card Actions
  const handleConfirmTool = (messageId: string, customArgs: any) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.toolCall) return;

    let feedbackText = '';
    const toolName = message.toolCall.name;
    const finalArgs = customArgs || message.toolCall.args;

    try {
      if (toolName === 'add_item_proposed') {
        const itemData = {
          name: finalArgs.name,
          place: finalArgs.place || 'Otro lugar',
          price: Number(finalArgs.price) || 0,
          quantity: Number(finalArgs.quantity) || 1,
          category: finalArgs.category || 'otros',
          paymentMethod: (finalArgs.paymentMethod as PaymentMethod) || 'tarjeta',
          bought: !!finalArgs.bought
        };
        onAddItem(itemData);
        feedbackText = `¡Registrado! Se añadió '${itemData.name}' (${itemData.bought ? 'Comprado' : 'Pendiente'}) en ${itemData.place} por $${(itemData.price * itemData.quantity).toFixed(2)}.`;
      } 
      else if (toolName === 'add_multiple_items_proposed') {
        const list = Array.isArray(finalArgs.items) ? finalArgs.items : [];
        if (list.length === 0) {
          feedbackText = 'No había artículos válidos para añadir.';
        } else {
          list.forEach((i: any) => {
            onAddItem({
              name: i.name,
              place: i.place || 'Supermercado',
              price: Number(i.price) || 0,
              quantity: Number(i.quantity) || 1,
              category: i.category || 'comida',
              paymentMethod: (i.paymentMethod as PaymentMethod) || 'tarjeta',
              bought: !!i.bought
            });
          });
          const totalSum = list.reduce((acc: number, curr: any) => acc + (Number(curr.price) * Number(curr.quantity || 1)), 0);
          feedbackText = `¡Registrados! Se agregaron ${list.length} artículos en total por $${totalSum.toFixed(2)}.`;
        }
      } 
      else if (toolName === 'add_service_proposed') {
        const serviceData = {
          service: finalArgs.service,
          amount: Number(finalArgs.amount) || 0,
          paymentMethod: (finalArgs.paymentMethod as PaymentMethod) || 'tarjeta'
        };
        onAddServicePayment(serviceData);
        feedbackText = `¡Servicio registrado! Se añadió el pago de '${serviceData.service}' por $${serviceData.amount.toFixed(2)}.`;
      } 
      else if (toolName === 'add_budget_funds') {
        feedbackText = executeBudgetFunds(finalArgs);
      } 
      else if (toolName === 'set_budget') {
        feedbackText = executeSetBudget(finalArgs);
      } 
      else if (toolName === 'toggle_item_bought') {
        feedbackText = executeToggleItemBought(finalArgs);
      } 
      else if (toolName === 'delete_item_by_name') {
        feedbackText = executeDeleteItem(finalArgs);
      } 
      else if (toolName === 'delete_service_payment_by_name') {
        feedbackText = executeDeleteServicePayment(finalArgs);
      }
      else if (toolName === 'update_item_proposed') {
        const item = items.find(i => i.name.toLowerCase().includes(finalArgs.name.toLowerCase()));
        if (!item) {
          feedbackText = `No se encontró ningún artículo activo con el nombre '${finalArgs.name}' para modificar.`;
        } else {
          const updatedFields: Partial<ShoppingItem> = {};
          if (finalArgs.newName !== undefined) updatedFields.name = finalArgs.newName;
          if (finalArgs.place !== undefined) updatedFields.place = finalArgs.place;
          if (finalArgs.price !== undefined) updatedFields.price = Number(finalArgs.price);
          if (finalArgs.quantity !== undefined) updatedFields.quantity = Number(finalArgs.quantity);
          if (finalArgs.category !== undefined) updatedFields.category = finalArgs.category;
          if (finalArgs.paymentMethod !== undefined) updatedFields.paymentMethod = finalArgs.paymentMethod as PaymentMethod;
          if (finalArgs.bought !== undefined) updatedFields.bought = !!finalArgs.bought;

          onUpdateItem(item.id, updatedFields);
          feedbackText = `¡Modificado! Se actualizó '${item.name}' con los nuevos valores indicados.`;
        }
      }
      else if (toolName === 'add_category') {
        feedbackText = executeAddCategory(finalArgs);
      }
      else if (toolName === 'add_place') {
        feedbackText = executeAddPlace(finalArgs);
      }
      else if (toolName === 'add_service_option') {
        feedbackText = executeAddServiceOption(finalArgs);
      }
      else if (toolName === 'restore_item_by_name') {
        feedbackText = executeRestoreItem(finalArgs);
      }
      else if (toolName === 'purge_archived_item_by_name') {
        feedbackText = executePurgeArchivedItem(finalArgs);
      }
      else if (toolName === 'reset_database_proposed') {
        feedbackText = executeResetDatabase();
      }

      // Mark tool as approved and update message feedback
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === messageId && msg.toolCall) {
            return {
              ...msg,
              text: feedbackText,
              toolCall: {
                ...msg.toolCall,
                status: 'approved',
                args: finalArgs // save final corrected parameters
              }
            };
          }
          return msg;
        })
      );

    } catch (e: any) {
      console.error(e);
      alert(`Error al ejecutar la acción: ${e.message}`);
    }
  };

  const handleRejectTool = (messageId: string) => {
    setMessages(prev => 
      prev.map(msg => {
        if (msg.id === messageId && msg.toolCall) {
          return {
            ...msg,
            text: 'Acción rechazada y cancelada por el usuario.',
            toolCall: {
              ...msg.toolCall,
              status: 'rejected'
            }
          };
        }
        return msg;
      })
    );
  };

  return (
    <>
      {/* 1. Floating Action Button (FAB) */}
      <button
        onClick={toggleDrawer}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 hover:from-emerald-950 hover:to-slate-900 rounded-2xl flex items-center justify-center text-emerald-400 hover:text-emerald-300 shadow-xl border border-slate-700/50 hover:border-emerald-500/30 cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95 group z-40"
        title="Pregunta al Asistente IA"
        id="ai-assistant-fab"
      >
        <Sparkles className="w-6 h-6 stroke-[2.2] group-hover:animate-pulse" />
        <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white animate-bounce">
          AI
        </span>
      </button>

      {/* 2. Side Chat Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" id="ai-chat-overlay">
          {/* Backdrop Blur */}
          <div 
            onClick={toggleDrawer} 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          />

          {/* Chat Container */}
          <div className="relative w-full md:w-[480px] h-full bg-white/95 backdrop-blur-md shadow-2xl flex flex-col z-10 border-l border-slate-100 animate-in slide-in-from-right duration-350 ease-out">
            
            {/* Header */}
            <header className="h-16 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-4 h-4 fill-emerald-500/20" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight">{assistantName}</h2>
                  <p className="text-[9px] text-emerald-400 font-medium">En línea • Motor de Visión & Texto</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                    showSettings 
                      ? 'bg-slate-800 border-slate-700 text-emerald-400' 
                      : 'bg-transparent border-transparent text-slate-400 hover:text-white'
                  }`}
                  title="Ajustes de IA"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleDrawer}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Content Feed */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {showSettings ? (
                <AIAssistantSettings
                  apiKey={apiKey}
                  onSaveApiKey={handleSaveApiKey}
                  selectedModel={selectedModel}
                  onSelectModel={handleSelectModel}
                  autoFailover={autoFailover}
                  onToggleFailover={handleToggleFailover}
                  assistantName={assistantName}
                  onSaveAssistantName={handleSaveAssistantName}
                  onClose={() => setShowSettings(false)}
                />
              ) : (
                <>
                  {/* API Key Missing Guidance */}
                  {!apiKey && (
                    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-2xl p-5 border border-slate-800 space-y-4 shadow-md animate-in zoom-in duration-200">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Sparkles className="w-5 h-5 fill-emerald-500/25" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-sm">Configuración Requerida</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Para empezar a interactuar y escanear tus tickets de compra de forma gratuita, necesitas una **Google Gemini API Key**.
                        </p>
                      </div>
                      <ol className="text-[11px] text-slate-400 space-y-2 list-decimal list-inside pl-1">
                        <li>Ve a <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-0.5">Google AI Studio <ArrowRight className="w-3 h-3 inline" /></a></li>
                        <li>Crea o copia una **API Key** gratuita.</li>
                        <li>Pégala a continuación para comenzar.</li>
                      </ol>

                      <AIAssistantSettings
                        apiKey={apiKey}
                        onSaveApiKey={handleSaveApiKey}
                        selectedModel={selectedModel}
                        onSelectModel={handleSelectModel}
                        autoFailover={autoFailover}
                        onToggleFailover={handleToggleFailover}
                        assistantName={assistantName}
                        onSaveAssistantName={handleSaveAssistantName}
                      />
                    </div>
                  )}

                  {/* Messages Feed */}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      
                      {/* Text/Image Message Bubble */}
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs border ${
                        msg.sender === 'user'
                          ? 'bg-slate-900 text-white border-slate-800 rounded-br-none'
                          : 'bg-white text-slate-800 border-slate-100 rounded-bl-none'
                      }`}>
                        
                        {/* Image Preview inside message */}
                        {msg.image && (
                          <div className="mb-2 max-w-full rounded-xl overflow-hidden border border-slate-700/10">
                            <img src={msg.image} alt="Adjunto del usuario" className="w-full h-auto max-h-[160px] object-cover" />
                          </div>
                        )}

                        {msg.text && (
                          <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        )}

                        {/* Model identifier tag */}
                        {msg.sender === 'assistant' && msg.modelUsed && (
                          <span className="block text-[8px] text-slate-400 mt-1 font-medium select-none">
                            Vía {msg.modelUsed}
                          </span>
                        )}
                      </div>

                      {/* LOADING/ERROR STATS */}
                      {msg.status === 'loading' && (
                        <div className="flex items-center gap-2 mt-1.5 pl-3">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce duration-300" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce duration-300" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce duration-300" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium">Procesando petición...</span>
                        </div>
                      )}

                      {msg.status === 'error' && (
                        <div className="flex items-start gap-1 p-2 bg-rose-50 border border-rose-100 rounded-xl mt-1.5 max-w-[85%] text-[10px] text-rose-600">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{msg.text}</span>
                        </div>
                      )}

                      {/* HUMAN IN THE LOOP CONFIRMATION CARDS */}
                      {msg.toolCall && msg.toolCall.status === 'pending' && (
                        <div className="w-full mt-2 select-none animate-in zoom-in duration-200">
                          <ConfirmationCard 
                            messageId={msg.id}
                            toolName={msg.toolCall.name}
                            initialArgs={msg.toolCall.args}
                            onConfirm={handleConfirmTool}
                            onReject={handleRejectTool}
                            categories={categories}
                            items={items}
                          />
                        </div>
                      )}

                      {msg.toolCall && msg.toolCall.status === 'approved' && (
                        <div className="flex items-center gap-1 mt-1 bg-emerald-50 px-2 py-1 border border-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg select-none">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Acción Aprobada y Guardada</span>
                        </div>
                      )}

                      {msg.toolCall && msg.toolCall.status === 'rejected' && (
                        <div className="flex items-center gap-1 mt-1 bg-slate-100 px-2 py-1 border border-slate-200 text-slate-500 text-[10px] font-bold rounded-lg select-none">
                          <X className="w-3.5 h-3.5" />
                          <span>Cancelado</span>
                        </div>
                      )}

                    </div>
                  ))}

                  {/* Automatic Failover Alert Banner */}
                  {failoverAlert && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-700 leading-snug animate-pulse select-none">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                      <span>{failoverAlert}</span>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            {/* Input Bar */}
            {!showSettings && apiKey && (
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 shrink-0 flex flex-col gap-2">
                
                {/* Selected Image Thumbnail preview */}
                {selectedImage && (
                  <div className="flex items-center justify-between bg-slate-50 p-2 border border-slate-150 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200">
                        <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-700">Foto del Recibo</span>
                        <span className="block text-[9px] text-slate-400">Lista para análisis de visión OCR</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="p-1 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 hover:border-rose-100 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* File/Camera attachment button */}
                  <button
                    type="button"
                    onClick={triggerFileSelect}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 transition cursor-pointer"
                    title="Subir foto de ticket o recibo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />

                  {/* Microphone speech recognition button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                      isListening
                        ? 'bg-rose-500 border-rose-500 text-white animate-pulse shadow-md shadow-rose-200 scale-105'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border-slate-200'
                    }`}
                    title={isListening ? "Detener grabación de voz" : "Grabar comando por voz"}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Main Input Text */}
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={selectedImage ? "Pídele a Gemini que escanee el recibo..." : "Escribe tu comando natural... (ej: 'Compré leche de $30')"}
                    className="flex-grow px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-450 placeholder-slate-400"
                    disabled={isSending}
                  />

                  {/* Send Action */}
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !selectedImage) || isSending}
                    className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-100 disabled:text-slate-400 rounded-xl transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------
// CONFIRMATION CARDS (Human-in-the-loop validation)
// ---------------------------------------------------------
interface ConfirmationCardProps {
  messageId: string;
  toolName: string;
  initialArgs: any;
  categories: Category[];
  items: ShoppingItem[];
  onConfirm: (messageId: string, customArgs: any) => void;
  onReject: (messageId: string) => void;
}

function ConfirmationCard({
  messageId,
  toolName,
  initialArgs,
  categories,
  items,
  onConfirm,
  onReject
}: ConfirmationCardProps) {
  // Local state to allow user to inspect and edit before confirming!
  const [editedArgs, setEditedArgs] = useState(() => {
    // Clone parameters
    const args = JSON.parse(JSON.stringify(initialArgs));
    
    // Normalize properties for items
    if (toolName === 'add_item_proposed') {
      if (args.price === undefined) args.price = 0;
      if (args.quantity === undefined) args.quantity = 1;
      if (!args.place) args.place = 'Establecimiento';
      if (!args.category) args.category = 'comida';
      if (args.bought === undefined) args.bought = false;
      if (!args.paymentMethod) args.paymentMethod = 'tarjeta';
    } 
    else if (toolName === 'add_multiple_items_proposed') {
      if (!Array.isArray(args.items)) args.items = [];
      args.items = args.items.map((item: any) => ({
        name: item.name || 'Producto',
        place: item.place || 'Supermercado',
        price: item.price !== undefined ? Number(item.price) : 0,
        quantity: item.quantity !== undefined ? Number(item.quantity) : 1,
        category: item.category || 'comida',
        paymentMethod: item.paymentMethod || 'tarjeta',
        bought: item.bought !== undefined ? !!item.bought : true
      }));
    }
    else if (toolName === 'add_service_proposed') {
      if (!args.service) args.service = 'Servicio';
      if (args.amount === undefined) args.amount = 0;
      if (!args.paymentMethod) args.paymentMethod = 'tarjeta';
    }
    else if (toolName === 'update_item_proposed') {
      const existing = items.find(i => i.name.toLowerCase().includes(args.name.toLowerCase()));
      if (existing) {
        if (args.newName === undefined) args.newName = existing.name;
        if (args.place === undefined) args.place = existing.place;
        if (args.price === undefined) args.price = existing.price;
        if (args.quantity === undefined) args.quantity = existing.quantity;
        if (args.category === undefined) args.category = existing.category;
        if (args.paymentMethod === undefined) args.paymentMethod = existing.paymentMethod;
        if (args.bought === undefined) args.bought = existing.bought;
      } else {
        if (args.newName === undefined) args.newName = args.name;
        if (args.place === undefined) args.place = 'Establecimiento';
        if (args.price === undefined) args.price = 0;
        if (args.quantity === undefined) args.quantity = 1;
        if (args.category === undefined) args.category = 'comida';
        if (args.paymentMethod === undefined) args.paymentMethod = 'tarjeta';
        if (args.bought === undefined) args.bought = false;
      }
    }
    
    return args;
  });

  const [paymentMethodMissing, setPaymentMethodMissing] = useState(false);

  // Checks validation of payment method before saving
  const handleValidateConfirm = () => {
    if (toolName === 'add_item_proposed') {
      if (!editedArgs.paymentMethod) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, editedArgs);
    } 
    else if (toolName === 'add_multiple_items_proposed') {
      const itemsList = editedArgs.items as any[];
      const missing = itemsList.some(item => !item.paymentMethod);
      if (missing) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, editedArgs);
    } 
    else if (toolName === 'add_service_proposed') {
      if (!editedArgs.paymentMethod) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, editedArgs);
    } 
    else if (toolName === 'update_item_proposed') {
      if (!editedArgs.paymentMethod) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, editedArgs);
    }
    else {
      onConfirm(messageId, editedArgs);
    }
  };

  // 1.5 UPDATE ITEM CARD
  if (toolName === 'update_item_proposed') {
    const handleFieldChange = (field: string, value: any) => {
      setEditedArgs((prev: any) => ({
        ...prev,
        [field]: value
      }));
      if (field === 'paymentMethod' && value) {
        setPaymentMethodMissing(false);
      }
    };

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[95%] mx-auto">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <ShoppingBag className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-xs text-slate-800">Modificar Artículo Existente</span>
        </div>

        <div className="space-y-3">
          {/* Target Product */}
          <div>
            <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Artículo a modificar</label>
            <div className="text-xs font-semibold text-slate-750 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
              {editedArgs.name}
            </div>
          </div>

          {/* New Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nuevo Nombre (Opcional)</label>
            <input
              type="text"
              value={editedArgs.newName}
              onChange={(e) => handleFieldChange('newName', e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-850 font-semibold focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Price */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Precio Unitario ($)</label>
              <input
                type="number"
                step="0.01"
                value={editedArgs.price}
                onChange={(e) => handleFieldChange('price', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
            {/* Quantity */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cantidad</label>
              <input
                type="number"
                value={editedArgs.quantity}
                onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Place */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Establecimiento</label>
              <input
                type="text"
                value={editedArgs.place}
                onChange={(e) => handleFieldChange('place', e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
            {/* Category */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Categoría</label>
              <select
                value={editedArgs.category}
                onChange={(e) => handleFieldChange('category', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method & Bought status */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Método de Pago</label>
              <select
                value={editedArgs.paymentMethod || ''}
                onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                className={`w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer ${
                  paymentMethodMissing && !editedArgs.paymentMethod 
                    ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-200' 
                    : 'border-slate-200'
                }`}
              >
                <option value="">-- Elige --</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado de Compra</label>
              <button
                type="button"
                onClick={() => handleFieldChange('bought', !editedArgs.bought)}
                className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  editedArgs.bought 
                    ? 'bg-emerald-50 border-emerald-250 text-emerald-700' 
                    : 'bg-amber-50 border-amber-250 text-amber-700'
                }`}
              >
                <span>{editedArgs.bought ? '¡Comprado!' : 'Planificado'}</span>
                {editedArgs.bought ? (
                  <ToggleRight className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-amber-600" />
                )}
              </button>
            </div>
          </div>

          {paymentMethodMissing && !editedArgs.paymentMethod && (
            <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Por favor selecciona cómo pagaste.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => onReject(messageId)}
            className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Rechazar
          </button>
          <button
            onClick={handleValidateConfirm}
            className="flex-grow py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
          >
            Aplicar Cambios
          </button>
        </div>
      </div>
    );
  }

  // 1. INDIVIDUAL ITEM CARD
  if (toolName === 'add_item_proposed') {
    const handleFieldChange = (field: string, value: any) => {
      setEditedArgs((prev: any) => ({
        ...prev,
        [field]: value
      }));
      if (field === 'paymentMethod' && value) {
        setPaymentMethodMissing(false);
      }
    };

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[95%] mx-auto">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <ShoppingBag className="w-4 h-4 text-emerald-500" />
          <span className="font-bold text-xs text-slate-800">Confirmar Nuevo Artículo</span>
        </div>

        <div className="space-y-3">
          {/* Product Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Artículo</label>
            <input
              type="text"
              value={editedArgs.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Price */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Precio Unitario ($)</label>
              <input
                type="number"
                step="0.01"
                value={editedArgs.price}
                onChange={(e) => handleFieldChange('price', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
            {/* Quantity */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cantidad</label>
              <input
                type="number"
                value={editedArgs.quantity}
                onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Place */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Establecimiento</label>
              <input
                type="text"
                value={editedArgs.place}
                onChange={(e) => handleFieldChange('place', e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
            {/* Category */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Categoría</label>
              <select
                value={editedArgs.category}
                onChange={(e) => handleFieldChange('category', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method & Bought status */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Método de Pago</label>
              <select
                value={editedArgs.paymentMethod || ''}
                onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                className={`w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer ${
                  paymentMethodMissing && !editedArgs.paymentMethod 
                    ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-200' 
                    : 'border-slate-200'
                }`}
              >
                <option value="">-- Elige --</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>

            {/* DIRECT VS PENDING TOGGLE SWITCH (Requerimiento de Raúl) */}
            <div className="flex flex-col justify-end">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado de Compra</label>
              <button
                type="button"
                onClick={() => handleFieldChange('bought', !editedArgs.bought)}
                className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  editedArgs.bought 
                    ? 'bg-emerald-50 border-emerald-250 text-emerald-700' 
                    : 'bg-amber-50 border-amber-250 text-amber-700'
                }`}
              >
                <span>{editedArgs.bought ? '¡Comprado!' : 'Planificado'}</span>
                {editedArgs.bought ? (
                  <ToggleRight className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-amber-600" />
                )}
              </button>
            </div>
          </div>

          {paymentMethodMissing && !editedArgs.paymentMethod && (
            <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Por favor selecciona cómo pagaste.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => onReject(messageId)}
            className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Rechazar
          </button>
          <button
            onClick={handleValidateConfirm}
            className="flex-grow py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
          >
            Aprobar Registro
          </button>
        </div>
      </div>
    );
  }

  // 2. MULTIPLE ITEMS TICKET SCAN CARD (Premium Bulk Mode)
  if (toolName === 'add_multiple_items_proposed') {
    const handleItemChange = (index: number, field: string, value: any) => {
      setEditedArgs((prev: any) => {
        const updatedList = [...prev.items];
        updatedList[index] = {
          ...updatedList[index],
          [field]: value
        };
        return { ...prev, items: updatedList };
      });
      if (field === 'paymentMethod' && value) {
        setPaymentMethodMissing(false);
      }
    };

    const handleDeleteItemFromList = (index: number) => {
      setEditedArgs((prev: any) => ({
        ...prev,
        items: prev.items.filter((_: any, i: number) => i !== index)
      }));
    };

    const handleBulkPaymentMethodChange = (method: string) => {
      setEditedArgs((prev: any) => ({
        ...prev,
        items: prev.items.map((i: any) => ({ ...i, paymentMethod: method }))
      }));
      if (method) setPaymentMethodMissing(false);
    };

    const handleBulkBoughtChange = (bought: boolean) => {
      setEditedArgs((prev: any) => ({
        ...prev,
        items: prev.items.map((i: any) => ({ ...i, bought }))
      }));
    };

    const list = editedArgs.items as any[];
    const storeName = list[0]?.place || 'Supermercado';
    const totalAmount = list.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity || 1)), 0);

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[98%] mx-auto">
        
        {/* Bulk Header details */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-purple-600" />
            <span className="font-extrabold text-xs text-slate-800">Recibo en {storeName}</span>
          </div>
          <span className="text-[11px] font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
            Total: ${totalAmount.toFixed(2)}
          </span>
        </div>

        {/* Bulk Controls */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Método de pago (Lote)</label>
            <select
              value={list[0]?.paymentMethod || ''}
              onChange={(e) => handleBulkPaymentMethodChange(e.target.value)}
              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 cursor-pointer focus:outline-none"
            >
              <option value="">-- Elige todos --</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Estado de compra (Lote)</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleBulkBoughtChange(true)}
                className={`flex-grow py-1 border text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                  list.every(i => i.bought) 
                    ? 'bg-emerald-50 border-emerald-250 text-emerald-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Comprado
              </button>
              <button
                type="button"
                onClick={() => handleBulkBoughtChange(false)}
                className={`flex-grow py-1 border text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                  list.every(i => !i.bought) 
                    ? 'bg-amber-50 border-amber-250 text-amber-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Pendiente
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable list of items to approve */}
        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
          {list.map((item, idx) => (
            <div key={idx} className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl relative space-y-2 group">
              {/* Delete item button */}
              <button
                type="button"
                onClick={() => handleDeleteItemFromList(idx)}
                className="absolute top-2 right-2 p-1 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 hover:border-rose-100 transition cursor-pointer"
                title="Eliminar artículo de la propuesta"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Title Input */}
              <div className="pr-7">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                  className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-400 focus:outline-none text-xs font-bold text-slate-700"
                />
              </div>

              {/* Grid with parameters */}
              <div className="grid grid-cols-4 gap-1.5 items-end">
                {/* Price */}
                <div className="col-span-1">
                  <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Precio ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                    className="w-full px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700"
                  />
                </div>
                {/* Qty */}
                <div className="col-span-1">
                  <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Cant.</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-full px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700"
                  />
                </div>
                {/* Category */}
                <div className="col-span-2">
                  <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Categoría</label>
                  <select
                    value={item.category}
                    onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                    className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700 cursor-pointer"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Method / Bought Status */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/50">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Pago:</span>
                  <select
                    value={item.paymentMethod || ''}
                    onChange={(e) => handleItemChange(idx, 'paymentMethod', e.target.value)}
                    className={`px-1.5 py-0.5 bg-white border rounded text-[10px] text-slate-700 font-semibold cursor-pointer ${
                      paymentMethodMissing && !item.paymentMethod 
                        ? 'border-rose-400 bg-rose-50' 
                        : 'border-slate-200'
                    }`}
                  >
                    <option value="">-- Elige --</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>

                {/* State Checkbox */}
                <button
                  type="button"
                  onClick={() => handleItemChange(idx, 'bought', !item.bought)}
                  className={`px-2 py-0.5 rounded border text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors ${
                    item.bought 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                >
                  <span>{item.bought ? 'Comprado' : 'Pendiente'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {paymentMethodMissing && list.some(i => !i.paymentMethod) && (
          <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Por favor selecciona el método de pago para todos los artículos.
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => onReject(messageId)}
            className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Rechazar
          </button>
          <button
            onClick={handleValidateConfirm}
            className="flex-grow py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
          >
            Aprobar Todo ({list.length})
          </button>
        </div>

      </div>
    );
  }

  // 3. SERVICE PAYMENT CARD
  if (toolName === 'add_service_proposed') {
    const handleFieldChange = (field: string, value: any) => {
      setEditedArgs((prev: any) => ({
        ...prev,
        [field]: value
      }));
      if (field === 'paymentMethod' && value) {
        setPaymentMethodMissing(false);
      }
    };

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[95%] mx-auto">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="font-bold text-xs text-slate-800">Confirmar Pago de Servicio</span>
        </div>

        <div className="space-y-3">
          {/* Service Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre del Servicio</label>
            <input
              type="text"
              value={editedArgs.service}
              onChange={(e) => handleFieldChange('service', e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Amount */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto Pagado ($)</label>
              <input
                type="number"
                step="0.01"
                value={editedArgs.amount}
                onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
            {/* Payment Method */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Método de Pago</label>
              <select
                value={editedArgs.paymentMethod || ''}
                onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                className={`w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer ${
                  paymentMethodMissing && !editedArgs.paymentMethod 
                    ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-200' 
                    : 'border-slate-200'
                }`}
              >
                <option value="">-- Elige --</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          </div>

          {paymentMethodMissing && !editedArgs.paymentMethod && (
            <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Por favor selecciona cómo pagaste.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => onReject(messageId)}
            className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Rechazar
          </button>
          <button
            onClick={handleValidateConfirm}
            className="flex-grow py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
          >
            Aprobar Registro
          </button>
        </div>
      </div>
    );
  }

  // 4. PRESETS BUDGET OR DIRECT ACTIONS CONFIRM (Simple interactive prompt)
  const isBudgetAction = toolName === 'add_budget_funds' || toolName === 'set_budget';
  const handleFieldChangeRaw = (field: string, value: any) => {
    setEditedArgs((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[95%] mx-auto">
      <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
        <Sparkles className="w-4 h-4 text-emerald-500" />
        <span className="font-bold text-xs text-slate-800">
          {toolName === 'add_budget_funds' && 'Aumentar Presupuesto'}
          {toolName === 'set_budget' && 'Modificar Presupuesto'}
          {toolName === 'toggle_item_bought' && 'Cambiar comprado/pendiente'}
          {toolName === 'delete_item_by_name' && 'Archivar Artículo'}
          {toolName === 'delete_service_payment_by_name' && 'Eliminar Pago Servicio'}
          {toolName === 'add_category' && 'Crear Categoría'}
          {toolName === 'add_place' && 'Agregar Establecimiento'}
          {toolName === 'add_service_option' && 'Crear Opción de Servicio'}
          {toolName === 'restore_item_by_name' && 'Restaurar Artículo'}
          {toolName === 'purge_archived_item_by_name' && 'Purga Definitiva'}
          {toolName === 'reset_database_proposed' && 'Reiniciar Aplicación'}
        </span>
      </div>

      <div className="space-y-3">
        {isBudgetAction ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Presupuesto</label>
              <select
                value={editedArgs.type}
                onChange={(e) => handleFieldChangeRaw('type', e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 cursor-pointer focus:outline-none"
              >
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta / Transferencia</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto ($)</label>
              <input
                type="number"
                value={editedArgs.amount}
                onChange={(e) => handleFieldChangeRaw('amount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
              />
            </div>
          </div>
        ) : toolName === 'reset_database_proposed' ? (
          <div className="bg-rose-50 text-rose-700 text-[11px] font-bold p-3 border border-rose-100 rounded-xl leading-relaxed">
            ¿Confirmas reiniciar por completo todas las bases de datos locales? Esto eliminará artículos, servicios y restaurará presupuestos de demostración.
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Objetivo del cambio</label>
            <input
              type="text"
              value={editedArgs.name || editedArgs.service || ''}
              onChange={(e) => handleFieldChangeRaw(editedArgs.name !== undefined ? 'name' : 'service', e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-50">
        <button
          onClick={() => onReject(messageId)}
          className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(messageId, editedArgs)}
          className="flex-grow py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
        >
          Confirmar Cambio
        </button>
      </div>
    </div>
  );
}
