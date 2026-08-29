// Chew - configuración de API
// Para producción en Vercel, usa la URL real del backend en Render.
(function () {
  const LOCAL_API = "http://localhost:4000/api";
  const PRODUCCION_API = "https://Chew-backend.onrender.com/api";

  const host = window.location.hostname;
  const esLocal = !host || host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.");

  window.Chew_API = window.Chew_API || (esLocal ? LOCAL_API : PRODUCCION_API);
})();