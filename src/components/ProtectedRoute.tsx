import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../lib/types";
import Spinner from "./Spinner";

interface Props {
  children: ReactNode;
  roles?: UserRole[];
  /** Si true, un chauffeur non-approuvé est redirigé vers /driver (page d'attente) */
  requireDriverApproved?: boolean;
}

export default function ProtectedRoute({
  children,
  roles,
  requireDriverApproved,
}: Props) {
  const { loading, user, role, profile } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  if (
    requireDriverApproved &&
    role === "driver" &&
    profile?.driver_status !== "approved"
  ) {
    return <Navigate to="/driver" replace />;
  }
  return <>{children}</>;
}
