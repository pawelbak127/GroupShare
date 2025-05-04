'use client';

import { useState } from 'react';
import { 
    FunnelIcon as FilterIcon, 
    CheckIcon 
  } from '@heroicons/react/24/outline';

/**
 * Uproszczone filtry powiadomień dla MVP
 */
const NotificationFilters = ({ initialFilters = {}, onFilterChange, onMarkAllAsRead }) => {
  const [filters, setFilters] = useState({
    type: initialFilters.type || '',
    read: initialFilters.read || '',
  });
  const [isExpanded, setIsExpanded] = useState(false);

  // Obsługa zmiany filtra
  const handleFilterChange = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Obsługa czyszczenia filtrów
  const handleClearFilters = () => {
    const clearedFilters = {
      type: '',
      read: '',
    };
    
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  return (
    <div className="border-b border-gray-200">
      {/* Pasek filtrów */}
      <div className="px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Powiadomienia</h3>
        
        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <FilterIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
            Filtry
          </button>
          
          <button
            type="button"
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={onMarkAllAsRead}
          >
            <CheckIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
            Oznacz wszystkie jako przeczytane
          </button>
        </div>
      </div>

      {/* Uproszczony panel filtrów */}
      {isExpanded && (
        <div className="px-4 py-4 border-t border-gray-200 bg-gray-50 grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-6">
          {/* Filtr typu */}
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700">
              Typ
            </label>
            <select
              id="type-filter"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <option value="">Wszystkie typy</option>
              <option value="invite">Zaproszenia</option>
              <option value="message">Wiadomości</option>
              <option value="payment">Płatności</option>
              <option value="access">Dostęp</option>
              <option value="system">Systemowe</option>
            </select>
          </div>

          {/* Filtr przeczytane/nieprzeczytane */}
          <div>
            <label htmlFor="read-filter" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="read-filter"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={filters.read}
              onChange={(e) => handleFilterChange('read', e.target.value)}
            >
              <option value="">Wszystkie</option>
              <option value="false">Nieprzeczytane</option>
              <option value="true">Przeczytane</option>
            </select>
          </div>

          {/* Przycisk czyszczenia filtrów */}
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="button"
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={handleClearFilters}
            >
              Wyczyść filtry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationFilters;