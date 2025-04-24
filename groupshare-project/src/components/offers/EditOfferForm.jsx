'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FormField, SubmitButton } from '@/components/forms';
import { toast } from '@/lib/utils/notification';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const EditOfferForm = ({ offerId }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [platforms, setPlatforms] = useState([]);
  const [formData, setFormData] = useState({
    pricePerSlot: '',
    slotsTotal: '',
    slotsAvailable: '',
    status: '',
    currency: 'PLN',
    accessInstructions: ''
  });
  const [errors, setErrors] = useState({});
  const [originalOffer, setOriginalOffer] = useState(null);
  const [groupId, setGroupId] = useState(null);

  // Pobierz dane oferty i platformy
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Pobierz dostępne platformy
        const platformsResponse = await fetch('/api/platforms');
        
        if (!platformsResponse.ok) {
          throw new Error('Nie udało się pobrać listy platform');
        }
        
        const platformsData = await platformsResponse.json();
        setPlatforms(platformsData);
        
        // Pobierz dane oferty
        const offerResponse = await fetch(`/api/offers/${offerId}`);
        
        if (!offerResponse.ok) {
          throw new Error('Nie udało się pobrać danych oferty');
        }
        
        const offerData = await offerResponse.json();
        setOriginalOffer(offerData);
        
        // Pobierz ID grupy
        if (offerData.groups) {
          setGroupId(offerData.groups.id);
        } else if (offerData.group_id) {
          setGroupId(offerData.group_id);
        }
        
        // Wypełnij formularz danymi
        setFormData({
          pricePerSlot: offerData.price_per_slot || '',
          slotsTotal: offerData.slots_total || '',
          slotsAvailable: offerData.slots_available || '',
          status: offerData.status || 'active',
          currency: offerData.currency || 'PLN',
          accessInstructions: '' // Instrukcje dostępowe nie są zwracane z API ze względów bezpieczeństwa
        });
      } catch (err) {
        console.error('Error fetching offer data:', err);
        toast.error(err.message || 'Wystąpił błąd podczas pobierania danych');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (offerId) {
      fetchData();
    }
  }, [offerId]);

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

  // Walidacja formularza
  const validateForm = () => {
    const newErrors = {};
    
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
    
    if (formData.slotsAvailable !== '' && (isNaN(formData.slotsAvailable) || parseInt(formData.slotsAvailable) < 0)) {
      newErrors.slotsAvailable = 'Liczba dostępnych miejsc nie może być ujemna';
    }
    
    if (parseInt(formData.slotsAvailable) > parseInt(formData.slotsTotal)) {
      newErrors.slotsAvailable = 'Liczba dostępnych miejsc nie może być większa niż całkowita liczba miejsc';
    }
    
    if (!formData.status) {
      newErrors.status = 'Wybierz status oferty';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      // Przygotuj dane do aktualizacji
      const updates = {
        pricePerSlot: parseFloat(formData.pricePerSlot),
        slotsTotal: parseInt(formData.slotsTotal),
        status: formData.status,
        currency: formData.currency
      };
      
      // Dodaj liczbę dostępnych miejsc tylko jeśli została zmieniona
      if (formData.slotsAvailable !== '') {
        updates.slotsAvailable = parseInt(formData.slotsAvailable);
      }
      
      // Dodaj instrukcje dostępowe tylko jeśli zostały wprowadzone
      if (formData.accessInstructions.trim()) {
        updates.accessInstructions = formData.accessInstructions.trim();
      }
      
      // Wyślij dane do API
      const response = await fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Wystąpił błąd podczas aktualizacji oferty');
      }
      
      // Powiadomienie o sukcesie
      toast.success('Oferta została pomyślnie zaktualizowana!');
      
      // Przekieruj z powrotem do strony grupy
      if (groupId) {
        router.push(`/groups/${groupId}`);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error updating offer:', error);
      toast.error(error.message || 'Wystąpił błąd podczas aktualizacji oferty');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Wyświetl spinner podczas ładowania
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Wyświetl błąd, jeśli nie udało się pobrać danych oferty
  if (!originalOffer) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
        Nie udało się pobrać danych oferty. Spróbuj ponownie później.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informacja o platformie (tylko do odczytu) */}
        <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
          <h3 className="text-lg font-medium mb-2">Informacje o platformie</h3>
          <p className="text-gray-700">
            <strong>Platforma:</strong>{' '}
            {originalOffer.subscription_platforms?.name || 'Nieznana platforma'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Platforma nie może zostać zmieniona po utworzeniu oferty.
          </p>
        </div>
        
        {/* Formularz edycji */}
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
            label="Łączna liczba miejsc"
            name="slotsTotal"
            type="number"
            value={formData.slotsTotal}
            onChange={handleChange}
            error={errors.slotsTotal}
            required
            min="1"
            step="1"
            helper="Łączna liczba miejsc w ofercie"
          />
          
          <FormField
            label="Dostępne miejsca"
            name="slotsAvailable"
            type="number"
            value={formData.slotsAvailable}
            onChange={handleChange}
            error={errors.slotsAvailable}
            min="0"
            step="1"
            helper="Liczba miejsc dostępnych do zakupu (opcjonalnie)"
          />
          
          <FormField
            label="Status oferty"
            name="status"
            type="select"
            value={formData.status}
            onChange={handleChange}
            error={errors.status}
            required
            options={[
              { value: 'active', label: 'Aktywna' },
              { value: 'inactive', label: 'Nieaktywna' },
              { value: 'paused', label: 'Wstrzymana' }
            ]}
            helper="Status określa widoczność i dostępność oferty"
          />
        </div>
        
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
          label="Instrukcje dostępowe (opcjonalnie)"
          name="accessInstructions"
          type="textarea"
          value={formData.accessInstructions}
          onChange={handleChange}
          error={errors.accessInstructions}
          rows={6}
          helper="Wprowadź nowe instrukcje dostępowe lub pozostaw puste, aby zachować obecne"
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
              <div className="mt-1 text-sm text-yellow-700">
                <p>
                  Jeśli wprowadzisz nowe instrukcje dostępowe, zastąpią one obecne. Pozostaw to pole puste, jeśli chcesz zachować dotychczasowe instrukcje.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => groupId ? router.push(`/groups/${groupId}`) : router.push('/dashboard')}
            disabled={isSubmitting}
          >
            Anuluj
          </button>
          
          <SubmitButton
            label="Zapisz zmiany"
            isSubmitting={isSubmitting}
            loadingLabel="Zapisywanie..."
          />
        </div>
      </form>
    </div>
  );
};

export default EditOfferForm;