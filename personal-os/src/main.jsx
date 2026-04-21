import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import App from "./App.jsx"
import "./index.css"
import { ensureUserProfileSheetLoaded } from "./lib/userProfileSheet"

document.documentElement.classList.add("dark")
void ensureUserProfileSheetLoaded()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
