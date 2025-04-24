// src/components/offers/OfferCard.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from '@/lib/utils/notification';
import { useOffersApi } from '@/hooks/api-hooks';

/**
 * Komponent karty oferty - wyświetla pojedynczą ofertę subskrypcji
 * @param {Object} offer - Dane oferty
 */
const OfferCard = ({ offer }) => {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Użyj API hooka do obsługi zakupu
  const { purchaseOffer } = useOffersApi();
  
  /**
   * Oblicza pozostały czas subskrypcji
   */
  const calculateTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    
    // Jeśli data już minęła
    if (expiryDate <= now) {
      return { expired: true, text: 'Wygasło' };
    }
    
    // Oblicz różnicę w dniach
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
      const diffMonths = Math.floor(diffDays / 30);
      return { expired: false, text: `${diffMonths} mies.` };
    } else {
      return { expired: false, text: `${diffDays} dni` };
    }
  };
  
  /**
   * Obsługuje proces zakupu oferty
   */
  const handlePurchase = async () => {
    // Przekieruj do logowania jeśli użytkownik nie jest zalogowany
    if (!isSignedIn) {
      router.push(`/sign-in?redirect=${encodeURIComponent(`/offers/${offer.id}`)}`);
      return;
    }
    
    // Sprawdź czy oferta ma dostępne miejsca
    if (offer.slots_available <= 0) {
      toast.error('Brak dostępnych miejsc');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Inicjuj zakup przez API
      const purchaseData = await purchaseOffer(offer.id);
      
      // Przekieruj do strony płatności
      router.push(`/checkout/${purchaseData.purchase?.id || purchaseData.id}`);
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(error.message || 'Wystąpił błąd podczas inicjowania zakupu');
      setIsLoading(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Treść karty z informacjami o ofercie */}
      <div className="p-6">
        <div className="flex items-center mb-4">
          {/* Logo i nazwa platformy */}
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
            {offer.subscription_platforms?.icon ? (
              <img 
                src={offer.subscription_platforms.icon} 
                alt={offer.subscription_platforms.name} 
                className="w-6 h-6 object-contain"
              />
            ) : (
              <span className="text-gray-500 text-xs font-bold">
                {offer.subscription_platforms?.name?.slice(0, 2) || 'SP'}
              </span>
            )}
          </div>
          <h3 className="ml-3 font-semibold text-gray-900">
            {offer.subscription_platforms?.name || 'Subskrypcja'}
          </h3>
          
          <span className="ml-3 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
            Natychmiastowy dostęp
          </span>

          {/* Jeśli grupa jest prywatna, wyświetl informację */}
          {offer.groups?.visibility === 'private' && (
            <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
              Grupa prywatna
            </span>
          )}
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Cena za miejsce:</span>
            <span className="font-medium text-gray-900">
              {offer.price_per_slot.toFixed(2)} {offer.currency} / mies.
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Dostępne miejsca:</span>
            <span className="font-medium text-gray-900">
              {offer.slots_available} / {offer.slots_total}
            </span>
          </div>
          {offer.expires_at && (
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Pozostały czas:</span>
              {(() => {
                const timeRemaining = calculateTimeRemaining(offer.expires_at);
                return (
                  <span className={`font-medium ${timeRemaining?.expired ? 'text-red-600' : 'text-green-600'}`}>
                    {timeRemaining?.text || 'Nie określono'}
                  </span>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      
      {/* Przycisk zakupu */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <div className="flex items-center">
          {offer.owner?.user_profiles && (
            <div className="flex items-center">
              <div className="w-6 h-6 bg-gray-200 rounded-full overflow-hidden">
                {offer.owner.user_profiles.avatar_url ? (
                  <img 
                    src={offer.owner.user_profiles.avatar_url} 
                    alt={offer.owner.user_profiles.display_name} 
                    className="w-6 h-6 object-cover"
                  />
                ) : (
                  <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-500">
                    {offer.owner.user_profiles.display_name?.slice(0, 1) || '?'}
                  </span>
                )}
              </div>
              <span className="ml-2 text-sm text-gray-600">
                {offer.owner.user_profiles.display_name || 'Sprzedający'}
              </span>
            </div>
          )}
        </div>
        
        <button 
          className={`px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
            ${(offer.slots_available <= 0 || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handlePurchase}
          disabled={offer.slots_available <= 0 || isLoading}
        >
          {isLoading ? 'Przetwarzanie...' : 
           offer.slots_available <= 0 ? 'Brak miejsc' : 'Kup teraz'}
        </button>
      </div>
    </div>
  );
};

export default OfferCard;