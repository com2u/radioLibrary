import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: null,
  de: null
};

async function loadTranslations(lang) {
  if (translations[lang]) return translations[lang];
  try {
    const res = await fetch(`/i18n/${lang}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    translations[lang] = data;
    return data;
  } catch (e) {
    console.error(`[i18n] Failed to load ${lang}.json:`, e.message);
    return {};
  }
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');
  const [dict, setDict] = useState({});

  useEffect(() => {
    loadTranslations(language).then(setDict);
  }, [language]);

  function t(key) {
    return dict[key] || key;
  }

  return (
    <LanguageContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
