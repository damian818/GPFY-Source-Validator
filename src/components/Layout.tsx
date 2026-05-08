import { Link, Outlet, useLocation } from "react-router-dom";

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-[#725bb4] shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-white font-bold text-xl tracking-tight">
                Gappify
              </Link>
            </div>
            <nav className="flex items-center gap-2">
              <Link
                to="/"
                className={"px-4 py-2 rounded-md transition-colors " + (location.pathname === "/" ? "bg-[#4f3b8a] text-white" : "text-purple-100 hover:bg-[#5f499c] hover:text-white")}
              >
                Validator
              </Link>
              <Link
                to="/admin"
                className={"px-4 py-2 rounded-md transition-colors " + (location.pathname === "/admin" ? "bg-[#4f3b8a] text-white" : "text-purple-100 hover:bg-[#5f499c] hover:text-white")}
              >
                Admin
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-[#4f3b8a] text-white py-4 mt-auto">
        <div className="container mx-auto px-4 text-sm text-center">
          © {new Date().getFullYear()} Gappify Import File Validator
        </div>
      </footer>
    </div>
  );
}
