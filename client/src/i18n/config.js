import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import translationEN from './locales/en.json';
import translationPT from './locales/pt-BR.json';
import translationES from './locales/es.json';

const resources = {
  en: {
    translation: translationEN,
  },
  'pt-BR': {
    translation: translationPT,
  },
  /** Browsers often report `pt` without region — map to the same bundle as pt-BR */
  pt: {
    translation: translationPT,
  },
  es: {
    translation: translationES,
  },
  'es-ES': {
    translation: translationES,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // i18next v25+ logs a Locize promo to console unless this is false
    showSupportNotice: false,
    debug: Boolean(import.meta.env?.DEV),
    fallbackLng: 'en', // Default language if browser language is not available
    supportedLngs: ['en', 'pt-BR', 'pt', 'es', 'es-ES'],
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      // Sem `navigator`: primeira visita usa inglês (fallbackLng); PT/ES só após escolha guardada em localStorage ou ?lng=
      order: ['querystring', 'localStorage', 'cookie', 'htmlTag'],
      caches: ['localStorage'],
      lookupQuerystring: 'lng',
    },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof document === 'undefined') return;
  const map = { en: 'en', pt: 'pt-BR', 'pt-BR': 'pt-BR', es: 'es', 'es-ES': 'es-ES' };
  document.documentElement.lang = map[lng] || lng || 'en';
});

export default i18n;
