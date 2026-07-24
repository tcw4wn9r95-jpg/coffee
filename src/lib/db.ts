import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Coffee, Shot } from "./types";

/** One entry per maintenance task the user has completed at least once. */
export interface MaintenanceLog {
  taskId: string;
  lastDoneAt: number;
  history: number[]; // timestamps, newest last
}

interface BrunaDB extends DBSchema {
  coffees: {
    key: string;
    value: Coffee;
    indexes: { updatedAt: number };
  };
  shots: {
    key: string;
    value: Shot;
    indexes: { coffeeId: string };
  };
  photos: {
    key: string;
    value: Blob;
  };
  maintenance: {
    key: string; // taskId
    value: MaintenanceLog;
  };
}

let dbp: Promise<IDBPDatabase<BrunaDB>> | null = null;

function db() {
  if (!dbp) {
    dbp = openDB<BrunaDB>("bruna", 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          const coffees = d.createObjectStore("coffees", { keyPath: "id" });
          coffees.createIndex("updatedAt", "updatedAt");
          const shots = d.createObjectStore("shots", { keyPath: "id" });
          shots.createIndex("coffeeId", "coffeeId");
          d.createObjectStore("photos");
        }
        if (oldVersion < 2) {
          d.createObjectStore("maintenance", { keyPath: "taskId" });
        }
      },
    });
  }
  return dbp;
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

// ---- Coffees ----
export async function listCoffees(): Promise<Coffee[]> {
  const all = await (await db()).getAllFromIndex("coffees", "updatedAt");
  return all.reverse(); // newest first
}
export async function getCoffee(id: string): Promise<Coffee | undefined> {
  return (await db()).get("coffees", id);
}
export async function putCoffee(c: Coffee): Promise<void> {
  await (await db()).put("coffees", { ...c, updatedAt: Date.now() });
}
export async function deleteCoffee(id: string): Promise<void> {
  const d = await db();
  const c = await d.get("coffees", id);
  if (c?.photoId) await d.delete("photos", c.photoId);
  const shots = await d.getAllFromIndex("shots", "coffeeId", id);
  const tx = d.transaction(["shots", "coffees"], "readwrite");
  for (const s of shots) await tx.objectStore("shots").delete(s.id);
  await tx.objectStore("coffees").delete(id);
  await tx.done;
}

// ---- Shots ----
export async function listShots(coffeeId: string): Promise<Shot[]> {
  const s = await (await db()).getAllFromIndex("shots", "coffeeId", coffeeId);
  return s.sort((a, b) => a.createdAt - b.createdAt);
}
export async function putShot(s: Shot): Promise<void> {
  await (await db()).put("shots", s);
}
export async function allShots(): Promise<Shot[]> {
  return (await db()).getAll("shots");
}

// ---- Photos ----
export async function putPhoto(blob: Blob): Promise<string> {
  const id = uid();
  await (await db()).put("photos", blob, id);
  return id;
}
export async function getPhoto(id: string): Promise<Blob | undefined> {
  return (await db()).get("photos", id);
}

// ---- Maintenance ----
export async function listMaintenance(): Promise<MaintenanceLog[]> {
  return (await db()).getAll("maintenance");
}
export async function getMaintenance(taskId: string): Promise<MaintenanceLog | undefined> {
  return (await db()).get("maintenance", taskId);
}
export async function logMaintenance(taskId: string, at = Date.now()): Promise<MaintenanceLog> {
  const d = await db();
  const prev = await d.get("maintenance", taskId);
  const next: MaintenanceLog = {
    taskId,
    lastDoneAt: at,
    history: [...(prev?.history || []), at].slice(-24), // cap at last 24
  };
  await d.put("maintenance", next);
  return next;
}

// ---- Backup ----
export interface BackupBundle {
  version: 1;
  exportedAt: number;
  coffees: Coffee[];
  shots: Shot[];
  photos: Record<string, string>; // photoId -> dataURL
}

async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const res = await fetch(dataURL);
  return res.blob();
}

export async function exportAll(): Promise<BackupBundle> {
  const d = await db();
  const coffees = await d.getAll("coffees");
  const shots = await d.getAll("shots");
  const photos: Record<string, string> = {};
  for (const c of coffees) {
    if (c.photoId) {
      const b = await d.get("photos", c.photoId);
      if (b) photos[c.photoId] = await blobToDataURL(b);
    }
  }
  return { version: 1, exportedAt: Date.now(), coffees, shots, photos };
}

export async function importAll(bundle: BackupBundle): Promise<void> {
  const d = await db();
  const tx = d.transaction(["coffees", "shots", "photos"], "readwrite");
  for (const c of bundle.coffees) await tx.objectStore("coffees").put(c);
  for (const s of bundle.shots) await tx.objectStore("shots").put(s);
  await tx.done;
  for (const [id, dataURL] of Object.entries(bundle.photos || {})) {
    const blob = await dataURLToBlob(dataURL);
    await d.put("photos", blob, id);
  }
}

export async function clearAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(["coffees", "shots", "photos"], "readwrite");
  await tx.objectStore("coffees").clear();
  await tx.objectStore("shots").clear();
  await tx.objectStore("photos").clear();
  await tx.done;
}
