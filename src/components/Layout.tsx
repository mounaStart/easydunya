import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Header from "./Header";
import BottomNav from "./BottomNav";
import ScrollToTop from "./ScrollToTop";
import NotificationPrompt from "./NotificationPrompt";
import LocationPrompt from "./LocationPrompt";
import PassengerLocationSync from "./PassengerLocationSync";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../lib/utils";

/** Force le changement de mot de passe (1ère connexion chauffeur). */
function PasswordChangeGate() {
  const { mustChangePassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (user && mustChangePassword && location.pathname !== "/change-password") {
      navigate("/change-password", { replace: true });
    }
  }, [user, mustChangePassword, location.pathname, navigate]);
  return null;
}

export default function Layout() {
  const location = useLocation();
  const { isDriver, isAdmin } = useAuth();
  const isPassengerHome = location.pathname === "/" && !isDriver && !isAdmin;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-x-hidden max-w-[100vw]">
      <ScrollToTop />
      <PasswordChangeGate />
      <PassengerLocationSync />
      <Header />
      <main className={cn("flex-1 has-bottom-nav", isPassengerHome && "bg-[#eef5fc]")}>
        <Outlet />
      </main>
      <footer className="hidden md:block bg-white border-t border-slate-100 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Easy Dunya — Adam Ba &amp; Maimouna Dia
      </footer>
      <LocationPrompt />
      <NotificationPrompt />
      <BottomNav />
    </div>
  );
}
