/* ============================================================
   Le Petit Shortt Cake — Configuración editable
   Cambiá estos datos sin tocar el resto del sitio.
   ============================================================ */
window.LPSC_CONFIG = {
  brand: "Le Petit Shortt Cake",

  /* ---------- Contacto y redes ---------- */
  whatsapp: "584246043896",
  instagram: "https://www.instagram.com/lepetitshorttcake?gwpx=dzNmc2s0cG13d2t5",
  tiktok: "https://www.tiktok.com/@lepetitshorttcakemcbo?_r=1&_t=ZS-9BYREI82Cdq",

  /* ---------- Contenido embebido ----------
     Pegá SOLO la URL de embed:
     Spotify: https://open.spotify.com/embed/playlist/ID
     YouTube: https://www.youtube.com/embed/ID
     Si quedan vacías, se muestra un cartel "muy pronto". */
  spotifyEmbed: "",
  youtubeEmbed: "",
  spotifyUrl: "", // link normal de Spotify (opcional)
  youtubeUrl: "", // link normal de YouTube (opcional)

  /* ---------- Precios ---------- */
  currency: "Ref.",
  priceNote: "Precios de referencia. Se confirman al coordinar el pedido.",

  /* ---------- Panel de administración ----------
     Con Supabase activo, el acceso es con el usuario creado en Auth.
     adminPassword solo se usa si Supabase está desactivado (modo demo). */
  adminPassword: "lepetit2026", // ← solo modo demo
  orderPrefix: "LPSC",

  /* ---------- Supabase ----------
     La anon key es pública: puede ir en el frontend. NUNCA pongas acá
     la service_role key. Para volver al modo demo, poné enabled: false. */
  supabase: {
    enabled: true,
    url: "https://ymwtfxkhpxvxfemsvgtv.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltd3RmeGtocHh2eGZlbXN2Z3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxNDU0MjksImV4cCI6MjExMDcyMTQyOX0.z6z5HKen_nD135Mmp19KN56ErjE9ziHSbhDJTiphJmI",
    adminEmail: "lepetitshorttcake@gmail.com",
    proofBucket: "comprobantes",
  },

  /* ---------- Métodos de pago ----------
     Reemplazar los datos de ejemplo por los reales. */
  payment: {
    pagoMovil: {
      label: "Pago Móvil",
      icon: "PM",
      hint: "Transferencia inmediata",
      instructions: [
        "Banco: Mercantil",
        "Teléfono: 584246043896",
        "Cédula: 32012336",
      ],
      referenceLabel: "Número de referencia",
      referencePlaceholder: "Ej. 123456789",
      extraLabel: "Banco emisor (opcional)",
      extraPlaceholder: "Ej. Mercantil",
    },
    zelle: {
      label: "Zelle",
      icon: "Z",
      hint: "Pago en dólares",
      instructions: ["Correo: malaurashortt@gmail.com"],
      referenceLabel: "Número de referencia",
      referencePlaceholder: "Ej. 987654321",
      extraLabel: "Nombre de quien envía",
      extraPlaceholder: "Nombre y apellido",
    },
    binance: {
      label: "Binance",
      icon: "₿",
      hint: "USDT / cripto",
      instructions: ["Correo: malaurashortt@gmail.com"],
      referenceLabel: "TXID / hash de la transacción",
      referencePlaceholder: "Pegá el hash de Binance",
      extraLabel: "Monto en USDT",
      extraPlaceholder: "Ej. 25.00",
    },
    efectivo: {
      label: "Efectivo",
      icon: "$",
      hint: "Al recibir el pedido",
      instructions: [
        "Pagás al momento de la entrega.",
        "Coordinamos punto y hora por WhatsApp.",
      ],
      referenceLabel: "",
      referencePlaceholder: "",
      extraLabel: "",
      extraPlaceholder: "",
    },
  },

  deliveryNote:
    "Las entregas se coordinan por WhatsApp. También hacemos pedidos al mayor y personalizaciones.",
};
