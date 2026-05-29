/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  RotateCcw, 
  Download, 
  FileText, 
  User, 
  Heart,
  ExternalLink,
  Calendar,
  BarChart3
} from 'lucide-react';
import { ShoppingItem, ArchivedItem, BudgetSummary, PREDEFINED_CATEGORIES, PAYMENT_METHODS, ServicePayment, PREDEFINED_SERVICES } from './types';
import BudgetCard from './components/BudgetCard';
import AddItemForm from './components/AddItemForm';
import StoreSummary from './components/StoreSummary';
import PurchaseList from './components/PurchaseList';
import ServicePayments from './components/ServicePayments';
import ExpenseCalendar from './components/ExpenseCalendar';
import ExpenseCharts from './components/ExpenseCharts';
import AIAssistant from './components/AIAssistant';

// Initial demo data to showcase calculating capabilities immediately
const DEFAULT_BUDGET = 350.00;
const DEFAULT_PAYMENT_METHOD = 'tarjeta';
const DEFAULT_ITEMS: ShoppingItem[] = [
  {
    id: 'demo-1',
    name: 'Frutas y Verduras Organicas',
    place: 'Mercadona',
    price: 12.50,
    quantity: 1,
    category: 'comida',
    paymentMethod: 'efectivo',
    bought: true,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString() // 1 day ago
  },
  {
    id: 'demo-2',
    name: 'Detergente Concentrado 3L',
    place: 'Mercadona',
    price: 7.80,
    quantity: 2,
    category: 'hogar',
    paymentMethod: 'tarjeta',
    bought: false,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString() // 12 hours ago
  },
  {
    id: 'demo-3',
    name: 'Audífonos Bluetooth Deportivos',
    place: 'Amazon',
    price: 49.99,
    quantity: 1,
    category: 'tecnologia',
    paymentMethod: 'tarjeta',
    bought: false,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString() // 5 hours ago
  },
  {
    id: 'demo-4',
    name: 'Camisa de Lino Casual',
    place: 'Zara',
    price: 29.95,
    quantity: 1,
    category: 'ropa',
    paymentMethod: 'efectivo',
    bought: true,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    id: 'demo-5',
    name: 'Suplemento Multivitamínico',
    place: 'Farmacia Sol',
    price: 18.20,
    quantity: 1,
    category: 'salud',
    paymentMethod: 'transferencia',
    bought: false,
    createdAt: new Date(Date.now() - 300000).toISOString() // 5 min ago
  }
];

