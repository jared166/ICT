// ============================================================================
// I.C.T. by Marketing Masters Group · Configuración editable
// Todo lo que cambia sin tocar el HTML vive aquí. Con un campo vacío, la página
// oculta el bloque, muestra un placeholder digno o usa el plan B (nunca un link
// roto ni "undefined"). Lo marcado [PENDIENTE] no se rellena con datos inventados.
// ============================================================================

export const CONFIG = {
  // ---------- Conversión ----------
  titularPorDefecto: "A",          // "A" | "B"; con ?h=a o ?h=b en la URL se fuerza
  webhookUrl: "",                  // [PENDIENTE] Inbound Webhook de un workflow de GoHighLevel
  calendarioUrl: "",               // [PENDIENTE] embed del calendario de GHL (30 min), ej. https://api.leadconnectorhq.com/widget/booking/XXXX
  whatsappAgencia: "",             // [PENDIENTE] número internacional sin "+", ej. 573001234567
  emailContacto: "",               // [PENDIENTE] ej. jared@marketingmaster.top
  videoHero: "",                   // [PENDIENTE] URL del video (opcional): YouTube, Vimeo o un .mp4
  cupos: [],                       // ej. [{ ciudad: "Medellín", disponibles: 4 }]; solo datos reales
  precioContinuidad: 60,           // [PENDIENTE] propuesta, a confirmar
  capturaCaso: "",                 // opcional: ruta de la captura del caso con datos tapados, ej. "assets/img/caso-ads-manager.webp"

  // ---------- Medición (cada script se carga solo si hay ID y hay consentimiento) ----------
  ga4Id: "",                       // [PENDIENTE] G-XXXXXXX
  clarityId: "",                   // [PENDIENTE]
  metaPixelId: "",                 // [PENDIENTE] píxel de Marketing Masters Group

  // ---------- Legal ----------
  legalRevisado: false,            // mientras sea false, las páginas legales muestran "Borrador en revisión legal"
  versionPoliticas: "2026-10-20",  // si cambia, se vuelve a pedir el consentimiento de cookies
  prestador: {
    nombre: "[PENDIENTE: Arturo Herrero o razón social de su sociedad]",
    nif: "[PENDIENTE]",
    domicilio: "[PENDIENTE], España",
    registro: "[PENDIENTE: datos registrales si es sociedad]",
    email: "[PENDIENTE]"
  }
};
