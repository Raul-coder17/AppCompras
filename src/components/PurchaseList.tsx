/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  SlidersHorizontal, 
  Calendar, 
  MapPin, 
  Tag, 
  HelpCircle,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  ListTodo,
  Info
} from 'lucide-react';
import { ShoppingItem, PREDEFINED_CATEGORIES } from '../types';

interface PurchaseListProps {
  items: ShoppingItem[];
  selectedStoreFilter: string | null;
  onToggleBought: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onUpdateItem: (id: string, updatedData: Partial<ShoppingItem>) => void;
}

type SortOrder = 'date-desc' | 'date-asc' | 'price-desc' | 'price-asc' | 'alpha-asc' | 'status-pending-first';

export default function PurchaseList({ 
  items, 
  selectedStoreFilter, 
  onToggleBought, 
  onDeleteItem, 
  onUpdateItem 
}: PurchaseListProps) {
  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('status-pending-first');

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlace, setEditPlace] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState(1);
  const [editCategory, setEditCategory] = useState('');

  // Start Editing Item
  const startEditing = (item: ShoppingItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPlace(item.place);
    setEditPrice(item.price.toString());
    setEditQty(item.quantity);
    setEditCategory(item.category);
  };

  // Save Edit
  const saveEdit = (id: string) => {
    const parsedPrice = parseFloat(editPrice);
    onUpdateItem(id, {
      name: editName.trim() || 'Sin nombre',
      place: editPlace.trim() || 'Cualquier lugar',
      price: isNaN(parsedPrice) ? 0 : parsedPrice,
      quantity: Math.max(1, editQty),
      category: editCategory
    });
    setEditingId(null);
  };

  // Cancel Edit
  const cancelEdit = () => {
    setEditingId(null);
  };

  // 1. First layer of filtering: store, category and search query
  const filteredItems = items.filter(item => {
    const matchesStore = !selectedStoreFilter || item.place.toLowerCase() === selectedStoreFilter.toLowerCase();
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.place.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStore && matchesCategory && matchesSearch;
  });

  // 2. Sorting
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortOrder) {
      case 'date-desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'date-asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'price-desc':
        return (b.price * b.quantity) - (a.price * a.quantity);
      case 'price-asc':
        return (a.price * a.quantity) - (b.price * b.quantity);
      case 'alpha-asc':
        return a.name.localeCompare(b.name);
      case 'status-pending-first':
        if (a.bought === b.bought) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Sub-sort by date
        }
        return a.bought ? 1 : -1; // Unbought (false) comes first
      default:
        return 0;
    }
  });

  // Calculate stats for current filter subset (vaya haciendo cuentas de todo)
  const totalCount = filteredItems.length;
  const boughtCount = filteredItems.filter(i => i.bought).length;
  const pendingCount = totalCount - boughtCount;
  const filteredSpent = filteredItems.reduce((acc, curr) => acc + (curr.bought ? curr.price * curr.quantity : 0), 0);
  const filteredPlanned = filteredItems.reduce((acc, curr) => acc + (!curr.bought ? curr.price * curr.quantity : 0), 0);
  const filteredTotalValue = filteredSpent + filteredPlanned;

  const getCategoryDetails = (id: string) => {
    const cat = PREDEFINED_CATEGORIES.find(c => c.id === id);
    return cat || { name: 'Otros', color: '#6B7280' };
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col h-full" id="purchase-list-container">
      
      {/* Title & Filter Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-indigo-600" />
            Lista de Compras
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedStoreFilter ? (
              <span>Mostrando compras para: <strong className="text-slate-800">{selectedStoreFilter}</strong></span>
            ) : (
              <span>Todos los artículos planificados</span>
            )}
          </p>
        </div>

        {/* Dynamic mini accounts of visible subset */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs text-slate-600 shrink-0 w-full sm:w-auto" id="list-subset-totals">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total en Pantalla</span>
            <span className="font-extrabold text-slate-800 text-sm">
              ${filteredTotalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-6 w-[1px] bg-slate-200"></div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400">Progreso</span>
            <span className="font-semibold text-slate-600">
              {boughtCount}/{totalCount} comprobados
            </span>
          </div>
        </div>
      </div>

      {/* Inputs, Category Tags and Sorting */}
      <div className="space-y-4 mb-6">
        
        {/* Search Input & Sorter */}
        <div className="flex flex-col sm:flex-row gap-3">
          
          {/* Search box */}
          <div className="relative flex-grow">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por artículo o lugar..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none transition duration-150 text-sm"
              id="search-purchase-input"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 font-bold text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sorter */}
          <div className="relative shrink-0 sm:w-56">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-2xl text-slate-800 focus:outline-none transition duration-150 appearance-none text-sm cursor-pointer"
              id="sort-purchase-select"
            >
              <option value="status-pending-first">Pendientes primero</option>
              <option value="date-desc">Más nuevos primero</option>
              <option value="date-asc">Más viejos primero</option>
              <option value="price-desc">Precio: Alto a Bajo</option>
              <option value="price-asc">Precio: Bajo a Alto</option>
              <option value="alpha-asc">Nombre (A-Z)</option>
            </select>
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
          </div>

        </div>

        {/* Category Filters row - Horizontal Scrollable */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin" id="category-filters-row">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === null 
                ? 'bg-slate-900 border border-slate-900 text-white' 
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100'
            }`}
          >
            Todas Categorías
          </button>
          {PREDEFINED_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                selectedCategory === cat.id 
                  ? 'bg-slate-800 text-white border-slate-800' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cat.color }}></span>
              {cat.name.split(' / ')[0]}
            </button>
          ))}
        </div>

      </div>

      {/* Main List Rendering */}
      <div className="flex-grow overflow-y-auto max-h-[500px] pr-1.5 scrollbar-thin space-y-3" id="shopping-items-list-container">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-6">
            <ShoppingBag className="w-10 h-10 text-slate-300 stroke-[1.5] mb-3" />
            <p className="text-sm text-slate-500 font-bold">No se encontraron artículos</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[320px]">
              {items.length === 0 
                ? 'Comienza agregando productos a comprar en el formulario adjunto.'
                : 'Intenta cambiar los filtros de búsqueda o vaciar la selección para ver el inventario.'}
            </p>
            {items.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                }}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Restablecer Filtros
              </button>
            )}
          </div>
        ) : (
          sortedItems.map((item) => {
            const isEditing = editingId === item.id;
            const catInfo = getCategoryDetails(item.category);
            const totalItemCost = item.price * item.quantity;

            return (
              <div 
                key={item.id}
                className={`p-4 md:p-5 rounded-2xl border transition-all duration-150 ${
                  item.bought 
                    ? 'bg-slate-50/55 border-slate-100 opacity-65 hover:opacity-90' 
                    : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                }`}
                id={`item-card-${item.id}`}
              >
                {isEditing ? (
                  /* Edit Mode Form Interface ***********************/
                  <div className="space-y-4" id={`edit-form-${item.id}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nombre</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Empresa / Lugar</label>
                        <input
                          type="text"
                          value={editPlace}
                          onChange={(e) => setEditPlace(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Precio Unitario ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cantidad</label>
                        <input
                          type="number"
                          min="1"
                          value={editQty}
                          onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 text-sm focus:outline-none text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoría</label>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-800 text-xs focus:outline-none cursor-pointer"
                        >
                          {PREDEFINED_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name.split(' / ')[0]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Cost Preview & Action Row */}
                    <div className="flex justify-between items-center pt-2">
                      <div className="text-xs text-slate-500 font-semibold">
                        Costo: <span className="text-indigo-600">${( (parseFloat(editPrice) || 0) * editQty ).toFixed(2)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(item.id)}
                          className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Guardar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3.5 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard Display Card ***************************/
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    
                    {/* Checkbox status & title info */}
                    <div className="flex items-start gap-3.5 w-full sm:w-auto">
                      
                      {/* Checkbox toggle with status change detection */}
                      <button
                        onClick={() => onToggleBought(item.id)}
                        className="mt-1 transition-transform relative focus:outline-none cursor-pointer shrink-0"
                        title={item.bought ? 'Marcar como pendiente de compra' : 'Marcar como comprado de forma efectiva'}
                        id={`check-btn-${item.id}`}
                      >
                        {item.bought ? (
                          <CheckSquare className="w-6 h-6 text-emerald-600 fill-emerald-50 bg-emerald-50/50 rounded-lg scale-100 hover:scale-105" />
                        ) : (
                          <Square className="w-6 h-6 text-slate-300 rounded-lg hover:text-slate-500 scale-100 hover:scale-105" />
                        )}
                      </button>

                      {/* Info and categories */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={`text-base font-semibold tracking-tight ${
                            item.bought ? 'text-slate-400 line-through' : 'text-slate-800'
                          }`}>
                            {item.name}
                          </h4>
                          {/* Unit count pill */}
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            item.bought ? 'bg-slate-200/50 text-slate-400' : 'bg-slate-100 text-slate-600'
                          }`}>
                            x{item.quantity} {item.quantity === 1 ? 'u' : 'unidades'}
                          </span>
                        </div>

                        {/* Badges row: Store & Category */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {/* Store badge */}
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px] ${
                            item.bought 
                              ? 'bg-slate-200/40 text-slate-400' 
                              : 'bg-indigo-50/60 text-indigo-600'
                          }`}>
                            <MapPin className="w-3 h-3" />
                            <span>{item.place}</span>
                          </div>

                          {/* Category badge */}
                          <div className="flex items-center gap-1 text-[11px] text-slate-400/80 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.bought ? '#CBD5E1' : catInfo.color }}></span>
                            <span>{catInfo.name.split(' / ')[0]}</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Prices details & Quick actions */}
                    <div className="flex sm:flex-col justify-between items-center sm:items-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100/70" id="item-actions">
                      
                      {/* Price accounts */}
                      <div className="text-left sm:text-right">
                        <div className={`text-base font-black ${item.bought ? 'text-slate-400' : 'text-slate-800'}`}>
                          ${totalItemCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {item.quantity > 1 && (
                          <div className="text-[10px] text-slate-400">
                            u. ${item.price.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>

                      {/* Action buttons (inline edit, delete) */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => startEditing(item)}
                          disabled={item.bought}
                          className={`p-1.5 rounded-lg border transition ${
                            item.bought
                              ? 'text-slate-300 border-transparent cursor-not-allowed'
                              : 'text-slate-500 border-slate-100 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800 cursor-pointer'
                          }`}
                          title="Editar producto"
                          id={`edit-btn-${item.id}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          className="p-1.5 text-slate-400 border border-transparent rounded-lg hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                          title="Eliminar producto de la lista"
                          id={`delete-btn-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
