// src/lib/api/error-handler.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

/**
 * Standardowa obsługa błędów API
 * @param {Error} error - Obiekt błędu
 * @param {string|null} message - Opcjonalny komunikat błędu
 * @param {number} status - Kod statusu HTTP (opcjonalny, domyślnie 500)
 * @returns {NextResponse} - Ujednolicona odpowiedź błędu
 */
export function handleApiError(error, message = null, status = 500) {
  console.error('API error:', error);
  
  // Upewnij się, że status jest liczbą w zakresie 200-599
  let statusCode = status;
  if (typeof statusCode !== 'number' || statusCode < 200 || statusCode > 599) {
    console.warn(`Invalid status code: ${statusCode}, defaulting to 500`);
    statusCode = 500;
  }
  
  // Ustal szczegóły błędu
  let errorMessage = message || error.message || 'Wystąpił nieoczekiwany błąd';
  let errorCode = error.code || 'unknown_error';
  let details = error.details || null;
  
  // Obsługa standardowych kodów błędów Supabase
  if (error.code === 'PGRST116') {
    statusCode = 404;
    errorMessage = message || 'Żądany zasób nie został znaleziony';
    errorCode = 'not_found';
  } else if (error.code === '42501') {
    statusCode = 403;
    errorMessage = message || 'Brak uprawnień do wykonania tej operacji';
    errorCode = 'permission_denied';
  } else if (error.code === '23505') {
    statusCode = 409;
    errorMessage = message || 'Zasób o podanych danych już istnieje';
    errorCode = 'resource_conflict';
  } else if (error.code === '23502') {
    statusCode = 400;
    errorMessage = message || 'Brak wymaganego pola';
    errorCode = 'missing_required_field';
  }
  
  // Zwróć ustandaryzowaną odpowiedź błędu
  return NextResponse.json(
    { 
      error: true, 
      message: errorMessage, 
      code: errorCode, 
      details, 
      timestamp: new Date().toISOString(),
      data: [] // Dodano pustą tablicę dla kompatybilności z klientem
    }, 
    { status: statusCode }
  );
}

/**
 * Generator odpowiedzi sukcesu API
 * @param {any} data - Dane do zwrócenia
 * @param {number} status - Kod statusu HTTP (opcjonalny, domyślnie 200)
 * @param {string} message - Opcjonalna wiadomość sukcesu
 * @returns {NextResponse} - Ujednolicona odpowiedź sukcesu
 */
export function apiResponse(data, status = 200, message = null) {
  // Upewnij się, że status jest liczbą w zakresie 200-599
  if (typeof status !== 'number' || status < 200 || status > 599) {
    console.warn(`Invalid status code: ${status}, defaulting to 200`);
    status = 200;
  }
  
  // Jeśli dane są null lub undefined, zwróć pustą tablicę
  const sanitizedData = data === null || data === undefined ? [] : data;
  
  const response = {
    success: true,
    data: sanitizedData
  };
  
  if (message) {
    response.message = message;
  }
  
  return NextResponse.json(response, { status });
}

/**
 * Sprawdza, czy żądanie zawiera poprawne dane
 * @param {Object} schema - Schemat walidacji (prosty obiekt z polami i warunkami)
 * @param {Object} body - Ciało żądania do walidacji
 * @returns {Object} - Obiekt { isValid, errors }
 */
export function validateRequestBody(schema, body) {
  const errors = {};
  let isValid = true;
  
  // Sprawdź, czy wszystkie wymagane pola są obecne
  for (const [field, requirements] of Object.entries(schema)) {
    if (requirements.required && (body[field] === undefined || body[field] === null || body[field] === '')) {
      errors[field] = `Pole '${field}' jest wymagane`;
      isValid = false;
      continue;
    }
    
    if (body[field] === undefined) continue;
    
    // Sprawdź typ
    if (requirements.type && typeof body[field] !== requirements.type) {
      errors[field] = `Pole '${field}' musi być typu ${requirements.type}`;
      isValid = false;
    }
    
    // Sprawdź minimalną wartość dla liczb
    if (requirements.min !== undefined && typeof body[field] === 'number' && body[field] < requirements.min) {
      errors[field] = `Pole '${field}' musi być większe lub równe ${requirements.min}`;
      isValid = false;
    }
    
    // Sprawdź maksymalną wartość dla liczb
    if (requirements.max !== undefined && typeof body[field] === 'number' && body[field] > requirements.max) {
      errors[field] = `Pole '${field}' musi być mniejsze lub równe ${requirements.max}`;
      isValid = false;
    }
    
    // Sprawdź minimalną długość dla stringów
    if (requirements.minLength !== undefined && typeof body[field] === 'string' && body[field].length < requirements.minLength) {
      errors[field] = `Pole '${field}' musi mieć co najmniej ${requirements.minLength} znaków`;
      isValid = false;
    }
    
    // Sprawdź maksymalną długość dla stringów
    if (requirements.maxLength !== undefined && typeof body[field] === 'string' && body[field].length > requirements.maxLength) {
      errors[field] = `Pole '${field}' może mieć maksymalnie ${requirements.maxLength} znaków`;
      isValid = false;
    }
    
    // Sprawdź wzorzec regex
    if (requirements.pattern && typeof body[field] === 'string' && !requirements.pattern.test(body[field])) {
      errors[field] = requirements.patternMessage || `Pole '${field}' ma nieprawidłowy format`;
      isValid = false;
    }
  }
  
  return { isValid, errors };
}

/**
 * Główna funkcja ochrony API - weryfikuje, autoryzuje i waliduje żądanie
 * @param {Function} handler - Funkcja obsługi żądania API
 * @param {Object} options - Opcje ochrony
 * @returns {Function} - Middleware zabezpieczające funkcję API
 */
export function protectApiRoute(handler, options = {}) {
  const { requireAuth = true, requiredRole = null, validationSchema = null } = options;
  
  return async (request, context) => {
    try {
      // 1. Sprawdź uwierzytelnienie, jeśli wymagane
      if (requireAuth) {
        const user = await currentUser();
        if (!user) {
          return NextResponse.json(
            { error: true, message: 'Unauthorized', code: 'unauthorized', data: [] },
            { status: 401 }
          );
        }
        
        // Dołącz użytkownika do kontekstu dla funkcji obsługi
        context.user = user;
        
        // Sprawdź rolę, jeśli wymagana
        if (requiredRole) {
          // Implementacja sprawdzania roli (uproszczona)
          const hasRole = await checkUserRole(user, requiredRole);
          if (!hasRole) {
            return NextResponse.json(
              { error: true, message: 'Insufficient permissions', code: 'forbidden', data: [] },
              { status: 403 }
            );
          }
        }
      }
      
      // 2. Sprawdź, czy mamy schemat walidacji dla metody POST/PUT/PATCH
      if (validationSchema && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const body = await request.json().catch(() => ({}));
        const { isValid, errors } = validateRequestBody(validationSchema, body);
        
        if (!isValid) {
          return NextResponse.json(
            { 
              error: true, 
              message: 'Validation failed', 
              code: 'validation_error', 
              details: errors,
              data: [] 
            },
            { status: 400 }
          );
        }
        
        // Przekaż zwalidowane dane do handlera
        request.validatedBody = body;
      }
      
      // 3. Przekaż do właściwego handlera
      return handler(request, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}