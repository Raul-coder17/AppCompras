/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Wallet, Receipt, Plus, Trash2, Info } from 'lucide-react';
import { PAYMENT_METHODS, ServicePayment } from '../types';

interface ServicePaymentsProps {
  payments: ServicePayment[];
  services: string[];
  onAddPayment: (payment: Omit<ServicePayment, 'id' | 'createdAt'>) => void;
  onDeletePayment: (id: string) => void;
  onAddService: (name: string) => void;
}

export default function ServicePayments({
  payments,
  services,
  onAddPayment,
  onDeletePayment,
  onAddService
}: ServicePaymentsProps) {
  const [selectedService, setSelectedService] = useState(services[0] || '');
  const [amountInput, setAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('tarjeta');
  const [newServiceName, setNewServiceName] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDay, setRecurringDay] = useState(15);

  useEffect(() => {
    if (!services.length) {
      setSelectedService('');
      return;
    }
    if (!services.includes(selectedService)) {
      setSelectedService(services[0]);
    }
  }, [services, selectedService]);

  const totals = useMemo(() => {
    const total = payments.reduce((acc, curr) => acc + curr.amount, 0);
    const cash = payments
      .filter((payment) => payment.paymentMethod === 'efectivo')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const card = total - cash;
    return { total, cash, card };
  }, [payments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService.trim()) return;

    const parsedAmount = parseFloat(amountInput);
    const amount = isNaN(parsedAmount) ? 0 : parsedAmount;
    if (amount <= 0) return;

    onAddPayment({
      service: selectedService.trim(),
      amount,
      paymentMethod: paymentMethod as any,
      isRecurring,
      recurringDay: isRecurring ? recurringDay : undefined
    });

    setAmountInput('');
    setPaymentMethod('tarjeta');
    setIsRecurring(false);
    setRecurringDay(15);
  };

  const handleAddService = () => {
    const trimmed = newServiceName.trim();
    if (!trimmed) return;
    onAddService(trimmed);
    setSelectedService(trimmed);
    setNewServiceName('');
  };

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8" id="service-payments-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Receipt className="w-5.5 h-5.5 text-slate-900" />
            Pagos de Servicios
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Registra Uber, Didi y otros servicios recurrentes.
          </p>
        </div>
        <div className="text-left sm:text-right bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Total servicios</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">
            ${totals.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-500 font-semibold mt-1">
            Efectivo ${totals.cash.toFixed(2)} · Tarjeta ${totals.card.toFixed(2)}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="service-payment-form">
        <div>
          <label htmlFor="input-service" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Servicio
          </label>
          <select
            id="input-service"
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-300 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 rounded-2xl text-slate-800 focus:outline-none transition duration-150 appearance-none text-sm cursor-pointer"
          >
            {services.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            placeholder="Agregar servicio"
            className="w-full px-3 py-2 bg-white border border-slate-300 shadow-sm rounded-xl text-xs text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddService}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Agregar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="input-service-amount" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Monto pagado
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Wallet className="w-4 h-4" />
              </span>
              <input
                id="input-service-amount"
                type="number"
                step="0.01"
                min="0"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-3 bg-white border border-slate-300 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none transition duration-150 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="input-service-payment" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Metodo de pago
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <CreditCard className="w-4 h-4" />
              </span>
              <select
                id="input-service-payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full pl-9 pr-3 py-3 bg-white border border-slate-300 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 rounded-2xl text-slate-800 focus:outline-none transition duration-150 appearance-none text-sm cursor-pointer"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
            </div>
          </div>
        </div>

        {/* Recurrence Options */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800">¿Programar como Gasto Recurrente?</span>
              <span className="text-[10px] text-slate-400 font-semibold">Se planificará automáticamente en los meses venideros</span>
            </div>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-all duration-300 cursor-pointer ${
                isRecurring ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-5 h-5 bg-white rounded-full shadow-md transform transition-all duration-300" />
            </button>
          </div>

          {isRecurring && (
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
              <label htmlFor="input-recurring-day" className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Día de cobro mensual:
              </label>
              <input
                id="input-recurring-day"
                type="number"
                min="1"
                max="31"
                value={recurringDay}
                onChange={(e) => setRecurringDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 15)))}
                className="w-16 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-center text-slate-800 font-bold focus:outline-none"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-4 px-4 rounded-2xl transition duration-150 shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-sm"
          id="add-service-payment-btn"
        >
          <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
          <span>Registrar pago</span>
        </button>
      </form>

      <div className="mt-6 space-y-3" id="service-payments-list">
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center bg-slate-100/60 rounded-2xl border border-dashed border-slate-300 p-5">
            <Info className="w-6 h-6 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500 font-medium">No hay pagos de servicios registrados</p>
            <p className="text-[11px] text-slate-400 mt-1">Agrega Uber, Didi u otro servicio para llevar el control.</p>
          </div>
        ) : (
          payments.map((payment) => {
            const method = PAYMENT_METHODS.find((item) => item.id === payment.paymentMethod);
            return (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 bg-slate-50/60"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{payment.service}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(payment.createdAt).toLocaleDateString('es-ES')} · {method?.name || 'Tarjeta'}
                    {payment.isRecurring && ` · 🔁 Recurrente (Día ${payment.recurringDay})`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold text-slate-800">
                    ${payment.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeletePayment(payment.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Eliminar pago"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
