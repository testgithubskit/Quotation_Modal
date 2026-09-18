import { Navigate, Outlet } from 'react-router-dom';
import { canAccessRoute, homePathForUser, useAuth } from '../config/AuthContext.jsx';

export default function RequireRole({ allowed }) {
  const { user, isAuthenticated, booting } = useAuth();

  if (booting) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowed && !canAccessRoute(user, allowed)) {
    return <Navigate to={homePathForUser(user)} replace />;
  }
  return <Outlet />;
}
