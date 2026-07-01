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
import { ShoppingItem, ArchivedItem, ServicePayment, Category, PaymentMethod, PREDEFINED_CATEGORIES, Income, MonthlyHistoryRecord, Apartado } from '../types';
import AIAssistantSettings, { GEMINI_MODELS } from './AIAssistantSettings';
import { buildDuplicateIndex, checkDuplicateTransaction } from '../utils/duplicateDetector';

// Obfuscation helpers for API key storage (prevents casual plain-text exposure in localStorage)
const encodeApiKey = (key: string): string => {
  try { return btoa(key); } catch { return key; }
};
const decodeApiKey = (encoded: string): string => {
  try { return atob(encoded); } catch { return encoded; }
};

// Migration: if existing key is stored unencoded (plain text starting with 'AIza'), re-encode it
const loadApiKey = (): string => {
  const stored = localStorage.getItem('cobuy_gemini_api_key') || '';
  if (!stored) return '';
  // Plain-text Gemini keys start with 'AIza' — migrate to encoded
  if (stored.startsWith('AIza')) {
    const encoded = encodeApiKey(stored);
    localStorage.setItem('cobuy_gemini_api_key', encoded);
    return stored;
  }
  return decodeApiKey(stored);
};

interface ToolCallState {
  id: string;
  name: string;
  args: any;
  status: 'pending' | 'approved' | 'rejected';
  feedbackText?: string;
}

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
  toolCalls?: ToolCallState[];
}

interface AIAssistantProps {
  userName?: string;
  items: ShoppingItem[];
  archivedItems: ArchivedItem[];
  servicePayments: ServicePayment[];
  cashBudget: number;
  cardBudget: number;
  // Snapshots del "Presupuesto Inicial" (fuente de verdad). Base para editar el presupuesto
  // desde la IA sin doble contar ingresos/apartados que ya están en cashBudget/cardBudget.
  initialCashBudget?: number;
  initialCardBudget?: number;
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

  // Capital management additions
  incomes?: Income[];
  monthlyHistory?: MonthlyHistoryRecord[];
  currentMonth?: string;
  onAddIncome?: (incomeData: Omit<Income, 'id' | 'createdAt'> & { createdAt?: string; externalId?: string }) => void;
  onDeleteIncome?: (id: string) => void;

  // Apartados addition
  apartados?: Apartado[];
  onAddApartado?: (name: string, amount: number, paymentMethod: 'efectivo' | 'tarjeta') => void;
  onDepositToApartado?: (id: string, amount: number) => void;
  onWithdrawFromApartado?: (id: string, amount: number) => void;
  onDeleteApartado?: (id: string) => void;
  externalAITrigger?: {
    image: string;
    text: string;
    timestamp: number;
  };
}

// Premium Error Translation Parser for Gemini API
export const parseGeminiError = (err: any, responseStatus?: number): string => {
  let msg = '';
  if (err instanceof Error) {
    msg = err.message;
  } else if (typeof err === 'object' && err !== null) {
    msg = err.message || JSON.stringify(err);
  } else {
    msg = String(err);
  }

  const lowerMsg = msg.toLowerCase();

  if (
    lowerMsg.includes('api key not valid') ||
    (lowerMsg.includes('api key') && lowerMsg.includes('invalid')) ||
    (responseStatus === 400 && lowerMsg.includes('key'))
  ) {
    return '🔑 Tu API Key de Gemini parece no ser válida o está mal copiada. Por favor, verifícala en los Ajustes (ícono de engranaje arriba).';
  }
  if (lowerMsg.includes('quota exceeded') || lowerMsg.includes('resource exhausted') || responseStatus === 429) {
    return '⏳ Se ha agotado la cuota gratuita de tu API Key o estás enviando peticiones demasiado rápido. Espera unos segundos y vuelve a intentarlo.';
  }
  if (lowerMsg.includes('safety') || lowerMsg.includes('blocked') || lowerMsg.includes('candidate') || lowerMsg.includes('finishreason')) {
    return '🛡️ La solicitud o la imagen cargada fue bloqueada por los filtros de seguridad y políticas de contenido de Gemini. Intenta refrasear tu mensaje o subir una imagen diferente.';
  }
  if ((lowerMsg.includes('model') && lowerMsg.includes('not found')) || responseStatus === 404) {
    return '🧠 El modelo seleccionado no está disponible en este momento. Intenta cambiar de modelo en los Ajustes de la IA.';
  }
  if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('network error') || lowerMsg.includes('cors')) {
    return '📶 Error de conexión a internet o bloqueo de red. Por favor revisa que tengas acceso estable a internet y vuelve a intentar.';
  }

  return `⚠️ Error de la IA: ${msg || 'Ocurrió un problema de comunicación inesperado. Intenta de nuevo.'}`;
};

// Custom lightweight Markdown-like parser for gorgeous AI message responses (Seniors-friendly)
const parseInlineFormatting = (text: string): React.ReactNode => {
  if (!text) return '';
  const parts = text.split('**');
  if (parts.length === 1) return text;

  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      // Bold text with subtle, high-contrast, premium background highlighting
      return (
        <strong key={idx} className="font-extrabold text-slate-900 bg-slate-100/80 px-1 py-0.5 rounded text-[11.5px] border border-slate-200/20">
          {part}
        </strong>
      );
    }
    return part;
  });
};

