/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  HandCoins, 
  PiggyBank, 
  Edit2, 
  Check, 
  X 
} from 'lucide-react';
import { BudgetSummary, Apartado } from '../types';

interface BudgetCardProps {
  summary: BudgetSummary;
  onUpdateBudget: (type: 'cash' | 'card', newBudget: number) => void;
  onOpenCloseWizard: () => void;
  totalIncomesCash?: number;
  totalIncomesCard?: number;
  apartados?: Apartado[];
  onAddApartado?: (name: string, amount: number, paymentMethod: 'efectivo' | 'tarjeta') => void;
  onDepositToApartado?: (id: string, amount: number) => void;
  onWithdrawFromApartado?: (id: string, amount: number) => void;
  onDeleteApartado?: (id: string) => void;
}

export default function BudgetCard({ 
  summary, 
  onUpdateBudget,
  onOpenCloseWizard,
  totalIncomesCash = 0,
  totalIncomesCard = 0,
  apartados = [],
  onAddApartado,
  onDepositToApartado,
  onWithdrawFromApartado,
  onDeleteApartado
}: BudgetCardProps) {
  const { totalBudget, spent, planned, remaining, cashBudget, cardBudget, cashSpent, cashPlanned, cardSpent, cardPlanned } = summary;
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [tempCashBudget, setTempCashBudget] = useState(cashBudget.toString());
  const [tempCardBudget, setTempCardBudget] = useState(cardBudget.toString());
  const [addCashAmount, setAddCashAmount] = useState('');
  const [addCardAmount, setAddCardAmount] = useState('');

  // Apartados interactive states
  const [showAddApartadoType, setShowAddApartadoType] = useState<'cash' | 'card' | null>(null);
  const [newApName, setNewApName] = useState('');
  const [newApAmount, setNewApAmount] = useState('');
  const [activeApActionId, setActiveApActionId] = useState<string | null>(null);
  const [apActionType, setApActionType] = useState<'deposit' | 'withdraw' | null>(null);
  const [apActionAmount, setApActionAmount] = useState('');

  useEffect(() => {
    if (!isEditingCash) {
      setTempCashBudget(cashBudget.toString());
    }
  }, [cashBudget, isEditingCash]);

  useEffect(() => {
    if (!isEditingCard) {
      setTempCardBudget(cardBudget.toString());
    }
  }, [cardBudget, isEditingCard]);

  const handleSaveCash = () => {
    const value = parseFloat(tempCashBudget);
    if (!isNaN(value) && value >= 0) {
      onUpdateBudget('cash', value);
      setIsEditingCash(false);
    }
  };

  const handleSaveCard = () => {
    const value = parseFloat(tempCardBudget);
    if (!isNaN(value) && value >= 0) {
      onUpdateBudget('card', value);
      setIsEditingCard(false);
    }
  };

  const handleAddCash = () => {
    const value = parseFloat(addCashAmount);
    if (isNaN(value) || value <= 0) return;
    onUpdateBudget('cash', cashBudget + value);
    setAddCashAmount('');
  };

  const handleAddCard = () => {
    const value = parseFloat(addCardAmount);
    if (isNaN(value) || value <= 0) return;
    onUpdateBudget('card', cardBudget + value);
    setAddCardAmount('');
  };

  const handleCreateApartado = (type: 'cash' | 'card') => {
    const amount = parseFloat(newApAmount);
    if (!newApName.trim() || isNaN(amount) || amount <= 0) return;
    
    // Check limit
    const available = type === 'cash' ? cashBudget : cardBudget;
    if (amount > available) {
      alert('Presupuesto disponible insuficiente para apartar esta cantidad.');
      return;
    }

    if (onAddApartado) {
      onAddApartado(newApName, amount, type === 'cash' ? 'efectivo' : 'tarjeta');
    }
    setNewApName('');
    setNewApAmount('');
    setShowAddApartadoType(null);
  };

  const handleApActionSubmit = (id: string, currentAmount: number, method: 'efectivo' | 'tarjeta') => {
    const amount = parseFloat(apActionAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (apActionType === 'deposit') {
      const available = method === 'efectivo' ? cashBudget : cardBudget;
      if (amount > available) {
        alert('Presupuesto disponible insuficiente.');
        return;
      }
      if (onDepositToApartado) onDepositToApartado(id, amount);
    } else if (apActionType === 'withdraw') {
      if (amount > currentAmount) {
        alert('No tienes suficientes fondos en este apartado.');
        return;
      }
      if (onWithdrawFromApartado) onWithdrawFromApartado(id, amount);
    }

    setActiveApActionId(null);
    setApActionType(null);
    setApActionAmount('');
  };

  const renderApartadosSection = (type: 'cash' | 'card') => {
    const list = apartados.filter(a => a.paymentMethod === (type === 'cash' ? 'efectivo' : 'tarjeta'));
    const total = list.reduce((acc, a) => acc + a.amount, 0);

    return (
      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between text-xs font-extrabold text-slate-700">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-slate-500">
            🔒 Apartados ({list.length})
          </span>
          <span className="text-slate-900">${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
        </div>

        {/* List of Apartados */}
        {list.length > 0 ? (
          <div className="mt-2.5 space-y-2">
            {list.map((ap) => (
              <div 
                key={ap.id} 
                className="flex flex-col bg-slate-50 border border-slate-150 rounded-xl p-2.5 hover:shadow-xs transition-all duration-205"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-slate-800 text-xs">{ap.name}</span>
                    <span className="block text-[10px] text-slate-400 font-bold">{new Date(ap.createdAt).toLocaleDateString('es-ES')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">${ap.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                    
                    {/* Tiny inline buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setActiveApActionId(ap.id);
                          setApActionType('deposit');
                          setApActionAmount('');
                        }}
                        className="p-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-lg text-emerald-600 transition cursor-pointer"
                        title="Depositar"
                      >
                        <span className="text-xs font-bold font-mono">+</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveApActionId(ap.id);
                          setApActionType('withdraw');
                          setApActionAmount('');
                        }}
                        className="p-1 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded-lg text-amber-600 transition cursor-pointer"
                        title="Retirar"
                      >
                        <span className="text-xs font-bold font-mono">-</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Estás seguro de eliminar el apartado "${ap.name}"? Todo su dinero volverá al presupuesto libre.`)) {
                            if (onDeleteApartado) onDeleteApartado(ap.id);
                          }
                        }}
                        className="p-1 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg text-rose-500 transition cursor-pointer"
                        title="Eliminar apartado"
                      >
                        <span className="text-[10px]">🗑️</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Action Form (Deposit/Withdrawal input) */}
                {activeApActionId === ap.id && (
                  <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-200/50 pt-2.5 animate-in slide-in-from-top-1 duration-150">
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">
                      {apActionType === 'deposit' ? 'Depositar:' : 'Retirar:'}
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={apActionAmount}
                      onChange={(e) => setApActionAmount(e.target.value)}
                      className="w-20 px-2 py-1 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                    />
                    <button
                      onClick={() => handleApActionSubmit(ap.id, ap.amount, type === 'cash' ? 'efectivo' : 'tarjeta')}
                      className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black cursor-pointer hover:bg-slate-800 transition"
                    >
                      Ok
                    </button>
                    <button
                      onClick={() => {
                        setActiveApActionId(null);
                        setApActionType(null);
                        setApActionAmount('');
                      }}
                      className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] font-extrabold cursor-pointer hover:bg-slate-300 transition"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-slate-450 font-bold italic text-center py-1">Sin apartados activos</p>
        )}

        {/* Create Apartado Inline Button / Form */}
        {showAddApartadoType === type ? (
          <div className="mt-3 bg-slate-50 border border-slate-200 border-dashed rounded-xl p-3 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Nuevo Apartado</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nombre (ej. Renta)"
                value={newApName}
                onChange={(e) => setNewApName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Monto"
                value={newApAmount}
                onChange={(e) => setNewApAmount(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => setShowAddApartadoType(null)}
                className="px-3 py-1.5 text-xs text-slate-650 hover:bg-slate-200/50 rounded-lg font-extrabold cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleCreateApartado(type)}
                className="px-3 py-1.5 text-xs bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-black cursor-pointer transition"
              >
                Crear
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setNewApName('');
              setNewApAmount('');
              setShowAddApartadoType(type);
            }}
            className="mt-3 w-full py-1.5 bg-slate-100 hover:bg-slate-200/60 border border-slate-200 border-dashed rounded-xl text-[10px] text-slate-600 font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span>🔒</span> + Crear Apartado
          </button>
        )}
      </div>
    );
  };

  const totalApartadosCash = apartados
    .filter(a => a.paymentMethod === 'efectivo')
    .reduce((acc, a) => acc + a.amount, 0);

  const totalApartadosCard = apartados
    .filter(a => a.paymentMethod === 'tarjeta')
    .reduce((acc, a) => acc + a.amount, 0);

  const totalApartados = totalApartadosCash + totalApartadosCard;
  const realTotalBudget = totalBudget + totalApartados;

  const percentSpent = totalBudget > 0 ? Math.min(100, Math.round((spent / totalBudget) * 100)) : 0;
  const percentPlanned = totalBudget > 0 ? Math.min(100, Math.round((planned / totalBudget) * 100)) : 0;
  const totalAllocated = spent + planned;
  const percentTotal = totalBudget > 0 ? Math.min(100, Math.round((totalAllocated / totalBudget) * 100)) : 0;
  const remainingCash = cashBudget - cashSpent;
  const remainingCard = cardBudget - cardSpent;

  const getContainerStyle = () => {
    if (percentTotal >= 100) return 'border-2 border-rose-500 shadow-xl shadow-rose-50/50 ring-4 ring-rose-100 bg-rose-50/5 transition-all duration-300';
    if (percentTotal >= 80) return 'border-2 border-amber-500 shadow-xl shadow-amber-50/50 ring-4 ring-amber-100 bg-amber-50/5 transition-all duration-300';
    return 'border border-slate-200/85 hover:shadow-md transition-all duration-300';
  };

  return (
    <div className={`glass-card rounded-3xl overflow-hidden ${getContainerStyle()}`} id="budget-card-container">
      {/* Smart-Cap Budget threshold alerts */}
      {percentTotal >= 100 && (
        <div className="bg-gradient-to-r from-rose-500 to-red-600 text-white px-6 py-2.5 flex items-center justify-between text-xs font-black tracking-wide animate-pulse">
          <span className="flex items-center gap-2">
            <span>🚨</span> ¡PRESUPUESTO EXCEDIDO! Revisa tus planes y compras pendientes.
          </span>
          <span className="bg-rose-700/80 px-2 py-0.5 rounded text-[10px]">Alerta Crítica</span>
        </div>
      )}
      {percentTotal >= 80 && percentTotal < 100 && (
        <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 px-6 py-2.5 flex items-center justify-between text-xs font-black tracking-wide">
          <span className="flex items-center gap-2">
            <span>⚠️</span> ADVERTENCIA: Has comprometido más del 80% de tu presupuesto.
          </span>
          <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-[10px]">Alerta Preventiva</span>
        </div>
      )}

      {/* Header section with interactive Available Capital input */}
      <div className="p-6 md:p-8 bg-gradient-to-b from-slate-50/70 to-slate-100/30 border-b border-slate-150/70">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          
          {/* Capital accumulation display */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-slate-500">
              <div className="p-1.5 bg-slate-100 rounded-lg text-slate-650 border border-slate-200/50 shadow-2xs">
                <Wallet className="w-4 h-4 animate-bounce" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                Capital Neto Acumulado
              </span>
            </div>
            
            <div className="flex items-baseline gap-2 mt-1">
              <h2 className="text-3.5xl sm:text-4xl lg:text-4.5xl font-black tracking-tight text-slate-900 leading-none">
                ${realTotalBudget.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <span className="text-xs text-slate-400 font-semibold">(MXN)</span>
            </div>

            <p className="text-[10.5px] text-slate-400 font-medium leading-relaxed max-w-sm sm:max-w-md">
              Suma total de tu patrimonio en curso, combinando tu capital disponible y los ahorros protegidos en tus apartados.
            </p>

            {totalApartados > 0 ? (
              <div className="flex items-center gap-2 mt-3 bg-white border border-slate-200/60 p-2 rounded-2xl shadow-2xs w-fit animate-in fade-in duration-200">
                <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 rounded-xl border border-emerald-100/50 text-[10px] sm:text-xs font-extrabold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Libre: ${totalBudget.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                </div>
                <span className="text-slate-300 font-light text-xs">|</span>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 rounded-xl border border-indigo-100/50 text-[10px] sm:text-xs font-extrabold text-indigo-700">
                  <span>🔒 Apartado: ${totalApartados.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 rounded-xl border border-emerald-100/50 text-[10px] sm:text-xs font-extrabold text-emerald-750">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Todo el capital está libre y disponible</span>
              </div>
            )}
          </div>

          {/* Right Metrics Panel */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4.5 w-full lg:w-auto shrink-0 bg-white/60 backdrop-blur-xs border border-slate-200/55 p-5 rounded-3xl shadow-sm">
            
            {/* Status chip */}
            <div className="flex flex-col lg:items-end gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Estado del Capital</span>
              <div className="mt-1">
                {remaining < 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm shadow-rose-100 border border-rose-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    🚨 Límite Excedido
                  </span>
                ) : remaining === 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm shadow-amber-100 border border-amber-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    ⚠️ Capital al Límite
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm shadow-emerald-100 border border-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    🍀 Capital Sano
                  </span>
                )}
              </div>
            </div>

            <div className="hidden sm:block lg:hidden w-px h-10 bg-slate-200"></div>

            {/* Commited Budget block */}
            <div className="flex flex-col lg:items-end gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Compromiso Financiero</span>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-sm sm:text-base font-black ${
                  percentTotal >= 100 ? 'text-rose-600' : percentTotal >= 80 ? 'text-amber-600' : 'text-slate-800'
                }`}>
                  {percentTotal}%
                </span>
                <span className="text-[11px] text-slate-400 font-semibold ml-1">presupuesto comprometido</span>
              </div>
              <p className="text-[9px] text-slate-450 font-bold leading-none mt-0.5">
                ${totalAllocated.toLocaleString('es-ES', { maximumFractionDigits: 0 })} asignado de ${totalBudget.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="hidden sm:block lg:hidden w-px h-10 bg-slate-200"></div>

            {/* Action button */}
            <div className="flex flex-col lg:items-end w-full sm:w-auto">
              <button
                onClick={onOpenCloseWizard}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-emerald-950 hover:to-slate-900 border border-slate-700/50 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-extrabold shadow-sm active:scale-97 cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5"
              >
                💰 Cerrar Mes Actual
              </button>
            </div>

          </div>

        </div>
      
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          <div className="bg-white/70 border border-slate-200/60 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Efectivo en mano</p>
              {remainingCash < 0 && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Presupuesto excedido
                </span>
              )}
            </div>
            {isEditingCash ? (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="number"
                  value={tempCashBudget}
                  onChange={(e) => setTempCashBudget(e.target.value)}
                  className="w-36 px-3 py-2 bg-white border border-slate-350 rounded-xl focus:border-slate-800 focus:outline-none font-bold text-lg text-slate-900"
                  placeholder="0.00"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCash();
                    if (e.key === 'Escape') setIsEditingCash(false);
                  }}
                />
                <button
                  onClick={handleSaveCash}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition cursor-pointer"
                  title="Guardar efectivo"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditingCash(false)}
                  className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition cursor-pointer"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-3">
                <p className="text-2.5xl font-black text-slate-900">
                  ${cashBudget.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <button
                  onClick={() => {
                    setTempCashBudget(cashBudget.toString());
                    setIsEditingCash(true);
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                  title="Editar efectivo"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={addCashAmount}
                onChange={(e) => setAddCashAmount(e.target.value)}
                className="w-32 px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs text-slate-750 focus:border-slate-800 focus:ring-1 focus:ring-slate-400 focus:outline-none font-bold"
                placeholder="Sumar cantidad"
              />
              <button
                onClick={handleAddCash}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
              >
                Sumar
              </button>
            </div>
            <p className="text-xs text-slate-600 font-semibold mt-3">
              Restante: ${remainingCash.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {totalIncomesCash > 0 && <span className="text-emerald-650 font-extrabold text-[10px]"> (+${totalIncomesCash} ingresos)</span>}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">Gastado: ${cashSpent.toFixed(2)} | Planificado: ${cashPlanned.toFixed(2)}</p>
            {renderApartadosSection('cash')}
          </div>

          <div className="bg-white/70 border border-slate-200/60 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tarjeta / Transferencia</p>
              {remainingCard < 0 && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Presupuesto excedido
                </span>
              )}
            </div>
            {isEditingCard ? (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="number"
                  value={tempCardBudget}
                  onChange={(e) => setTempCardBudget(e.target.value)}
                  className="w-36 px-3 py-2 bg-white border border-slate-350 rounded-xl focus:border-slate-800 focus:outline-none font-bold text-lg text-slate-900"
                  placeholder="0.00"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCard();
                    if (e.key === 'Escape') setIsEditingCard(false);
                  }}
                />
                <button
                  onClick={handleSaveCard}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition cursor-pointer"
                  title="Guardar tarjeta"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditingCard(false)}
                  className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition cursor-pointer"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-3">
                <p className="text-2.5xl font-black text-slate-900">
                  ${cardBudget.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <button
                  onClick={() => {
                    setTempCardBudget(cardBudget.toString());
                    setIsEditingCard(true);
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                  title="Editar tarjeta"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={addCardAmount}
                onChange={(e) => setAddCardAmount(e.target.value)}
                className="w-32 px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs text-slate-750 focus:border-slate-800 focus:ring-1 focus:ring-slate-400 focus:outline-none font-bold"
                placeholder="Sumar cantidad"
              />
              <button
                onClick={handleAddCard}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
              >
                Sumar
              </button>
            </div>
            <p className="text-xs text-slate-600 font-semibold mt-3">
              Restante: ${remainingCard.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {totalIncomesCard > 0 && <span className="text-emerald-650 font-extrabold text-[10px]"> (+${totalIncomesCard} ingresos)</span>}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">Gastado: ${cardSpent.toFixed(2)} | Planificado: ${cardPlanned.toFixed(2)}</p>
            {renderApartadosSection('card')}
          </div>
        </div>

        {/* Dynamic Multi-segment progress bar */}
        <div className="mt-7 w-full bg-slate-200 h-3 rounded-full overflow-hidden flex shadow-inner" id="budget-progress-bar">
          <div 
            className={`h-full transition-all duration-500 ease-out ${
              percentTotal >= 100 ? 'bg-rose-500' : percentTotal >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
            }`} 
            style={{ width: `${percentSpent}%` }}
            title={`Comprado: ${percentSpent}%`}
          />
          <div 
            className={`h-full transition-all duration-500 ease-out ${
              percentTotal >= 100 ? 'bg-rose-450' : 'bg-amber-400'
            }`} 
            style={{ width: `${percentPlanned}%` }}
            title={`Planificado: ${percentPlanned}%`}
          />
        </div>
        
        {/* Progress legend */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-3.5 text-xs text-slate-600 px-0.5 font-semibold">
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full inline-block shrink-0 ${
                percentTotal >= 100 ? 'bg-rose-500' : percentTotal >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}></span>
              Comprado ({percentSpent}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full inline-block shrink-0 ${
                percentTotal >= 100 ? 'bg-rose-400' : 'bg-amber-400'
              }`}></span>
              Planificado ({percentPlanned}%)
            </span>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">Presupuesto total</span>
        </div>
      </div>

      {/* Grid of calculations */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-150 bg-white" id="budget-calculations-grid">
        
        {/* Col 1: Gastado */}
        <div className="p-6 flex items-start gap-4 hover:bg-slate-50/50 transition-colors" id="stat-spent">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-xs shrink-0">
            <TrendingUp className="w-6.5 h-6.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-550 uppercase tracking-wider">Total Comprado</p>
            <h3 className="text-2.5xl font-black text-slate-900 mt-1.5 leading-none">
              ${spent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">Gastado de forma efectiva</p>
          </div>
        </div>

        {/* Col 2: Planificado / Por Comprar */}
        <div className="p-6 flex items-start gap-4 hover:bg-slate-50/50 transition-colors" id="stat-planned">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shadow-xs shrink-0">
            <HandCoins className="w-6.5 h-6.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-550 uppercase tracking-wider">Por Comprar / Pendiente</p>
            <h3 className="text-2.5xl font-black text-slate-900 mt-1.5 leading-none">
              ${planned.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">Reservado en planes</p>
          </div>
        </div>

        {/* Col 3: Disponible / Restante */}
        <div className="p-6 flex items-start gap-4 hover:bg-slate-50/50 transition-colors" id="stat-remaining">
          <div className={`p-3 rounded-2xl shadow-xs shrink-0 ${remaining < 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            <PiggyBank className="w-6.5 h-6.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-550 uppercase tracking-wider">Capital Restante</p>
            <h3 className={`text-2.5xl font-black mt-1.5 leading-none ${remaining < 0 ? 'text-red-700' : 'text-slate-900'}`}>
              ${remaining.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs font-semibold mt-1">
              {remaining < 0 ? <span className="text-rose-700">¡Estás sobregirado!</span> : <span className="text-slate-500">Disponible para gastar</span>}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
