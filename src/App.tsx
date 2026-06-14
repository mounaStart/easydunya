import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";

import Home from "./pages/Home";
import About from "./pages/About";
import Search from "./pages/Search";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChangePassword from "./pages/ChangePassword";
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

/** Page d'accueil selon le rôle : chauffeur → tableau de bord, admin → admin, sinon recherche passager. */
function HomeIndex() {
  const { loading, profile } = useAuth();
  if (loading) return <Home />;
  if (profile?.role === "driver") return <DriverHome />;
  if (profile?.role === "admin") return <Navigate to="/admin" replace />;
  return <Home />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeIndex />} />
        <Route path="a-propos" element={<About />} />
        <Route path="search" element={<Search />} />
        <Route path="login" element={<Login />} />
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
