// All catalogs are bundled with the app and loaded from the local server.
export const supportedLocales = ['zh-CN', 'en'];
const catalogs = Object.fromEntries(await Promise.all(supportedLocales.map(async locale => {
  const response = await fetch(new URL(`./locales/${locale}.json`, import.meta.url));
  if (!response.ok) throw new Error(`Could not load locale: ${locale}`);
  return [locale, await response.json()];
})));
let locale = 'zh-CN';
export const getLocale = () => locale;
export function setLocale(value) {
  locale = supportedLocales.includes(value) ? value : 'zh-CN';
  document.documentElement.lang = locale;
}
export function t(key, params = {}) {
  const message = catalogs[locale]?.[key] ?? catalogs['zh-CN'][key] ?? key;
  return message.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
}
// Only explicitly marked app labels are translated; filenames and user data stay intact.
export function translateStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(element => {
    const text = [...element.childNodes].find(node => node.nodeType === 3 && node.textContent.trim());
    if (text) text.textContent = t(element.dataset.i18n);
  });
  for (const attribute of ['title', 'aria-label', 'placeholder']) {
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    });
  }
}
