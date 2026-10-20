/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { THEMES } from '../constants/themeConstants';

export { THEMES };

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('hubdesk_theme');
      if (saved && (saved === 'light' || saved === 'warm' || saved === 'dark')) {
        return saved;
      }
    } catch {
      // Ignora erro de acesso a localStorage
    }
    return 'light';
  });

  const applyThemeToDOM = (newTheme) => {
    const root = document.documentElement;
    const body = document.body;

    // Atualiza atributos data-theme
    root.setAttribute('data-theme', newTheme);
    if (body) {
      body.setAttribute('data-theme', newTheme);
    }

    // Gerencia classes CSS auxiliares
    root.classList.remove('theme-light', 'theme-warm', 'theme-dark', 'dark');
    root.classList.add(`theme-${newTheme}`);
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.style.colorScheme = 'light';
    }
  };

  useEffect(() => {
    applyThemeToDOM(theme);
    try {
      localStorage.setItem('hubdesk_theme', theme);
    } catch {
      // Ignora erro ao salvar no localStorage
    }
  }, [theme]);

  const setTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'warm' || newTheme === 'dark') {
      setThemeState(newTheme);
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      if (prev === 'light') return 'warm';
      if (prev === 'warm') return 'dark';
      return 'light';
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === 'dark',
        isWarm: theme === 'warm',
        isLight: theme === 'light',
        themeConfig: THEMES[theme],
        allThemes: THEMES
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser utilizado dentro de um ThemeProvider');
  }
  return context;
};
