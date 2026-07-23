import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCoffees } from "../lib/db";
import type { Coffee } from "../lib/types";
import { PhotoThumb } from "../components/PhotoThumb";
import { RecipeLine } from "../components/RecipeView";
import { CupIcon, PlusIcon } from "../components/Icons";

export function Home() {
  const nav = useNavigate();
  const [coffees, setCoffees] = useState<Coffee[] | null>(null);

  useEffect(() => {
    listCoffees().then(setCoffees);
  }, []);

  const locked = coffees?.filter((c) => c.status === "locked").length ?? 0;

  return (
    <div className="screen">
      <div className="row-between">
        <div className="brand">
          <img src="/coffee/favicon.svg" className="brand-logo" alt="" />
          <span className="brand-name">Bruna</span>
        </div>
        <button className="btn btn-soft" onClick={() => nav("/new")}>
          <PlusIcon size={18} /> New
        </button>
      </div>

      <h1 className="screen-title" style={{ marginTop: 22 }}>
        Your shelf
      </h1>
      <p className="lede">
        {coffees && coffees.length > 0
          ? `${coffees.length} ${coffees.length === 1 ? "coffee" : "coffees"}${
              locked ? ` · ${locked} dialed in` : ""
            }.`
          : "Nothing here yet — add your first coffee to begin."}
      </p>

      {coffees === null ? (
        <div className="empty">
          <span className="spinner spinner-clay" />
        </div>
      ) : coffees.length === 0 ? (
        <div className="empty">
          <div className="empty-mark">
            <CupIcon size={44} />
          </div>
          <p style={{ maxWidth: "30ch", margin: "0 auto 20px" }}>
            Snap a bag of coffee and Bruna will read it and set your starting
            espresso recipe.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => nav("/new")}>
            <PlusIcon size={18} /> Add a coffee
          </button>
        </div>
      ) : (
        <div className="list">
          {coffees.map((c) => (
            <button
              key={c.id}
              className="coffee-card"
              onClick={() => nav(`/coffee/${c.id}`)}
            >
              <PhotoThumb photoId={c.photoId} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-between">
                  <div className="coffee-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </div>
                  <span className={`badge ${c.status === "locked" ? "badge-locked" : "badge-dialing"}`}>
                    {c.status === "locked" ? "Dialed" : "Dialing"}
                  </span>
                </div>
                <div className="coffee-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.roaster ? `${c.roaster} · ` : ""}
                  {c.origin || c.process || "espresso"}
                </div>
                {c.lockedRecipe && (
                  <div className="coffee-sub" style={{ color: "var(--clay)" }}>
                    <RecipeLine r={c.lockedRecipe} />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
