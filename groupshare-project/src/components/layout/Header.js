// src/components/layout/Header.jsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import NotificationBell from '../notifications/NotificationBell';

/**
 * Navigation header component
 */
const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Close mobile menu
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Check if link is active
  const isActiveLink = (path) => {
    if (path === '/' && pathname === '/') {
      return true;
    }
    
    if (path !== '/' && pathname.startsWith(path)) {
      return true;
    }
    
    return false;
  };

  return (
    <header className="bg-white shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Top">
        <div className="w-full py-4 flex items-center justify-between border-b border-indigo-500 lg:border-none">
          {/* Logo and site name */}
          <div className="flex items-center">
            <Link href="/" onClick={closeMobileMenu}>
              <span className="sr-only">GroupShare</span>
              <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold">
                G
              </div>
            </Link>
            <div className="ml-3 flex items-baseline space-x-4">
              <Link 
                href="/" 
                className="text-xl font-bold text-gray-900 hover:text-gray-700"
                onClick={closeMobileMenu}
              >
                GroupShare
              </Link>
            </div>
          </div>

          {/* Desktop navigation */}
          <div className="hidden lg:flex lg:items-center lg:space-x-6">
            <div className="flex space-x-6 mr-6">
              <Link
                href="/offers"
                className={`px-1 py-2 text-sm font-medium ${
                  isActiveLink('/offers')
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
                }`}
              >
                Przeglądaj oferty
              </Link>
              
              <SignedIn>
                <Link
                  href="/dashboard"
                  className={`px-1 py-2 text-sm font-medium ${
                    isActiveLink('/dashboard')
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
                  }`}
                >
                  Mój panel
                </Link>
                <Link
                  href="/groups"
                  className={`px-1 py-2 text-sm font-medium ${
                    isActiveLink('/groups')
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
                  }`}
                >
                  Moje grupy
                </Link>
              </SignedIn>
              
              <Link
                href="/how-it-works"
                className={`px-1 py-2 text-sm font-medium ${
                  isActiveLink('/how-it-works')
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
                }`}
              >
                Jak to działa
              </Link>
            </div>
            
            <SignedIn>
              {/* Notification Bell */}
              <div className="mr-4">
                <NotificationBell />
              </div>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            
            <SignedOut>
              <div className="flex items-center space-x-4">
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Zaloguj się
                </Link>
                
                <Link
                  href="/sign-up"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                >
                  Zarejestruj się
                </Link>
              </div>
            </SignedOut>
          </div>

          {/* Mobile menu button */}
          <div className="flex lg:hidden">
            <SignedIn>
              {/* Notification Bell for mobile */}
              <div className="mr-2">
                <NotificationBell />
              </div>
            </SignedIn>
            
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              aria-expanded="false"
              onClick={toggleMobileMenu}
            >
              <span className="sr-only">Otwórz menu</span>
              {mobileMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden">
            <div className="pt-2 pb-3 space-y-1">
              <Link
                href="/offers"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActiveLink('/offers')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                onClick={closeMobileMenu}
              >
                Przeglądaj oferty
              </Link>
              
              <SignedIn>
                <Link
                  href="/dashboard"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActiveLink('/dashboard')
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={closeMobileMenu}
                >
                  Mój panel
                </Link>
                <Link
                  href="/groups"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActiveLink('/groups')
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={closeMobileMenu}
                >
                  Moje grupy
                </Link>
                <Link
                  href="/notifications"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActiveLink('/notifications')
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={closeMobileMenu}
                >
                  Powiadomienia
                </Link>
              </SignedIn>
              
              <Link
                href="/how-it-works"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActiveLink('/how-it-works')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                onClick={closeMobileMenu}
              >
                Jak to działa
              </Link>
              
              <SignedOut>
                <Link
                  href="/sign-in"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  onClick={closeMobileMenu}
                >
                  Zaloguj się
                </Link>
                <Link
                  href="/sign-up"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  onClick={closeMobileMenu}
                >
                  Zarejestruj się
                </Link>
              </SignedOut>
            </div>
            
            <SignedIn>
              <div className="pt-4 pb-3 border-t border-gray-200">
                <div className="flex items-center px-4">
                  <div className="flex-shrink-0">
                    <UserButton />
                  </div>
                </div>
              </div>
            </SignedIn>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;