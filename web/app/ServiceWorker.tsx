"use client";

import { useEffect } from "react";

export default function ServiceWorker() {
  useEffect(() => {
    // Solo in produzione: in dev il SW interferirebbe con l'hot-reload.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
