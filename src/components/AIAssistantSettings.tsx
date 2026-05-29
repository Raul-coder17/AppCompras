/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings, Eye, EyeOff, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface AIAssistantSettingsProps {
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  autoFailover: boolean;
  onToggleFailover: (value: boolean) => void;
  assistantName: string;
  onSaveAssistantName: (name: string) => void;
  onClose?: () => void;
}

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recomendado)', description: 'Último modelo, súper rápido y multimodal' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Rápido, excelente para tareas generales' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Ligero y balanceado, ideal para OCR' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Razonamiento complejo (más lento)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Alta capacidad analítica y de contexto' }
];

export default function AIAssistantSettings({
  apiKey,
  onSaveApiKey,
  selectedModel,
  onSelectModel,
  autoFailover,
  onToggleFailover,
  assistantName,
  onSaveAssistantName,
  onClose
}: AIAssistantSettingsProps) {
  const [nameInput, setNameInput] = useState(assistantName);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSave = () => {
    onSaveApiKey(keyInput.trim());
    setTestStatus('idle');
  };

  const handleTestConnection = async () => {
    if (!keyInput.trim()) {
      setTestStatus('error');
      setErrorMessage('Por favor ingresa una API Key antes de realizar la prueba.');
      return;
    }

    setTestStatus('testing');
    setErrorMessage('');

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${keyInput.trim()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Di únicamente: ¡Conexión exitosa!' }] }]
          })
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setTestStatus('success');
      } else {
        throw new Error('Respuesta vacía o inesperada de Gemini.');
      }
    } catch (error: any) {
      console.error('Error al probar conexión:', error);
      setTestStatus('error');
      setErrorMessage(error.message || 'Error de red o API Key inválida.');
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in slide-in-from-top duration-200">
      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-700" />
          <h3 className="font-bold text-slate-800 text-sm">Configuración del Asistente</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            Cerrar
          </button>
        )}
      </div>

      {/* Assistant Custom Name */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-600 tracking-wide uppercase">
          Nombre del Asistente
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Ej: Timmy"
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-slate-450 focus:ring-1 focus:ring-slate-300"
          />
          <button
            onClick={() => onSaveAssistantName(nameInput.trim() || 'Asistente Gemini IA')}
            disabled={nameInput.trim() === assistantName}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${nameInput.trim() === assistantName
                ? 'bg-slate-100 text-slate-400 border border-transparent cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white border border-transparent animate-in zoom-in duration-200'
              }`}
          >
            Guardar
          </button>
        </div>
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-600 tracking-wide uppercase">
          Google Gemini API Key
        </label>
        <div className="relative flex gap-2">
          <div className="relative flex-grow">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:border-slate-450 focus:ring-1 focus:ring-slate-300"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={keyInput.trim() === apiKey}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${keyInput.trim() === apiKey
                ? 'bg-slate-100 text-slate-400 border border-transparent cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white border border-transparent'
              }`}
          >
            Guardar
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-normal">
          Tu API Key se almacena localmente de forma segura en tu navegador y nunca se transmite a ningún servidor de terceros.
        </p>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-600 tracking-wide uppercase">
          Modelo Principal
        </label>
        <select
          value={selectedModel}
          onChange={(e) => onSelectModel(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-slate-450 cursor-pointer"
        >
          {GEMINI_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-slate-400 leading-normal">
          {GEMINI_MODELS.find((m) => m.id === selectedModel)?.description}
        </p>
      </div>

      {/* Auto Failover Rotation Switch */}
      <div className="flex items-start justify-between bg-slate-50 p-3 rounded-xl gap-3 border border-slate-100">
        <div className="space-y-0.5">
          <span className="block text-xs font-bold text-slate-700">Failover Automático (Alternar)</span>
          <span className="block text-[10px] text-slate-400 leading-snug">
            Si el modelo principal falla o se satura, el asistente intentará los otros modelos de forma automática.
          </span>
        </div>
        <button
          onClick={() => onToggleFailover(!autoFailover)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoFailover ? 'bg-emerald-500' : 'bg-slate-200'
            }`}
          role="switch"
          aria-checked={autoFailover}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${autoFailover ? 'translate-x-4' : 'translate-x-0'
              }`}
          />
        </button>
      </div>

      {/* Test Connection Button */}
      <div className="border-t border-slate-50 pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testStatus === 'testing' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Probar Conexión
          </button>

          {testStatus === 'success' && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              <Check className="w-3.5 h-3.5" />
              ¡Conexión exitosa!
            </span>
          )}
        </div>

        {testStatus === 'error' && (
          <div className="flex items-start gap-1.5 p-3 rounded-lg bg-rose-50 border border-rose-100 text-[10px] text-rose-600 leading-normal">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
