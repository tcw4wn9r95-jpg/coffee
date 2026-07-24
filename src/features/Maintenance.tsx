import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logMaintenance } from "../lib/db";
import {
  MAINTENANCE_TASKS,
  cadenceLabel,
  fetchAllStatuses,
  getTask,
  relTime,
  statusOf,
  whenDue,
  type TaskStatus,
} from "../lib/maintenance";
import type { MaintenanceLog } from "../lib/db";
import { MaintenanceAnim } from "../components/MaintenanceAnim";
import { BackIcon, CheckIcon, WrenchIcon } from "../components/Icons";
import { useToast } from "../components/Toast";

export function Maintenance() {
  const nav = useNavigate();
  const [statuses, setStatuses] = useState<TaskStatus[] | null>(null);

  async function load() {
    setStatuses(await fetchAllStatuses());
  }
  useEffect(() => {
    load();
  }, []);

  if (!statuses) {
    return <div className="screen" />;
  }

  const overdue = statuses.filter((s) => s.status === "overdue").length;
  const due = statuses.filter((s) => s.status === "due").length;
  const ok = statuses.filter((s) => s.status === "ok").length;

  const grouped = {
    machine: statuses.filter((s) => s.task.gear === "machine"),
    grinder: statuses.filter((s) => s.task.gear === "grinder"),
  };

  return (
    <div className="screen">
      <div className="row-between" style={{ marginBottom: 6 }}>
        <div>
          <div className="eyebrow">Care</div>
          <h1 style={{ fontSize: 26, fontFamily: "var(--serif)", marginTop: 2 }}>
            Equipment care
          </h1>
        </div>
        <div className="maint-task-icon" style={{ width: 42, height: 42 }}>
          <WrenchIcon size={20} />
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
        A clean grinder tastes sweeter, and a descaled boiler brews at
        temperature. Bruna keeps track — you just press "done".
      </p>

      <div className="maint-summary">
        <div className="maint-stat">
          <div className={`maint-stat-num ${overdue > 0 ? "overdue" : ""}`}>{overdue}</div>
          <div className="maint-stat-label">Overdue</div>
        </div>
        <div className="maint-stat">
          <div className={`maint-stat-num ${due > 0 ? "due" : ""}`}>{due}</div>
          <div className="maint-stat-label">Due</div>
        </div>
        <div className="maint-stat">
          <div className="maint-stat-num">{ok}</div>
          <div className="maint-stat-label">On track</div>
        </div>
      </div>

      {(["machine", "grinder"] as const).map((gear) => (
        <section key={gear} style={{ marginTop: 22 }}>
          <h3 style={{ fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-soft)", margin: "8px 0" }}>
            {gear === "machine" ? "Lelit Anna PL41EM" : "Fellow Opus"}
          </h3>
          {grouped[gear].map((s) => (
            <TaskCard key={s.task.id} status={s} onOpen={() => nav(`/care/${s.task.id}`)} />
          ))}
        </section>
      ))}
    </div>
  );
}

function TaskCard({ status, onOpen }: { status: TaskStatus; onOpen: () => void }) {
  const { task, log } = status;
  return (
    <button className="maint-task-card" onClick={onOpen}>
      <div className="maint-task-icon">
        <MaintenanceAnim anim={task.anim} size={38} />
      </div>
      <div className="maint-task-body">
        <div className="maint-task-name">{task.name}</div>
        <div className="maint-task-meta">
          {cadenceLabel(task)} · ~{task.minutes} min
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <StatusPill status={status} />
          {log && (
            <span className="muted" style={{ fontSize: 12 }}>
              Last: {relTime(log.lastDoneAt)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: TaskStatus }) {
  const label =
    status.status === "never"
      ? "Never done"
      : status.status === "ok"
      ? "On track"
      : whenDue(status);
  return <span className={`status-pill ${status.status}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
export function MaintenanceTask() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const task = getTask(id);
  const [log, setLog] = useState<MaintenanceLog | undefined>();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!task) return;
    import("../lib/db").then(async ({ getMaintenance }) => {
      setLog(await getMaintenance(task.id));
    });
  }, [task]);

  if (!task) {
    return (
      <div className="screen">
        <button className="link-btn row" onClick={() => nav("/care")}>
          <BackIcon size={18} /> Back
        </button>
        <p className="muted" style={{ marginTop: 24 }}>Task not found.</p>
      </div>
    );
  }

  const total = task.steps.length;
  const s = statusOf(task, log);
  const currentStep = task.steps[step];

  async function markDone() {
    const next = await logMaintenance(task!.id);
    setLog(next);
    setDone(true);
    toast(`${task!.name} — logged 🎉`);
  }

  return (
    <div className="screen">
      <button className="link-btn row" onClick={() => nav("/care")}>
        <BackIcon size={18} /> Back
      </button>

      <div className="eyebrow" style={{ marginTop: 10 }}>
        {task.gear === "machine" ? "Lelit Anna PL41EM" : "Fellow Opus"}
      </div>
      <h1 style={{ fontSize: 24, fontFamily: "var(--serif)", marginTop: 4 }}>{task.name}</h1>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
        {cadenceLabel(task)} · ~{task.minutes} min · {task.blurb}
      </p>

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <StatusPill status={s} />
        {log && (
          <span className="muted" style={{ fontSize: 12 }}>
            Last done {relTime(log.lastDoneAt)}
          </span>
        )}
      </div>

      {done ? (
        <div className="card card-pad" style={{ marginTop: 20, textAlign: "center" }}>
          <div className="done-check" style={{ width: 56, height: 56, margin: "0 auto 12px" }}>
            <CheckIcon size={30} />
          </div>
          <h2 style={{ fontSize: 20, fontFamily: "var(--serif)" }}>
            {task.name} — done
          </h2>
          <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
            Bruna logged it. Next one is due in{" "}
            <strong>{task.everyDays === 1 ? "1 day" : `${task.everyDays} days`}</strong>.
          </p>
          <div className="row" style={{ gap: 10, marginTop: 18, justifyContent: "center" }}>
            <button className="btn btn-ghost" onClick={() => { setStep(0); setDone(false); }}>
              Do it again
            </button>
            <button className="btn btn-primary" onClick={() => nav("/care")}>
              Back to dashboard
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card card-pad" style={{ marginTop: 18 }}>
            <div className="step-counter">
              Step {step + 1} of {total}
            </div>
            <div style={{ margin: "14px 0 6px" }}>
              <MaintenanceAnim anim={task.anim} size={140} />
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.45, marginTop: 8, textAlign: "center" }}>
              {currentStep.text}
            </p>
            {currentStep.detail && <p className="step-detail" style={{ textAlign: "center" }}>{currentStep.detail}</p>}
            <div className="step-dots">
              {task.steps.map((_, i) => (
                <span key={i} className={`step-dot ${i === step ? "on" : i < step ? "done" : ""}`} />
              ))}
            </div>
          </div>

          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </button>
            {step < total - 1 ? (
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              >
                Next step
              </button>
            ) : (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={markDone}>
                <CheckIcon size={18} /> Mark done
              </button>
            )}
          </div>

          <p className="muted" style={{ fontSize: 11.5, textAlign: "center", marginTop: 18 }}>
            Source: {task.source}
          </p>
        </>
      )}

      {MAINTENANCE_TASKS.length > 1 && null}
    </div>
  );
}
