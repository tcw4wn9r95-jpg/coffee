import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCoffees } from "../lib/db";
import { getLearningStats, type LearningStats } from "../lib/palate";
import type { Coffee } from "../lib/types";
import { CoffeeTile } from "../components/CoffeeTile";
import { CupIcon, PlusIcon, SparkIcon } from "../components/Icons";

function LearningBadge({ s }: { s: LearningStats }) {
  const copy =
    s.tastings === 0
      ? "Bruna learns your taste as you log tastings"
      : `Learning your taste — ${s.tastings} tasting${s.tastings === 1 ? "" : "s"}${
          s.loved ? ` · ${s.loved} loved` : ""
        }`;
  return (
    <div className="learning-badge" title="Your tastings tune future recommendations">
      <SparkIcon size={15} />
      <span>{copy}</span>
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function Home() {
  const nav = useNavigate();
  const [coffees, setCoffees] = useState<Coffee[] | null>(null);
  const [stats, setStats] = useState<LearningStats | null>(null);

  useEffect(() => {
    listCoffees().then(setCoffees);
    getLearningStats().then(setStats);
  }, []);

  const locked = coffees?.filter((c) => c.status === "locked").length ?? 0;
  const rows = coffees ? chunk(coffees, 2) : [];

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
        The shelf
      </h1>
      <p className="lede">
        {coffees && coffees.length > 0
          ? `${coffees.length} ${coffees.length === 1 ? "coffee" : "coffees"}${
              locked ? ` · ${locked} dialed in` : ""
            }.`
          : "Your collection, beautifully shelved. Add your first coffee to begin."}
      </p>

      {stats && coffees && coffees.length > 0 && <LearningBadge s={stats} />}

      {coffees === null ? (
        <div className="empty">
          <span className="spinner spinner-clay" />
        </div>
      ) : coffees.length === 0 ? (
        <div className="shelf" style={{ marginTop: 26 }}>
          <div className="shelf-unit">
            <div className="shelf-empty">
              <div className="empty-mark">
                <CupIcon size={40} />
              </div>
              <p style={{ maxWidth: "28ch", margin: "0 auto 18px" }}>
                Snap a bag of coffee and Bruna will catalogue it and set your
                starting espresso recipe.
              </p>
              <button className="btn btn-primary btn-lg" onClick={() => nav("/new")}>
                <PlusIcon size={18} /> Add a coffee
              </button>
            </div>
            <div className="shelf-ledge" />
          </div>
        </div>
      ) : (
        <div className="shelf">
          {rows.map((row, r) => (
            <div className="shelf-unit" key={r}>
              <div className="shelf-row">
                {row.map((c, i) => (
                  <CoffeeTile key={c.id} coffee={c} index={r * 2 + i} />
                ))}
                {row.length === 1 && <span className="tile-spacer" />}
              </div>
              <div className="shelf-ledge" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
