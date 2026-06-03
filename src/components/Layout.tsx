import { Outlet } from "react-router-dom";
import Header from "./Header";
import BottomNav from "./BottomNav";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 has-bottom-nav">
        <Outlet />
      </main>
      <footer className="hidden md:block bg-white border-t border-slate-100 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Easy Dunya — Adam Ba &amp; Maimouna Dia
      </footer>
      <BottomNav />
    </div>
  );
}
