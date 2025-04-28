// src/lib/database/supabase-admin-client.js
import { createClient } from '@supabase/supabase-js';

// Inicjalizacja klienta Supabase z uprawnieniami administratora
// Dodajemy wartości domyślne w przypadku braku zmiennych środowiskowych
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Sprawdzenie czy zmienne środowiskowe są ustawione
if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
}

// Sprawdź, czy zmienne są poprawne przed utworzeniem klienta
const isConfigValid = supabaseUrl && supabaseServiceKey;

// Uwaga: Ten klient ma pełne uprawnienia do bazy danych, używaj ostrożnie!
const supabaseAdmin = isConfigValid 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

// Funkcja pomocnicza do obsługi błędów Supabase
export const handleSupabaseAdminError = (error) => {
  console.error('Supabase Admin error:', error);
  
  return {
    error: true,
    message: error.message || 'Nieoczekiwany błąd administratora',
    code: error.code || 'unknown_error',
    details: error.details || null,
  };
};

// Funkcje administratora do zarządzania użytkownikami

// Funkcja do tworzenia profilu użytkownika przez administratora
export const createUserProfileAdmin = async (userProfile) => {
  try {
    // Sprawdź czy klient jest dostępny
    if (!supabaseAdmin) {
      throw new Error('Database client is not initialized. Check environment variables.');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .insert([userProfile])
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        console.warn('Admin: Próba utworzenia duplikatu profilu użytkownika:', error);
        
        // Jeśli profil już istnieje, pobierz go
        const { data: existingUser, error: fetchError } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('external_auth_id', userProfile.external_auth_id)
          .single();
          
        if (fetchError) {
          throw new Error('Nie można pobrać istniejącego profilu: ' + fetchError.message);
        }
        
        return existingUser;
      } else {
        throw new Error(error.message || 'Nie udało się utworzyć profilu użytkownika');
      }
    }
    
    return data;
  } catch (error) {
    handleSupabaseAdminError(error);
    throw error;
  }
};

// Funkcja do pobierania profilu użytkownika przez administratora
export const getUserByAuthIdAdmin = async (authId) => {
  if (!authId) return null;
  
  try {
    // Sprawdź czy klient jest dostępny
    if (!supabaseAdmin) {
      throw new Error('Database client is not initialized. Check environment variables.');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('external_auth_id', authId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Nie znaleziono - to normalny przypadek
        return null;
      } else {
        console.error('Admin: Błąd pobierania profilu użytkownika:', error);
        throw new Error(error.message || 'Nie udało się pobrać profilu użytkownika');
      }
    }
    
    return data;
  } catch (error) {
    handleSupabaseAdminError(error);
    throw error;
  }
};

// Funkcja do aktualizacji profilu użytkownika przez administratora
export const updateUserProfileAdmin = async (userId, updates) => {
  try {
    // Sprawdź czy klient jest dostępny
    if (!supabaseAdmin) {
      throw new Error('Database client is not initialized. Check environment variables.');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    handleSupabaseAdminError(error);
    throw error;
  }
};

// Funkcja do pobierania platform subskrypcyjnych przez administratora
export const getSubscriptionPlatformsAdmin = async () => {
  try {
    // Sprawdź czy klient jest dostępny
    if (!supabaseAdmin) {
      throw new Error('Database client is not initialized. Check environment variables.');
    }

    const { data, error } = await supabaseAdmin
      .from('subscription_platforms')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    handleSupabaseAdminError(error);
    return [];
  }
};

// Funkcja do pobierania członków grupy przez administratora
export const getGroupMembersAdmin = async (groupId) => {
  try {
    // Sprawdź czy klient jest dostępny
    if (!supabaseAdmin) {
      throw new Error('Database client is not initialized. Check environment variables.');
    }

    const { data, error } = await supabaseAdmin
      .from('group_members')
      .select(`
        *,
        user:user_profiles(id, display_name, avatar_url, email)
      `)
      .eq('group_id', groupId);
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    handleSupabaseAdminError(error);
    return [];
  }
};

// Zapisz wszystkie aktywności administratora do logu bezpieczeństwa
export const logAdminActivity = async (action, resourceType, resourceId, details = {}) => {
  try {
    // Sprawdź czy klient jest dostępny
    if (!supabaseAdmin) {
      console.error('Database client is not initialized. Could not log activity.');
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('security_logs')
      .insert([{
        action_type: action,
        resource_type: resourceType,
        resource_id: resourceId,
        status: 'success',
        details: details,
      }]);
    
    if (error) console.error('Błąd logowania aktywności administratora:', error);
    
  } catch (error) {
    console.error('Wyjątek podczas logowania aktywności administratora:', error);
  }
};

// Funkcja do zarządzania powiadomieniami użytkowników
export const createNotification = async (userId, type, title, content, relatedEntityType = null, relatedEntityId = null) => {
  try {
    // Sprawdź czy klient jest dostępny
    if (!supabaseAdmin) {
      throw new Error('Database client is not initialized. Check environment variables.');
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert([{
        user_id: userId,
        type,
        title,
        content,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    handleSupabaseAdminError(error);
    throw error;
  }
};

// Funkcja do pobierania nieprzeczytanych powiadomień użytkownika
export const getUnreadNotificationsCount = async (userId) => {
  try {
    // Sprawdź czy klient jest dostępny
    if (!supabaseAdmin) {
      throw new Error('Database client is not initialized. Check environment variables.');
    }

    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) throw error;
    
    return count || 0;
  } catch (error) {
    handleSupabaseAdminError(error);
    return 0;
  }
};

// Sprawdź czy klient jest poprawnie skonfigurowany
if (!supabaseAdmin) {
  console.error('UWAGA: Klient supabaseAdmin nie został zainicjalizowany poprawnie. Upewnij się, że zmienne środowiskowe są ustawione.');
}

// Eksport klienta administratora jako domyślny
export default supabaseAdmin;