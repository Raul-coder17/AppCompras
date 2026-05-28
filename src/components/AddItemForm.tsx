/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  MapPin, 
  DollarSign, 
  Hash, 
  Grid,
  Info
} from 'lucide-react';
import { ShoppingItem, PAYMENT_METHODS, Category } from '../types';

interface AddItemFormProps {
  onAddItem: (itemData: Omit<ShoppingItem, 'id' | 'createdAt'>) => void;
  existingPlaces: string[]; // For smart suggestions
  categories: Category[];
  onAddCategory: (name: string) => void;
  onAddPlace: (name: string) => void;
}

export default function AddItemForm({ onAddItem, existingPlaces, categories, onAddCategory, onAddPlace }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [newPlaceName, setNewPlaceName] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || 'otros');
  const [paymentMethod, setPaymentMethod] = useState('tarjeta');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (!categories.find((cat) => cat.id === selectedCategory)) {
      setSelectedCategory(categories[0]?.id || 'otros');
    }
  }, [categories, selectedCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBulkMode && !name.trim()) return;

    const parsedPrice = parseFloat(priceInput);
    const finalPrice = isNaN(parsedPrice) ? 0 : parsedPrice;
    const finalPlace = place.trim() || 'Cualquier lugar';

    if (finalPlace !== 'Cualquier lugar' && !existingPlaces.some((p) => p.toLowerCase() === finalPlace.toLowerCase())) {
      onAddPlace(finalPlace);
    }

    if (isBulkMode) {
      const lines = bulkText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) return;

      lines.forEach((line) => {
        onAddItem({
          name: line,
          place: finalPlace,
          price: finalPrice,
          quantity: Math.max(1, quantity),
          category: selectedCategory,
          bought: false,
          paymentMethod
        });
      });
    } else {
      onAddItem({
        name: name.trim(),
        place: finalPlace,
        price: finalPrice,
        quantity: Math.max(1, quantity),
        category: selectedCategory,
        bought: false,
        paymentMethod
      });
    }

    // Reset Form
    setName('');
    setPlace('');
    setPriceInput('');
    setQuantity(1);
    setSelectedCategory(categories[0]?.id || 'otros');
    setPaymentMethod('tarjeta');
    setBulkText('');
    setNewPlaceName('');
  };

  const currentPrice = parseFloat(priceInput) || 0;
  const draftTotal = currentPrice * quantity;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm" id="add-item-form-container">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 text-sm font-bold">+</span>
          Planificar Nueva Compra
        </h3>
        <button
          type="button"
          onClick={() => setIsBulkMode((prev) => !prev)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
            isBulkMode ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {isBulkMode ? 'Modo rapido' : 'Lista rapida'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" id="new-purchase-form">
        
        {/* Product Name / Bulk List */}
        {isBulkMode ? (
          <div>
            <label htmlFor="input-product-list" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Lista de productos (uno por linea)
            </label>
            <textarea
              id="input-product-list"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Ej. Leche deslactosada\nZapatillas\nCafetera"
              className="w-full px-4 py-3 bg-white border border-slate-300 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 rounded-2xl text-slate-800 font-medium placeholder-slate-400 focus:outline-none transition duration-150 text-sm min-h-[120px]"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              Se aplican lugar, categoria, precio, cantidad y metodo de pago a todos los productos.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="input-product-name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              ¿Que vas a comprar? *
            </label>
            <input
              id="input-product-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Leche deslactosada, Zapatillas, Cafetera..."
              className="w-full px-4 py-3 bg-white border border-slate-300 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 rounded-2xl text-slate-800 font-medium placeholder-slate-400 focus:outline-none transition duration-150 text-sm"
            />
          </div>
        )}

        {/* Place & Category in 2-Column row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Origen/Lugar (Store/Place) */}
          <div className="relative">
            <label htmlFor="input-product-place" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>¿En qué lugar?</span>
              <span className="text-[10px] text-slate-400 capitalize">Ej. Mercado, Farmacia</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <MapPin className="w-4 h-4" />
              </span>
              <select
                id="input-product-place"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 rounded-2xl text-slate-800 focus:outline-none transition duration-150 appearance-none text-sm cursor-pointer"
              >
                <option value="">Selecciona un lugar</option>
                {existingPlaces.map((existingPlace) => (
                  <option key={existingPlace} value={existingPlace}>
                    {existingPlace}
                  </option>
                ))}
              </select>
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label htmlFor="input-product-category" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Categoría
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Grid className="w-4 h-4" />
              </span>
              <select
                id="input-product-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 rounded-2xl text-slate-800 focus:outline-none transition duration-150 appearance-none text-sm cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nueva categoria"
                className="w-full px-3 py-2 bg-white border border-slate-300 shadow-sm rounded-xl text-xs text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onAddCategory(newCategoryName);
                  setNewCategoryName('');
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Add Place */}
          <div>
            <label htmlFor="input-new-place" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Agregar lugar
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-new-place"
                type="text"
                value={newPlaceName}
                onChange={(e) => setNewPlaceName(e.target.value)}
                placeholder="Ej. Mercado Central"
                className="w-full px-3 py-2 bg-white border border-slate-300 shadow-sm rounded-xl text-xs text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onAddPlace(newPlaceName);
                  setNewPlaceName('');
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                Guardar
              </button>
            </div>
          </div>

        </div>

        {/* Price & Quantity in 2-Column row */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          
          {/* Price */}
          <div>
            <label htmlFor="input-product-price" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Precio Estimado ($)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <DollarSign className="w-4 h-4" />
              </span>
              <input
                id="input-product-price"
                type="number"
                step="0.01"
                min="0"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-3 bg-white border border-slate-300 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none transition duration-150 text-sm"
              />
            </div>
          </div>

          {/* Quantity Selector with Plus and Minus */}
          <div>
            <label htmlFor="input-product-quantity" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Cantidad
            </label>
            <div className="flex items-center border border-slate-300 bg-white rounded-2xl overflow-hidden h-[46px] shadow-sm">
              <button
                type="button"
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                className="px-3.5 h-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition font-bold cursor-pointer"
                id="qty-minus"
              >
                -
              </button>
              <input
                id="input-product-quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-center bg-transparent border-none text-slate-800 font-semibold focus:outline-none text-sm [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity(prev => prev + 1)}
                className="px-3.5 h-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition font-bold cursor-pointer"
                id="qty-plus"
              >
                +
              </button>
            </div>
          </div>

        </div>

        {/* Payment Method */}
        <div>
          <label htmlFor="input-payment-method" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Metodo de pago
          </label>
          <div className="relative">
            <select
              id="input-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-300 shadow-sm focus:border-slate-400 focus:ring-2 focus:ring-slate-200 rounded-2xl text-slate-800 focus:outline-none transition duration-150 appearance-none text-sm cursor-pointer"
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

        {/* Cost Estimation Preview */}
        <div className="p-4 bg-slate-100/60 rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-600" id="form-estimate-preview">
          <span className="flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Cálculo estimado:
          </span>
          <span className="font-bold text-slate-800 text-sm">
            {quantity} × ${currentPrice.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = 
            <span className="text-indigo-600 ml-1">
              ${draftTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 px-4 rounded-2xl transition duration-150 shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
          id="add-item-submit-btn"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar a la Lista</span>
        </button>

      </form>
    </div>
  );
}
