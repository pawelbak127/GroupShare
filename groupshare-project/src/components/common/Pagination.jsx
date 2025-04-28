'use client';

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon
  } from '@heroicons/react/24/outline';

/**
 * Komponent paginacji do używania w różnych częściach aplikacji
 * @param {number} currentPage - Aktualna strona
 * @param {number} totalPages - Całkowita liczba stron
 * @param {function} onPageChange - Funkcja wywoływana przy zmianie strony
 * @param {number} maxVisiblePages - Maksymalna liczba widocznych przycisków stron (domyślnie 5)
 */
const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  maxVisiblePages = 5
}) => {
  // Nie pokazuj paginacji, jeśli mamy tylko jedną stronę
  if (totalPages <= 1) {
    return null;
  }

  // Funkcja generująca tablicę stron do wyświetlenia
  const getPageNumbers = () => {
    const pages = [];

    // Oblicz zakres stron do wyświetlenia
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Dostosuj zakres, aby zawsze pokazywać maxVisiblePages stron
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Generuj przyciski stron
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <nav className="flex items-center justify-between border-t border-gray-200 px-4 sm:px-0">
      <div className="hidden md:-mt-px md:flex md:flex-1 md:justify-between">
        {/* Przyciski Poprzednia/Pierwsza */}
        <div className="flex">
          {/* Pierwsza strona */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
              currentPage === 1
                ? 'cursor-not-allowed text-gray-300'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ChevronDoubleLeftIcon className="h-5 w-5 mr-1" />
            <span className="hidden lg:inline">Pierwsza</span>
          </button>

          {/* Poprzednia strona */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
              currentPage === 1
                ? 'cursor-not-allowed text-gray-300'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            <span>Poprzednia</span>
          </button>
        </div>

        {/* Numerowane strony */}
        <div className="hidden md:flex">
          {getPageNumbers().map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
                page === currentPage
                  ? 'border-indigo-500 text-indigo-600 border-b-2'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        {/* Przyciski Następna/Ostatnia */}
        <div className="flex">
          {/* Następna strona */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
              currentPage === totalPages
                ? 'cursor-not-allowed text-gray-300'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>Następna</span>
            <ChevronRightIcon className="h-5 w-5 ml-1" />
          </button>

          {/* Ostatnia strona */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
              currentPage === totalPages
                ? 'cursor-not-allowed text-gray-300'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="hidden lg:inline">Ostatnia</span>
            <ChevronDoubleRightIcon className="h-5 w-5 ml-1" />
          </button>
        </div>
      </div>

      {/* Mobilna paginacja */}
      <div className="flex md:hidden items-center justify-between w-full">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            currentPage === 1
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ChevronLeftIcon className="h-5 w-5" />
          <span className="sr-only">Poprzednia</span>
        </button>
        
        <span className="text-sm text-gray-700">
          Strona <span className="font-medium">{currentPage}</span> z{' '}
          <span className="font-medium">{totalPages}</span>
        </span>
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            currentPage === totalPages
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <ChevronRightIcon className="h-5 w-5" />
          <span className="sr-only">Następna</span>
        </button>
      </div>
    </nav>
  );
};

export default Pagination;