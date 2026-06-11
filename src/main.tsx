import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import '@fontsource-variable/lora/index.css'
import 'lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
