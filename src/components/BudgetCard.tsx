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
import { BudgetSummary } from '../types';

interface BudgetCardProps {
  summary: BudgetSummary;
  onUpdateBudget: (type: 'cash' | 'card', newBudget: number) => void;
}

export default function BudgetCard({ summary, onUpdateBudget }: BudgetCardProps) {
  const { totalBudget, spent, planned, remaining, cashBudget, cardBudget, cashSpent, cashPlanned, cardSpent, cardPlanned } = summary;
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [tempCashBudget, setTempCashBudget] = useState(cashBudget.toString());
  const [tempCardBudget, setTempCardBudget] = useState(cardBudget.toString());
  const [addCashAmount, setAddCashAmount] = useState('');
  const [addCardAmount, setAddCardAmount] = useState('');

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

  const percentSpent = totalBudget > 0 ? Math.min(100, Math.round((spent / totalBudget) * 100)) : 0;
  const percentPlanned = totalBudget > 0 ? Math.min(100, Math.round((planned / totalBudget) * 100)) : 0;
  const totalAllocated = spent + planned;
  const percentTotal = totalBudget > 0 ? Math.min(100, Math.round((totalAllocated / totalBudget) * 100)) : 0;
  const remainingCash = cashBudget - cashSpent;
  const remainingCard = cardBudget - cardSpent;

  return (
    <div className="glass-card rounded-3xl overflow-hidden" id="budget-card-container">
      {/* Header section with interactive Available Capital input */}
      <div className="p-6 md:p-8 bg-slate-50/50 border-b border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Wallet className="w-4.5 h-4.5 text-slate-500" />
              Presupuesto Total Disponible
            </p>
            <div className="flex items-center gap-2.5 mt-2.5 group" id="display-budget">
              <h2 className="text-3.5xl md:text-4.5xl font-black text-slate-900 tracking-tight leading-none">
                ${totalBudget.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
          </div>

          <div className="flex flex-col items-end text-right md:w-auto w-full">
            <span className={`text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-xs ${
              remaining < 0 
                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                : remaining === 0 
                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {remaining < 0 ? 'Límite Excedido' : 'Capital Sano'}
            </span>
            <p className="text-xs text-slate-500 font-semibold mt-2.5">
              {percentTotal}% del presupuesto comprometido
            </p>
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
            <p className="text-xs text-slate-600 font-semibold mt-3">Restante: ${remainingCash.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[11px] text-slate-500 font-medium">Gastado: ${cashSpent.toFixed(2)} | Planificado: ${cashPlanned.toFixed(2)}</p>
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
            <p className="text-xs text-slate-600 font-semibold mt-3">Restante: ${remainingCard.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[11px] text-slate-500 font-medium">Gastado: ${cardSpent.toFixed(2)} | Planificado: ${cardPlanned.toFixed(2)}</p>
          </div>
        </div>

        {/* Dynamic Multi-segment progress bar */}
        <div className="mt-7 w-full bg-slate-200 h-3 rounded-full overflow-hidden flex shadow-inner" id="budget-progress-bar">
          <div 
            className="bg-emerald-500 h-full transition-all duration-500 ease-out" 
            style={{ width: `${percentSpent}%` }}
            title={`Comprado: ${percentSpent}%`}
          />
          <div 
            className="bg-amber-400 h-full transition-all duration-500 ease-out" 
            style={{ width: `${percentPlanned}%` }}
            title={`Planificado: ${percentPlanned}%`}
          />
        </div>
        
        {/* Progress legend */}
        <div className="flex justify-between items-center mt-3 text-xs text-slate-600 px-0.5 font-semibold">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              Comprado ({percentSpent}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
              Planificado ({percentPlanned}%)
            </span>
          </div>
          <span>Presupuesto total</span>
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
