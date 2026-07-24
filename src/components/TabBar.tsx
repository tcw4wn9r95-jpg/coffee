import { useLocation, useNavigate } from "react-router-dom";
import { HomeIcon, PlusIcon, SettingsIcon, WrenchIcon } from "./Icons";

export function TabBar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const on = (p: string) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p);
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        <button
          className={`tab ${on("/") ? "active" : ""}`}
          onClick={() => nav("/")}
          aria-label="Shelf"
        >
          <HomeIcon />
          Shelf
        </button>
        <button
          className={`tab ${on("/new") ? "active" : ""}`}
          onClick={() => nav("/new")}
          aria-label="New coffee"
        >
          <PlusIcon />
          New
        </button>
        <button
          className={`tab ${on("/care") ? "active" : ""}`}
          onClick={() => nav("/care")}
          aria-label="Equipment care"
        >
          <WrenchIcon />
          Care
        </button>
        <button
          className={`tab ${on("/settings") ? "active" : ""}`}
          onClick={() => nav("/settings")}
          aria-label="Settings"
        >
          <SettingsIcon />
          Settings
        </button>
      </div>
    </nav>
  );
}
