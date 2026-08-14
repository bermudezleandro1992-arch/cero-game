import { createContext, useContext, useState, useCallback } from 'react'
import { THEMES, getSavedThemeId, applyTheme } from './theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(getSavedThemeId)

  const setTheme = useCallback((id) => {
    applyTheme(id)
    setThemeId(id)
  }, [])

  return (
    <ThemeContext.Provider value={{ themeId, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
