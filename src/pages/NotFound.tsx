import { useLocation, NavLink } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="text-center">
        <h1 className="display-1 fw-bold">404</h1>
        <p className="fs-3">
          <span className="text-danger">Oops!</span> Seite nicht gefunden.
        </p>
        <p className="lead">
          Die Seite, die Sie suchen, existiert nicht.
        </p>
        <NavLink to="/" className="btn btn-primary">
          Zurück zum Dashboard
        </NavLink>
      </div>
    </div>
  );
};

export default NotFound;