export default function App() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<ArchivedItem[]>([]);
  const [servicePayments, setServicePayments] = useState<ServicePayment[]>([]);
  const [cashBudget, setCashBudget] = useState<number>(0);
  const [cardBudget, setCardBudget] = useState<number>(DEFAULT_BUDGET);
  const [places, setPlaces] = useState<string[]>([]);
  const [serviceOptions, setServiceOptions] = useState<string[]>(PREDEFINED_SERVICES);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [categories, setCategories] = useState(PREDEFINED_CATEGORIES);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'charts'>('list');
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('cobuy_username') || 'Raúl');
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const handleUpdateUserName = (newName: string) => {
    const trimmed = newName.trim();
    if (trimmed) {
      setUserName(trimmed);
      localStorage.setItem('cobuy_username', trimmed);
    }
  };

  // 1. Initial State Load from LocalStorage
  useEffect(() => {
    try {
      const storedItems = localStorage.getItem('cobuy_shopping_items');
      const storedBudget = localStorage.getItem('cobuy_total_budget');
      const storedCashBudget = localStorage.getItem('cobuy_budget_cash');
      const storedCardBudget = localStorage.getItem('cobuy_budget_card');
      const storedCategories = localStorage.getItem('cobuy_categories');
      const storedArchivedItems = localStorage.getItem('cobuy_archived_items');
      const storedPlaces = localStorage.getItem('cobuy_places');
      const storedServicePayments = localStorage.getItem('cobuy_service_payments');
      const storedServices = localStorage.getItem('cobuy_services');

      if (storedItems) {
        const parsedItems = JSON.parse(storedItems) as ShoppingItem[];
        const normalizedItems = parsedItems.map((item) => ({
          ...item,
          paymentMethod: item.paymentMethod || DEFAULT_PAYMENT_METHOD
        }));
        setItems(normalizedItems);
      } else {
        setItems(DEFAULT_ITEMS);
      }

      if (storedArchivedItems) {
        const parsedArchived = JSON.parse(storedArchivedItems) as ArchivedItem[];
        const normalizedArchived = parsedArchived.map((item) => ({
          ...item,
          paymentMethod: item.paymentMethod || DEFAULT_PAYMENT_METHOD
        }));
        setArchivedItems(normalizedArchived);
      } else {
        setArchivedItems([]);
      }

      if (storedPlaces) {
        setPlaces(JSON.parse(storedPlaces));
      } else {
        setPlaces([]);
      }

      if (storedServicePayments) {
        const parsedPayments = JSON.parse(storedServicePayments) as ServicePayment[];
        const normalizedPayments = parsedPayments.map((payment) => ({
          ...payment,
          paymentMethod: payment.paymentMethod || DEFAULT_PAYMENT_METHOD
        }));
        setServicePayments(normalizedPayments);
      } else {
        setServicePayments([]);
      }

      if (storedServices) {
        setServiceOptions(JSON.parse(storedServices));
      } else {
        setServiceOptions(PREDEFINED_SERVICES);
      }

      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      } else {
        setCategories(PREDEFINED_CATEGORIES);
      }

      if (storedCashBudget || storedCardBudget) {
        setCashBudget(parseFloat(storedCashBudget || '0') || 0);
        setCardBudget(parseFloat(storedCardBudget || '0') || 0);
      } else if (storedBudget) {
        setCashBudget(0);
        setCardBudget(parseFloat(storedBudget) || DEFAULT_BUDGET);
      } else {
        setCashBudget(0);
        setCardBudget(DEFAULT_BUDGET);
      }
    } catch (e) {
      console.warn("No se pudo cargar datos desde localStorage", e);
      setItems(DEFAULT_ITEMS);
      setArchivedItems([]);
      setCashBudget(0);
      setCardBudget(DEFAULT_BUDGET);
      setCategories(PREDEFINED_CATEGORIES);
      setPlaces([]);
      setServicePayments([]);
      setServiceOptions(PREDEFINED_SERVICES);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // 2. Save state adjustments back as variables mutate
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_shopping_items', JSON.stringify(items));
    } catch (e) {
      console.error("Error al guardar artículos en localStorage", e);
    }
  }, [items, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_archived_items', JSON.stringify(archivedItems));
    } catch (e) {
      console.error("Error al guardar historial en localStorage", e);
    }
  }, [archivedItems, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_budget_cash', cashBudget.toString());
      localStorage.setItem('cobuy_budget_card', cardBudget.toString());
    } catch (e) {
      console.error("Error al guardar presupuesto en localStorage", e);
    }
  }, [cashBudget, cardBudget, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_categories', JSON.stringify(categories));
    } catch (e) {
      console.error("Error al guardar categorias en localStorage", e);
    }
  }, [categories, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_places', JSON.stringify(places));
    } catch (e) {
      console.error("Error al guardar lugares en localStorage", e);
    }
  }, [places, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_service_payments', JSON.stringify(servicePayments));
    } catch (e) {
      console.error("Error al guardar pagos de servicios en localStorage", e);
    }
  }, [servicePayments, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('cobuy_services', JSON.stringify(serviceOptions));
    } catch (e) {
      console.error("Error al guardar servicios en localStorage", e);
    }
  }, [serviceOptions, isInitialized]);

  // Core Mutation Actions
  const handleAddItem = (itemData: Omit<ShoppingItem, 'id' | 'createdAt'>) => {
    const newItem: ShoppingItem = {
      ...itemData,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setItems((prev) => [newItem, ...prev]);
    if (itemData.place && !places.some((place) => place.toLowerCase() === itemData.place.toLowerCase())) {
      setPlaces((prev) => [itemData.place, ...prev]);
    }
  };

  const handleToggleBought = (id: string) => {
    setItems((prev) => 
      prev.map(item => 
        item.id === id ? { ...item, bought: !item.bought } : item
      )
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      setArchivedItems((archived) => {
        if (archived.some((item) => item.id === id)) return archived;
        return [{ ...target, deletedAt: new Date().toISOString() }, ...archived];
      });
      return prev.filter(item => item.id !== id);
    });
  };

  const handleRestoreItem = (id: string) => {
    setArchivedItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      const { deletedAt, ...rest } = target;
      setItems((current) => {
        if (current.some((item) => item.id === id)) return current;
        return [rest, ...current];
      });
      return prev.filter(item => item.id !== id);
    });
  };

  const handlePurgeArchivedItem = (id: string) => {
    setArchivedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, updatedData: Partial<ShoppingItem>) => {
    setItems((prev) => 
      prev.map(item => 
        item.id === id ? { ...item, ...updatedData } : item
      )
    );
  };

  const handleUpdateBudget = (type: 'cash' | 'card', newBudget: number) => {
    if (type === 'cash') {
      setCashBudget(newBudget);
      return;
    }
    setCardBudget(newBudget);
  };

  const handleAddCategory = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const normalized = trimmedName.toLowerCase();
    if (categories.some((cat) => cat.name.toLowerCase() === normalized)) return;

    const palette = ['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#6B7280'];
    const nextColor = palette[categories.length % palette.length];
    const newCategory = {
      id: `custom-${normalized.replace(/\s+/g, '-')}`,
      name: trimmedName,
      color: nextColor
    };

    setCategories((prev) => [...prev, newCategory]);
  };

  const handleAddPlace = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (places.some((place) => place.toLowerCase() === trimmedName.toLowerCase())) return;
    setPlaces((prev) => [trimmedName, ...prev]);
  };

  const handleAddServicePayment = (paymentData: Omit<ServicePayment, 'id' | 'createdAt'>) => {
    const newPayment: ServicePayment = {
      ...paymentData,
      id: `service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setServicePayments((prev) => [newPayment, ...prev]);
    if (paymentData.service && !serviceOptions.some((service) => service.toLowerCase() === paymentData.service.toLowerCase())) {
      setServiceOptions((prev) => [paymentData.service, ...prev]);
    }
  };

  const handleDeleteServicePayment = (id: string) => {
    setServicePayments((prev) => prev.filter((payment) => payment.id !== id));
  };

  const handleAddServiceOption = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (serviceOptions.some((service) => service.toLowerCase() === trimmedName.toLowerCase())) return;
    setServiceOptions((prev) => [trimmedName, ...prev]);
  };

  // Reset shopping database completely
  const handleResetData = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = () => {
    setItems([]);
    setArchivedItems([]);
    setServicePayments([]);
    setCashBudget(0);
    setCardBudget(0);
    setSelectedStoreFilter(null);
    setPlaces([]);
    setServiceOptions(PREDEFINED_SERVICES);
    setIsResetModalOpen(false);
  };

  // Export List functionality
  const handleExportData = () => {
    const keys = ['Producto', 'Lugar', 'Precio Unitario', 'Cantidad', 'Costo Total', 'Categoria', 'Metodo de Pago', 'Comprado', 'Fecha de Registro'];
    const csvContent = [
      keys.join(','),
      ...items.map(i => [
        `"${i.name.replace(/"/g, '""')}"`,
        `"${i.place.replace(/"/g, '""')}"`,
        i.price.toFixed(2),
        i.quantity,
        (i.price * i.quantity).toFixed(2),
        `"${i.category}"`,
        `"${PAYMENT_METHODS.find((method) => method.id === i.paymentMethod)?.name || 'Tarjeta'}"`,
        i.bought ? "SÍ" : "NO",
        new Date(i.createdAt).toLocaleDateString('es-ES')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lista_compras_cuentas_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute stats in real-time (vaya haciendo cuentas de todo)
  const itemsSpent = items.reduce((acc, curr) => acc + (curr.bought ? curr.price * curr.quantity : 0), 0);
  const planned = items.reduce((acc, curr) => acc + (!curr.bought ? curr.price * curr.quantity : 0), 0);
  const servicesSpent = servicePayments.reduce((acc, curr) => acc + curr.amount, 0);
  const spent = itemsSpent + servicesSpent;
  const totalBudget = cashBudget + cardBudget;
  const remaining = totalBudget - spent;

  const cashSpentItems = items.reduce((acc, curr) => acc + (curr.bought && curr.paymentMethod === 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cashPlanned = items.reduce((acc, curr) => acc + (!curr.bought && curr.paymentMethod === 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cardSpentItems = items.reduce((acc, curr) => acc + (curr.bought && curr.paymentMethod !== 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cardPlanned = items.reduce((acc, curr) => acc + (!curr.bought && curr.paymentMethod !== 'efectivo' ? curr.price * curr.quantity : 0), 0);
  const cashSpentServices = servicePayments.reduce((acc, curr) => acc + (curr.paymentMethod === 'efectivo' ? curr.amount : 0), 0);
  const cardSpentServices = servicePayments.reduce((acc, curr) => acc + (curr.paymentMethod !== 'efectivo' ? curr.amount : 0), 0);
  const cashSpent = cashSpentItems + cashSpentServices;
  const cardSpent = cardSpentItems + cardSpentServices;

  const budgetSummary: BudgetSummary = {
    totalBudget,
    spent,
    planned,
    remaining,
    cashBudget,
    cardBudget,
    cashSpent,
    cashPlanned,
    cardSpent,
    cardPlanned
  };

  // Extract unique place strings sorted for smart Autocomplete suggestions
  const existingPlaces: string[] = places.map((place) => place.trim()).filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 flex flex-col font-sans" id="app-root-layout">
      
      {/* Upper Navigation / Title Block with Minimal Elements */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-xs sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo Brand Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-sm" id="app-logo-bg">
              <ShoppingBag className="w-5.5 h-5.5 text-emerald-400 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Cuentas Compras</h1>
              <p className="text-xs text-slate-500 font-semibold mt-1">Gestión & Control de Presupuestos</p>
            </div>
          </div>

          {/* User profile identifier & Quick reset/csv actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* User chip */}
            <button
              onClick={() => {
                setTempName(userName);
                setIsNameModalOpen(true);
              }}
              className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-full border border-slate-200 hover:border-slate-350 text-xs text-slate-700 font-extrabold cursor-pointer transition-all shadow-xs active:scale-95 select-none"
              title="Cambiar tu nombre de usuario"
              id="user-profile-chip"
            >
              <User className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Hola, <span className="text-emerald-600 font-black">{userName}</span></span>
            </button>

            {/* Export CSV action button */}
            <button
              onClick={handleExportData}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
              title="Exportar compras completas a Excel / CSV"
              id="export-csv-btn"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            {/* Reiniciar demo seed values */}
            <button
              onClick={handleResetData}
              className="p-2.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer active:scale-95"
              title="Restablecer base de datos"
              id="reset-raw-db"
            >
              <RotateCcw className="w-4.5 h-4.5" />
            </button>

          </div>
        </div>
      </header>

      {/* Main Body Grid Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {/* Navigation Tabs - Modern Glass Switch */}
        <div className="flex justify-center mb-8" id="view-mode-tabs">
          <div className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-300/40 backdrop-blur-xs max-w-2xl w-full sm:w-auto shadow-xs">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-extrabold transition-all duration-150 cursor-pointer active:scale-95 ${
                activeTab === 'list' 
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <ShoppingBag className="w-4.5 h-4.5 text-slate-700" />
              <span>Lista de Compras</span>
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-extrabold transition-all duration-150 cursor-pointer active:scale-95 ${
                activeTab === 'calendar' 
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Calendar className="w-4.5 h-4.5 text-slate-700" />
              <span>Calendario Mensual</span>
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-extrabold transition-all duration-150 cursor-pointer active:scale-95 ${
                activeTab === 'charts' 
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <BarChart3 className="w-4.5 h-4.5 text-slate-700" />
              <span>Gráficos Analíticos</span>
            </button>
          </div>
        </div>

        {activeTab === 'list' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-200">
            
            {/* LEFT 2 COLS: Budget Metrics Board & Purchase List */}
            <div className="lg:col-span-2 space-y-8 flex flex-col">
              
              {/* Top metrics with inline customizable budget cap */}
              <BudgetCard 
                summary={budgetSummary} 
                onUpdateBudget={handleUpdateBudget} 
              />

              {/* List with rich actions: edit inline, check toggles, filters, sorts */}
              <div className="flex-grow">
                <PurchaseList 
                  items={items}
                  archivedItems={archivedItems}
                  selectedStoreFilter={selectedStoreFilter}
                  onToggleBought={handleToggleBought}
                  onDeleteItem={handleDeleteItem}
                  onUpdateItem={handleUpdateItem}
                  onRestoreItem={handleRestoreItem}
                  onPurgeArchivedItem={handlePurgeArchivedItem}
                  categories={categories}
                />
              </div>
              
            </div>

            {/* RIGHT 1 COL: Planning form & Store ledger aggregates */}
            <div className="space-y-8">
              
              {/* Dynamic Interactive Input form */}
              <AddItemForm 
                onAddItem={handleAddItem} 
                existingPlaces={existingPlaces}
                onAddPlace={handleAddPlace}
                categories={categories}
                onAddCategory={handleAddCategory}
              />

              <ServicePayments
                payments={servicePayments}
                services={serviceOptions}
                onAddPayment={handleAddServicePayment}
                onDeletePayment={handleDeleteServicePayment}
                onAddService={handleAddServiceOption}
              />

              {/* Aggregated store financial sums ("haciendo cuentas por lugar") */}
              <StoreSummary 
                items={items}
                selectedStoreFilter={selectedStoreFilter}
                onSelectStoreFilter={setSelectedStoreFilter}
              />

            </div>

          </div>
        ) : activeTab === 'calendar' ? (
          <div className="animate-in fade-in duration-200">
            <ExpenseCalendar 
              items={items} 
              servicePayments={servicePayments} 
            />
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <ExpenseCharts
              items={items}
              servicePayments={servicePayments}
              categories={categories}
              cashBudget={cashBudget}
              cardBudget={cardBudget}
            />
          </div>
        )}
      </main>

      {/* Clean Subtle Page Footer */}
      <footer className="mt-auto border-t border-slate-100 bg-white" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <p className="font-medium">Gestor de Compras y Presupuesto © 2026</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <span>Creado con</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
            <span>para compras eficientes y controladas.</span>
          </div>
        </div>
      </footer>

      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-100 p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-9 w-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Restablecer aplicacion</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Esto eliminara todos los registros de compras y dejara el presupuesto en cero.
                  Esta accion no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                Si, restablecer
              </button>
            </div>
          </div>
        </div>
      )}
      {isNameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-150 p-6 space-y-4 animate-in zoom-in duration-250">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
              <User className="w-5 h-5 text-emerald-500" />
              <h2 className="text-sm font-black text-slate-900">¿Cómo te llamas?</h2>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Escribe tu nombre para personalizar tu perfil y para que el asistente de Inteligencia Artificial se dirija a ti de manera cercana y personalizada.
            </p>

            <div>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                maxLength={20}
                placeholder="Escribe tu nombre (ej. Raúl)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-400 placeholder-slate-400"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tempName.trim()) {
                    handleUpdateUserName(tempName);
                    setIsNameModalOpen(false);
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsNameModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleUpdateUserName(tempName);
                  setIsNameModalOpen(false);
                }}
                disabled={!tempName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 transition cursor-pointer"
              >
                Guardar Nombre
              </button>
            </div>
          </div>
        </div>
      )}

      <AIAssistant
        userName={userName}
        items={items}
        archivedItems={archivedItems}
        servicePayments={servicePayments}
        cashBudget={cashBudget}
        cardBudget={cardBudget}
        categories={categories}
        places={places}
        serviceOptions={serviceOptions}
        onAddItem={handleAddItem}
        onToggleBought={handleToggleBought}
        onDeleteItem={handleDeleteItem}
        onUpdateItem={handleUpdateItem}
        onUpdateBudget={handleUpdateBudget}
        onAddServicePayment={handleAddServicePayment}
        onDeleteServicePayment={handleDeleteServicePayment}
        onAddCategory={handleAddCategory}
        onAddPlace={handleAddPlace}
        onAddServiceOption={handleAddServiceOption}
        onRestoreItem={handleRestoreItem}
        onPurgeArchivedItem={handlePurgeArchivedItem}
        onResetDatabase={handleConfirmReset}
      />

    </div>
  );
}
