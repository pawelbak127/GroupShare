'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FormField, SubmitButton } from '@/components/forms';
import { toast } from '@/lib/utils/notification';

const CreateOfferForm = ({ groupId, platforms = [] }) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    platformId: '',
    pricePerSlot: '',
    slotsTotal: '',
    currency: 'PLN',
    accessInstructions: '',
    durationMonths: '1' // Wartość domyślna
  });
  const [errors, setErrors] = useState({});

  // Zwykła walidacja formularza przed wysłaniem
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.platformId) {
      newErrors.platformId = 'Wybierz platformę subskrypcji';
    }
    
    if (!formData.pricePerSlot) {
      newErrors.pricePerSlot = 'Wprowadź cenę za miejsce';
    } else if (isNaN(formData.pricePerSlot) || parseFloat(formData.pricePerSlot) <= 0) {
      newErrors.pricePerSlot = 'Cena musi być liczbą większą od zera';
    }
    
    if (!formData.slotsTotal) {
      newErrors.slotsTotal = 'Wprowadź liczbę dostępnych miejsc';
    } else if (isNaN(formData.slotsTotal) || parseInt(formData.slotsTotal) <= 0) {
      newErrors.slotsTotal = 'Liczba miejsc musi być liczbą całkowitą większą od zera';
    }
    
    if (!formData.accessInstructions.trim()) {
      newErrors.accessInstructions = 'Wprowadź instrukcje dostępowe';
    } else if (formData.accessInstructions.trim().length < 10) {
      newErrors.accessInstructions = 'Instrukcje dostępowe są zbyt krótkie (minimum 10 znaków)';
    }
    
    if (!formData.durationMonths) {
      newErrors.durationMonths = 'Wybierz czas trwania subskrypcji';
    } else if (isNaN(formData.durationMonths) || parseInt(formData.durationMonths) <= 0) {
      newErrors.durationMonths = 'Czas trwania musi być liczbą większą od zera';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Obsługa zmiany pola formularza
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Usuń błąd dla tego pola, gdy użytkownik zacznie je edytować
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Wysłanie formularza
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Formularz zawiera błędy. Popraw je przed wysłaniem.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Przygotuj dane do wysłania
      const offerData = {
        groupId,
        platformId: formData.platformId,
        pricePerSlot: parseFloat(formData.pricePerSlot),
        slotsTotal: parseInt(formData.slotsTotal),
        currency: formData.currency,
        accessInstructions: formData.accessInstructions,
        durationMonths: parseInt(formData.durationMonths) // Dodajemy czas trwania
      };
      
      // Wyślij dane do API
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(offerData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Wystąpił błąd podczas tworzenia oferty');
      }
      
      // Powiadomienie o sukcesie
      toast.success('Oferta została pomyślnie utworzona!');
      
      // Przekieruj z powrotem do strony grupy
      router.push(`/groups/${groupId}`);
    } catch (error) {
      console.error('Error creating offer:', error);
      toast.error(error.message || 'Wystąpił błąd podczas tworzenia oferty');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormField
          label="Platforma subskrypcji"
          name="platformId"
          type="select"
          value={formData.platformId}
          onChange={handleChange}
          error={errors.platformId}
          required
          options={[
            { value: '', label: 'Wybierz platformę...' },
            ...platforms.map(platform => ({
              value: platform.id,
              label: platform.name
            }))
          ]}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Cena za miejsce"
            name="pricePerSlot"
            type="number"
            value={formData.pricePerSlot}
            onChange={handleChange}
            error={errors.pricePerSlot}
            required
            min="0.01"
            step="0.01"
            prefix="PLN"
            helper="Miesięczna cena za każde miejsce w subskrypcji"
          />
          
          <FormField
            label="Liczba dostępnych miejsc"
            name="slotsTotal"
            type="number"
            value={formData.slotsTotal}
            onChange={handleChange}
            error={errors.slotsTotal}
            required
            min="1"
            step="1"
            helper="Jak wiele miejsc chcesz udostępnić w tej subskrypcji"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Waluta"
            name="currency"
            type="select"
            value={formData.currency}
            onChange={handleChange}
            error={errors.currency}
            required
            options={[
              { value: 'PLN', label: 'PLN - Polski złoty' },
              { value: 'EUR', label: 'EUR - Euro' },
              { value: 'USD', label: 'USD - Dolar amerykański' }
            ]}
          />
          
          <FormField
            label="Czas trwania (miesiące)"
            name="durationMonths"
            type="select"
            value={formData.durationMonths}
            onChange={handleChange}
            error={errors.durationMonths}
            required
            options={[
              { value: '1', label: '1 miesiąc' },
              { value: '3', label: '3 miesiące' },
              { value: '6', label: '6 miesięcy' },
              { value: '12', label: '12 miesięcy (1 rok)' },
              { value: '24', label: '24 miesiące (2 lata)' }
            ]}
            helper="Określa jak długo będzie trwała subskrypcja"
          />
        </div>
        
        <FormField
          label="Instrukcje dostępowe"
          name="accessInstructions"
          type="textarea"
          value={formData.accessInstructions}
          onChange={handleChange}
          error={errors.accessInstructions}
          required
          rows={8}
          helper="Wprowadź szczegółowe instrukcje, jak uzyskać dostęp do subskrypcji (dane logowania, kroki konfiguracji, itp.). Te dane będą zaszyfrowane i udostępniane tylko po opłaceniu dostępu."
        />
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Informacja o bezpieczeństwie</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Upewnij się, że podane instrukcje są kompletne i dokładne. Będą one widoczne tylko dla osób, które dokonały płatności za dostęp.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => router.push(`/groups/${groupId}`)}
            disabled={isSubmitting}
          >
            Anuluj
          </button>
          
          <SubmitButton
            label="Utwórz ofertę"
            isSubmitting={isSubmitting}
            loadingLabel="Tworzenie..."
          />
        </div>
      </form>
    </div>
  );
};

export default CreateOfferForm;