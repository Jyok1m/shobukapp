export const THEME_STORAGE_KEY = "shobukapp-theme";

/*
 * Applied before paint by the inline script in app/layout.tsx: data-theme on
 * <html> overrides the system preference, no attribute follows it. Kept out of
 * lib/theme.ts so the server layout imports a plain string, not a client module.
 */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
