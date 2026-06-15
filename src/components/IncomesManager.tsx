import React, { useState } from 'react';
import { Coins, Trash2, Plus, CreditCard, Sparkles, TrendingUp, DollarSign } from 'lucide-react';
import { Income } from '../types';

interface IncomesManagerProps {
  incomes: Income[];
  onAddIncome: (incomeData: Omit<Income, 'id' | 'createdAt'>) => void;
  onDeleteIncome: (id: string) => void;
}

export default function IncomesManager({
  incomes,
  onAddIncome,
  onDeleteIncome
}: IncomesManagerProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('transferencia');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Por favor escribe un concepto para el ingreso.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Por favor escribe un monto válido mayor a 0.');
      return;
    }

    onAddIncome({
      name: name.trim(),
      amount: numAmount,
      paymentMethod
    });

    setName('');
    setAmount('');
  };

  const totalCash = incomes
    .filter(i => i.paymentMethod === 'efectivo')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalCard = incomes
    .filter(i => i.paymentMethod !== 'efectivo')
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-6 transition-all duration-300 hover:shadow-md">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/25">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Ingresos del Mes</h3>
            <p className="text-[10px] text-slate-400 font-medium">Registra tus entradas de dinero extra</p>
          </div>
        </div>
        <TrendingUp className="w-4 h-4 text-emerald-500 animate-pulse" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-emerald-50/40 rounded-2xl border border-emerald-100/50 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[10px] uppercase tracking-wider">
            <DollarSign className="w-3.5 h-3.5" /> Efectivo
          </div>
          <span className="text-sm font-extrabold text-emerald-800 mt-1.5">
            ${totalCash.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="p-3 bg-blue-50/40 rounded-2xl border border-blue-100/50 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[10px] uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5" /> Digital
          </div>
          <span className="text-sm font-extrabold text-blue-800 mt-1.5">
            ${totalCard.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3 bg-slate-50/60 p-3.5 rounded-2xl border border-slate-100">
        <div>
          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Concepto / Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Nómina quincenal, Venta, Regalo"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-350 focus:ring-1 focus:ring-slate-300 placeholder-slate-400 font-semibold"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-350 focus:ring-1 focus:ring-slate-300 placeholder-slate-400 font-extrabold text-emerald-700"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Destino de Fondos</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'efectivo' | 'tarjeta' | 'transferencia')}
              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none cursor-pointer font-bold"
            >
              <option value="transferencia">🏦 Transferencia</option>
              <option value="tarjeta">💳 Tarjeta</option>
              <option value="efectivo">💵 Efectivo</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="text-[10px] text-rose-500 font-bold leading-relaxed">{error}</p>
        )}

        <button
          type="submit"
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> Registrar Ingreso
        </button>
      </form>

      {/* List of Incomes */}
      <div className="space-y-2">
        <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Historial de Ingresos Activos</span>
        {incomes.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
            <Coins className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
            <p className="text-[10px] text-slate-400 font-medium">No has registrado ingresos en este mes todavía.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
            {incomes.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-xs transition group"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] ${
                    inc.paymentMethod === 'efectivo'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                      : inc.paymentMethod === 'transferencia'
                      ? 'bg-amber-50 text-amber-600 border border-amber-100/50'
                      : 'bg-blue-50 text-blue-600 border border-blue-100/50'
                  }`}>
                    {inc.paymentMethod === 'efectivo' ? '💵' : inc.paymentMethod === 'transferencia' ? '🏦' : '💳'}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-700">{inc.name}</span>
                    <span className="block text-[8px] text-slate-400 font-semibold">
                      {new Date(inc.createdAt).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-extrabold ${inc.paymentMethod === 'efectivo' ? 'text-emerald-700' : inc.paymentMethod === 'transferencia' ? 'text-amber-700' : 'text-blue-700'}`}>
                    +${inc.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    onClick={() => onDeleteIncome(inc.id)}
                    className="p-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50/50 transition cursor-pointer"
                    title="Eliminar ingreso"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
