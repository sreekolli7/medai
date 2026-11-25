import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'
import { CatalogProvider } from './lib/catalog'
import { ContentProvider } from './lib/content'
import { PrefsProvider } from './lib/prefs'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PrefsProvider>
        <AuthProvider>
          <CatalogProvider>
            <ContentProvider model="heart">
              <App />
            </ContentProvider>
          </CatalogProvider>
        </AuthProvider>
      </PrefsProvider>
    </BrowserRouter>
  </StrictMode>,
)
