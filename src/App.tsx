import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Spinner from "./components/Spinner";
import { useAuth } from "./hooks/useAuth";
import { useAgency } from "./lib/agency/useAgency";

import Home from "./pages/Home";
import About from "./pages/About";
import LegalDoc from "./pages/LegalDoc";
import Search from "./pages/Search";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import TripDetail from "./pages/TripDetail";
import CheckBooking from "./pages/CheckBooking";
import NotFound from "./pages/NotFound";

import MyBookings from "./pages/passenger/MyBookings";
import Reservation from "./pages/passenger/Reservation";
import Historique from "./pages/passenger/Historique";
import Profile from "./pages/passenger/Profile";

import DriverHome from "./pages/driver/Home";
import DriverDashboard from "./pages/driver/Dashboard";
import DriverVehicles from "./pages/driver/MyVehicles";
import DriverNewTrip from "./pages/driver/NewTrip";
import DriverTripBookings from "./pages/driver/TripBookings";
import DriverEarnings from "./pages/driver/Earnings";
import DriverHistorique from "./pages/driver/Historique";

import AdminDashboard from "./pages/admin/Dashboard";
import AgencyLayout from "./pages/agency/AgencyLayout";
import AgencyDashboard from "./pages/agency/Dashboard";
import AgencyDeparts from "./pages/agency/Departs";
import AgencyPlaces from "./pages/agency/Places";
import AgencyReservations from "./pages/agency/Reservations";
import AgencyGuichet from "./pages/agency/Guichet";
import AgencyEmbarquement from "./pages/agency/Embarquement";
import AgencyRapports from "./pages/agency/Rapports";
import AgencyVehicules from "./pages/agency/Vehicules";
import AgencyChauffeurs from "./pages/agency/Chauffeurs";
import AgencyReseau from "./pages/agency/Reseau";
import AgencyParametres from "./pages/agency/Parametres";
import AgencyVoyagePublic from "./pages/agency/VoyagePublic";

/** Page d'accueil selon le rôle : chauffeur → tableau de bord, admin → admin, sinon recherche passager. */
function HomeIndex() {
  const { loading, profile, user, authReady } = useAuth();
  const { staff, agency } = useAgency();
  if (loading || (user && !authReady)) return <Spinner />;
  if (profile?.role === "driver") return <DriverHome />;
  if (profile?.role === "admin") return <Navigate to="/admin" replace />;
  if (!user && staff && agency?.status === "approved") return <Navigate to="/agence" replace />;
  return <Home />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeIndex />} />
        <Route path="a-propos" element={<About />} />
        <Route path="cgu" element={<LegalDoc kind="cgu" />} />
        <Route path="confidentialite" element={<LegalDoc kind="privacy" />} />
        <Route path="search" element={<Search />} />
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="register" element={<Register />} />
        <Route
          path="change-password"
          element={
            <ProtectedRoute roles={["passenger", "driver", "admin"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route path="check" element={<CheckBooking />} />
        <Route path="trips/:tripId" element={<TripDetail />} />
        <Route path="agence/voyage/:tripId" element={<AgencyVoyagePublic />} />

        <Route path="agence" element={<AgencyLayout />}>
          <Route index element={<AgencyDashboard />} />
          <Route path="departs" element={<AgencyDeparts />} />
          <Route path="places" element={<AgencyPlaces />} />
          <Route path="reservations" element={<AgencyReservations />} />
          <Route path="guichet" element={<AgencyGuichet />} />
          <Route path="embarquement" element={<AgencyEmbarquement />} />
          <Route path="rapports" element={<AgencyRapports />} />
          <Route path="vehicules" element={<AgencyVehicules />} />
          <Route path="chauffeurs" element={<AgencyChauffeurs />} />
          <Route path="reseau" element={<AgencyReseau />} />
          <Route path="parametres" element={<AgencyParametres />} />
        </Route>

        {/* Passenger */}
        <Route path="reservation" element={<Reservation />} />
        <Route path="historique" element={<Historique />} />
        <Route
          path="me/bookings"
          element={
            <ProtectedRoute roles={["passenger", "driver", "admin"]}>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute roles={["passenger", "driver", "admin"]}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Driver */}
        <Route
          path="driver"
          element={
            <ProtectedRoute roles={["driver", "admin"]}>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="driver/vehicles"
          element={
            <ProtectedRoute roles={["driver", "admin"]} requireDriverApproved>
              <DriverVehicles />
            </ProtectedRoute>
          }
        />
        <Route
          path="driver/trips/new"
          element={
            <ProtectedRoute roles={["driver", "admin"]} requireDriverApproved>
              <DriverNewTrip />
            </ProtectedRoute>
          }
        />
        <Route
          path="driver/trips/:tripId/bookings"
          element={
            <ProtectedRoute roles={["driver", "admin"]} requireDriverApproved>
              <DriverTripBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="driver/earnings"
          element={
            <ProtectedRoute roles={["driver", "admin"]} requireDriverApproved>
              <DriverEarnings />
            </ProtectedRoute>
          }
        />
        <Route
          path="driver/historique"
          element={
            <ProtectedRoute roles={["driver", "admin"]}>
              <DriverHistorique />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
