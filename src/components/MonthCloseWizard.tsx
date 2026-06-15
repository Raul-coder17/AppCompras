import React, { useState, useEffect } from 'react';
import { X, Calendar, ChevronRight, CheckCircle2, Coins, CreditCard, AlertTriangle, ArrowRight, Sparkles, TrendingUp, Check, Info } from 'lucide-react';
import { ShoppingItem, ServicePayment, Income } from '../types';

interface MonthCloseWizardProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonthName: string;
  cashBudget: number;
  cardBudget: number;
  items: ShoppingItem[];
  servicePayments: ServicePayment[];
  incomes: Income[];
  onConfirmClose: (newCashBudget: number, newCardBudget: number, carryOverPendingItems: boolean) => void;
}

export default function MonthCloseWizard({
  isOpen,
  onClose,
  currentMonthName,
  cashBudget,
  cardBudget,
  items,
  servicePayments,
  incomes,
  onConfirmClose
}: MonthCloseWizardProps) {
  const [step, setStep] = useState(1);

  // Budgets for the next month
  const [nextCashBudget, setNextCashBudget] = useState('0');
  const [nextCardBudget, setNextCardBudget] = useState('0');
  
  // Options
  const [carryOverPending, setCarryOverPending] = useState(true);
  const [transferRemainingCash, setTransferRemainingCash] = useState(true);
  const [transferRemainingCard, setTransferRemainingCard] = useState(true);

  // Calculations of ending month
  const boughtItems = items.filter(i => i.bought);
  const pendingItems = items.filter(i => !i.bought);

  const spentCash = boughtItems
    .filter(i => i.paymentMethod === 'efectivo')
    .reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

  const spentCard = boughtItems
    .filter(i => i.paymentMethod === 'tarjeta' || i.paymentMethod === 'transferencia')
    .reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

  const spentServicesCash = servicePayments
    .filter(s => s.paymentMethod === 'efectivo')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const spentServicesCard = servicePayments
    .filter(s => s.paymentMethod !== 'efectivo')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const spentServices = spentServicesCash + spentServicesCard;
  
  const totalIncomesCash = incomes
    .filter(i => i.paymentMethod === 'efectivo')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalIncomesCard = incomes
    .filter(i => i.paymentMethod !== 'efectivo')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Final remaining balances (starting budget - spent. Incomes are already integrated in cashBudget/cardBudget)
  const remainingCash = Math.max(0, cashBudget - spentCash - spentServicesCash);
  // Service payments are paid from card or cash depending on paymentMethod
  const remainingCard = Math.max(0, cardBudget - spentCard - spentServicesCard);

  // Pre-fill budgets in step 2
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      // Auto-pre-fill next budgets using default values or carry-overs
      const baseCash = transferRemainingCash ? remainingCash : 0;
      const baseCard = transferRemainingCard ? remainingCard : 0;
      setNextCashBudget(String(Math.round(baseCash)));
      setNextCardBudget(String(Math.round(baseCard)));
    }
  }, [isOpen]);

  // Handle remaining balance carry-overs dynamically when user toggles checkboxes
  const handleToggleTransferCash = (checked: boolean) => {
    setTransferRemainingCash(checked);
    setNextCashBudget(prev => {
      const val = parseFloat(prev) || 0;
      const diff = checked ? remainingCash : -remainingCash;
      return String(Math.max(0, Math.round(val + diff)));
    });
  };

  const handleToggleTransferCard = (checked: boolean) => {
    setTransferRemainingCard(checked);
    setNextCardBudget(prev => {
      const val = parseFloat(prev) || 0;
      const diff = checked ? remainingCard : -remainingCard;
      return String(Math.max(0, Math.round(val + diff)));
    });
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = () => {
    const finalCash = parseFloat(nextCashBudget) || 0;
    const finalCard = parseFloat(nextCardBudget) || 0;
    onConfirmClose(finalCash, finalCard, carryOverPending);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in zoom-in duration-250">
        
        {/* Header */}
        <header className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">Cierre de Capital Mensual</h3>
              <p className="text-[10px] text-slate-400 font-semibold">Cierra {currentMonthName} e inicia limpio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </header>

        {/* Step Indicator Breadcrumbs */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-4 w-full">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step >= 1 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {step > 1 ? <Check className="w-3 h-3 text-emerald-400 stroke-[3]" /> : '1'}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${step === 1 ? 'text-slate-800' : 'text-slate-400'}`}>Resumen</span>
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step >= 2 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {step > 2 ? <Check className="w-3 h-3 text-emerald-400 stroke-[3]" /> : '2'}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${step === 2 ? 'text-slate-800' : 'text-slate-400'}`}>Nuevo Capital</span>
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                step === 3 ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500'
              }`}>
                3
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${step === 3 ? 'text-emerald-700 font-extrabold' : 'text-slate-400'}`}>Confirmar</span>
            </div>
          </div>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">

          {/* STEP 1: SUMMARY OF ENDING MONTH */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-800">Resumen Financiero de {currentMonthName}</h4>
                <p className="text-[11px] text-slate-400 font-medium">Revisa las cifras generales y saldos restantes que tienes antes de archivar.</p>
              </div>

              {/* Grid Balance Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    💵 Saldo Sobrante Efectivo
                  </span>
                  <span className="text-lg font-black text-slate-800 mt-2">
                    ${remainingCash.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="text-[8px] text-slate-400 font-semibold mt-1">
                    Inicial: ${(Math.max(0, cashBudget - totalIncomesCash)).toLocaleString('es-MX', { minimumFractionDigits: 2 })} • Ingresos: +${totalIncomesCash}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    💳 Saldo Sobrante Tarjeta
                  </span>
                  <span className="text-lg font-black text-slate-800 mt-2">
                    ${remainingCard.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="text-[8px] text-slate-400 font-semibold mt-1">
                    Inicial: ${(Math.max(0, cardBudget - totalIncomesCard)).toLocaleString('es-MX', { minimumFractionDigits: 2 })} • Ingresos: +${totalIncomesCard}
                  </div>
                </div>
              </div>

              {/* Expense & Items breakdown list */}
              <div className="bg-slate-50/60 p-4.5 border border-slate-100 rounded-2xl space-y-3">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Actividad y Operaciones</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Compras Hechas</span>
                    <span className="block text-xs font-black text-slate-700 mt-0.5">{boughtItems.length} artículos</span>
                    <span className="block text-[8px] font-semibold text-rose-500 mt-0.5">-${(spentCash + spentCard).toFixed(0)}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Servicios Pagados</span>
                    <span className="block text-xs font-black text-slate-700 mt-0.5">{servicePayments.length} recibos</span>
                    <span className="block text-[8px] font-semibold text-indigo-500 mt-0.5">-${spentServices.toFixed(0)}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pendientes</span>
                    <span className="block text-xs font-black text-slate-700 mt-0.5">{pendingItems.length} artículos</span>
                    <span className="block text-[8px] text-amber-600 font-bold mt-0.5">Por traspasar</span>
                  </div>
                </div>
              </div>

              {/* Information Banner */}
              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl flex gap-2.5 items-start">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-800 leading-normal font-medium">
                  Al avanzar, el sistema archivará de forma segura el registro consolidado de compras, servicios e ingresos de este mes en tu historial para consultas futuras.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: DEFINE NEW MONTH CAPITAL */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-800">Presupuesto para el Siguiente Mes</h4>
                <p className="text-[11px] text-slate-400 font-medium">Ingresa el dinero con el que dispondrás para comenzar el siguiente periodo.</p>
              </div>

              {/* Carry over toggles */}
              <div className="space-y-2 bg-slate-50 p-4 border border-slate-150 rounded-2xl">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Opciones de Traspaso Inteligente</span>
                
                {/* Carry cash */}
                {remainingCash > 0 && (
                  <label className="flex items-center justify-between p-2 hover:bg-white rounded-xl transition cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">Traspasar efectivo restante</span>
                      <span className="text-[9px] text-slate-400">Suma +${remainingCash.toFixed(0)} al nuevo presupuesto</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={transferRemainingCash}
                      onChange={(e) => handleToggleTransferCash(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 border-slate-350 accent-emerald-600 cursor-pointer"
                    />
                  </label>
                )}

                {/* Carry card */}
                {remainingCard > 0 && (
                  <label className="flex items-center justify-between p-2 hover:bg-white rounded-xl transition cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">Traspasar tarjeta restante</span>
                      <span className="text-[9px] text-slate-400">Suma +${remainingCard.toFixed(0)} al nuevo presupuesto</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={transferRemainingCard}
                      onChange={(e) => handleToggleTransferCard(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 border-slate-350 accent-emerald-600 cursor-pointer"
                    />
                  </label>
                )}

                {/* Carry pending items */}
                {pendingItems.length > 0 && (
                  <label className="flex items-center justify-between p-2 hover:bg-white rounded-xl transition cursor-pointer select-none">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">Mudar artículos pendientes</span>
                      <span className="text-[9px] text-slate-400">Pasa {pendingItems.length} artículos planificados sin comprar al nuevo mes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={carryOverPending}
                      onChange={(e) => setCarryOverPending(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 border-slate-350 accent-emerald-600 cursor-pointer"
                    />
                  </label>
                )}
              </div>

              {/* Budgets Input fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-emerald-500" /> Presupuesto Efectivo ($)
                  </label>
                  <input
                    type="number"
                    value={nextCashBudget}
                    onChange={(e) => setNextCashBudget(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-800 focus:outline-none focus:border-slate-400 text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-500" /> Presupuesto Tarjeta ($)
                  </label>
                  <input
                    type="number"
                    value={nextCardBudget}
                    onChange={(e) => setNextCardBudget(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-800 focus:outline-none focus:border-slate-400 text-center"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRM CLOSURE AND FINAL WARNINGS */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-800">¿Todo listo para cerrar el mes?</h4>
                <p className="text-[11px] text-slate-400 font-medium">Por favor confirma que las siguientes configuraciones de capital inicial sean correctas.</p>
              </div>

              {/* Summary Cards */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-3">
                <span className="block text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Nuevo mes inicializado con:</span>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-100/50 shadow-2xs">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Efectivo Inicial</span>
                    <span className="block text-lg font-black text-emerald-700 mt-1">${parseFloat(nextCashBudget) || 0}</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-100/50 shadow-2xs">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tarjeta Inicial</span>
                    <span className="block text-lg font-black text-emerald-700 mt-1">${parseFloat(nextCardBudget) || 0}</span>
                  </div>
                </div>

                <div className="text-[10px] text-emerald-800/80 font-bold text-center border-t border-emerald-150 pt-2 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                  <span>
                    {carryOverPending && pendingItems.length > 0
                      ? `Se mudarán ${pendingItems.length} artículos planificados al nuevo mes.`
                      : 'Se iniciará la lista de compras vacía.'}
                  </span>
                </div>
              </div>

              {/* Safety Warning */}
              <div className="p-4.5 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3 items-start shadow-xs">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="block text-[11px] font-black text-amber-800 uppercase tracking-wide">Acción Irreversible</span>
                  <p className="text-[10px] text-amber-700 leading-normal font-semibold">
                    Al confirmar el cierre, la lista de compras actual se limpiará (los artículos comprados serán archivados) y no podrás volver a modificar los datos de {currentMonthName}.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Bar */}
        <footer className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Atrás
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-400 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                Siguiente <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-100 hover:shadow-lg active:scale-97"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.2]" /> Cerrar e Iniciar Mes
              </button>
            )}
          </div>
        </footer>

      </div>
    </div>
  );
}
