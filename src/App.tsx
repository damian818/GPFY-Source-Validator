import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RulesProvider } from "./rulesContext";
import { Layout } from "./components/Layout";
import { ValidatorPage } from "./pages/ValidatorPage";
import { AdminPage } from "./pages/AdminPage";

export default function App() {
  return (
    <RulesProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ValidatorPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </RulesProvider>
  );
}
