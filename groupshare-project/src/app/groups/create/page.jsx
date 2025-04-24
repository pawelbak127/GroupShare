'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField, SubmitButton } from '@/components/forms';
import { toast } from '@/lib/utils/notification';

export default function CreateGroupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'private',
    visibility: 'private' // Nowe pole
  });
  const [errors, setErrors] = useState({});

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
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nazwa grupy jest wymagana';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Nazwa grupy musi mieć co najmniej 3 znaki';
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
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          privacy: formData.privacy,
          visibility: formData.visibility
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Nie udało się utworzyć grupy');
      }
      
      toast.success('Grupa została utworzona pomyślnie!');
      router.push(`/groups/${data.id || data.data?.id}`);
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error(error.message || 'Wystąpił błąd podczas tworzenia grupy');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Utwórz nową grupę</h1>
        <p className="mt-1 text-sm text-gray-500">
          Stwórz grupę, aby zarządzać subskrypcjami i udostępniać je innym
        </p>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <FormField
            label="Nazwa grupy"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
            required
            placeholder="np. Przyjaciele, Rodzina, Współlokatorzy"
            helper="Używaj nazwy, którą łatwo rozpoznają członkowie twojej grupy"
          />
          
          <FormField
            label="Opis grupy"
            name="description"
            type="textarea"
            value={formData.description}
            onChange={handleChange}
            error={errors.description}
            rows={3}
            placeholder="Krótki opis celu i zasad grupy (opcjonalne)"
            helper="Dobry opis pomoże członkom zrozumieć cel grupy"
          />
          
          <FormField
            label="Prywatność grupy"
            name="privacy"
            type="select"
            value={formData.privacy}
            onChange={handleChange}
            error={errors.privacy}
            required
            options={[
              { value: 'private', label: 'Prywatna - Tylko zaproszeni użytkownicy mogą dołączyć' },
              { value: 'restricted', label: 'Ograniczona - Użytkownicy mogą prosić o dołączenie' },
              { value: 'public', label: 'Publiczna - Każdy może zobaczyć i dołączyć do grupy' }
            ]}
            helper="Prywatne grupy są widoczne tylko dla członków. Publiczne grupy są widoczne dla wszystkich."
          />
          
          <FormField
            label="Widoczność grupy"
            name="visibility"
            type="select"
            value={formData.visibility}
            onChange={handleChange}
            error={errors.visibility}
            required
            options={[
              { value: 'private', label: 'Prywatna - Widoczna tylko dla członków' },
              { value: 'public', label: 'Publiczna - Widoczna dla wszystkich' }
            ]}
            helper="Prywatne grupy wymagają zaproszenia. Publiczne grupy są widoczne dla wszystkich."
          />
          
          <div className="pt-5 border-t border-gray-200 flex justify-end space-x-3">
            <Link
              href="/groups"
              className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Anuluj
            </Link>
            
            <SubmitButton
              label="Utwórz grupę"
              isSubmitting={isSubmitting}
              loadingLabel="Tworzenie..."
            />
          </div>
        </form>
      </div>
    </div>
  );
}