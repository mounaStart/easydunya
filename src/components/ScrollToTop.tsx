import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

function resetScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  const root = document.getElementById("root");
  if (root) root.scrollTop = 0;
}

/** Remonte en haut à chaque changement de route (SPA). */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    resetScroll();
    requestAnimationFrame(resetScroll);
  }, [pathname]);

  return null;
}
