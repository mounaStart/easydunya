import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page text-center">
      <div className="text-7xl mb-2">🛣</div>
      <h1 className="h1 mb-2">404</h1>
      <p className="muted mb-6">Page introuvable / صفحة غير موجودة</p>
      <Link to="/" className="btn-primary inline-flex">
        ← Accueil
      </Link>
    </div>
  );
}