const renderFormattedText = (text: string): React.ReactNode => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check for Markdown Table Block
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().includes('|') && lines[i + 1].includes('-')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        // Extract headers
        const headerCols = tableLines[0]
          .split('|')
          .map(c => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        
        // Extract rows (skipping the separator line at index 1)
        const rows = tableLines.slice(2).map(r => {
          return r
            .split('|')
            .map(c => c.trim())
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        }).filter(r => r.length > 0);

        elements.push(
          <div key={`table-${i}`} className="my-3.5 overflow-x-auto rounded-xl border border-slate-200/60 shadow-xs max-w-full">
            <table className="min-w-full divide-y divide-slate-150 text-[10.5px]">
              <thead className="bg-slate-100/90 font-extrabold text-slate-800">
                <tr>
                  {headerCols.map((col, idx) => (
                    <th key={`th-${idx}`} className="px-3 py-2 text-left tracking-wider font-extrabold text-[11px] text-slate-700">
                      {parseInlineFormatting(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-slate-655 font-semibold">
                {rows.map((row, rIdx) => (
                  <tr key={`tr-${rIdx}`} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    {row.map((cell, cIdx) => (
                      <td key={`td-${cIdx}`} className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {parseInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Check for Heading 3/4
    if (line.trim().startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="text-xs font-black text-slate-900 mt-2.5 mb-1.5 flex items-center gap-1">
          <span className="w-1 h-3 rounded-full bg-emerald-500" />
          {parseInlineFormatting(line.trim().slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.trim().startsWith('## ') || line.trim().startsWith('# ')) {
      const isH1 = line.trim().startsWith('# ');
      const titleText = isH1 ? line.trim().slice(2) : line.trim().slice(3);
      elements.push(
        <h3 key={`h2-${i}`} className="text-[12px] font-black text-slate-900 mt-4 mb-2 tracking-tight border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-3.5 rounded-full bg-emerald-500 animate-pulse" />
          {parseInlineFormatting(titleText)}
        </h3>
      );
      i++;
      continue;
    }

    // Check for List Items (Bulleted)
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || line.trim().startsWith('• ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('• '))) {
        const rawLine = lines[i].trim();
        const content = rawLine.startsWith('- ') ? rawLine.slice(2) : rawLine.startsWith('* ') ? rawLine.slice(2) : rawLine.slice(2);
        listItems.push(content);
        i++;
      }

      elements.push(
        <ul key={`ul-${i}`} className="my-2.5 pl-1.5 space-y-2 list-none">
          {listItems.map((item, idx) => (
            <li key={`li-${idx}`} className="text-[11.5px] text-slate-700 leading-relaxed font-semibold flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
              <span className="flex-1">{parseInlineFormatting(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Check for List Items (Numbered)
    const numListMatch = line.trim().match(/^(\d+)\.\s(.*)/);
    if (numListMatch) {
      const listItems: { num: string; text: string }[] = [];
      while (i < lines.length) {
        const currentMatch = lines[i].trim().match(/^(\d+)\.\s(.*)/);
        if (!currentMatch) break;
        listItems.push({ num: currentMatch[1], text: currentMatch[2] });
        i++;
      }

      elements.push(
        <ol key={`ol-${i}`} className="my-2.5 pl-1 space-y-2 list-none">
          {listItems.map((item, idx) => (
            <li key={`oli-${idx}`} className="text-[11.5px] text-slate-700 leading-relaxed font-semibold flex items-start gap-2.5">
              <span className="text-[9.5px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 w-4.5 h-4.5 rounded-md flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                {item.num}
              </span>
              <span className="flex-1">{parseInlineFormatting(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular Plain Text Line
    if (line.trim() !== '') {
      elements.push(
        <p key={`p-${i}`} className="text-[11.5px] text-slate-700 leading-relaxed font-semibold my-2">
          {parseInlineFormatting(line)}
        </p>
      );
    } else {
      elements.push(<div key={`spacer-${i}`} className="h-2" />);
    }
    
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
};

interface ModelLimit {
  rpm: number;
  rpd: number;
}

export const MODEL_LIMITS: Record<string, ModelLimit> = {
  'gemini-2.5-flash': { rpm: 15, rpd: 1500 },
  'gemini-2.0-flash': { rpm: 15, rpd: 1500 },
  'gemini-1.5-flash': { rpm: 15, rpd: 1500 },
  'gemini-2.5-pro': { rpm: 2, rpd: 50 },
  'gemini-1.5-pro': { rpm: 2, rpd: 50 },
};

export const getModelLimits = (modelId: string): ModelLimit => {
  return MODEL_LIMITS[modelId] || { rpm: 15, rpd: 1500 };
};

export default function AIAssistant({
  userName = 'Usuario',
  items,
  archivedItems,
  servicePayments,
  cashBudget,
  cardBudget,
  initialCashBudget = 0,
  initialCardBudget = 0,
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
  onResetDatabase,
  incomes = [],
  monthlyHistory = [],
  currentMonth = '',
  onAddIncome,
  onDeleteIncome,
  apartados = [],
  onAddApartado,
  onDepositToApartado,
  onWithdrawFromApartado,
  onDeleteApartado,
  externalAITrigger
}: AIAssistantProps) {
  // Assistant drawer state
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Gemini API Configuration
  const [apiKey, setApiKey] = useState(() => loadApiKey());
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

  // Rate limits tracking (Gemini Free Tier RPM & RPD limits)
  const [requestTimestamps, setRequestTimestamps] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('spendwise_api_requests');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          return parsed.filter((t: any) => typeof t === 'number' && t > oneDayAgo);
        }
      }
    } catch (e) {
      console.error('Error cargando timestamps de cuota:', e);
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('spendwise_api_requests', JSON.stringify(requestTimestamps));
  }, [requestTimestamps]);

  const recordApiRequest = () => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    setRequestTimestamps(prev => [...prev.filter(t => t > oneDayAgo), now]);
  };

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

  const startListening = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!recognitionRef.current) {
      alert('El reconocimiento de voz no está soportado en este navegador. Te recomendamos usar Google Chrome o Safari.');
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (err) {
      // Ignore if already started
      console.debug('Recognition start issue:', err);
    }
  };

  const stopListening = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.debug('Recognition stop issue:', err);
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Save configurations in LocalStorage
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('cobuy_gemini_api_key', encodeApiKey(key));
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
          text: `¡Hola, ${userName}! Soy ${assistantName}, tu asistente de compras con Google Gemini. Puedes pedirme que agregue artículos, registre pagos de servicios, actualice tus presupuestos o subas una foto de un recibo para escanearlo. ¿En qué te ayudo hoy?`
        }
      ]);
    }
  };

  // Handle image upload, compress using Canvas (max 1024px, 80% JPEG quality) and convert to base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setSelectedImage(compressedBase64);
        } else {
          setSelectedImage(reader.result as string);
        }
      };
      img.src = reader.result as string;
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
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Estás sin conexión a internet. Por favor, comprueba tu conexión antes de usar el asistente.');
    }

    const modelToUse = currentModel;
    attemptedModels.push(modelToUse);

    // Build active month name
    const [currY, currM] = currentMonth.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const currMonthName = currM ? `${monthNames[parseInt(currM) - 1]} ${currY}` : '';

    // Calculate real spending to get actual remaining free budget
    const cashSpentItems = items.reduce((acc, curr) => acc + (curr.bought && curr.paymentMethod === 'efectivo' ? curr.price * curr.quantity : 0), 0);
    const cardSpentItems = items.reduce((acc, curr) => acc + (curr.bought && curr.paymentMethod !== 'efectivo' ? curr.price * curr.quantity : 0), 0);
    const currentMonthServices = servicePayments.filter(s => s.createdAt.startsWith(currentMonth));
    const cashSpentServices = currentMonthServices.reduce((acc, curr) => acc + (curr.paymentMethod === 'efectivo' ? curr.amount : 0), 0);
    const cardSpentServices = currentMonthServices.reduce((acc, curr) => acc + (curr.paymentMethod !== 'efectivo' ? curr.amount : 0), 0);
    const cashSpent = cashSpentItems + cashSpentServices;
    const cardSpent = cardSpentItems + cardSpentServices;

    // De-duplicate recurring templates by name (case-insensitive) to avoid cluttering prompt context
    const uniqueRecurringTemplates = Array.from(
      new Map(
        servicePayments
          .filter(s => s.isRecurring)
          .map(s => [s.service.toLowerCase(), s])
      ).values()
    );

    // Build current state payload for the system instructions
    const systemInstruction = `
Eres un asistente financiero experto dentro de la aplicación 'SpendWise Pro'.
El usuario con el que estás hablando se llama: ${userName}. Dirígete a él o ella por su nombre cuando lo consideres oportuno de manera extremadamente afectuosa, respetuosa, atenta y cercana.
Tu objetivo es ayudar a ${userName} a gestionar su lista de compras, servicios, presupuestos e ingresos mediante lenguaje natural, consultas analíticas, cálculos matemáticos y análisis de fotografías de recibos.
Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Estado actual de la aplicación:
- Mes activo actual: ${currentMonth} (${currMonthName})
- Artículos planificados/comprados (ShoppingItem): ${JSON.stringify(items.map(i => ({ id: i.id, name: i.name, place: i.place, price: i.price, quantity: i.quantity, category: i.category, bought: i.bought, paymentMethod: i.paymentMethod, createdAt: i.createdAt })))}
- Historial de artículos eliminados/archivados (ArchivedItem): ${JSON.stringify(archivedItems.map(a => ({ id: a.id, name: a.name, place: a.place, price: a.price, quantity: a.quantity, category: a.category, paymentMethod: a.paymentMethod, createdAt: a.createdAt, deletedAt: a.deletedAt })))}
- Pagos de servicios registrados este mes (ServicePayment): ${JSON.stringify(currentMonthServices)}
- Definición de servicios recurrentes activos (plantillas): ${JSON.stringify(uniqueRecurringTemplates.map(s => ({ service: s.service, amount: s.amount, paymentMethod: s.paymentMethod, recurringDay: s.recurringDay })))}
- Ingresos de este mes (Income): ${JSON.stringify(incomes)}
- Apartados de ahorro/resguardados activos (Apartado): ${JSON.stringify(apartados.map(a => ({ id: a.id, name: a.name, amount: a.amount, paymentMethod: a.paymentMethod })))}
- Historial financiero de meses cerrados (MonthlyHistoryRecord): ${JSON.stringify(monthlyHistory.map(m => ({ monthId: m.monthId, summary: m.summary })))}
- Presupuesto en efectivo asignado (excluyendo apartados, incluye ingresos extras): $${cashBudget}
- Presupuesto en tarjeta/transferencia asignado (excluyendo apartados, incluye ingresos extras): $${cardBudget}
- Presupuesto en efectivo libre disponible actual (ya descontando lo comprado y pagado): $${cashBudget - cashSpent}
- Presupuesto en tarjeta/transferencia libre disponible actual (ya descontando lo comprado y pagado): $${cardBudget - cardSpent}
- Total de capital libre disponible actual: $${(cashBudget - cashSpent) + (cardBudget - cardSpent)}
- Categorías de compras disponibles: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name })))}
- Lugares de compra frecuentes: ${JSON.stringify(places)}
- Servicios frecuentes: ${JSON.stringify(serviceOptions)}


Reglas importantes:
1. DISTINGUE CONSULTAS vs ACCIONES DE REGISTRO:
   - CONSULTAS (Preguntas, cálculos, históricos, presupuestos, apartados de ahorro): Si el usuario hace preguntas sobre qué ha comprado, cuánto tiene ahorrado en sus apartados, cuánto ha gastado en ciertas fechas o periodos (ayer, hoy, esta semana, este mes), saldos de presupuestos o cálculos generales, NO invoques ninguna herramienta ni propongas tarjetas de confirmación. Responde amigablemente por chat en lenguaje de texto natural claro, prolijo, ordenado y con números formateados. Sé servicial y haz cálculos precisos utilizando los campos 'createdAt' de los datos para agrupar gastos por fechas. Identifica el día exacto de la semana y la fecha de registro de cada movimiento utilizando su campo 'createdAt' en comparación con la fecha de hoy.
   - ACCIONES DE MUTACIÓN (Añadir, modificar, borrar, reiniciar): Si el usuario solicita explícitamente agregar un artículo/servicio, cambiar un precio/cantidad, marcar algo como comprado o borrar un registro (ej: "Agrega pan", "Compré detergente", "Borra el café"), SÍ debes proponer la tarjeta de confirmación correspondiente invocando la herramienta (tool call) de manera inmediata.
2. Tono, Trato Conversacional y Formato Premium (Especial para Adultos Mayores):
   - Evita ser robótico, seco, invasivo o demasiado imperativo.
   - Trata al usuario con extrema cordialidad y respeto ("Hola, (Nombre de usuario), un gusto saludarte. Claro que sí, con mucho gusto...").
   - Brinda explicaciones comprensibles y amigables. No asumas que conoce términos técnicos complejos.
   - ESTRUCTURACIÓN PREMIUM DE RESPUESTAS (Tablas, Listas y Negritas): Tienes total libertad y la recomendación de responder utilizando Markdown estándar. El sistema interpretará y renderizará automáticamente tus respuestas en hermosas interfaces visuales interactivas:
     * Usa TABLAS DE MARKDOWN (con cabeceras y filas, ej: | Elemento | Detalle | Costo |) para desgloses de compras, listas de gastos del mes, balances de servicios o presupuestos. El sistema las convertirá en preciosas tablas cebra con bordes nítidos.
     * Usa LISTAS CON VIÑETAS (empezando con "- ") o LISTAS NUMERADAS (ej. "1. ") para organizar ideas, productos o guías. El sistema las convertirá en listas premium con elegantes círculos verdes esmeralda o tarjetas secuenciales numeradas.
     * Usa TEXTO EN NEGRITA (encerrado en "**") para resaltar cantidades monetarias, nombres de apartados de ahorro, categorías y estados (ej: "**$450.00**", "**Ahorro Viaje**"). El sistema les dará un sombreado redondeado especial de alta visibilidad para que resalten a la vista.
3. Analiza el lenguaje natural del usuario o las imágenes de recibos que suba. Si el usuario te da una lista rápida o menciona artículos (ej: "Agrega leche, huevos, jamón" o "lista rápida: pan y café"), invoca de inmediato 'add_multiple_items_proposed' (o 'add_item_proposed' si es un solo artículo) SIN pedirle precios, cantidades o lugares. Es de vital importancia que NUNCA le preguntes por chat el precio, cantidad o establecimiento si no los especificó; en su lugar, llama a la herramienta inmediatamente y deja que la tarjeta de confirmación se encargue de mostrarlos en pantalla.
4. Identifica rigurosamente si el usuario se refiere a una compra ya realizada (directa/comprada) o a algo que tiene planeado comprar en el futuro (pendiente/planificada) basándote en los verbos que use:
   - Ej: "Compré", "Gasté", "Pagué", "Fui a comprar" -> Directa (bought = true).
   - Ej: "Añade a la lista", "Quiero comprar", "Planeo comprar", "Tengo que comprar" -> Pendiente/planificada (bought = false).
   - Si no se puede determinar, pon comprado como false (pendiente) o true según el contexto, pero asegúrate de que el parámetro 'bought' se envíe.
5. Si el usuario sube un recibo con múltiples artículos, utiliza 'add_multiple_items_proposed' para proponerlos todos juntos en una sola tarjeta de confirmación de forma inmediata.
6. Si falta información en la solicitud del usuario (como precio, lugar, cantidad o categoría), NO le preguntes por el chat. Invoca la herramienta correspondiente de inmediato y deja que esos parámetros falten o se establezcan en valores por defecto; el usuario podrá completarlos o modificarlos cómodamente en la tarjeta interactiva de confirmación que aparecerá en su pantalla.
7. Si ejecutas una acción directa que no requiere tarjeta de confirmación compleja (como actualizar un presupuesto o borrar/marcar comprado, o restaurar del historial), describe lo que has hecho de manera extremadamente breve e interactiva.
8. Para modificar un artículo existente (ej: "cambia el precio del pan a $20" o "renombra cereal a cereal fitness"), llama a 'update_item_proposed'.
9. Si el usuario pide agregar un nuevo lugar frecuente, categoría o servicio de forma independiente, llama a 'add_place', 'add_category' o 'add_service_option' respectively.
10. PRECIO TOTAL vs PRECIOS INDIVIDUALES en compras múltiples:
    - Si el usuario menciona varios artículos CON un precio total general (ej: "Compré leche, pan y huevos por $150", "Gasté $200 en frutas, verduras y carne"), usa 'add_multiple_items_proposed' con el parámetro 'totalPrice' igual al monto total y deja el precio individual de cada artículo en 0. La tarjeta de confirmación se encargará de distribuir el total.
    - Si el usuario menciona varios artículos CON precios individuales (ej: "Compré leche $30, pan $20 y huevos $50"), usa 'add_multiple_items_proposed' con el precio de cada artículo en su campo 'price' y NO envíes 'totalPrice'.
    - Si el usuario menciona artículos sin ningún precio, no envíes 'totalPrice' ni precios individuales (dejar en 0).
11. REGISTRO DE INGRESOS: Si el usuario menciona haber recibido dinero (por ejemplo: 'Me pagaron mi nómina de $10,000 en tarjeta', 'Registra un ingreso de $500 en efectivo por un regalo' o 'Me llegó una lana extra de $1200'), debes proponer la tarjeta de confirmación correspondiente llamando a 'add_income_proposed' inmediatamente. Si no especifica el método de pago (efectivo o tarjeta), invoca la herramienta sin enviarlo (o déjalo vacío) para que el usuario elija su destino interactivamente.
12. APARTADOS DE AHORRO (RESERVAS): Si el usuario solicita resguardar o separar dinero (por ejemplo: \'Quiero guardar $1000 en efectivo para la Renta\', \'Crea un apartado de ahorro llamado Viaje con $500 en tarjeta\' o \'Sepárame $200 de mi presupuesto\'), debes proponer la tarjeta correspondiente llamando a \'add_apartado_proposed\'. Si desea depositar o meter más dinero en un apartado existente, llama a \'deposit_to_apartado_proposed\'. Si desea retirar o sacar dinero de un apartado existente, llama a \'withdraw_from_apartado_proposed\'. Si desea eliminar/borrar un apartado existente por completo, llama a \'delete_apartado_proposed\'.
13. ESCANEO DE CAPTURAS DE PANTALLA DE MOVIMIENTOS (Ej. Mercado Pago):
    Si el usuario sube una captura de pantalla que muestra una lista de movimientos/transacciones de uno o varios días (con montos positivos, negativos, fechas como "2 de junio" o "1 de junio", y horas como "22:11"), debes:
    - Extraer TODAS las transacciones válidas visibles en la imagen.
    - Mapear cada transacción al método o herramienta correspondiente (llamando a múltiples herramientas en paralelo si es necesario):
      * Ingresos (ej. "+ $374", "+ $1,800", "Transferencia recibida"): llama a \'add_income_proposed\'.
      * Pagos de servicios recurrentes/suscripciones/taxis/telefónicas/recargas (ej. "Pago - $50 Telcel", "DiDi", "Uber", "Netflix"): llama a \'add_service_proposed\'.
      * Compras generales o envíos de dinero (ej. "- $160 Chipi", "Pago supermercado"): llama a \'add_item_proposed\' con \'bought = true\'.
      * Movimientos de apartados/ahorros (ej. "Monto retirado Ahorros", "Monto apartado Renta"): llama a \'withdraw_from_apartado_proposed\' o \'deposit_to_apartado_proposed\'.
    - Calcular y pasar la fecha real en el parámetro \'createdAt\'. Traduce expresiones de fecha relativas como "2 de junio" a una fecha completa ISO 8601 (YYYY-MM-DDTHH:MM:SS) o "YYYY-MM-DD" deduciendo el año del día de hoy (${new Date().getFullYear()}). Por ejemplo: "2 de junio" con hora "22:11" se convierte en "${new Date().getFullYear()}-06-02T22:11:00".
14. PREVENCIÓN DE DUPLICADOS:
    - Antes de sugerir registrar un gasto, servicio o ingreso, compáralo con los registros activos y el historial cerrado (MonthlyHistoryRecord).
    - Si detectas que ya existe un registro con el mismo monto y un concepto similar en la misma fecha, adviértele amigablemente al usuario en tu mensaje de chat (ej. "⚠️ Veo que ya tienes registrado hoy un gasto por $X para Y, pero te presento la tarjeta por si fue un consumo distinto") al mismo tiempo que invocas la herramienta correspondiente.
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
                bought: { type: 'BOOLEAN', description: 'Si la compra ya se efectuó (true) o si es un plan futuro/pendiente (false)' },
                externalId: { type: 'STRING', description: 'ID de transacción o número de operación de Mercado Pago (opcional)' },
                createdAt: { type: 'STRING', description: 'Fecha y hora real del movimiento en formato ISO 8601 o YYYY-MM-DD (opcional)' }
              },
              required: ['name', 'bought']
            }
          },
          {
            name: 'add_multiple_items_proposed',
            description: 'Propone añadir múltiples artículos a la vez (ideal para escaneo de tickets completos de supermercado o listas rápidas). Soporta dos modos: precios individuales por artículo, o un precio total general que se distribuye entre todos.',
            parameters: {
              type: 'OBJECT',
              properties: {
                totalPrice: { type: 'NUMBER', description: 'Precio total general de toda la compra. Usar SOLO cuando el usuario da un monto global para varios artículos sin desglosar precios individuales (ej: "compré X, Y y Z por $150"). Si se proporcionan precios individuales por artículo, NO enviar este campo.' },
                items: {
                  type: 'ARRAY',
                  description: 'Lista de artículos extraídos',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      name: { type: 'STRING', description: 'Nombre del artículo' },
                      place: { type: 'STRING', description: 'Lugar de compra' },
                      price: { type: 'NUMBER', description: 'Precio unitario del artículo. Dejar en 0 si se usa totalPrice.' },
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
            description: 'Propone registrar el pago de un servicio recurrente/fijo mensual como internet, Netflix, agua, etc.',
            parameters: {
              type: 'OBJECT',
              properties: {
                service: { type: 'STRING', description: 'Nombre del servicio (ej. Netflix, Uber, Celular, Internet)' },
                amount: { type: 'NUMBER', description: 'Monto total pagado por el servicio' },
                paymentMethod: { type: 'STRING', description: 'Método de pago (efectivo, tarjeta, transferencia)' },
                isRecurring: { type: 'BOOLEAN', description: 'Indica si es una suscripción recurrente todos los meses (true) o cobro único (false)' },
                recurringDay: { type: 'NUMBER', description: 'Día de cobro programado del mes (1 al 31) si es recurrente' },
                externalId: { type: 'STRING', description: 'ID de transacción o número de operación de Mercado Pago (opcional)' },
                createdAt: { type: 'STRING', description: 'Fecha y hora real del movimiento en formato ISO 8601 o YYYY-MM-DD (opcional)' }
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
            description: 'Fija el PRESUPUESTO INICIAL del mes (el punto de partida) de efectivo o tarjeta. NO fija el total disponible actual: los ingresos y apartados ya cargados se suman/restan aparte, así que el disponible se recalcula solo. Usar cuando el usuario quiere definir con cuánto arranca el mes.',
            parameters: {
              type: 'OBJECT',
              properties: {
                type: { type: 'STRING', description: 'Tipo de presupuesto a modificar: "cash" o "card"' },
                amount: { type: 'NUMBER', description: 'Monto inicial del mes (punto de partida), antes de sumar ingresos y restar apartados' }
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
            name: 'add_income_proposed',
            description: 'Propone registrar un nuevo ingreso extra de dinero (nómina, pago recibido, regalo) en efectivo o tarjeta.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o concepto del ingreso (ej: Nómina quincenal, Venta de consola, Regalo)' },
                amount: { type: 'NUMBER', description: 'Monto del ingreso en pesos/dólares' },
                paymentMethod: { type: 'STRING', description: 'Destino del dinero. Debe ser "efectivo" para efectivo o "tarjeta" para tarjeta/banco. Si no se puede inferir del mensaje, dejar en blanco para que el usuario elija.' },
                externalId: { type: 'STRING', description: 'ID de transacción o número de operación de Mercado Pago (opcional)' },
                createdAt: { type: 'STRING', description: 'Fecha y hora real del movimiento en formato ISO 8601 o YYYY-MM-DD (opcional)' }
              },
              required: ['name', 'amount']
            }
          },
          {
            name: 'delete_income_by_name',
            description: 'Busca un ingreso de dinero activo por su nombre o concepto y lo elimina.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o concepto del ingreso a borrar' }
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
          },
          {
            name: 'add_apartado_proposed',
            description: 'Propone crear un nuevo apartado de ahorro o reserva de dinero (ej: Apartado para Renta, Ahorro para Viaje). Requiere confirmación.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o concepto del apartado de ahorro (ej: Renta, Viaje, Fondo de Emergencia)' },
                amount: { type: 'NUMBER', description: 'Monto a resguardar inicialmente en el apartado' },
                paymentMethod: { type: 'STRING', description: 'Origen del presupuesto del apartado. Debe ser "efectivo" o "tarjeta". Si no se puede inferir del mensaje, dejar vacío para elegir en la UI.' }
              },
              required: ['name', 'amount']
            }
          },
          {
            name: 'deposit_to_apartado_proposed',
            description: 'Propone depositar o agregar más dinero a un apartado de ahorro existente. Requiere confirmación.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o concepto del apartado existente al que se depositará' },
                amount: { type: 'NUMBER', description: 'Monto de dinero a depositar en el apartado' }
              },
              required: ['name', 'amount']
            }
          },
          {
            name: 'withdraw_from_apartado_proposed',
            description: 'Propone retirar dinero de un apartado de ahorro existente y regresarlo al presupuesto libre. Requiere confirmación.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o concepto del apartado existente del que se retirará' },
                amount: { type: 'NUMBER', description: 'Monto de dinero a retirar del apartado' }
              },
              required: ['name', 'amount']
            }
          },
          {
            name: 'delete_apartado_proposed',
            description: 'Propone eliminar permanentemente un apartado de ahorro y devolver todo su saldo al presupuesto libre disponible. Requiere confirmación.',
            parameters: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Nombre o concepto del apartado a eliminar' }
              },
              required: ['name']
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
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          msg.toolCalls.forEach(tc => {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.args
              }
            });
          });
        }
        contents.push({ role: 'model', parts });

        // Insert function response to satisfy the model context and API schema
        const responseParts: any[] = [];
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          msg.toolCalls.forEach(tc => {
            responseParts.push({
              functionResponse: {
                name: tc.name,
                response: {
                  content: {
                    status: tc.status,
                    message: tc.status === 'approved' 
                      ? 'Acción confirmada y guardada con éxito.' 
                      : 'Acción rechazada por el usuario.'
                  }
                }
              }
            });
          });
        } else if (msg.toolCall) {
          responseParts.push({
            functionResponse: {
              name: msg.toolCall.name,
              response: {
                content: {
                  status: msg.toolCall.status,
                  message: msg.toolCall.status === 'approved' 
                    ? 'Acción confirmada y guardada con éxito.' 
                    : 'Acción rechazada por el usuario.'
                }
              }
            }
          });
        }

        if (responseParts.length > 0) {
          contents.push({
            role: 'function',
            parts: responseParts
          });
        }
      }
    });

    // Add current user prompt
    const currentUserParts: any[] = [];
    if (userText) {
      currentUserParts.push({ text: userText });
    }

    if (base64Image) {
      const receiptPrompt = 'Analiza esta imagen de recibo o ticket de compra de forma extremadamente minuciosa. Extrae con precisión:\n' +
        '1. La tienda o establecimiento en el campo "place" de cada artículo.\n' +
        '2. La lista de productos con sus nombres completos descriptivos.\n' +
        '3. Precios unitarios y cantidades. Si solo hay un total global sin desglosar o si prefieres proponer un total unificado para la lista de compras, indícalo usando el parámetro "totalPrice".\n' +
        '4. Clasifica adecuadamente cada artículo en una categoría lógica.\n' +
        '5. Detecta el método de pago si se especifica.\n' +
        'Invoca inmediatamente la herramienta add_multiple_items_proposed para proponer registrar todo el ticket junto en pantalla.';
      currentUserParts.push({ text: receiptPrompt });
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
      recordApiRequest();
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey.trim()
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorDetails = await response.json().catch(() => ({}));
        const rawMsg = errorDetails?.error?.message || `HTTP ${response.status}`;
        throw new Error(parseGeminiError(rawMsg, response.status));
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

      throw new Error(parseGeminiError(err));
    }
  };

  // Active limits based on current selection
  const activeLimits = getModelLimits(selectedModel);
  const nowMs = Date.now();
  const oneMinuteAgo = nowMs - 60 * 1000;
  const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;

  const rpmCount = requestTimestamps.filter(t => t > oneMinuteAgo).length;
  const rpdCount = requestTimestamps.filter(t => t > oneDayAgo).length;

  const isNearRpmLimit = rpmCount >= activeLimits.rpm - 2 && rpmCount < activeLimits.rpm;
  const isNearRpdLimit = rpdCount >= activeLimits.rpd - (activeLimits.rpd > 100 ? 50 : 5) && rpdCount < activeLimits.rpd;

  const isRpmExceeded = rpmCount >= activeLimits.rpm;
  const isRpdExceeded = rpdCount >= activeLimits.rpd;

  const sendAutoMessage = async (text: string, imageBase64: string) => {
    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    // Add user message to state
    setMessages(prev => [
      ...prev,
      {
        id: userMessageId,
        sender: 'user',
        text: 'Procesando captura de pantalla de Mercado Pago...',
        image: imageBase64,
        status: 'done'
      }
    ]);

    setIsSending(true);

    // Add assistant loading message
    setMessages(prev => [
      ...prev,
      {
        id: assistantMessageId,
        sender: 'assistant',
        status: 'loading'
      }
    ]);

    try {
      const { responseData, modelUsed } = await callGemini(text, imageBase64, selectedModel);

      const candidate = responseData?.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let modelResponseText = '';
      const functionCalls: any[] = [];
      for (const part of parts) {
        if (part.text) {
          modelResponseText += part.text;
        }
        if (part.functionCall) {
          functionCalls.push(part.functionCall);
        }
      }

      setMessages(prev => {
        const loadingIdx = prev.findIndex(msg => msg.id === assistantMessageId);
        if (loadingIdx === -1) return prev;

        const updated = [...prev];

        const mappedToolCalls = functionCalls.map((call, idx) => ({
          id: `${assistantMessageId}-${idx}`,
          name: call.name,
          args: call.args,
          status: 'pending' as const
        }));

        updated[loadingIdx] = {
          id: assistantMessageId,
          sender: 'assistant',
          status: 'done',
          modelUsed: GEMINI_MODELS.find(m => m.id === modelUsed)?.name || modelUsed,
          text: modelResponseText || (mappedToolCalls.length > 0 ? `He analizado tu captura de Mercado Pago y tengo las siguientes propuestas (${mappedToolCalls.length}):` : 'Extraje la información, pero no se reconoció una acción específica para guardar.'),
          toolCalls: mappedToolCalls.length > 0 ? mappedToolCalls : undefined
        };

        return updated;
      });

    } catch (err: any) {
      console.error(err);
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              status: 'error',
              text: err.message || 'Ocurrió un error inesperado al conectar con Google Gemini.'
            };
          }
          return msg;
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  const lastProcessedTriggerRef = useRef<number>(0);

  useEffect(() => {
    if (externalAITrigger && externalAITrigger.image && externalAITrigger.timestamp > lastProcessedTriggerRef.current) {
      lastProcessedTriggerRef.current = externalAITrigger.timestamp;

      if (!isOpen) {
        setIsOpen(true);
      }

      if (messages.length === 0) {
        setMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: `¡Hola, ${userName}! Soy ${assistantName}, tu asistente de compras con Google Gemini. Puedes pedirme que agregue artículos, registre pagos de servicios, actualice tus presupuestos o subas una foto de un recibo para escanearlo. ¿En qué te ayudo hoy?`
          }
        ]);
      }

      sendAutoMessage(externalAITrigger.text, externalAITrigger.image);
    }
  }, [externalAITrigger]);

  // Submit Text/Image message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRpmExceeded || isRpdExceeded) return;
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
      const parts = candidate?.content?.parts || [];

      let modelResponseText = '';
      const functionCalls: any[] = [];
      for (const part of parts) {
        if (part.text) {
          modelResponseText += part.text;
        }
        if (part.functionCall) {
          functionCalls.push(part.functionCall);
        }
      }

      setMessages(prev => {
        const loadingIdx = prev.findIndex(msg => msg.id === assistantMessageId);
        if (loadingIdx === -1) return prev;

        const updated = [...prev];

        const mappedToolCalls = functionCalls.map((call, idx) => ({
          id: `${assistantMessageId}-${idx}`,
          name: call.name,
          args: call.args,
          status: 'pending' as const
        }));

        updated[loadingIdx] = {
          id: assistantMessageId,
          sender: 'assistant',
          status: 'done',
          modelUsed: GEMINI_MODELS.find(m => m.id === modelUsed)?.name || modelUsed,
          text: modelResponseText || (mappedToolCalls.length > 0 ? `Tengo ${mappedToolCalls.length} propuestas para ti:` : 'Entendido. Si tienes alguna duda, dime.'),
          toolCalls: mappedToolCalls.length > 0 ? mappedToolCalls : undefined
        };

        return updated;
      });

    } catch (err: any) {
      console.error(err);
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              status: 'error',
              text: err.message || 'Ocurrió un error inesperado al conectar con Google Gemini.'
            };
          }
          return msg;
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  // Retry a failed message directly from the UI
  const handleRetryMessage = async (errorMessageId: string) => {
    const errorMsgIndex = messages.findIndex(m => m.id === errorMessageId);
    if (errorMsgIndex === -1) return;

    // Find the closest user prompt preceding the error
    let userMsg = null;
    for (let i = errorMsgIndex - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        userMsg = messages[i];
        break;
      }
    }

    if (!userMsg) return;

    // Change status back to loading and clear error text
    setMessages(prev =>
      prev.map(msg =>
        msg.id === errorMessageId
          ? { ...msg, status: 'loading', text: undefined }
          : msg
      )
    );

    setIsSending(true);

    try {
      const { responseData, modelUsed } = await callGemini(userMsg.text || '', userMsg.image || null, selectedModel);

      const candidate = responseData?.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let modelResponseText = '';
      const functionCalls: any[] = [];
      for (const part of parts) {
        if (part.text) {
          modelResponseText += part.text;
        }
        if (part.functionCall) {
          functionCalls.push(part.functionCall);
        }
      }

      setMessages(prev => {
        const errIdx = prev.findIndex(msg => msg.id === errorMessageId);
        if (errIdx === -1) return prev;

        const updated = [...prev];

        const mappedToolCalls = functionCalls.map((call, idx) => ({
          id: `${errorMessageId}-${idx}`,
          name: call.name,
          args: call.args,
          status: 'pending' as const
        }));

        updated[errIdx] = {
          id: errorMessageId,
          sender: 'assistant',
          status: 'done',
          modelUsed: GEMINI_MODELS.find(m => m.id === modelUsed)?.name || modelUsed,
          text: modelResponseText || (mappedToolCalls.length > 0 ? `Tengo ${mappedToolCalls.length} propuestas para ti:` : 'Entendido. Si tienes alguna duda, dime.'),
          toolCalls: mappedToolCalls.length > 0 ? mappedToolCalls : undefined
        };

        return updated;
      });

    } catch (err: any) {
      console.error(err);
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === errorMessageId) {
            return {
              ...msg,
              status: 'error',
              text: err.message || 'Ocurrió un error al reintentar la conexión.'
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
    // Sumar sobre el SNAPSHOT inicial (no sobre el pool derivado), porque onUpdateBudget escribe
    // el snapshot. Como pool = snapshot + ingresos − apartados, sumar amount al snapshot hace que
    // el pool suba exactamente amount, sin doble contar ingresos/apartados ya cargados (B6).
    const currentInitial = args.type === 'cash' ? initialCashBudget : initialCardBudget;
    onUpdateBudget(args.type, currentInitial + args.amount);
    return `Se añadieron $${args.amount} a tu presupuesto de ${args.type === 'cash' ? 'efectivo' : 'tarjeta'}.`;
  };

  const executeSetBudget = (args: { type: 'cash' | 'card'; amount: number }) => {
    // Semántica intencional: fija el "Presupuesto Inicial" (snapshot) del mes, igual que el campo
    // manual. El disponible se recalcula solo (snapshot + ingresos − apartados). Ver decisión en
    // PLAN_BUG_CALCULO.md. NO forzamos aquí un total exacto en vivo.
    onUpdateBudget(args.type, args.amount);
    return `Listo: dejé tu presupuesto INICIAL de ${args.type === 'cash' ? 'efectivo' : 'tarjeta'} en $${args.amount}. ` +
      `Eso es tu punto de partida del mes; tus ingresos y apartados ya cargados se suman y se restan aparte, ` +
      `así que el disponible que ves puede ser distinto a esa cifra.`;
  };

  // Hook SOLO para desarrollo/tests e2e. Gateado con import.meta.env.DEV: en `npm run build`
  // Vite reemplaza import.meta.env.DEV por `false` y Rollup elimina el bloque completo por
  // dead-code elimination — NO queda ningún rastro (ni el string "__spendwiseAI") en el bundle
  // de producción. Permite ejercitar los executores reales de los tools de presupuesto de la IA
  // sin pasar por Gemini, para blindar el fix de B6 (add_budget_funds suma sobre el snapshot).
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __spendwiseAI?: unknown }).__spendwiseAI = {
        budgetFunds: (type: 'cash' | 'card', amount: number) => executeBudgetFunds({ type, amount }),
        setBudget: (type: 'cash' | 'card', amount: number) => executeSetBudget({ type, amount })
      };
    }
  });

  const executeToggleItemBought = (args: { name: string }) => {
    if (!args || !args.name) return 'Por favor especifica el nombre del artículo.';
    const targetName = args.name.toLowerCase();
    const item = items.find(i => i.name.toLowerCase().includes(targetName));
    if (item) {
      onToggleBought(item.id);
      return `Se marcó '${item.name}' como ${!item.bought ? 'Comprado' : 'Pendiente'}.`;
    }
    return `No encontré ningún artículo que coincida con '${args.name}'.`;
  };

  const executeDeleteItem = (args: { name: string }) => {
    if (!args || !args.name) return 'Por favor especifica el nombre del artículo.';
    const targetName = args.name.toLowerCase();
    const item = items.find(i => i.name.toLowerCase().includes(targetName));
    if (item) {
      onDeleteItem(item.id);
      return `Se eliminó/archivó '${item.name}' correctamente.`;
    }
    return `No encontré ningún artículo para eliminar que coincida con '${args.name}'.`;
  };

  const executeDeleteServicePayment = (args: { service: string }) => {
    if (!args || !args.service) return 'Por favor especifica el nombre del servicio.';
    const targetName = args.service.toLowerCase();
    const payment = servicePayments.find(p => p.service.toLowerCase().includes(targetName));
    if (payment) {
      onDeleteServicePayment(payment.id);
      return `Se eliminó el pago de servicio de '${payment.service}' por $${payment.amount}.`;
    }
    return `No encontré ningún pago de servicio registrado para '${args.service}'.`;
  };

  const executeAddCategory = (args: { name: string }) => {
    if (!args || !args.name) return 'Por favor especifica el nombre de la categoría.';
    onAddCategory(args.name);
    return `Se creó la categoría personalizada '${args.name}'.`;
  };

  const executeAddPlace = (args: { name: string }) => {
    if (!args || !args.name) return 'Por favor especifica el nombre del establecimiento.';
    onAddPlace(args.name);
    return `Se registró '${args.name}' como establecimiento frecuente.`;
  };

  const executeAddServiceOption = (args: { name: string }) => {
    if (!args || !args.name) return 'Por favor especifica el nombre del servicio.';
    onAddServiceOption(args.name);
    return `Se añadió '${args.name}' como servicio frecuente.`;
  };

  const executeRestoreItem = (args: { name: string }) => {
    if (!args || !args.name) return 'Por favor especifica el nombre del artículo.';
    const targetName = args.name.toLowerCase();
    const item = archivedItems.find(i => i.name.toLowerCase().includes(targetName));
    if (item) {
      onRestoreItem(item.id);
      return `Se restauró '${item.name}' a la lista de compras activa.`;
    }
    return `No encontré ningún artículo en el historial/eliminados que coincida con '${args.name}'.`;
  };

  const executePurgeArchivedItem = (args: { name: string }) => {
    if (!args || !args.name) return 'Por favor especifica el nombre del artículo.';
    const targetName = args.name.toLowerCase();
    const item = archivedItems.find(i => i.name.toLowerCase().includes(targetName));
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

  const executeDeleteIncome = (args: { name: string }) => {
    if (!incomes || !onDeleteIncome) return 'La función de eliminar ingresos no está disponible en este momento.';
    if (!args || !args.name) return 'Por favor especifica el nombre del ingreso.';
    const targetName = args.name.toLowerCase();
    const target = incomes.find(inc => inc.name.toLowerCase().includes(targetName));
    if (target) {
      onDeleteIncome(target.id);
      return `Se eliminó el ingreso de '${target.name}' por un monto de $${target.amount}.`;
    }
    return `No encontré ningún ingreso registrado que coincida con '${args.name}'.`;
  };

  const executeDepositToApartado = (args: { name: string; amount: number }) => {
    if (!apartados || !onDepositToApartado) return 'La función de depositar a apartados no está disponible.';
    if (!args || !args.name) return 'Por favor especifica el nombre del apartado.';
    const targetName = args.name.toLowerCase();
    const target = apartados.find(a => a.name.toLowerCase().includes(targetName));
    if (target) {
      onDepositToApartado(target.id, args.amount);
      return `Se depositaron $${args.amount} en el apartado de ahorro '${target.name}'.`;
    }
    return `No encontré ningún apartado de ahorro que coincida con '${args.name}'.`;
  };

  const executeWithdrawFromApartado = (args: { name: string; amount: number }) => {
    if (!apartados || !onWithdrawFromApartado) return 'La función de retirar de apartados no está disponible.';
    if (!args || !args.name) return 'Por favor especifica el nombre del apartado.';
    const targetName = args.name.toLowerCase();
    const target = apartados.find(a => a.name.toLowerCase().includes(targetName));
    if (target) {
      onWithdrawFromApartado(target.id, args.amount);
      return `Se retiraron $${args.amount} del apartado de ahorro '${target.name}'.`;
    }
    return `No encontré ningún apartado de ahorro que coincida con '${args.name}'.`;
  };

  const executeDeleteApartado = (args: { name: string }) => {
    if (!apartados || !onDeleteApartado) return 'La función de eliminar apartados no está disponible.';
    if (!args || !args.name) return 'Por favor especifica el nombre del apartado.';
    const targetName = args.name.toLowerCase();
    const target = apartados.find(a => a.name.toLowerCase().includes(targetName));
    if (target) {
      onDeleteApartado(target.id);
      return `Se eliminó el apartado de ahorro '${target.name}' y sus fondos se regresaron al presupuesto libre.`;
    }
    return `No encontré ningún apartado de ahorro que coincida con '${args.name}'.`;
  };

  // Human-in-the-loop: Confirm or Reject Card Actions
  const handleConfirmTool = (messageId: string, toolCallId: string, customArgs: any) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    let targetToolCall = null;
    if (message.toolCalls) {
      targetToolCall = message.toolCalls.find(tc => tc.id === toolCallId);
    } else if (message.toolCall) {
      targetToolCall = message.toolCall;
    }

    if (!targetToolCall) return;

    let feedbackText = '';
    const toolName = targetToolCall.name;
    const finalArgs = customArgs || targetToolCall.args;

    try {
      if (toolName === 'add_item_proposed') {
        const itemData = {
          name: finalArgs.name,
          place: finalArgs.place || 'Otro lugar',
          price: Number(finalArgs.price) || 0,
          quantity: Number(finalArgs.quantity) || 1,
          category: finalArgs.category || 'otros',
          paymentMethod: (finalArgs.paymentMethod as PaymentMethod) || 'tarjeta',
          bought: !!finalArgs.bought,
          externalId: finalArgs.externalId || undefined,
          createdAt: finalArgs.createdAt || undefined
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
          paymentMethod: (finalArgs.paymentMethod as PaymentMethod) || 'tarjeta',
          isRecurring: finalArgs.isRecurring !== undefined ? !!finalArgs.isRecurring : undefined,
          recurringDay: finalArgs.recurringDay !== undefined ? Number(finalArgs.recurringDay) : undefined,
          externalId: finalArgs.externalId || undefined,
          createdAt: finalArgs.createdAt || undefined
        };
        onAddServicePayment(serviceData);
        feedbackText = `¡Servicio registrado! Se añadió el pago de '${serviceData.service}' por $${serviceData.amount.toFixed(2)}${serviceData.isRecurring ? ` (Recurrente el día ${serviceData.recurringDay})` : ''
          }.`;
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
        if (!finalArgs || !finalArgs.name) {
          feedbackText = 'Falta especificar el nombre del artículo a modificar.';
        } else {
          const targetName = finalArgs.name.toLowerCase();
          const item = items.find(i => i.name.toLowerCase().includes(targetName));
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
      else if (toolName === 'add_income_proposed') {
        const incomeData = {
          name: finalArgs.name,
          amount: Number(finalArgs.amount) || 0,
          paymentMethod: finalArgs.paymentMethod as 'efectivo' | 'tarjeta',
          externalId: finalArgs.externalId || undefined,
          createdAt: finalArgs.createdAt || undefined
        };
        if (onAddIncome) {
          onAddIncome(incomeData);
        }
        feedbackText = `¡Ingreso registrado! Se añadieron $${incomeData.amount.toFixed(2)} por concepto de '${incomeData.name}' a tu presupuesto de ${incomeData.paymentMethod}.`;
      }
      else if (toolName === 'delete_income_by_name') {
        feedbackText = executeDeleteIncome(finalArgs);
      }
      else if (toolName === 'reset_database_proposed') {
        feedbackText = executeResetDatabase();
      }
      else if (toolName === 'add_apartado_proposed') {
        const apartadoData = {
          name: finalArgs.name,
          amount: Number(finalArgs.amount) || 0,
          paymentMethod: finalArgs.paymentMethod as 'efectivo' | 'tarjeta'
        };
        if (onAddApartado) {
          onAddApartado(apartadoData.name, apartadoData.amount, apartadoData.paymentMethod);
        }
        feedbackText = `¡Apartado creado! Se reservaron $${apartadoData.amount.toFixed(2)} bajo el concepto '${apartadoData.name}' desde tu presupuesto de ${apartadoData.paymentMethod}.`;
      }
      else if (toolName === 'deposit_to_apartado_proposed') {
        feedbackText = executeDepositToApartado(finalArgs);
      }
      else if (toolName === 'withdraw_from_apartado_proposed') {
        feedbackText = executeWithdrawFromApartado(finalArgs);
      }
      else if (toolName === 'delete_apartado_proposed') {
        feedbackText = executeDeleteApartado(finalArgs);
      }

      // Mark tool as approved and update message feedback
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === messageId) {
            if (msg.toolCalls) {
              return {
                ...msg,
                toolCalls: msg.toolCalls.map(tc => {
                  if (tc.id === toolCallId) {
                    return {
                      ...tc,
                      status: 'approved',
                      args: finalArgs, // save final corrected parameters
                      feedbackText: feedbackText
                    };
                  }
                  return tc;
                })
              };
            } else if (msg.toolCall) {
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
          }
          return msg;
        })
      );

    } catch (e: any) {
      console.error(e);
      alert(`Error al ejecutar la acción: ${e.message}`);
    }
  };

  const handleRejectTool = (messageId: string, toolCallId: string) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          if (msg.toolCalls) {
            return {
              ...msg,
              toolCalls: msg.toolCalls.map(tc => {
                if (tc.id === toolCallId) {
                  return {
                    ...tc,
                    status: 'rejected'
                  };
                }
                return tc;
              })
            };
          } else if (msg.toolCall) {
            return {
              ...msg,
              text: 'Acción rechazada y cancelada por el usuario.',
              toolCall: {
                ...msg.toolCall,
                status: 'rejected'
              }
            };
          }
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
                  className={`p-1.5 rounded-lg border transition cursor-pointer ${showSettings
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
                    <div className="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-2xl p-6 border border-slate-800 space-y-4 shadow-md animate-in zoom-in duration-200" id="ai-key-guidance-card">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Sparkles className="w-5 h-5 fill-emerald-500/25 animate-pulse" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="font-black text-sm tracking-tight">🔑 Configuración Requerida</h3>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                          Para activar el Asistente de IA (conversar por voz y escanear fotos de tickets físicos), necesitamos una <strong>API Key de Google Gemini</strong>. Es una clave personal de cortesía 100% gratuita que Google te regala.
                        </p>
                      </div>

                      <div className="bg-slate-850/40 rounded-xl p-3 border border-slate-800/60 space-y-3">
                        <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider">Sigue estos sencillos pasos:</p>
                        <ol className="text-[11px] text-slate-350 space-y-2.5 font-bold list-decimal list-inside pl-0.5">
                          <li className="leading-normal">
                            Ingresa aquí: <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-350 underline inline-flex items-center gap-0.5 font-black cursor-pointer">
                              Google AI Studio <ArrowRight className="w-3.5 h-3.5 inline shrink-0" />
                            </a>
                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">(Inicia sesión con tu correo común de Gmail)</span>
                          </li>
                          <li className="leading-normal">
                            Presiona el botón azul que dice <span className="text-white font-black">"Create API Key"</span> (Crear Llave).
                          </li>
                          <li className="leading-normal">
                            Copia esa clave larga (ej. <span className="font-mono text-[10px] text-slate-400">AIzaSyD5x...</span>) y pégala en el recuadro blanco de abajo.
                          </li>
                        </ol>
                      </div>

                      <div className="text-[10px] text-slate-450 leading-relaxed font-semibold border-t border-slate-800/80 pt-3">
                        <p className="flex items-start gap-1.5 text-slate-400">
                          <span className="text-emerald-400 shrink-0 text-[11px]">🔒</span>
                          <span><strong>Seguridad Máxima:</strong> Tu clave no se guarda en internet. Queda grabada únicamente en la memoria de tu propio celular.</span>
                        </p>
                      </div>

                      <div className="border-t border-slate-800/85 pt-1">
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
                    </div>
                  )}

                  {/* Messages Feed */}
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>

                      {/* Text/Image Message Bubble */}
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs border ${msg.sender === 'user'
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
                          <div className={msg.sender === 'user' ? 'text-xs leading-relaxed whitespace-pre-wrap font-semibold' : ''}>
                            {msg.sender === 'user' ? msg.text : renderFormattedText(msg.text)}
                          </div>
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
                        <div className="flex flex-col gap-2 p-3 bg-rose-50 border border-rose-100/70 rounded-xl mt-1.5 max-w-[85%] text-[10px] text-rose-700 shadow-xs animate-in fade-in duration-200">
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span className="font-semibold leading-relaxed">{msg.text}</span>
                          </div>
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-rose-100/50">
                            {msg.text?.includes('🔑') && (
                              <button
                                type="button"
                                onClick={() => setShowSettings(true)}
                                className="px-2 py-0.5 bg-white hover:bg-rose-100/20 text-rose-700 border border-rose-200 rounded text-[9px] font-bold cursor-pointer transition active:scale-95"
                              >
                                Configurar API Key
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRetryMessage(msg.id)}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold cursor-pointer transition active:scale-95 flex items-center gap-0.5"
                            >
                              <RefreshCw className="w-2.5 h-2.5 shrink-0" /> Reintentar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SINGLE TOOLCALL (Backward Compatibility) */}
                      {msg.toolCall && msg.toolCall.status === 'pending' && (
                        <div className="w-full mt-2 select-none animate-in zoom-in duration-200">
                          <ConfirmationCard
                            key={`${msg.id}-${JSON.stringify(msg.toolCall.args)}`}
                            messageId={msg.id}
                            toolCallId="single"
                            toolName={msg.toolCall.name}
                            initialArgs={msg.toolCall.args}
                            onConfirm={(msgId, tcId, args) => handleConfirmTool(msgId, tcId, args)}
                            onReject={(msgId, tcId) => handleRejectTool(msgId, tcId)}
                            categories={categories}
                            items={items}
                            apartados={apartados}
                            servicePayments={servicePayments}
                            incomes={incomes}
                            monthlyHistory={monthlyHistory}
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

                      {/* MULTIPLE TOOLCALLS (Parallel Tool Calling) */}
                      {msg.toolCalls && msg.toolCalls.map((tc) => (
                        <div key={tc.id} className="w-full mt-2 select-none animate-in zoom-in duration-200">
                          {tc.status === 'pending' && (
                            <ConfirmationCard
                              key={`${tc.id}-${JSON.stringify(tc.args)}`}
                              messageId={msg.id}
                              toolCallId={tc.id}
                              toolName={tc.name}
                              initialArgs={tc.args}
                              onConfirm={handleConfirmTool}
                              onReject={handleRejectTool}
                              categories={categories}
                              items={items}
                              apartados={apartados}
                              servicePayments={servicePayments}
                              incomes={incomes}
                              monthlyHistory={monthlyHistory}
                            />
                          )}

                          {tc.status === 'approved' && (
                            <div className="flex flex-col gap-1 bg-emerald-50 p-2.5 border border-emerald-100 text-emerald-800 text-[11px] rounded-xl font-semibold select-none shadow-3xs">
                              <div className="flex items-center gap-1.5 font-extrabold text-emerald-900">
                                <Check className="w-4 h-4 stroke-[2.5] text-emerald-600" />
                                <span>Acción Aprobada y Guardada</span>
                              </div>
                              {tc.feedbackText && (
                                <p className="text-[10px] text-emerald-700 mt-0.5 leading-normal">
                                  {tc.feedbackText}
                                </p>
                              )}
                            </div>
                          )}

                          {tc.status === 'rejected' && (
                            <div className="flex flex-col gap-1 bg-slate-50 p-2.5 border border-slate-200 text-slate-500 text-[11px] rounded-xl font-semibold select-none shadow-3xs">
                              <div className="flex items-center gap-1.5 font-extrabold text-slate-700">
                                <X className="w-4 h-4 text-slate-500" />
                                <span>Cancelado</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                                Acción rechazada y cancelada por el usuario.
                              </p>
                            </div>
                          )}
                        </div>
                      ))}

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

                {/* Quota Exhaustion Alerts */}
                {isRpdExceeded && (
                  <div className="bg-rose-50 border border-rose-150/70 text-rose-700 rounded-xl p-3 text-[10px] leading-relaxed font-bold animate-in slide-in-from-bottom duration-200 shadow-3xs">
                    <div className="flex items-center gap-1.5 mb-1.5 text-rose-800 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 animate-pulse" />
                      <span>¡Límite Diario Agotado!</span>
                    </div>
                    <p className="font-semibold text-slate-600 mb-1.5">
                      La cuota diaria gratuita para el modelo <strong className="text-slate-900 bg-slate-100 px-1 rounded">{selectedModel}</strong> ({activeLimits.rpd} respuestas) ha finalizado.
                    </p>
                    <p className="font-normal text-slate-500">
                      Por favor, ve a <button type="button" onClick={() => setShowSettings(true)} className="text-rose-600 underline font-extrabold cursor-pointer hover:text-rose-800">Ajustes</button> y selecciona el modelo <strong>Gemini 2.5 Flash</strong> (que tiene 1,500 respuestas diarias gratuitas) o vuelve a intentar mañana.
                    </p>
                  </div>
                )}

                {!isRpdExceeded && isRpmExceeded && (
                  <div className="bg-rose-50 border border-rose-150/70 text-rose-700 rounded-xl p-3 text-[10px] leading-relaxed font-bold animate-in slide-in-from-bottom duration-200 shadow-3xs">
                    <div className="flex items-center gap-1.5 mb-1.5 text-rose-800 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 animate-bounce" />
                      <span>Límite de Velocidad Alcanzado</span>
                    </div>
                    <p className="font-semibold text-slate-600">
                      Has enviado demasiados mensajes seguidos (máximo {activeLimits.rpm} por minuto). Espera 45 segundos para que la API gratuita se libere y puedas continuar conversando.
                    </p>
                  </div>
                )}

                {!isRpdExceeded && !isRpmExceeded && isNearRpdLimit && (
                  <div className="bg-amber-50 border border-amber-150 text-amber-800 rounded-xl p-2.5 text-[10px] leading-relaxed font-bold animate-in fade-in duration-200">
                    ⚠️ <strong>¡Aviso de Cuota!</strong> Te quedan muy pocas respuestas hoy para este modelo ({activeLimits.rpd - rpdCount} de {activeLimits.rpd}). Puedes cambiar a un modelo Flash en Ajustes para seguir conversando de forma ilimitada.
                  </div>
                )}

                {!isRpdExceeded && !isRpmExceeded && !isNearRpdLimit && isNearRpmLimit && (
                  <div className="bg-amber-50 border border-amber-150 text-amber-800 rounded-xl p-2.5 text-[10px] leading-relaxed font-bold animate-in fade-in duration-200">
                    ⚠️ Has enviado comandos de forma continua. Espera unos segundos antes de mandar otro para evitar bloqueos temporales del servidor.
                  </div>
                )}

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
                    disabled={isRpmExceeded || isRpdExceeded}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:text-slate-350 disabled:cursor-not-allowed rounded-xl border border-slate-200 transition cursor-pointer"
                    title="Subir foto de ticket o recibo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*"
                    className="hidden"
                  />

                  {/* Microphone speech recognition button - Push-To-Talk */}
                  <button
                    type="button"
                    onMouseDown={startListening}
                    onMouseUp={stopListening}
                    onMouseLeave={stopListening}
                    onTouchStart={startListening}
                    onTouchEnd={stopListening}
                    disabled={isRpmExceeded || isRpdExceeded}
                    className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 select-none touch-none disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-350 ${isListening
                        ? 'bg-rose-500 border-rose-500 text-white animate-pulse shadow-md shadow-rose-200 scale-105'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border-slate-200'
                      }`}
                    title="Mantén presionado para hablar y suelta para enviar"
                  >
                    {isListening ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Main Input Text */}
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      isRpdExceeded 
                        ? "Cuota diaria agotada. Cambia de modelo..." 
                        : isRpmExceeded 
                          ? "Límite por minuto alcanzado. Espera..." 
                          : selectedImage 
                            ? "Pídele a Gemini que escanee el recibo..." 
                            : "Escribe tu comando natural... (ej: 'Compré leche de $30')"
                    }
                    className="flex-grow px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-450 placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSending || isRpmExceeded || isRpdExceeded}
                  />

                  {/* Send Action */}
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !selectedImage) || isSending || isRpmExceeded || isRpdExceeded}
                    className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-100 disabled:text-slate-400 rounded-xl transition cursor-pointer disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Quota usage badge */}
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 px-1 pt-1.5 border-t border-slate-50 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isRpmExceeded || isRpdExceeded ? 'bg-rose-500 animate-ping' : isNearRpmLimit || isNearRpdLimit ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'} shrink-0`} />
                    <span>Límites ({selectedModel.includes('pro') ? 'Pro' : 'Flash'}):</span>
                  </div>
                  <div className="flex gap-2">
                    <span className={isRpmExceeded ? 'text-rose-600 font-extrabold' : isNearRpmLimit ? 'text-amber-600 font-extrabold' : 'text-slate-500'}>
                      Minuto: {rpmCount}/{activeLimits.rpm}
                    </span>
                    <span className="text-slate-200">|</span>
                    <span className={isRpdExceeded ? 'text-rose-600 font-extrabold' : isNearRpdLimit ? 'text-amber-600 font-extrabold' : 'text-slate-500'}>
                      Día: {rpdCount}/{activeLimits.rpd}
                    </span>
                  </div>
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
  key?: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  initialArgs: any;
  categories: Category[];
  items: ShoppingItem[];
  apartados?: Apartado[];
  servicePayments?: ServicePayment[];
  incomes?: Income[];
  monthlyHistory?: MonthlyHistoryRecord[];
  onConfirm: (messageId: string, toolCallId: string, customArgs: any) => void;
  onReject: (messageId: string, toolCallId: string) => void;
}

function ConfirmationCard({
  messageId,
  toolCallId,
  toolName,
  initialArgs,
  categories,
  items,
  apartados = [],
  servicePayments = [],
  incomes = [],
  monthlyHistory = [],
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
      const hasTotalPrice = args.totalPrice !== undefined && Number(args.totalPrice) > 0;
      const totalPriceVal = hasTotalPrice ? Number(args.totalPrice) : 0;
      const itemCount = args.items.length || 1;
      const distributedPrice = hasTotalPrice ? Math.round((totalPriceVal / itemCount) * 100) / 100 : 0;

      args.items = args.items.map((item: any) => ({
        name: item.name || 'Producto',
        place: item.place || 'Supermercado',
        price: hasTotalPrice ? distributedPrice : (item.price !== undefined ? Number(item.price) : 0),
        quantity: item.quantity !== undefined ? Number(item.quantity) : 1,
        category: item.category || 'comida',
        paymentMethod: item.paymentMethod || 'tarjeta',
        bought: item.bought !== undefined ? !!item.bought : true
      }));

      // Store totalPrice mode flag for the confirmation card UI
      args.useTotalPrice = hasTotalPrice;
      args.totalPrice = hasTotalPrice ? totalPriceVal : undefined;
    }
    else if (toolName === 'add_service_proposed') {
      if (!args.service) args.service = 'Servicio';
      if (args.amount === undefined) args.amount = 0;
      if (!args.paymentMethod) args.paymentMethod = 'tarjeta';
      if (args.isRecurring === undefined) args.isRecurring = false;
      if (args.recurringDay === undefined) args.recurringDay = 10;
    }
    else if (toolName === 'add_income_proposed') {
      if (!args.name) args.name = 'Ingreso';
      if (args.amount === undefined) args.amount = 0;
      if (!args.paymentMethod) args.paymentMethod = ''; // let user choose
    }
    else if (toolName === 'add_apartado_proposed') {
      if (!args.name) args.name = 'Apartado';
      if (args.amount === undefined) args.amount = 0;
      if (!args.paymentMethod) args.paymentMethod = ''; // let user choose
    }
    else if (toolName === 'deposit_to_apartado_proposed' || toolName === 'withdraw_from_apartado_proposed') {
      if (args.name) {
        const match = (apartados || []).find((a: Apartado) => a.name.toLowerCase().includes(args.name.toLowerCase()));
        if (match) {
          args.name = match.name;
        }
      } else {
        args.name = '';
      }
      if (args.amount === undefined) args.amount = 0;
    }
    else if (toolName === 'delete_apartado_proposed') {
      if (args.name) {
        const match = (apartados || []).find((a: Apartado) => a.name.toLowerCase().includes(args.name.toLowerCase()));
        if (match) {
          args.name = match.name;
        }
      } else {
        args.name = '';
      }
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

  // Build the duplicate index once per render
  const dupIndex = React.useMemo(() => {
    return buildDuplicateIndex(items, servicePayments, incomes || [], monthlyHistory || []);
  }, [items, servicePayments, incomes, monthlyHistory]);

  const checkDuplicate = () => {
    let name = '';
    let amount = 0;
    if (toolName === 'add_item_proposed') {
      name = editedArgs.name || '';
      amount = Number(editedArgs.price) * (Number(editedArgs.quantity) || 1);
    } else if (toolName === 'add_service_proposed') {
      name = editedArgs.service || '';
      amount = Number(editedArgs.amount) || 0;
    } else if (toolName === 'add_income_proposed') {
      name = editedArgs.name || '';
      amount = Number(editedArgs.amount) || 0;
    } else {
      return null;
    }

    if (!name || !amount) return null;

    return checkDuplicateTransaction({
      name,
      amount,
      date: editedArgs.createdAt || new Date(),
      externalId: editedArgs.externalId
    }, dupIndex);
  };

  const duplicateStatus = checkDuplicate();

  // Checks validation of payment method before saving
  const handleValidateConfirm = () => {
    if (toolName === 'add_item_proposed') {
      if (!editedArgs.paymentMethod) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, toolCallId, editedArgs);
    }
    else if (toolName === 'add_multiple_items_proposed') {
      const itemsList = editedArgs.items as any[];
      const missing = itemsList.some(item => !item.paymentMethod);
      if (missing) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, toolCallId, editedArgs);
    }
    else if (toolName === 'add_service_proposed') {
      if (!editedArgs.paymentMethod) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, toolCallId, editedArgs);
    }
    else if (toolName === 'update_item_proposed') {
      if (!editedArgs.paymentMethod) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, toolCallId, editedArgs);
    }
    else if (toolName === 'add_income_proposed') {
      if (!editedArgs.paymentMethod) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, toolCallId, editedArgs);
    }
    else if (toolName === 'add_apartado_proposed') {
      if (!editedArgs.paymentMethod) {
        setPaymentMethodMissing(true);
        return;
      }
      onConfirm(messageId, toolCallId, editedArgs);
    }
    else {
      onConfirm(messageId, toolCallId, editedArgs);
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
                className={`w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer ${paymentMethodMissing && !editedArgs.paymentMethod
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
                className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${editedArgs.bought
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
            onClick={() => onReject(messageId, toolCallId)}
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
                className={`w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer ${paymentMethodMissing && !editedArgs.paymentMethod
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
                className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${editedArgs.bought
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

          {/* Optional custom date and external ID fields */}
          {(editedArgs.createdAt || editedArgs.externalId) && (
            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100/60 animate-in fade-in duration-200">
              {editedArgs.createdAt && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Operación</label>
                  <input
                    type="date"
                    value={editedArgs.createdAt.slice(0, 10)}
                    onChange={(e) => handleFieldChange('createdAt', e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              )}
              {editedArgs.externalId && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ID Transacción</label>
                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-500 truncate" title={editedArgs.externalId}>
                    {editedArgs.externalId}
                  </div>
                </div>
              )}
            </div>
          )}

          {duplicateStatus && (
            <div className={`p-3 rounded-xl border text-[11px] leading-relaxed font-semibold flex items-start gap-2 animate-in slide-in-from-bottom-2 duration-200 ${
              duplicateStatus.type === 'exact' 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-orange-50 border-orange-200 text-orange-850'
            }`}>
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                duplicateStatus.type === 'exact' ? 'text-rose-500' : 'text-orange-500'
              }`} />
              <div>
                <p className={`font-extrabold ${duplicateStatus.type === 'exact' ? 'text-rose-900' : 'text-orange-900'}`}>
                  {duplicateStatus.type === 'exact' ? 'Duplicado Exacto Detectado' : 'Posible Duplicado Detectado'}
                </p>
                <p className="mt-0.5 text-[10px]">
                  {duplicateStatus.type === 'exact' 
                    ? `Esta transacción ya se encuentra registrada en la base de datos (ID: ${editedArgs.externalId}).`
                    : `Existe un registro similar en la misma fecha y monto: ${duplicateStatus.details}`
                  }
                </p>
              </div>
            </div>
          )}

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
            onClick={() => onReject(messageId, toolCallId)}
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
      setEditedArgs((prev: any) => {
        const newItems = prev.items.filter((_: any, i: number) => i !== index);
        // Redistribute total if in totalPrice mode
        if (prev.useTotalPrice && prev.totalPrice && newItems.length > 0) {
          const distributed = Math.round((Number(prev.totalPrice) / newItems.length) * 100) / 100;
          return { ...prev, items: newItems.map((i: any) => ({ ...i, price: distributed })) };
        }
        return { ...prev, items: newItems };
      });
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

    const handleTotalPriceChange = (newTotal: number) => {
      setEditedArgs((prev: any) => {
        const count = prev.items.length || 1;
        const distributed = Math.round((newTotal / count) * 100) / 100;
        return {
          ...prev,
          totalPrice: newTotal,
          items: prev.items.map((i: any) => ({ ...i, price: distributed }))
        };
      });
    };

    const handleToggleTotalPriceMode = () => {
      setEditedArgs((prev: any) => {
        if (prev.useTotalPrice) {
          // Switching OFF total mode → keep distributed prices as individual prices
          return { ...prev, useTotalPrice: false, totalPrice: undefined };
        } else {
          // Switching ON total mode → sum current individual prices as the total
          const currentSum = prev.items.reduce((acc: number, i: any) => acc + (Number(i.price) * Number(i.quantity || 1)), 0);
          const count = prev.items.length || 1;
          const distributed = Math.round((currentSum / count) * 100) / 100;
          return {
            ...prev,
            useTotalPrice: true,
            totalPrice: Math.round(currentSum * 100) / 100,
            items: prev.items.map((i: any) => ({ ...i, price: distributed }))
          };
        }
      });
    };

    const list = editedArgs.items as any[];
    const storeName = list[0]?.place || 'Supermercado';
    const isTotalMode = !!editedArgs.useTotalPrice;
    const totalAmount = isTotalMode
      ? Number(editedArgs.totalPrice) || 0
      : list.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity || 1)), 0);

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[98%] mx-auto">

        {/* Bulk Header details */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-purple-600" />
            <span className="font-extrabold text-xs text-slate-800">Recibo en {storeName}</span>
          </div>
          {isTotalMode ? (
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-slate-500">Total: $</span>
              <input
                type="number"
                step="0.01"
                value={editedArgs.totalPrice}
                onChange={(e) => handleTotalPriceChange(parseFloat(e.target.value) || 0)}
                className="w-20 px-1.5 py-0.5 bg-purple-50 border border-purple-200 rounded-md text-[11px] font-extrabold text-purple-800 text-right focus:outline-none focus:border-purple-400"
              />
            </div>
          ) : (
            <span className="text-[11px] font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
              Total: ${totalAmount.toFixed(2)}
            </span>
          )}
        </div>

        {/* Total Price Mode Toggle */}
        <div className="flex items-center justify-between bg-purple-50/60 px-3 py-2 rounded-xl border border-purple-100/80">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">Modo de precio</span>
            <span className="text-[10px] text-purple-600 font-medium">
              {isTotalMode ? 'Un solo total → se reparte entre todos' : 'Cada artículo tiene su precio'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleTotalPriceMode}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${isTotalMode
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
          >
            {isTotalMode ? (
              <><Coins className="w-3.5 h-3.5" /> Total General</>
            ) : (
              <><CreditCard className="w-3.5 h-3.5" /> Por Artículo</>
            )}
          </button>
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
                className={`flex-grow py-1 border text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${list.every(i => i.bought)
                    ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                Comprado
              </button>
              <button
                type="button"
                onClick={() => handleBulkBoughtChange(false)}
                className={`flex-grow py-1 border text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${list.every(i => !i.bought)
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
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
          {list.map((item, idx) => {
            const itemCheck = checkDuplicateTransaction({
              name: item.name || '',
              amount: Number(item.price) * (Number(item.quantity) || 1),
              date: editedArgs.createdAt || new Date(),
              externalId: item.externalId
            }, dupIndex);

            return (
              <div key={idx} className={`p-3 border rounded-xl relative space-y-2 group transition-all duration-200 ${
                itemCheck 
                  ? itemCheck.type === 'exact' 
                    ? 'bg-rose-50/45 border-rose-250 hover:border-rose-350' 
                    : 'bg-orange-50/45 border-orange-250 hover:border-orange-350'
                  : 'bg-slate-50/70 border-slate-100 hover:border-slate-200'
              }`}>
                {/* Delete item button */}
                <button
                  type="button"
                  onClick={() => handleDeleteItemFromList(idx)}
                  className="absolute top-2 right-2 p-1 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 hover:border-rose-100 transition cursor-pointer z-10"
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
                <div className={`grid gap-1.5 items-end ${isTotalMode ? 'grid-cols-3' : 'grid-cols-4'}`}>
                  {/* Price — only show in individual mode */}
                  {!isTotalMode && (
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
                  )}
                  {/* In total mode, show the distributed portion (read-only) */}
                  {isTotalMode && (
                    <div className="col-span-1">
                      <label className="block text-[8px] font-bold text-purple-400 uppercase tracking-wider mb-0.5">Porción ($)</label>
                      <div className="w-full px-1.5 py-0.5 bg-purple-50 border border-purple-100 rounded text-[10px] text-purple-700 font-bold">
                        ${Number(item.price).toFixed(2)}
                      </div>
                    </div>
                  )}
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
                  <div className="col-span-1">
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
                      className={`px-1.5 py-0.5 bg-white border rounded text-[10px] text-slate-700 font-semibold cursor-pointer ${paymentMethodMissing && !item.paymentMethod
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
                    className={`px-2 py-0.5 rounded border text-[9px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors ${item.bought
                        ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                        : 'bg-amber-50 border-amber-250 text-amber-700'
                      }`}
                  >
                    <span>{item.bought ? 'Comprado' : 'Pendiente'}</span>
                  </button>
                </div>

                {/* Inline Duplicate Warning Badge */}
                {itemCheck && (
                  <div className={`mt-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] leading-snug font-semibold flex items-start gap-1.5 ${
                    itemCheck.type === 'exact' 
                      ? 'bg-rose-50 border-rose-100 text-rose-800 animate-in slide-in-from-bottom-1 duration-150' 
                      : 'bg-orange-50 border-orange-100 text-orange-850 animate-in slide-in-from-bottom-1 duration-150'
                  }`}>
                    <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      itemCheck.type === 'exact' ? 'text-rose-500' : 'text-orange-500'
                    }`} />
                    <div>
                      <span className="font-extrabold">
                        {itemCheck.type === 'exact' ? 'Duplicado Exacto' : 'Posible Duplicado'}:
                      </span>{' '}
                      <span>{itemCheck.type === 'exact' ? 'Ya registrado en la base de datos.' : `Similar a ${itemCheck.details}`}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
            onClick={() => onReject(messageId, toolCallId)}
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
                className={`w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer ${paymentMethodMissing && !editedArgs.paymentMethod
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

          {/* Recurrence Selector */}
          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100/60">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pago Recurrente</label>
              <button
                type="button"
                onClick={() => handleFieldChange('isRecurring', !editedArgs.isRecurring)}
                className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${editedArgs.isRecurring
                    ? 'bg-indigo-50 border-indigo-250 text-indigo-700'
                    : 'bg-slate-50 border-slate-250 text-slate-700'
                  }`}
              >
                <span>{editedArgs.isRecurring ? '🔁 Sí, Mensual' : 'Cobro Único'}</span>
                {editedArgs.isRecurring ? (
                  <ToggleRight className="w-5 h-5 text-indigo-600" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-500" />
                )}
              </button>
            </div>
            {editedArgs.isRecurring && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Día del mes (1-31)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editedArgs.recurringDay}
                  onChange={(e) => handleFieldChange('recurringDay', Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-bold focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Optional custom date and external ID fields */}
          {(editedArgs.createdAt || editedArgs.externalId) && (
            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100/60 animate-in fade-in duration-200">
              {editedArgs.createdAt && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Operación</label>
                  <input
                    type="date"
                    value={editedArgs.createdAt.slice(0, 10)}
                    onChange={(e) => handleFieldChange('createdAt', e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              )}
              {editedArgs.externalId && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ID Transacción</label>
                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-500 truncate" title={editedArgs.externalId}>
                    {editedArgs.externalId}
                  </div>
                </div>
              )}
            </div>
          )}

          {duplicateStatus && (
            <div className={`p-3 rounded-xl border text-[11px] leading-relaxed font-semibold flex items-start gap-2 animate-in slide-in-from-bottom-2 duration-200 ${
              duplicateStatus.type === 'exact' 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-orange-50 border-orange-200 text-orange-855'
            }`}>
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                duplicateStatus.type === 'exact' ? 'text-rose-500' : 'text-orange-500'
              }`} />
              <div>
                <p className={`font-extrabold ${duplicateStatus.type === 'exact' ? 'text-rose-900' : 'text-orange-900'}`}>
                  {duplicateStatus.type === 'exact' ? 'Duplicado Exacto Detectado' : 'Posible Duplicado Detectado'}
                </p>
                <p className="mt-0.5 text-[10px]">
                  {duplicateStatus.type === 'exact' 
                    ? `Esta transacción ya se encuentra registrada en la base de datos (ID: ${editedArgs.externalId}).`
                    : `Existe un registro similar en la misma fecha y monto: ${duplicateStatus.details}`
                  }
                </p>
              </div>
            </div>
          )}

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
            onClick={() => onReject(messageId, toolCallId)}
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

  // 3.5 ADD INCOME CARD PROPOSED BY AI
  if (toolName === 'add_income_proposed') {
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
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[95%] mx-auto animate-in zoom-in duration-200">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <Coins className="w-4 h-4 text-emerald-500" />
          <span className="font-bold text-xs text-slate-800">Confirmar Registro de Ingreso</span>
        </div>

        <div className="space-y-3">
          {/* Income Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Concepto / Nombre</label>
            <input
              type="text"
              value={editedArgs.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Amount */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto ($)</label>
              <input
                type="number"
                step="0.01"
                value={editedArgs.amount || 0}
                onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-850 focus:outline-none font-bold"
              />
            </div>
            {/* Payment Method */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Destino de Fondos</label>
              <select
                value={editedArgs.paymentMethod || ''}
                onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                className={`w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer ${paymentMethodMissing && !editedArgs.paymentMethod
                    ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-200'
                    : 'border-slate-200'
                  }`}
              >
                <option value="">-- Elige --</option>
                <option value="efectivo">💵 Efectivo</option>
                <option value="tarjeta">💳 Tarjeta</option>
              </select>
            </div>
          </div>

          {/* Optional custom date and external ID fields */}
          {(editedArgs.createdAt || editedArgs.externalId) && (
            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100/60 animate-in fade-in duration-200">
              {editedArgs.createdAt && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Operación</label>
                  <input
                    type="date"
                    value={editedArgs.createdAt.slice(0, 10)}
                    onChange={(e) => handleFieldChange('createdAt', e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              )}
              {editedArgs.externalId && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ID Transacción</label>
                  <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-500 truncate" title={editedArgs.externalId}>
                    {editedArgs.externalId}
                  </div>
                </div>
              )}
            </div>
          )}

          {duplicateStatus && (
            <div className={`p-3 rounded-xl border text-[11px] leading-relaxed font-semibold flex items-start gap-2 animate-in slide-in-from-bottom-2 duration-200 ${
              duplicateStatus.type === 'exact' 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-orange-50 border-orange-200 text-orange-855'
            }`}>
              <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                duplicateStatus.type === 'exact' ? 'text-rose-500' : 'text-orange-500'
              }`} />
              <div>
                <p className={`font-extrabold ${duplicateStatus.type === 'exact' ? 'text-rose-900' : 'text-orange-900'}`}>
                  {duplicateStatus.type === 'exact' ? 'Duplicado Exacto Detectado' : 'Posible Duplicado Detectado'}
                </p>
                <p className="mt-0.5 text-[10px]">
                  {duplicateStatus.type === 'exact' 
                    ? `Esta transacción ya se encuentra registrada en la base de datos (ID: ${editedArgs.externalId}).`
                    : `Existe un registro similar en la misma fecha y monto: ${duplicateStatus.details}`
                  }
                </p>
              </div>
            </div>
          )}

          {paymentMethodMissing && !editedArgs.paymentMethod && (
            <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Por favor selecciona dónde deseas registrar este dinero.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => onReject(messageId, toolCallId)}
            className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Rechazar
          </button>
          <button
            onClick={handleValidateConfirm}
            className="flex-grow py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
          >
            Registrar Ingreso
          </button>
        </div>
      </div>
    );
  }

  // 3.6 ADD APARTADO CARD PROPOSED BY AI
  if (toolName === 'add_apartado_proposed') {
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
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[95%] mx-auto animate-in zoom-in duration-200">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <Coins className="w-4 h-4 text-indigo-500" />
          <span className="font-bold text-xs text-slate-800">Confirmar Creación de Apartado</span>
        </div>

        <div className="space-y-3">
          {/* Apartado Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre / Concepto del Apartado</label>
            <input
              type="text"
              value={editedArgs.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Amount */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto inicial ($)</label>
              <input
                type="number"
                step="0.01"
                value={editedArgs.amount || 0}
                onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-850 focus:outline-none font-bold"
              />
            </div>
            {/* Payment Method / Origen */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Origen de Fondos</label>
              <select
                value={editedArgs.paymentMethod || ''}
                onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                className={`w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer ${paymentMethodMissing && !editedArgs.paymentMethod
                    ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-200'
                    : 'border-slate-200'
                  }`}
              >
                <option value="">-- Elige --</option>
                <option value="efectivo">💵 Efectivo</option>
                <option value="tarjeta">💳 Tarjeta</option>
              </select>
            </div>
          </div>

          {paymentMethodMissing && !editedArgs.paymentMethod && (
            <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Por favor selecciona el origen de fondos para este apartado.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => onReject(messageId, toolCallId)}
            className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Rechazar
          </button>
          <button
            onClick={handleValidateConfirm}
            className="flex-grow py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
          >
            Crear Apartado
          </button>
        </div>
      </div>
    );
  }

  // 3.7 DEPOSIT TO APARTADO CARD
  if (toolName === 'deposit_to_apartado_proposed') {
    const handleFieldChange = (field: string, value: any) => {
      setEditedArgs((prev: any) => ({
        ...prev,
        [field]: value
      }));
    };

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[95%] mx-auto animate-in zoom-in duration-200">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <Coins className="w-4 h-4 text-emerald-500" />
          <span className="font-bold text-xs text-slate-800">Confirmar Depósito a Apartado</span>
        </div>

        <div className="space-y-3">
          {/* Select Apartado */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Apartado Destino</label>
            <select
              value={editedArgs.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">-- Selecciona --</option>
              {apartados.map(a => (
                <option key={a.id} value={a.name}>
                  {a.name} (${a.amount.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto a Depositar ($)</label>
            <input
              type="number"
              step="0.01"
              value={editedArgs.amount || 0}
              onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-850 focus:outline-none font-bold"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => onReject(messageId, toolCallId)}
            className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Rechazar
          </button>
          <button
            onClick={handleValidateConfirm}
            disabled={!editedArgs.name || editedArgs.amount <= 0}
            className="flex-grow py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Depositar
          </button>
        </div>
      </div>
    );
  }

  // 3.8 WITHDRAW FROM APARTADO CARD
  if (toolName === 'withdraw_from_apartado_proposed') {
    const handleFieldChange = (field: string, value: any) => {
      setEditedArgs((prev: any) => ({
        ...prev,
        [field]: value
      }));
    };

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[95%] mx-auto animate-in zoom-in duration-200">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <Coins className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-xs text-slate-800">Confirmar Retiro de Apartado</span>
        </div>

        <div className="space-y-3">
          {/* Select Apartado */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Apartado de Origen</label>
            <select
              value={editedArgs.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">-- Selecciona --</option>
              {apartados.map(a => (
                <option key={a.id} value={a.name}>
                  {a.name} (${a.amount.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto a Retirar ($)</label>
            <input
              type="number"
              step="0.01"
              value={editedArgs.amount || 0}
              onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-850 focus:outline-none font-bold"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => onReject(messageId, toolCallId)}
            className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-655 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Rechazar
          </button>
          <button
            onClick={handleValidateConfirm}
            disabled={!editedArgs.name || editedArgs.amount <= 0}
            className="flex-grow py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Retirar Fondos
          </button>
        </div>
      </div>
    );
  }

  // 3.9 DELETE APARTADO CARD
  if (toolName === 'delete_apartado_proposed') {
    const handleFieldChange = (field: string, value: any) => {
      setEditedArgs((prev: any) => ({
        ...prev,
        [field]: value
      }));
    };

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 max-w-[95%] mx-auto animate-in zoom-in duration-200">
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <Trash2 className="w-4 h-4 text-rose-500" />
          <span className="font-bold text-xs text-rose-700">¿Eliminar Apartado de Ahorro?</span>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
            Se eliminará por completo el apartado de ahorro y <strong>todos sus fondos resguardados se regresarán a tu saldo libre disponible</strong>.
          </p>

          {/* Select Apartado */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Apartado a Eliminar</label>
            <select
              value={editedArgs.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">-- Selecciona --</option>
              {apartados.map(a => (
                <option key={a.id} value={a.name}>
                  {a.name} (${a.amount.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => onReject(messageId, toolCallId)}
            className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleValidateConfirm}
            disabled={!editedArgs.name}
            className="flex-grow py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Eliminar Apartado
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
          onClick={() => onReject(messageId, toolCallId)}
          className="flex-grow py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition"
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(messageId, toolCallId, editedArgs)}
          className="flex-grow py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
        >
          Confirmar Cambio
        </button>
      </div>
    </div>
  );
}
