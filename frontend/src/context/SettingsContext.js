import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings(response.data.settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Set defaults
      setSettings({
        country: {
          currency_symbol: '$',
          currency_code: 'USD',
          date_format: 'MM/DD/YYYY'
        },
        tax: {
          tax_rate: 0,
          tax_name: 'Tax'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshSettings = async () => {
    await fetchSettings();
  };

  const currencySymbol = settings?.country?.currency_symbol || '$';
  const currencyCode = settings?.country?.currency_code || 'USD';
  const dateFormat = settings?.country?.date_format || 'MM/DD/YYYY';
  const taxRate = settings?.tax?.tax_rate || 0;
  const taxName = settings?.tax?.tax_name || 'Tax';

  // Format currency helper
  const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return `${currencySymbol}0.00`;
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  return (
    <SettingsContext.Provider value={{
      settings,
      loading,
      refreshSettings,
      currencySymbol,
      currencyCode,
      dateFormat,
      taxRate,
      taxName,
      formatCurrency
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export default SettingsContext;
