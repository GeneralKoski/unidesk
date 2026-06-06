// Client helper per le fetch verso le API: su 401 (sessione scaduta) notifica
// l'app, che riporta al login.
export function notifyUnauthorized(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("unidesk:unauthorized"));
  }
}

export async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401) {
    notifyUnauthorized();
    throw new Error("Sessione scaduta");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}
