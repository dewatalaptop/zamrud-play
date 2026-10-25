import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { BugBoundary } from "./BugBoundary";
import { AuthProvider } from "./auth/AuthProvider";
import { ToastProvider } from "./components/Toast";
import { I18nProvider } from "./i18n";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BugBoundary>
      <I18nProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </BugBoundary>
  </StrictMode>
);
