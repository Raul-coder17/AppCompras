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
import { ShoppingItem, PREDEFINED_CATEGORIES } from '../types';

interface AddItemFormProps {
  onAddItem: (itemData: Omit<ShoppingItem, 'id' | 'createdAt'>) => void;
  existingPlaces: string[]; // For smart suggestions
}

export default function AddItemForm({ onAddItem, existingPlaces }: AddItemFormProps) {
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(PREDEFINED_CATEGORIES[0].id);
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false);

  // Filter recommendations based on current place text
  const suggestions = existingPlaces
    .filter(p => p && p.toLowerCase().includes(place.toLowerCase()) && p.toLowerCase() !== place.toLowerCase())
    .slice(0, 4);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedPrice = parseFloat(priceInput);
    const finalPrice = isNaN(parsedPrice) ? 0 : parsedPrice;
    const finalPlace = place.trim() || 'Cualquier lugar';

    onAddItem({
      name: name.trim(),
      place: finalPlace,
      price: finalPrice,
      quantity: Math.max(1, quantity),
      category: selectedCategory,
      bought: false
    });

    // Reset Form
    setName('');
    setPlace('');
    setPriceInput('');
    setQuantity(1);
    setSelectedCategory(PREDEFINED_CATEGORIES[0].id);
  };

  const currentPrice = parseFloat(priceInput) || 0;
  const draftTotal = currentPrice * quantity;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm" id="add-item-form-container">
      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-5">
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 text-sm font-bold">+</span>
        Planificar Nueva Compra
      </h3>

      <form onSubmit={handleSubmit} className="space-y-5" id="new-purchase-form">
        
        {/* Product Name */}
        <div>
          <label htmlFor="input-product-name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            ¿Qué vas a comprar? *
          </label>
          <input
            id="input-product-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Leche deslactosada, Zapatillas, Cafetera..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-2xl text-slate-800 font-medium placeholder-slate-400 focus:outline-none transition duration-150 text-sm"
          />
        </div>

        {/* Place & Category in 2-Column row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Origen/Lugar (Store/Place) */}
          <div className="relative">
            <label htmlFor="input-product-place" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>¿En qué lugar?</span>
              <span className="text-[10px] text-slate-400 capitalize">Ej. Mercadona, Amazon</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <MapPin className="w-4 h-4" />
              </span>
              <input
                id="input-product-place"
                type="text"
                value={place}
                onChange={(e) => {
                  setPlace(e.target.value);
                  setShowPlaceSuggestions(true);
                }}
                onFocus={() => setShowPlaceSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPlaceSuggestions(false), 200)}
                placeholder="Ej. Mercadona, Carrefour, Amazon..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none transition duration-150 text-sm"
              />
            </div>

            {/* Smart suggestions dropdown */}
            {showPlaceSuggestions && suggestions.length > 0 && (
              <div className="absolute z-15 w-full bg-white border border-slate-100 rounded-xl mt-1 shadow-lg overflow-hidden py-1" id="suggestions-box">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => {
                      setPlace(s);
                      setShowPlaceSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            )}
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
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-2xl text-slate-800 focus:outline-none transition duration-150 appearance-none text-sm cursor-pointer"
              >
                {PREDEFINED_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
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
                className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none transition duration-150 text-sm"
              />
            </div>
          </div>

          {/* Quantity Selector with Plus and Minus */}
          <div>
            <label htmlFor="input-product-quantity" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Cantidad
            </label>
            <div className="flex items-center border border-slate-200 bg-slate-50 rounded-2xl overflow-hidden h-[46px]">
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

        {/* Cost Estimation Preview */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs text-slate-600" id="form-estimate-preview">
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
