import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TripDetail from "./pages/TripDetail";
import BookTrip from "./pages/BookTrip";
import CheckBooking from "./pages/CheckBooking";
import NotFound from "./pages/NotFound";

import MyBookings from "./pages/passenger/MyBookings";

import DriverDashboard from "./pages/driver/Dashboard";
import DriverVehicles from "./pages/driver/MyVehicles";
import DriverNewTrip from "./pages/driver/NewTrip";
import DriverTripBookings from "./pages/driver/TripBookings";

import AdminDashboard from "./pages/admin/Dashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="check" element={<CheckBooking />} />
        <Route path="trips/:tripId" element={<TripDetail />} />
        <Route path="trips/:tripId/book" element={<BookTrip />} />

        {/* Passenger */}
        <Route
          path="me/bookings"
          element={
            <ProtectedRoute roles={["passenger", "driver", "admin"]}>
              <MyBookings />
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
            <ProtectedRoute roles={["driver", "admin"]}>
              <DriverVehicles />
            </ProtectedRoute>
          }
        />
        <Route
          path="driver/trips/new"
          element={
            <ProtectedRoute roles={["driver", "admin"]}>
              <DriverNewTrip />
            </ProtectedRoute>
          }
        />
        <Route
          path="driver/trips/:tripId/bookings"
          element={
            <ProtectedRoute roles={["driver", "admin"]}>
              <DriverTripBookings />
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
