/* ============================================================
   Le Petit Shortt Cake — Lógica del sitio
   ============================================================ */
(() => {
  "use strict";

  const CFG = window.LPSC_CONFIG || {};

  /* ---------- Supabase ----------
     Si no está configurado o no carga el CDN, el sitio sigue funcionando
     en modo demo con localStorage. */
  const SB = CFG.supabase || {};
  const useSupabase = Boolean(
    SB.enabled && SB.url && SB.anonKey && window.supabase?.createClient
  );
  const supabase = useSupabase
    ? window.supabase.createClient(SB.url, SB.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
  const proofBucket = SB.proofBucket || "comprobantes";
  const MAX_PROOFS = 3;
  const FX = CFG.exchange || {};

  /* ---------- Utilidades ---------- */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const pad = (n) => String(n).padStart(2, "0");
  const isoLocal = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const todayIso = () => isoLocal(new Date());

  const esc = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));

  const fmtNum = (n) =>
    Number(n).toLocaleString("es-VE", {
      minimumFractionDigits: Number(n) % 1 ? 2 : 0,
      maximumFractionDigits: 2,
    });

  const money = (n) => `${CFG.currency || "Ref."} ${fmtNum(n)}`;

  const fmtAmount = (n) =>
    Number(n || 0).toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  function paymentAmountInfo() {
    const total = Number(cartTotalValue() || 0);
    if (state.checkout.method === "pagoMovil") {
      const rate =
        Number(state.checkout.euroRate) || Number(FX.manualEuroRate) || 0;
      return {
        amount: total * rate,
        currency: "VES",
        label: `Bs ${fmtAmount(total * rate)}`,
        rate,
        note: state.checkout.rateLoading
          ? "Calculando la tasa euro…"
          : `Tasa euro: Bs ${fmtAmount(rate)}`,
      };
    }
    const currency = state.checkout.method === "binance" ? "USDT" : "USD";
    return {
      amount: total,
      currency,
      label: `${currency} ${fmtAmount(total)}`,
      rate: null,
      note:
        state.checkout.method === "efectivo"
          ? "Se paga al recibir el pedido."
          : `Precio en ${currency}.`,
    };
  }

  const plainAmount = (n) =>
    Number(n || 0).toLocaleString("en-US", {
      useGrouping: false,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  function paymentCopyData() {
    const key = state.checkout.method;
    const method = (CFG.payment || {})[key] || {};
    const amount = paymentAmountInfo();

    if (key === "pagoMovil") {
      let phone = String(method.phone || "").replace(/\D/g, "");
      if (phone.length === 12 && phone.startsWith("58")) phone = phone.slice(2);
      const fields = [
        { key: "bank", label: "Banco", value: String(method.bankCode || "").trim() },
        { key: "id", label: "Cédula", value: String(method.idNumber || "").trim() },
        { key: "phone", label: "Celular", value: phone },
        {
          key: "amount",
          label: "Monto",
          value: plainAmount(amount.amount),
          disabled: state.checkout.rateLoading,
        },
      ];
      return {
        fields,
        all: fields.map((field) => field.value).join("\n"),
        allLabel: "Copiar todos",
        allDisabled: state.checkout.rateLoading,
      };
    }

    if (key === "zelle" || key === "binance") {
      return {
        fields: [],
        all: String(method.email || "").trim(),
        allLabel: "Copiar correo",
        allDisabled: false,
      };
    }

    return null;
  }

  const formatDate = (iso) => {
    if (!iso) return "Sin fecha";
    const date = new Date(`${iso}T12:00:00`);
    return date.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return "—";
    const date = new Date(isoString);
    return `${date.toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })} · ${date.toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const normalizePhone = (phone) => {
    let digits = String(phone || "").replace(/\D/g, "");
    if (digits.startsWith("0")) digits = `58${digits.slice(1)}`;
    return digits;
  };

  const waLink = (message, phone = CFG.whatsapp) => {
    const number = normalizePhone(phone);
    const text = encodeURIComponent(message || "");
    return `https://wa.me/${number}${text ? `?text=${text}` : ""}`;
  };

  const loadJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("No se pudo leer", key, error);
      return fallback;
    }
  };

  const loadArray = (key) => {
    const value = loadJSON(key, []);
    return Array.isArray(value) ? value : [];
  };

  const saveJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("No se pudo guardar", key, error);
      return false;
    }
  };

  const debounce = (fn, wait = 180) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  /* ---------- Datos ---------- */

  const PRODUCTS = [
    {
      id: "casita",
      name: "Casita de jengibre",
      category: "casitas",
      price: 20,
      badge: "La favorita",
      short: "Ideal para compartir en familia y sacar fotos hermosas.",
      description: "Ideal para compartir en familia y sacar fotos hermosas.",
      includes: [
        "Galleta fachada y contrafachada",
        "2 paredes y 2 techos de galleta",
        "Puerta y accesorios de galleta",
        "100 g de dulces y gomitas",
        "Manga con glaseado blanco",
        "Manga con glaseado de color",
        "QR con instrucciones de uso",
      ],
      size: "15 × 15 × 15 cm",
      people: "2 a 4 personas",
      image: "assets/kits/1.webp",
      images: [
        "assets/kits/1.webp",
        "assets/kits/2.webp",
        "assets/kits/3.webp",
        "assets/kits/4.webp",
      ],
      tone: "casitas",
    },
    {
      id: "munecos",
      name: "Muñecos de jengibre",
      category: "grupos",
      price: 16,
      badge: "Personalizable",
      short: "15 muñecos medianos y 5 mangas de colores para decorar.",
      description:
        "Una opción pensada para grupos: cada persona puede decorar su propio muñeco de jengibre. Se puede personalizar dependiendo de las necesidades del cliente.",
      includes: [
        "15 muñecos de jengibre medianos",
        "5 mangas pasteleras con glaseado: blanco, rojo, verde, amarillo y azul",
        "Personalizable a pedido",
      ],
      size: "10 × 5 cm",
      people: "Ideal para grupos",
      image: "assets/kits/5.webp",
      images: [
        "assets/kits/5.webp",
        "assets/kits/6.webp",
        "assets/kits/7.webp",
        "assets/kits/8.webp",
      ],
      tone: "grupos",
    },
    {
      id: "minicasitas",
      name: "Minicasitas de jengibre",
      category: "grupos",
      price: 15,
      badge: "Personalizable",
      short: "Una aldea en miniatura con 5 casitas y mini muñecos.",
      description:
        "Cinco mini casitas y mini muñecos de jengibre con dulces y mangas de glaseado para armar una aldea entera. Perfectas como regalo o para mesas dulces.",
      includes: [
        "5 mini casitas y mini muñecos",
        "100 g de dulces y gomitas",
        "3 mangas pasteleras con glaseado: verde, rojo y blanco",
      ],
      size: "5 × 5 × 5 cm",
      people: "5 mini casitas",
      image: "assets/kits/11.webp",
      images: [
        "assets/kits/11.webp",
        "assets/kits/13.webp",
        "assets/kits/14.webp",
        "assets/kits/12.webp",
      ],
      tone: "grupos",
    },
    {
      id: "pesebre",
      name: "Pesebre de jengibre",
      category: "pesebre",
      price: 30,
      badge: "Edición especial",
      short: "El pesebre completo con personajes y 10 mangas de glaseado.",
      description:
        "Una pieza especial para la temporada: el pesebre de jengibre con todos sus personajes, techos, paredes y una paleta de glaseados para decorar cada detalle.",
      includes: [
        "Fachada y contrafachada de galleta",
        "2 paredes y 2 techos",
        "10 mangas de glaseado de colores distintos",
        "Jesús, María, José y el ángel",
        "Melchor, Gaspar y Baltasar",
        "Buey, mula, pastor y oveja",
      ],
      size: "15 × 15 cm",
      people: "5 a 10 personas",
      image: "assets/kits/9.webp",
      images: ["assets/kits/9.webp", "assets/kits/10.webp"],
      tone: "pesebre",
    },
    {
      id: "coronas",
      name: "Coronas de Adviento",
      category: "adviento",
      price: 35,
      badge: "Suscripción",
      short: "Una corona con vela y oración cada domingo de Adviento.",
      description:
        "Suscripción especial de Adviento: se entrega una corona con vela y oración cada domingo, hasta completar las cuatro coronas de la temporada.",
      includes: [
        "Galleta base y galletas estructura",
        "Sprinkles",
        "Vela",
        "Manga con glaseado verde",
        "Mini manga con glaseado rojo",
        "Oración para cada domingo",
        "4 coronas en total",
      ],
      size: "10 cm",
      people: "4 domingos",
      persons: "2 personas",
      image: "assets/productos/coronas.webp",
      tone: "adviento",
    },
    {
      id: "manga",
      name: "Manga con glaseado",
      category: "extras",
      price: 1.5,
      short: "Para sumar color y detalles a tus galletas.",
      description:
        "Manga pastelera individual con glaseado listo para usar. Elige el color al coordinar tu pedido.",
      includes: ["1 manga de glaseado", "Colores a elección"],
      size: "",
      people: "Extra",
      image: "assets/productos/extras.webp",
      icon: "i-bag",
      tone: "extras-claro",
    },
    {
      id: "dulces",
      name: "100 g de dulces y gomitas",
      category: "extras",
      price: 2.5,
      short: "El topping perfecto para tu casita.",
      description:
        "Porción de 100 gramos de dulces y gomitas variadas para decorar y complementar tu kit.",
      includes: ["100 g de dulces y gomitas surtidas"],
      size: "",
      people: "Extra",
      image: "assets/productos/extra-dulces.webp",
      icon: "i-candy",
      tone: "extras",
    },
    {
      id: "mini-casita",
      name: "Mini casita + mini manga",
      category: "extras",
      price: 6,
      short: "Una casita individual con su manga de glaseado.",
      description:
        "Mini casita de jengibre con una mini manga de glaseado. Ideal para regalar como detalle individual o como extra para tu kit de grupo.",
      includes: ["1 mini casita", "1 mini manga de glaseado"],
      people: "Extra",
      image: "assets/extras/1.png",
      icon: "i-house",
      tone: "extras",
    },
    {
      id: "muneco-mini",
      name: "Muñeco de jengibre + mini manga",
      category: "extras",
      price: 3,
      short: "Un muñeco individual para decorar y regalar.",
      description:
        "Muñeco de jengibre mediano con una mini manga de glaseado para decorarlo a tu gusto.",
      includes: ["1 muñeco de jengibre", "1 mini manga de glaseado"],
      size: "",
      people: "Extra",
      image: "assets/extras/2.png",
      icon: "i-ginger",
      tone: "extras",
    },
    {
      id: "arbolito",
      name: "Arbolito de jengibre + mini manga",
      category: "extras",
      price: 7,
      short: "El detalle navideño que faltaba en tu mesa.",
      description:
        "Arbolito de jengibre con una mini manga de glaseado para sumar un detalle verde a la decoración.",
      includes: ["1 arbolito de jengibre", "1 mini manga de glaseado"],
      size: "",
      people: "Extra",
      image: "assets/extras/5.png",
      icon: "i-tree",
      tone: "extras",
    },
    {
      id: "reyes",
      name: "Reyes + 3 mini mangas",
      category: "extras",
      price: 5,
      short: "Los tres reyes magos para completar tu pesebre.",
      description:
        "Galletas de los tres reyes magos con tres mini mangas de glaseado para decorarlas.",
      includes: ["Galletas de Melchor, Gaspar y Baltasar", "3 mini mangas de glaseado"],
      size: "",
      people: "Extra",
      image: "assets/extras/6.png",
      icon: "i-crown",
      tone: "extras",
    },
    {
      id: "pesebre-2d",
      name: "Pesebre 2D + Jesús, María y José + 5 mini mangas",
      category: "extras",
      price: 10,
      short: "Un pesebre en 2D con sus personajes principales.",
      description:
        "Pesebre 2D con las galletas de Jesús, María y José, más cinco minimangas de colores para decorar.",
      includes: [
        "Pesebre 2D de galleta",
        "Jesús, María y José",
        "5 minimangas de colores",
      ],
      size: "",
      people: "Extra",
      image: "assets/extras/3.png",
      icon: "i-star",
      tone: "extras",
    },
    {
      id: "gigante",
      name: "Muñeco de jengibre gigante + manga",
      category: "extras",
      price: 15,
      short: "El favorito de la mesa, en tamaño gigante.",
      description:
        "Muñeco de jengibre gigante con una manga de glaseado para decorar en grande. Un regalo que no pasa desapercibido.",
      includes: ["1 muñeco de jengibre gigante", "1 manga de glaseado"],
      size: "",
      people: "Extra",
      image: "assets/extras/4.png",
      icon: "i-ginger",
      tone: "extras",
    },
  ];

  const CATEGORIES = [
    { id: "casitas", label: "Casitas" },
    { id: "grupos", label: "Grupos" },
    { id: "pesebre", label: "Pesebre" },
    { id: "adviento", label: "Adviento" },
    { id: "extras", label: "Little Extras" },
  ];

  const FILTERS = [
    { id: "kits", label: "Kits" },
    { id: "extras", label: "Little Extras" },
  ];

  const KIT_SECTIONS = [
    { id: "lo-mas-pedido", label: "Lo más pedido", categories: ["casitas"] },
    { id: "grupos", label: "Grupos", categories: ["grupos"] },
    {
      id: "tradiciones",
      label: "Tradiciones",
      categories: ["pesebre", "adviento"],
    },
  ];

  const EXTRA_ORDER = [
    "manga",
    "mini-casita",
    "muneco-mini",
    "dulces",
    "pesebre-2d",
    "gigante",
    "arbolito",
    "reyes",
  ];

  const extraPosition = (id) => {
    const position = EXTRA_ORDER.indexOf(id);
    return position < 0 ? EXTRA_ORDER.length : position;
  };

  const STATUSES = {
    pendiente_verificacion: {
      label: "Pendiente de verificación",
      className: "s-pendiente",
    },
    pagado: { label: "Pagado confirmado", className: "s-pagado" },
    en_preparacion: { label: "En preparación", className: "s-preparacion" },
    listo: { label: "Listo", className: "s-listo" },
    entregado: { label: "Entregado", className: "s-entregado" },
    cancelado: { label: "Cancelado", className: "s-cancelado" },
  };

  const CONFIRMED_STATUSES = ["pagado", "en_preparacion", "listo", "entregado"];

  const DELIVERY_STATUSES = {
    por_asignar: { label: "Por asignar", className: "d-por-asignar" },
    en_camino: { label: "En camino", className: "d-en-camino" },
    entregado: { label: "Entregado", className: "d-entregado" },
  };

  const KEYS = {
    cart: "lpsc_carrito_v1",
    orders: "lpsc_pedidos_v1",
    counter: "lpsc_contador_v1",
    customer: "lpsc_cliente_v1",
    admin: "lpsc_admin_sesion",
  };

  /* ---------- Estado ---------- */

  const state = {
    cart: loadArray(KEYS.cart),
    filter: "kits",
    detailQty: 1,
    checkout: {
      step: 1,
      method: Object.keys(CFG.payment || {})[0] || "pagoMovil",
      proofs: [],
      paymentNote: "",
      euroRate: Number(FX.manualEuroRate) || 0,
      rateSource: "tasa de respaldo",
      rateLoading: FX.useLiveRate !== false,
      customer: null,
    },
    admin: {
      calYear: new Date().getFullYear(),
      calMonth: new Date().getMonth(),
      search: "",
      status: "todos",
      authed: false,
      authReady: !useSupabase,
      orders: [],
    },
  };

  const productById = (id) => PRODUCTS.find((product) => product.id === id);

  const categoryLabel = (id) =>
    CATEGORIES.find((category) => category.id === id)?.label || id;

  /* ---------- Elementos ---------- */

  const siteHeader = $("#siteHeader");
  const menuBtn = $("#menuBtn");
  const mainNav = $("#mainNav");
  const cartBtn = $("#cartBtn");
  const cartBadge = $("#cartBadge");
  const cartDrawer = $("#cartDrawer");
  const cartClose = $("#cartClose");
  const cartItems = $("#cartItems");
  const cartTotal = $("#cartTotal");
  const cartCountLabel = $("#cartCountLabel");
  const checkoutBtn = $("#checkoutBtn");
  const overlay = $("#overlay");

  const filters = $("#filters");
  const catalogGrid = $("#catalogGrid");
  const catalogSwitch = $("#catalogSwitch");
  const catalogSwitchLabel = $("#catalogSwitchLabel");

  const productModal = $("#productModal");
  const productModalBody = $("#productModalBody");

  const checkoutModal = $("#checkoutModal");
  const checkoutCard = $(".checkout-card", checkoutModal);
  const checkoutForm = $("#checkoutForm");
  const checkoutSteps = $("#checkoutSteps");
  const checkoutActions = $("#checkoutActions");
  const checkoutSuccess = $("#checkoutSuccess");
  const checkoutBack = $("#checkoutBack");
  const checkoutNext = $("#checkoutNext");
  const checkoutConfirm = $("#checkoutConfirm");
  const orderPreview = $("#orderPreview");
  const methodGrid = $("#methodGrid");
  const payInstructions = $("#payInstructions");
  const proofSection = $("#proofSection");
  const uploadBox = $("#uploadBox");
  const proofHint = $("#proofHint");
  const proofInput = $("#proofInput");
  const proofPreview = $("#proofPreview");
  const paymentNote = $("#paymentNote");
  const zelleHolderField = $("#zelleHolderField");
  const zelleHolder = $("#zelleHolder");
  const deliveryType = $("#deliveryType");
  const addressField = $("#addressField");
  const deliveryDate = $("#deliveryDate");

  const adminView = $("#adminView");
  const adminLogin = $("#adminLogin");
  const adminLoginForm = $("#adminLoginForm");
  const adminEmail = $("#adminEmail");
  const adminEmailField = $("#adminEmailField");
  const adminPass = $("#adminPass");
  const adminError = $("#adminError");
  const adminLoginHint = $("#adminLoginHint");
  const adminPanel = $("#adminPanel");
  const adminLogout = $("#adminLogout");
  const adminStats = $("#adminStats");
  const adminSearch = $("#adminSearch");
  const adminStatusFilter = $("#adminStatusFilter");
  const adminList = $("#adminList");
  const adminListCount = $("#adminListCount");
  const calLabel = $("#calLabel");
  const calGrid = $("#calGrid");
  const exportBtn = $("#exportBtn");

  const orderModal = $("#orderModal");
  const orderModalBody = $("#orderModalBody");
  const proofLightbox = $("#proofLightbox");
  const proofLightboxImg = $("#proofLightboxImg");

  const toast = $("#toast");
  const confettiLayer = $("#confettiLayer");

  /* ---------- Toasts y confeti ---------- */

  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  function legacyCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (!legacyCopy(text)) {
        throw new Error("No se pudo copiar");
      }
      showToast("Copiado al portapapeles");
    } catch (error) {
      try {
        if (!legacyCopy(text)) throw new Error("No se pudo copiar");
        showToast("Copiado al portapapeles");
      } catch (fallbackError) {
        console.warn("No se pudo copiar al portapapeles", error, fallbackError);
        showToast("No se pudo copiar. Intentá de nuevo.");
      }
    }
  }

  function burstConfetti(count = 20) {
    const colors = ["#DB1D74", "#F5AEBA", "#CD8EDF", "#58E477", "#FFA9DD", "#2DABD0", "#FFC94D"];
    for (let index = 0; index < count; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 0.25}s`;
      piece.style.animationDuration = `${1.2 + Math.random() * 0.8}s`;
      piece.style.transform = `rotate(${Math.random() * 180}deg)`;
      confettiLayer.appendChild(piece);
      setTimeout(() => piece.remove(), 2200);
    }
  }

  /* ---------- Modales y foco ---------- */

  const mobileScrollLock = window.matchMedia("(max-width: 780px)");
  let lockedScrollY = null;

  function unlockBodyScroll() {
    if (lockedScrollY === null) return;
    const y = lockedScrollY;
    lockedScrollY = null;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    root.style.scrollBehavior = previousBehavior;
  }

  function lockBodyScroll() {
    if (lockedScrollY !== null) return;
    lockedScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function syncBodyLock() {
    const hasOpenModal = Boolean($(".modal.is-open"));
    const cartOpen = cartDrawer.classList.contains("is-open");
    const shouldLock = hasOpenModal || cartOpen;
    document.body.classList.toggle("no-scroll", shouldLock);

    if (shouldLock && mobileScrollLock.matches) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
  }

  function openModal(modal) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    const card = modal.querySelector(".modal-card");
    if (card) {
      card.setAttribute("tabindex", "-1");
      card.focus({ preventScroll: true });
    }
    syncBodyLock();
  }

  function closeModal(modal) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    syncBodyLock();
  }

  function closeAllModals() {
    $$(".modal.is-open").forEach(closeModal);
  }

  /* ---------- Enlaces y embeds ---------- */

  function applyConfig() {
    $$('[data-link="whatsapp"]').forEach((link) => {
      link.href = waLink(
        link.dataset.waMessage || "Hola! Tengo una duda sobre..."
      );
    });

    $$('[data-link="instagram"]').forEach((link) => {
      link.href = CFG.instagram || "#";
    });

    $$('[data-link="tiktok"]').forEach((link) => {
      link.href = CFG.tiktok || "#";
    });

    const deliveryNote = $("#deliveryNote");
    if (deliveryNote) deliveryNote.textContent = CFG.deliveryNote || "";

    if (useSupabase) {
      if (adminEmailField) adminEmailField.hidden = false;
      if (adminLoginHint) {
        adminLoginHint.textContent =
          "Ingresá con las credenciales del panel para ver el calendario de pedidos.";
      }
    }

    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();

    renderEmbeds();
  }

  function renderEmbeds() {
    const spotifySlot = $("#spotifySlot");
    const spotifyLink = $("#spotifyLink");
    if (spotifySlot) {
      if (CFG.spotifyEmbed) {
        spotifySlot.innerHTML = `
          <iframe class="spotify-frame" src="${esc(CFG.spotifyEmbed)}"
            title="Playlist de Spotify de Le Petit Shortt Cake" loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
        if (CFG.spotifyUrl && spotifyLink) {
          spotifyLink.href = CFG.spotifyUrl;
          spotifyLink.hidden = false;
        }
      } else {
        spotifySlot.innerHTML = `
          <div class="embed-placeholder spotify-placeholder">
            <div class="spotify-cover">
              <img src="assets/secciones/playlist-christmas-hits.webp" alt="" data-fallback>
              <svg aria-hidden="true"><use href="#i-spotify"/></svg>
            </div>
            <div class="spotify-placeholder-copy">
              <strong>Playlist muy pronto</strong>
              <span>Mientras tanto, poné tu música navideña favorita.</span>
            </div>
          </div>`;
      }
    }

    const youtubeSlot = $("#youtubeSlot");
    const youtubeLink = $("#youtubeLink");
    const youtubePlay = $("#youtubePlay");
    const youtubeSoon = $("#youtubeSlot .tutorial-soon");
    if (youtubeSlot && CFG.youtubeEmbed) {
      youtubeSlot.innerHTML = `
        <iframe class="video-frame" src="${esc(CFG.youtubeEmbed)}"
          title="Video tutorial de Le Petit Shortt Cake" loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen></iframe>`;
    }

    if (youtubeSoon) youtubeSoon.hidden = Boolean(CFG.youtubeUrl || CFG.youtubeEmbed);

    [youtubeLink, youtubePlay].forEach((link) => {
      if (!link) return;
      if (CFG.youtubeUrl) {
        link.href = CFG.youtubeUrl;
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    });
  }

  function setupImageFallbacks() {
    document.addEventListener(
      "error",
      (event) => {
        const img = event.target;
        if (img instanceof HTMLImageElement && img.hasAttribute("data-fallback")) {
          img.classList.add("is-missing");
        }
      },
      true
    );

    $$("img[data-fallback]").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) img.classList.add("is-missing");
    });
  }

  /* ---------- Catálogo ---------- */

  function renderFilters() {
    filters.innerHTML = FILTERS.map(
      (filter) => `
        <button type="button" class="filter-btn ${state.filter === filter.id ? "is-active" : ""}"
          data-filter="${filter.id}" role="tab" aria-selected="${state.filter === filter.id}">
          ${filter.label}
        </button>`
    ).join("");

    if (!catalogSwitch || !catalogSwitchLabel) return;
    const goingToExtras = state.filter !== "extras";
    const label = goingToExtras ? "Ver Little Extras" : "Volver a Kits";
    catalogSwitchLabel.textContent = label;
    catalogSwitch.setAttribute("aria-label", label);
  }

  function galleryImages(product) {
    if (product.images?.length) return product.images;
    return product.image ? [product.image] : [];
  }

  function productGallery(product) {
    const images = galleryImages(product);
    if (!images.length) {
      return `<span class="product-icon"><svg aria-hidden="true"><use href="#${product.icon}"/></svg></span>`;
    }
    const multiple = images.length > 1;
    return `
      <div class="product-gallery" data-gallery data-index="0" aria-label="Fotos de ${esc(product.name)}">
        <div class="product-gallery-track" data-gallery-track>
          ${images
            .map(
              (src, index) => `
            <div class="product-gallery-slide">
              <img src="${esc(src)}" alt="${esc(product.name)} — foto ${index + 1} de ${images.length}" loading="${index === 0 ? "eager" : "lazy"}">
            </div>`
            )
            .join("")}
        </div>
        ${multiple
          ? `
        <button type="button" class="product-gallery-nav product-gallery-nav--prev" data-gallery-step="-1" aria-label="Foto anterior">
          <svg aria-hidden="true"><use href="#i-chevron-left"/></svg>
        </button>
        <button type="button" class="product-gallery-nav product-gallery-nav--next" data-gallery-step="1" aria-label="Foto siguiente">
          <svg aria-hidden="true"><use href="#i-chevron-right"/></svg>
        </button>
        <div class="product-gallery-dots">
          ${images
            .map(
              (_, index) =>
                `<button type="button" class="product-gallery-dot${index === 0 ? " is-active" : ""}" data-gallery-dot="${index}" aria-label="Ver foto ${index + 1} de ${images.length}"${index === 0 ? ' aria-current="true"' : ""}></button>`
            )
            .join("")}
        </div>`
          : ""}
      </div>`;
  }

  function productMedia(product) {
    if (product.image) {
      return `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">`;
    }
    return `<span class="product-icon"><svg aria-hidden="true"><use href="#${product.icon}"/></svg></span>`;
  }

  function galleryIndex(track) {
    if (!track?.clientWidth) return 0;
    const count = track.children.length || 1;
    return Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / track.clientWidth)));
  }

  function goToGallery(gallery, index) {
    const track = gallery?.querySelector("[data-gallery-track]");
    const count = track?.children.length || 0;
    if (!track || count < 2) return;
    const next = Math.max(0, Math.min(count - 1, index));
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  }

  function stepGallery(gallery, delta) {
    const track = gallery?.querySelector("[data-gallery-track]");
    const count = track?.children.length || 0;
    if (!track || count < 2) return;
    const next = (galleryIndex(track) + delta + count) % count;
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  }

  function syncGallery(track) {
    const gallery = track?.closest(".product-gallery");
    if (!gallery) return;
    const index = galleryIndex(track);
    if (Number(gallery.dataset.index) === index) return;
    gallery.dataset.index = String(index);
    gallery.querySelectorAll("[data-gallery-dot]").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
      if (dotIndex === index) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  }

  function productCard(product) {
    const isExtra = product.category === "extras";
    return `
      <article class="product-card tone-${product.tone} ${isExtra ? "product-card--extra" : ""}" data-reveal>
        <button type="button" class="product-media" data-open-product="${product.id}" aria-label="Ver detalle de ${esc(product.name)}">
          ${productMedia(product)}
          ${product.badge ? `<span class="product-badge">${esc(product.badge)}</span>` : ""}
        </button>
        <div class="product-body">
          <p class="product-cat">${categoryLabel(product.category)}</p>
          <h3 class="product-name">
            <button type="button" data-open-product="${product.id}">${esc(product.name)}</button>
          </h3>
          <p class="product-desc">${esc(product.short)}</p>
          <div class="product-meta">
            ${product.size ? `<span>${esc(product.size)}</span>` : ""}
            ${product.persons ? `<span>${esc(product.persons)}</span>` : ""}
            ${product.people ? `<span>${esc(product.people)}</span>` : ""}
          </div>
          <div class="product-foot">
            <div class="product-price"><span>${esc(CFG.currency || "Ref.")}</span>${fmtNum(product.price)}</div>
            <button type="button" class="add-btn" data-add="${product.id}">
              <svg aria-hidden="true"><use href="#i-plus"/></svg> Agregar
            </button>
          </div>
        </div>
      </article>`;
  }

  function renderCatalog() {
    if (state.filter === "extras") {
      catalogGrid.innerHTML = `
        <section class="catalog-section">
          <div class="catalog-section-grid">
            ${PRODUCTS.filter((product) => product.category === "extras")
              .sort((a, b) => extraPosition(a.id) - extraPosition(b.id))
              .map(productCard)
              .join("")}
          </div>
        </section>`;
    } else {
      catalogGrid.innerHTML = KIT_SECTIONS.map(
        (section) => `
          <section class="catalog-section">
            <h3 class="catalog-section-title">${esc(section.label)}</h3>
            <div class="catalog-section-grid">
              ${PRODUCTS.filter((product) => section.categories.includes(product.category))
                .map(productCard)
                .join("")}
            </div>
          </section>`
      ).join("");
    }
    observeReveals();
  }

  /* ---------- Carrito ---------- */

  const cartDetails = () =>
    state.cart
      .map((item) => {
        const product = productById(item.id);
        return product ? { ...product, qty: item.qty } : null;
      })
      .filter(Boolean);

  const cartCount = () => state.cart.reduce((total, item) => total + item.qty, 0);
  const cartTotalValue = () =>
    cartDetails().reduce((total, item) => total + item.price * item.qty, 0);

  function persistCart() {
    saveJSON(KEYS.cart, state.cart);
  }

  function updateCartUI() {
    const count = cartCount();
    if (cartBadge) cartBadge.textContent = String(count);
    if (cartCountLabel) cartCountLabel.textContent = String(count);
    if (cartTotal) cartTotal.textContent = money(cartTotalValue());
    if (cartDrawer.classList.contains("is-open")) renderCart();
  }

  function renderCart() {
    const items = cartDetails();

    if (!items.length) {
      cartItems.innerHTML = `
        <div class="empty-cart">
          <svg aria-hidden="true"><use href="#i-cart"/></svg>
          <strong>Tu carrito está vacío</strong>
          <p>Sumá una casita o un kit para empezar a armar tu pedido.</p>
          <a href="#catalogo" class="btn btn-ghost btn-sm" data-close-cart>Ver catálogo</a>
        </div>`;
      return;
    }

    cartItems.innerHTML = items
      .map(
        (item) => `
        <div class="cart-item">
          <div class="cart-item-media tone-${item.tone}">${productMedia(item)}</div>
          <div class="cart-item-info">
            <p class="cart-item-name">${esc(item.name)}</p>
            <p class="cart-item-price">${money(item.price)} c/u</p>
            <div class="qty-control">
              <button type="button" data-cart-dec="${item.id}" aria-label="Quitar una unidad"><svg aria-hidden="true"><use href="#i-minus"/></svg></button>
              <span>${item.qty}</span>
              <button type="button" data-cart-inc="${item.id}" aria-label="Agregar una unidad"><svg aria-hidden="true"><use href="#i-plus"/></svg></button>
            </div>
          </div>
          <button type="button" class="cart-item-remove" data-cart-remove="${item.id}" aria-label="Eliminar ${esc(item.name)}">
            <svg aria-hidden="true"><use href="#i-trash"/></svg>
          </button>
        </div>`
      )
      .join("");
  }

  function addToCart(id, qty = 1) {
    const product = productById(id);
    if (!product) return;
    const existing = state.cart.find((item) => item.id === id);
    if (existing) {
      existing.qty += qty;
    } else {
      state.cart.push({ id, qty });
    }
    persistCart();
    updateCartUI();
    showToast(`${product.name} agregado al carrito`);
    burstConfetti(12);
  }

  function updateCartQty(id, delta) {
    const item = state.cart.find((entry) => entry.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      state.cart = state.cart.filter((entry) => entry.id !== id);
    }
    persistCart();
    updateCartUI();
    renderCart();
  }

  function removeCartItem(id) {
    state.cart = state.cart.filter((entry) => entry.id !== id);
    persistCart();
    updateCartUI();
    renderCart();
  }

  function clearCart() {
    state.cart = [];
    persistCart();
    updateCartUI();
    renderCart();
  }

  let overlayTimer;

  function openCart() {
    renderCart();
    overlay.hidden = false;
    clearTimeout(overlayTimer);
    requestAnimationFrame(() => {
      overlay.classList.add("is-open");
      cartDrawer.classList.add("is-open");
      cartDrawer.setAttribute("aria-hidden", "false");
      syncBodyLock();
    });
  }

  function closeCart() {
    cartDrawer.classList.remove("is-open");
    cartDrawer.setAttribute("aria-hidden", "true");
    overlay.classList.remove("is-open");
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => {
      overlay.hidden = true;
    }, 320);
    syncBodyLock();
  }

  /* ---------- Detalle de producto ---------- */

  function openProduct(id) {
    const product = productById(id);
    if (!product) return;

    state.detailQty = 1;
    const hasGallery = (product.images?.length || 0) > 1;

    productModalBody.innerHTML = `
      <button type="button" class="modal-close" data-close-modal aria-label="Cerrar detalle">
        <svg aria-hidden="true"><use href="#i-close"/></svg>
      </button>
      <div class="product-detail">
        <div class="detail-media tone-${product.tone}${hasGallery ? " detail-media--gallery" : ""}">${productGallery(product)}</div>
        <div class="detail-body">
          <p class="product-cat">${categoryLabel(product.category)}</p>
          <h2>${esc(product.name)}</h2>
          <p class="detail-desc">${esc(product.description)}</p>
          <div class="detail-meta">
            ${product.size ? `<span>${esc(product.size)}</span>` : ""}
            ${product.persons ? `<span>${esc(product.persons)}</span>` : ""}
            ${product.people ? `<span>${esc(product.people)}</span>` : ""}
          </div>
          <p class="includes-title">Contenido del kit</p>
          <ul class="includes-list">
            ${product.includes
              .map(
                (item) =>
                  `<li><svg aria-hidden="true"><use href="#i-check"/></svg> ${esc(item)}</li>`
              )
              .join("")}
          </ul>
          <div class="detail-buy">
            <div class="detail-price"><span>${esc(CFG.currency || "Ref.")}</span>${fmtNum(product.price)}</div>
            <div class="qty-control">
              <button type="button" data-detail-dec aria-label="Quitar una unidad"><svg aria-hidden="true"><use href="#i-minus"/></svg></button>
              <span data-detail-count>1</span>
              <button type="button" data-detail-inc aria-label="Agregar una unidad"><svg aria-hidden="true"><use href="#i-plus"/></svg></button>
            </div>
            <button type="button" class="btn btn-primary" data-add-detail="${product.id}">Agregar al carrito</button>
          </div>
        </div>
      </div>`;

    openModal(productModal);
  }

  /* ---------- Checkout ---------- */

  function capturePaymentFields() {
    if (paymentNote) state.checkout.paymentNote = paymentNote.value.trim();
    if (zelleHolder) state.checkout.zelleHolder = zelleHolder.value.trim();
  }

  function renderMethods() {
    const methods = Object.entries(CFG.payment || {});
    methodGrid.innerHTML = methods
      .map(
        ([key, method]) => `
        <button type="button" class="method-card ${state.checkout.method === key ? "is-selected" : ""}" data-method="${key}">
          <span class="method-icon">${esc(method.icon)}</span>
          <span>
            <strong>${esc(method.label)}</strong>
            <small>${esc(method.hint || "")}</small>
          </span>
          <span class="method-check"><svg aria-hidden="true"><use href="#i-check"/></svg></span>
        </button>`
      )
      .join("");
  }

  function renderMethodDetails() {
    const method = (CFG.payment || {})[state.checkout.method];
    if (!method) return;

    const amount = paymentAmountInfo();
    const copyData = paymentCopyData();
    const copyBlock = copyData
      ? `
        <div class="pay-copy">
          <p class="pay-copy-title">Copiar datos</p>
          <div class="pay-copy-actions">
            ${copyData.fields
              .map(
                (field) => `
                  <button type="button" class="copy-btn" data-copy-field="${field.key}"${field.disabled ? " disabled" : ""}>
                    <svg aria-hidden="true"><use href="#i-copy"/></svg>
                    <span>${esc(field.label)}</span>
                  </button>`
              )
              .join("")}
            <button type="button" class="copy-btn copy-all" data-copy-field="all"${copyData.allDisabled ? " disabled" : ""}>
              <svg aria-hidden="true"><use href="#i-copy"/></svg>
              <span>${esc(copyData.allLabel)}</span>
            </button>
          </div>
          ${
            copyData.allDisabled
              ? '<p class="pay-copy-hint">Esperando la tasa para copiar el monto…</p>'
              : ""
          }
        </div>`
      : "";

    payInstructions.innerHTML = `
      <h3>Datos para pagar</h3>
      <ul>${(method.instructions || [])
        .map((line) => `<li>${esc(line)}</li>`)
        .join("")}</ul>
      <p class="pay-amount">
        <span>Monto a pagar</span>
        <strong>${esc(amount.label)}</strong>
        <span>${esc(amount.note)}</span>
      </p>
      ${copyBlock}`;

    const isCash = state.checkout.method === "efectivo";
    const isZelle = state.checkout.method === "zelle";
    if (proofSection) proofSection.hidden = isCash;
    if (zelleHolderField) zelleHolderField.hidden = !isZelle;
    if (!isZelle && zelleHolder) markFieldError(zelleHolder, false);
    if (proofHint) {
      proofHint.textContent = isCash
        ? "En efectivo no necesitás subir captura: pagás al recibir."
        : isZelle
          ? "Subí entre 1 y 3 capturas y escribí el nombre del titular de la cuenta."
          : "Subí entre 1 y 3 capturas. Son obligatorias para confirmar el pedido.";
    }
    if (checkoutConfirm) {
      checkoutConfirm.innerHTML = isCash
        ? 'Confirmar pedido <svg aria-hidden="true"><use href="#i-check"/></svg>'
        : 'Aceptar y enviar pedido <svg aria-hidden="true"><use href="#i-check"/></svg>';
    }
    if (isCash) markUploadError(false);
  }

  function setCheckoutStep(step) {
    state.checkout.step = step;

    $$("#checkoutSteps li").forEach((item) => {
      const itemStep = Number(item.dataset.stepDot);
      item.classList.toggle("is-active", itemStep === step);
      item.classList.toggle("is-done", itemStep < step);
    });

    $$(".checkout-panel").forEach((panel) => {
      panel.classList.toggle("is-active", Number(panel.dataset.step) === step);
    });

    checkoutBack.hidden = step === 1;
    checkoutNext.hidden = step === 2;
    checkoutConfirm.hidden = step !== 2;

    if (checkoutCard) checkoutCard.scrollTop = 0;
  }

  function markFieldError(input, hasError) {
    const field = input?.closest(".field");
    if (field) field.classList.toggle("has-error", hasError);
  }

  function markUploadError(hasError) {
    uploadBox?.classList.toggle("has-error", Boolean(hasError));
  }

  function validateStep(step) {
    if (step === 1) {
      const name = $("#custName");
      const phone = $("#custPhone");
      const date = $("#deliveryDate");
      const address = $("#custAddress");
      let valid = true;

      const nameOk = name.value.trim().length >= 3;
      markFieldError(name, !nameOk);
      if (!nameOk) valid = false;

      const phoneOk = phone.value.replace(/\D/g, "").length >= 7;
      markFieldError(phone, !phoneOk);
      if (!phoneOk) valid = false;

      const dateOk = Boolean(date.value) && date.value >= todayIso();
      markFieldError(date, !dateOk);
      if (!dateOk) valid = false;

      const needsAddress = deliveryType.value === "Entrega a domicilio";
      const addressOk = !needsAddress || address.value.trim().length >= 5;
      markFieldError(address, !addressOk);
      if (!addressOk) valid = false;

      if (!valid) {
        showToast("Revisá los campos marcados en rojo.");
        return false;
      }

      state.checkout.customer = {
        name: name.value.trim(),
        phone: phone.value.trim(),
        email: $("#custEmail").value.trim(),
        date: date.value,
        deliveryType: deliveryType.value,
        address: address.value.trim(),
        notes: $("#custNotes").value.trim(),
      };

      saveJSON(KEYS.customer, {
        name: state.checkout.customer.name,
        phone: state.checkout.customer.phone,
        email: state.checkout.customer.email,
        address: state.checkout.customer.address,
        notes: state.checkout.customer.notes,
      });

      return true;
    }

    if (step === 2) {
      capturePaymentFields();
      if (state.checkout.method === "zelle") {
        const holderOk = (state.checkout.zelleHolder || "").length >= 3;
        markFieldError(zelleHolder, !holderOk);
        if (!holderOk) {
          zelleHolder?.scrollIntoView({ behavior: "smooth", block: "center" });
          showToast("Escribí el nombre del titular de la cuenta Zelle.");
          return false;
        }
      }
      if (
        state.checkout.method !== "efectivo" &&
        state.checkout.proofs.length === 0
      ) {
        markUploadError(true);
        uploadBox?.scrollIntoView({ behavior: "smooth", block: "center" });
        showToast("Subí al menos una captura del pago.");
        return false;
      }
      markUploadError(false);
      return true;
    }

    return true;
  }

  function resetCheckout() {
    state.checkout = {
      step: 1,
      method: Object.keys(CFG.payment || {})[0] || "pagoMovil",
      proofs: [],
      paymentNote: "",
      zelleHolder: "",
      euroRate: Number(FX.manualEuroRate) || 0,
      rateSource: "tasa de respaldo",
      rateLoading: FX.useLiveRate !== false,
      customer: null,
    };

    const saved = loadJSON(KEYS.customer, {}) || {};
    $("#custName").value = saved.name || "";
    $("#custPhone").value = saved.phone || "";
    $("#custEmail").value = saved.email || "";
    $("#custAddress").value = saved.address || "";
    $("#custNotes").value = saved.notes || "";
    $("#custPhone").value = saved.phone || "";
    deliveryType.value = "Coordinar por WhatsApp";
    deliveryDate.value = "";
    deliveryDate.min = todayIso();
    addressField.hidden = true;
    $("#custAddress").required = false;
    paymentNote.value = "";
    if (zelleHolder) zelleHolder.value = "";
    proofInput.value = "";
    markUploadError(false);
    renderProofPreview();

    $$(".field.has-error").forEach((field) => field.classList.remove("has-error"));

    checkoutSteps.hidden = false;
    checkoutForm.hidden = false;
    checkoutActions.hidden = false;
    checkoutSuccess.hidden = true;

    renderOrderPreview();
    renderMethods();
    renderMethodDetails();
    setCheckoutStep(1);
  }

  async function loadExchangeRate() {
    if (FX.useLiveRate === false || state.checkout.method !== "pagoMovil") return;
    state.checkout.rateLoading = true;
    renderMethodDetails();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const [usdResponse, fxResponse] = await Promise.all([
        fetch(FX.bcvUsdApi, { signal: controller.signal }),
        fetch(FX.eurUsdApi, { signal: controller.signal }),
      ]);
      if (!usdResponse.ok || !fxResponse.ok) throw new Error("Tasa no disponible");

      const [usdData, fxData] = await Promise.all([
        usdResponse.json(),
        fxResponse.json(),
      ]);
      const bcvUsd = Number(
        (usdData || []).find(
          (item) => item?.fuente === "oficial" && item?.moneda === "USD"
        )?.promedio
      );
      const eurToUsd = Number(fxData?.rates?.USD);
      if (!Number.isFinite(bcvUsd) || !Number.isFinite(eurToUsd)) {
        throw new Error("Tasa inválida");
      }

      state.checkout.euroRate = Math.round(bcvUsd * eurToUsd * 100) / 100;
      state.checkout.rateSource = "dólar oficial BCV";
    } catch (error) {
      console.warn("No se pudo actualizar la tasa", error);
      state.checkout.euroRate = Number(FX.manualEuroRate) || 0;
      state.checkout.rateSource = "tasa de respaldo";
      showToast("No pudimos actualizar la tasa; usamos la de respaldo.");
    } finally {
      clearTimeout(timeout);
      state.checkout.rateLoading = false;
      renderMethodDetails();
    }
  }

  async function openCheckout() {
    if (!state.cart.length) {
      showToast("Tu carrito está vacío. Sumá un kit para continuar.");
      return;
    }
    closeCart();
    resetCheckout();
    openModal(checkoutModal);
    await loadExchangeRate();
  }

  function renderOrderPreview() {
    if (!orderPreview) return;
    const items = cartDetails();
    orderPreview.innerHTML = `
      <div class="summary-box">
        <h3>Tu pedido</h3>
        <ul class="summary-items">
          ${items
            .map(
              (item) =>
                `<li><span>${item.qty} × ${esc(item.name)}</span><strong>${money(item.price * item.qty)}</strong></li>`
            )
            .join("")}
        </ul>
        <div class="summary-total"><span>Total</span><strong>${money(cartTotalValue())}</strong></div>
      </div>`;
  }

  /* ---------- Pedidos: adaptador local / Supabase ---------- */

  function orderToRow(order) {
    const customer = order.customer || {};
    const payment = order.payment || {};
    const proofPaths = Array.isArray(payment.proofPaths)
      ? payment.proofPaths
      : payment.proofPath
        ? [payment.proofPath]
        : [];
    return {
      id: order.id,
      number: order.number,
      created_at: order.createdAt,
      delivery_date: order.deliveryDate,
      customer_name: customer.name || "",
      customer_phone: customer.phone || "",
      customer_email: customer.email || null,
      customer_address: customer.address || null,
      customer_notes: customer.notes || null,
      delivery_type: customer.deliveryType || null,
      total: Number(order.total || 0),
      payment_method: payment.method || "efectivo",
      payment_note: payment.note || null,
      proof_path: proofPaths[0] || null,
      proof_paths: proofPaths,
      status: order.status || "pendiente_verificacion",
      delivery_status: order.deliveryStatus || "por_asignar",
      history: order.history || [],
      delivery_history: order.deliveryHistory || [],
    };
  }

  function orderFromRow(row) {
    const proofPaths = Array.isArray(row.proof_paths)
      ? row.proof_paths.filter(Boolean)
      : row.proof_path
        ? [row.proof_path]
        : [];
    const customer = {
      name: row.customer_name || "",
      phone: row.customer_phone || "",
      email: row.customer_email || "",
      date: row.delivery_date,
      deliveryType: row.delivery_type || "",
      address: row.customer_address || "",
      notes: row.customer_notes || "",
    };
    return {
      id: row.id,
      number: row.number,
      createdAt: row.created_at,
      deliveryDate: row.delivery_date,
      customer,
      items: (row.orden_items || []).map((item) => ({
        id: item.product_id,
        name: item.name,
        price: Number(item.price),
        qty: Number(item.qty),
      })),
      total: Number(row.total),
      payment: {
        method: row.payment_method,
        note: row.payment_note || "",
        proofPaths,
        proofPath: proofPaths[0] || null,
        proofs: proofPaths.map((path, index) => ({
          path,
          name: `Captura ${index + 1}`,
        })),
      },
      status: row.status,
      deliveryStatus: row.delivery_status || "por_asignar",
      history: row.history || [],
      deliveryHistory: row.delivery_history || [],
    };
  }

  function itemsToRows(orderId, items) {
    return (items || []).map((item) => ({
      order_id: orderId,
      product_id: item.id || null,
      name: item.name,
      price: Number(item.price),
      qty: Number(item.qty),
    }));
  }

  async function nextOrderNumber() {
    if (!useSupabase) {
      let counter = 0;
      try {
        counter = Number(localStorage.getItem(KEYS.counter) || 0) + 1;
        localStorage.setItem(KEYS.counter, String(counter));
      } catch (error) {
        console.warn(error);
        counter = getOrders().length + 1;
      }
      return `${CFG.orderPrefix || "LPSC"}-${new Date().getFullYear()}-${String(counter).padStart(3, "0")}`;
    }
    const { data, error } = await supabase.rpc("next_order_number", {
      p_prefix: CFG.orderPrefix || "LPSC",
    });
    if (error) throw error;
    return data;
  }

  function getOrders() {
    const orders = useSupabase ? state.admin.orders : loadArray(KEYS.orders);
    return orders.filter((order) => order && order.number);
  }

  async function refreshOrders() {
    if (!useSupabase) {
      state.admin.orders = loadArray(KEYS.orders);
      return getOrders();
    }
    const { data, error } = await supabase
      .from("ordenes")
      .select("*, orden_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    state.admin.orders = (data || []).map(orderFromRow);
    return getOrders();
  }

  const refreshAdmin = debounce(async () => {
    try {
      await refreshOrders();
      if (isAdminAuthed()) renderAdmin();
    } catch (error) {
      console.warn("No se pudieron actualizar los pedidos", error);
    }
  }, 250);

  const deliveryStatusKey = (order) =>
    order?.deliveryStatus && DELIVERY_STATUSES[order.deliveryStatus]
      ? order.deliveryStatus
      : "por_asignar";

  const deliveryStatusLabel = (order) =>
    DELIVERY_STATUSES[deliveryStatusKey(order)]?.label || "Por asignar";

  async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  function proofExtension(name, type) {
    // compressImage siempre vuelve a codificar en JPEG.
    if (type === "image/png") return "png";
    if (type === "image/webp") return "webp";
    if (type === "image/jpeg") return "jpg";
    const fromName = String(name || "").split(".").pop().toLowerCase();
    return /^[a-z0-9]{3,4}$/.test(fromName) ? fromName : "jpg";
  }

  async function saveOrder(order) {
    const proofs = Array.isArray(order.payment?.proofs)
      ? order.payment.proofs
      : [];
    const needsProof = order.payment?.method !== "efectivo";
    if (needsProof && proofs.length === 0 && !order.payment?.proofPath) {
      throw new Error("Falta la captura del pago");
    }

    if (!useSupabase) {
      const orders = getOrders();
      orders.unshift(order);
      const saved = saveJSON(KEYS.orders, orders);
      if (!saved && proofs.length) {
        throw new Error("No se pudieron guardar las capturas del pago");
      }
      state.admin.orders = orders;
      return order;
    }

    const uploadedPaths = [];

    try {
      for (let index = 0; index < proofs.length; index += 1) {
        const proof = proofs[index];
        const blob = await dataUrlToBlob(proof.data);
        const path = `${order.id}-${index + 1}.${proofExtension(proof.name, blob.type)}`;
        const { error: uploadError } = await supabase.storage
          .from(proofBucket)
          .upload(path, blob, {
            contentType: blob.type || "image/jpeg",
            upsert: false,
          });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
      }
      order.payment.proofPaths = uploadedPaths;
      order.payment.proofPath = uploadedPaths[0] || null;

      // Sin .select(): el público no tiene permiso de lectura (RLS).
      const { error: orderError } = await supabase
        .from("ordenes")
        .insert(orderToRow(order));
      if (orderError) throw orderError;

      const rows = itemsToRows(order.id, order.items);
      if (rows.length) {
        const { error: itemsError } = await supabase.from("orden_items").insert(rows);
        if (itemsError) throw itemsError;
      }
    } catch (error) {
      if (uploadedPaths.length) {
        try {
          await supabase.storage.from(proofBucket).remove(uploadedPaths);
        } catch (cleanupError) {
          console.warn("No se pudieron limpiar las capturas", cleanupError);
        }
      }
      throw error;
    }

    // El cliente anónimo no puede leer pedidos (RLS). El alta ya terminó:
    // no queremos que un fallo de refresco haga creer que no se guardó.
    try {
      await refreshOrders();
    } catch (error) {
      console.warn("Pedido guardado; no se pudo refrescar la lista local", error);
    }
    return order;
  }

  async function updateOrder(updated) {
    if (!useSupabase) {
      saveJSON(
        KEYS.orders,
        getOrders().map((entry) => (entry.number === updated.number ? updated : entry))
      );
      state.admin.orders = loadArray(KEYS.orders);
      return;
    }
    const { error } = await supabase
      .from("ordenes")
      .update(orderToRow(updated))
      .eq("number", updated.number);
    if (error) throw error;
    await refreshOrders();
  }

  async function deleteOrder(number) {
    if (!useSupabase) {
      saveJSON(KEYS.orders, getOrders().filter((entry) => entry.number !== number));
      state.admin.orders = loadArray(KEYS.orders);
      return;
    }
    const order = getOrders().find((entry) => entry.number === number);
    const { error } = await supabase.from("ordenes").delete().eq("number", number);
    if (error) throw error;
    const paths = Array.isArray(order?.payment?.proofPaths)
      ? order.payment.proofPaths
      : order?.payment?.proofPath
        ? [order.payment.proofPath]
        : [];
    if (paths.length) {
      const { error: storageError } = await supabase.storage
        .from(proofBucket)
        .remove(paths);
      if (storageError) console.warn("No se pudieron borrar las capturas", storageError);
    }
    await refreshOrders();
  }

  async function confirmOrder() {
    capturePaymentFields();
    const customer = state.checkout.customer;
    const items = cartDetails();

    if (!customer || !items.length) {
      showToast("Faltan datos del pedido. Revisá el carrito e intentá de nuevo.");
      return;
    }
    if (
      state.checkout.method !== "efectivo" &&
      state.checkout.proofs.length === 0
    ) {
      markUploadError(true);
      showToast("Subí al menos una captura antes de confirmar.");
      return;
    }
    if (state.checkout.submitting) return;
    state.checkout.submitting = true;
    checkoutConfirm.disabled = true;

    const amountInfo = paymentAmountInfo();
    const order = {
      id:
        (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
        String(Date.now()),
      number: "",
      createdAt: new Date().toISOString(),
      deliveryDate: customer.date,
      customer: { ...customer },
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty,
      })),
      total: cartTotalValue(),
      payment: {
        method: state.checkout.method,
        amount: amountInfo.amount,
        amountLabel: amountInfo.label,
        currency: amountInfo.currency,
        euroRate: amountInfo.rate,
        holderName:
          state.checkout.method === "zelle" ? state.checkout.zelleHolder : null,
        note: [
          state.checkout.paymentNote,
          state.checkout.method === "zelle" && state.checkout.zelleHolder
            ? `Titular Zelle: ${state.checkout.zelleHolder}`
            : "",
          `Monto a pagar: ${amountInfo.label}`,
          state.checkout.method === "pagoMovil"
            ? `Tasa euro: Bs ${fmtAmount(amountInfo.rate || 0)} (${state.checkout.rateSource})`
            : "",
          state.checkout.method !== "efectivo"
            ? `Capturas: ${state.checkout.proofs.length}`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        proofs: state.checkout.proofs.map((proof) => ({
          data: proof.data,
          name: proof.name,
        })),
        proofPaths: [],
        proofPath: null,
      },
      status: "pendiente_verificacion",
      deliveryStatus: "por_asignar",
      history: [
        {
          status: "pendiente_verificacion",
          at: new Date().toISOString(),
        },
      ],
    };

    try {
      order.number = await nextOrderNumber();
      await saveOrder(order);
    } catch (error) {
      console.error("No se pudo guardar el pedido", error);
      showToast("No se pudo registrar el pedido. Revisá tu conexión e intentá de nuevo.");
      return;
    } finally {
      state.checkout.submitting = false;
      checkoutConfirm.disabled = false;
    }

    clearCart();
    showCheckoutSuccess(order);
  }

  function showCheckoutSuccess(order) {
    checkoutSteps.hidden = true;
    checkoutForm.hidden = true;
    checkoutActions.hidden = true;
    checkoutSuccess.hidden = false;

    $("#successOrderNumber").textContent = order.number;
    const successNote = $("#successNote");
    if (successNote) {
      successNote.textContent =
        order.payment?.method === "efectivo"
          ? "Guardá este número. Coordinaremos el pago al recibir por WhatsApp."
          : "Guardá este número. Ya recibimos tus capturas del pago; el equipo las verificará y te confirmará por WhatsApp.";
    }
    burstConfetti(55);
    checkoutCard.scrollTop = 0;
  }

  /* ---------- Comprobante ---------- */

  function compressImage(file, maxSide = 1200, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          let { width, height } = image;
          const scale = Math.min(1, maxSide / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderProofPreview() {
    const proofs = state.checkout.proofs;
    uploadBox.hidden = proofs.length > 0;

    if (proofs.length === 0) {
      proofPreview.innerHTML = "";
      return;
    }

    proofPreview.innerHTML = `
      ${proofs
        .map(
          (proof, index) => `
          <div class="proof-frame">
            <img class="proof-image" src="${proof.data}" alt="Captura ${index + 1}"
              data-proof-view="${index}" title="Ver captura completa">
            <button type="button" class="proof-remove" data-proof-remove="${index}"
              aria-label="Quitar captura ${index + 1}" title="Quitar captura ${index + 1}">
              <svg aria-hidden="true"><use href="#i-trash"/></svg>
            </button>
          </div>`
        )
        .join("")}
      ${
        proofs.length < MAX_PROOFS
          ? `<label class="upload upload-mini" for="proofInput">
              <svg aria-hidden="true"><use href="#i-upload"/></svg>
              <strong>Agregar otra</strong>
              <span>${MAX_PROOFS - proofs.length} disponible(s)</span>
            </label>`
          : ""
      }`;
  }

  /* ---------- Admin ---------- */

  function isAdminAuthed() {
    if (useSupabase) return state.admin.authed;
    try {
      return sessionStorage.getItem(KEYS.admin) === "1";
    } catch (error) {
      return state.admin.authed;
    }
  }

  function setAdminAuthed(value) {
    state.admin.authed = value;
    if (useSupabase) return;
    try {
      if (value) sessionStorage.setItem(KEYS.admin, "1");
      else sessionStorage.removeItem(KEYS.admin);
    } catch (error) {
      console.warn(error);
    }
  }

  function showAdminUI() {
    const authed = isAdminAuthed();
    adminLogin.hidden = authed;
    adminPanel.hidden = !authed;
    adminLogout.hidden = !authed;
    if (authed) {
      renderAdmin();
      refreshAdmin();
    }
  }

  async function initAuth() {
    if (!useSupabase) {
      state.admin.authReady = true;
      return;
    }
    try {
      supabase.auth.onAuthStateChange((_event, session) => {
        const next = Boolean(session?.user);
        const changed = next !== state.admin.authed;
        state.admin.authed = next;
        state.admin.authReady = true;
        if (changed) {
          adminError.hidden = true;
          showAdminUI();
        }
        if (next) refreshAdmin();
      });
      const { data } = await supabase.auth.getSession();
      state.admin.authed = Boolean(data?.session?.user);
    } catch (error) {
      console.warn("No se pudo iniciar la autenticación", error);
    } finally {
      state.admin.authReady = true;
      if (window.location.hash === "#admin") showAdminUI();
    }
  }

  function filteredOrders(orders) {
    const query = state.admin.search.trim().toLowerCase();

    return orders
      .filter((order) => {
        if (state.admin.status !== "todos" && order.status !== state.admin.status) {
          return false;
        }
        if (!query) return true;
        const haystack = [
          order.number,
          order.customer?.name,
          order.customer?.phone,
          order.customer?.email,
          ...(order.items || []).map((item) => item.name),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const dateCompare = String(a.deliveryDate).localeCompare(String(b.deliveryDate));
        if (dateCompare !== 0) return dateCompare;
        return String(b.createdAt).localeCompare(String(a.createdAt));
      });
  }

  function renderStats(orders) {
    const pending = orders.filter((order) => order.status === "pendiente_verificacion").length;
    const confirmed = orders.filter((order) =>
      CONFIRMED_STATUSES.includes(order.status)
    ).length;
    const revenue = orders
      .filter((order) => CONFIRMED_STATUSES.includes(order.status))
      .reduce((total, order) => total + Number(order.total || 0), 0);

    adminStats.innerHTML = `
      <div class="stat-card"><small>Pedidos totales</small><strong>${orders.length}</strong></div>
      <div class="stat-card is-sky"><small>Por verificar</small><strong>${pending}</strong></div>
      <div class="stat-card is-green"><small>Confirmados</small><strong>${confirmed}</strong></div>
      <div class="stat-card is-lilac"><small>Total confirmado</small><strong>${money(revenue)}</strong></div>`;
  }

  function renderCalendar(orders) {
    const year = state.admin.calYear;
    const month = state.admin.calMonth;
    const filtered = filteredOrders(orders);
    const byDate = {};

    filtered.forEach((order) => {
      if (!order.deliveryDate) return;
      byDate[order.deliveryDate] = byDate[order.deliveryDate] || [];
      byDate[order.deliveryDate].push(order);
    });

    calLabel.textContent = new Date(year, month, 1).toLocaleDateString("es-VE", {
      month: "long",
      year: "numeric",
    });

    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const today = todayIso();

    const cells = [];
    for (let index = 0; index < totalCells; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = isoLocal(date);
      const dayNumber = date.getDate();
      const isOut = date.getMonth() !== month;
      const dayOrders = byDate[iso] || [];
      const visible = dayOrders.slice(0, 2);

      cells.push(`
        <div class="cal-cell ${isOut ? "is-out" : ""} ${iso === today ? "is-today" : ""}">
          <span class="cal-day">${dayNumber}</span>
          ${visible
            .map(
              (order) => `
              <button type="button" class="cal-event ${STATUSES[order.status]?.className || ""}"
                data-order-open="${esc(order.number)}"
                title="${esc(order.customer?.name || "")} · ${esc(STATUSES[order.status]?.label || "")}">
                ${esc((order.customer?.name || "").split(" ")[0] || order.number)}
              </button>`
            )
            .join("")}
          ${dayOrders.length > visible.length ? `<span class="cal-more">+${dayOrders.length - visible.length} más</span>` : ""}
        </div>`);
    }

    calGrid.innerHTML = cells.join("");
  }

  function renderAdminList(orders) {
    const filtered = filteredOrders(orders);
    adminListCount.textContent = String(filtered.length);

    if (!filtered.length) {
      adminList.innerHTML = `
        <div class="empty-state">
          <svg aria-hidden="true"><use href="#i-calendar"/></svg>
          <strong>Sin pedidos por acá</strong>
          <p>Cuando alguien haga una compra, va a aparecer en el calendario y en esta lista.</p>
        </div>`;
      return;
    }

    adminList.innerHTML = filtered
      .map(
        (order) => `
        <button type="button" class="admin-order" data-order-open="${esc(order.number)}">
          <div class="admin-order-info">
            <strong>${esc(order.number)}</strong>
            <span>${esc(order.customer?.name || "Sin nombre")}</span>
            <small>${formatDate(order.deliveryDate)} · ${money(order.total)}</small>
            <small class="admin-order-delivery">${esc(deliveryStatusLabel(order))}</small>
          </div>
          <span class="status-pill ${STATUSES[order.status]?.className || ""}">
            ${esc(STATUSES[order.status]?.label || order.status)}
          </span>
        </button>`
      )
      .join("");
  }

  function renderAdmin() {
    if (!isAdminAuthed()) return;
    const orders = getOrders();
    renderStats(orders);
    renderCalendar(orders);
    renderAdminList(orders);
  }

  async function openOrder(number) {
    let order = getOrders().find((entry) => entry.number === number);
    if (!order) {
      showToast("No se encontró el pedido.");
      return;
    }

    const proofPaths = Array.isArray(order.payment?.proofPaths)
      ? order.payment.proofPaths
      : order.payment?.proofPath
        ? [order.payment.proofPath]
        : [];
    if (useSupabase && proofPaths.length) {
      const signed = await Promise.all(
        proofPaths.map(async (path) => {
          try {
            const { data, error } = await supabase.storage
              .from(proofBucket)
              .createSignedUrl(path, 60 * 60);
            if (error) throw error;
            return data?.signedUrl || null;
          } catch (error) {
            console.warn("No se pudo abrir el comprobante", error);
            return null;
          }
        })
      );
      order = {
        ...order,
        payment: {
          ...order.payment,
          proofs: signed.map((url, index) => ({
            path: proofPaths[index],
            name: `Captura ${index + 1}`,
            proof: url,
          })),
        },
      };
    }

    const statusOptions = Object.entries(STATUSES)
      .map(
        ([key, status]) =>
          `<option value="${key}" ${order.status === key ? "selected" : ""}>${status.label}</option>`
      )
      .join("");

    const deliveryOptions = Object.entries(DELIVERY_STATUSES)
      .map(
        ([key, status]) =>
          `<option value="${key}" ${deliveryStatusKey(order) === key ? "selected" : ""}>${status.label}</option>`
      )
      .join("");

    const method = CFG.payment?.[order.payment?.method];
    const proofs = (
      Array.isArray(order.payment?.proofs)
        ? order.payment.proofs
        : order.payment?.proof
          ? [{ name: "comprobante", proof: order.payment.proof }]
          : []
    ).map((entry) => ({ ...entry, proof: entry.proof || entry.data || null }));

    orderModalBody.innerHTML = `
      <button type="button" class="modal-close" data-close-modal aria-label="Cerrar pedido">
        <svg aria-hidden="true"><use href="#i-close"/></svg>
      </button>
      <div class="order-head">
        <div>
          <p class="eyebrow">Detalle del pedido</p>
          <h2>${esc(order.number)}</h2>
        </div>
        <span class="status-pill ${STATUSES[order.status]?.className || ""}">
          ${esc(STATUSES[order.status]?.label || order.status)}
        </span>
      </div>

      <div class="order-grid">
        <div class="order-info">
          <h3>Cliente</h3>
          <p><strong>${esc(order.customer?.name || "Sin nombre")}</strong><br>
          ${esc(order.customer?.phone || "Sin teléfono")}<br>
          ${order.customer?.email ? esc(order.customer.email) : ""}</p>
        </div>
        <div class="order-info">
          <h3>Entrega</h3>
          <p><strong>${formatDate(order.deliveryDate)}</strong><br>
          ${esc(order.customer?.deliveryType || "")}<br>
          ${esc(deliveryStatusLabel(order))}<br>
          ${order.customer?.address ? esc(order.customer.address) : "Sin dirección"}</p>
        </div>
      </div>

      <div class="order-info">
        <h3>Productos</h3>
        <ul class="order-items">
          ${(order.items || [])
            .map(
              (item) =>
                `<li><span>${item.qty} × ${esc(item.name)}</span><strong>${money(item.price * item.qty)}</strong></li>`
            )
            .join("")}
        </ul>
        <div class="order-total"><span>Total</span><strong>${money(order.total)}</strong></div>
      </div>

      <div class="order-grid" style="margin-top:12px">
        <div class="order-info">
          <h3>Pago</h3>
          <p><strong>${esc(method?.label || order.payment?.method || "—")}</strong><br>
          ${order.payment?.amountLabel ? `Monto a pagar: ${esc(order.payment.amountLabel)}<br>` : ""}
          ${order.payment?.note ? `Detalle: ${esc(order.payment.note)}<br>` : ""}
          ${proofs.length ? `Captura(s) del pago cargada(s): ${proofs.length} ✓` : order.payment?.method === "efectivo" ? "Pago al recibir" : "Sin comprobante"}</p>
        </div>
        <div class="order-info">
          <h3>Registro</h3>
          <p>Creado: ${formatDateTime(order.createdAt)}<br>
          ${order.customer?.notes ? `Notas: ${esc(order.customer.notes)}` : "Sin notas especiales"}</p>
        </div>
      </div>

      ${
        proofs.length
          ? `<div class="order-proof"><h3 class="includes-title">Comprobante${proofs.length > 1 ? "s" : ""}</h3>
              ${proofs
                .map(
                  (entry, index) => `
                  <div class="order-proof-item">
                    ${entry.proof ? `<img src="${entry.proof}" alt="Comprobante ${index + 1} del pedido ${esc(order.number)}"><br>` : ""}
                    <a href="${entry.proof || "#"}" ${entry.proof ? "download" : ""} class="btn btn-ghost btn-sm" style="margin-top:8px">
                      <svg aria-hidden="true"><use href="#i-download"/></svg> Descargar captura ${index + 1}
                    </a>
                  </div>`
                )
                .join("")}
            </div>`
          : ""
      }

      <div class="order-admin-actions">
        <div class="field">
          <label for="orderStatusSelect">Estado del pedido</label>
          <select id="orderStatusSelect">${statusOptions}</select>
        </div>
        <div class="field">
          <label for="orderDateInput">Fecha de entrega</label>
          <input type="date" id="orderDateInput" value="${esc(order.deliveryDate || "")}">
        </div>
        <div class="field">
          <label for="orderDeliverySelect">Estado de entrega</label>
          <select id="orderDeliverySelect">${deliveryOptions}</select>
        </div>
        <button type="button" class="btn btn-primary" id="orderSave">Guardar cambios</button>
        <a class="btn btn-wa" href="${waLink(
          `Hola ${order.customer?.name || ""}! Te escribimos de Le Petit Shortt Cake por tu pedido ${order.number}.`,
          order.customer?.phone
        )}" target="_blank" rel="noopener">
          <svg aria-hidden="true"><use href="#i-whatsapp"/></svg> WhatsApp
        </a>
        <button type="button" class="btn btn-danger" id="orderDelete">
          <svg aria-hidden="true"><use href="#i-trash"/></svg> Eliminar
        </button>
      </div>`;

    $("#orderSave").addEventListener("click", async () => {
      const nextStatus = $("#orderStatusSelect").value;
      const nextDate = $("#orderDateInput").value;
      const nextDeliveryStatus = $("#orderDeliverySelect").value;
      const updated = getOrders().map((entry) => {
        if (entry.number !== order.number) return entry;
        const changed = entry.status !== nextStatus;
        const deliveryChanged = deliveryStatusKey(entry) !== nextDeliveryStatus;
        return {
          ...entry,
          status: nextStatus,
          deliveryDate: nextDate || entry.deliveryDate,
          deliveryStatus: nextDeliveryStatus || deliveryStatusKey(entry),
          history: changed
            ? [
                ...(entry.history || []),
                { status: nextStatus, at: new Date().toISOString() },
              ]
            : entry.history,
          deliveryHistory: deliveryChanged
            ? [
                ...(entry.deliveryHistory || []),
                { status: nextDeliveryStatus, at: new Date().toISOString() },
              ]
            : entry.deliveryHistory,
        };
      });
      const updatedOrder = updated.find((entry) => entry.number === order.number);
      try {
        await updateOrder(updatedOrder);
      } catch (error) {
        console.error("No se pudo actualizar el pedido", error);
        showToast("No se pudo guardar el pedido. Revisá tu conexión.");
        return;
      }
      renderAdmin();
      closeModal(orderModal);
      showToast("Pedido actualizado.");
    });

    $("#orderDelete").addEventListener("click", async () => {
      if (!window.confirm(`¿Eliminar el pedido ${order.number}? Esta acción no se puede deshacer.`)) {
        return;
      }
      try {
        await deleteOrder(order.number);
      } catch (error) {
        console.error("No se pudo eliminar el pedido", error);
        showToast("No se pudo eliminar el pedido. Revisá tu conexión.");
        return;
      }
      renderAdmin();
      closeModal(orderModal);
      showToast("Pedido eliminado.");
    });

    openModal(orderModal);
  }

  function exportCSV() {
    const rows = [
      [
        "Número",
        "Creado",
        "Entrega",
        "Estado de entrega",
        "Cliente",
        "Teléfono",
        "Productos",
        "Total",
        "Método",
        "Monto a pagar",
        "Detalle de pago",
        "Estado",
        "Notas",
      ],
    ];

    filteredOrders(getOrders()).forEach((order) => {
      rows.push([
        order.number,
        formatDateTime(order.createdAt),
        order.deliveryDate,
        deliveryStatusLabel(order),
        order.customer?.name || "",
        order.customer?.phone || "",
        (order.items || []).map((item) => `${item.qty} × ${item.name}`).join("; "),
        order.total,
        CFG.payment?.[order.payment?.method]?.label || order.payment?.method || "",
        order.payment?.amountLabel || "",
        order.payment?.note || "",
        STATUSES[order.status]?.label || order.status,
        order.customer?.notes || "",
      ]);
    });

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pedidos-le-petit-${todayIso()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    showToast("Calendario exportado en CSV.");
  }

  /* ---------- Ruta admin ---------- */

  function handleRoute() {
    const isAdminRoute = window.location.hash === "#admin";

    adminView.hidden = !isAdminRoute;
    document.body.classList.toggle("admin-open", isAdminRoute);

    if (isAdminRoute) {
      showAdminUI();
      if (!isAdminAuthed()) {
        setTimeout(() => adminPass?.focus(), 200);
      }
    }
  }

  /* ---------- Reveal ---------- */

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
  );

  function observeReveals() {
    $$("[data-reveal]:not(.is-visible)").forEach((element) => {
      revealObserver.observe(element);
    });
  }

  /* ---------- Eventos globales ---------- */

  function setupEvents() {
    mobileScrollLock.addEventListener("change", syncBodyLock);

    document.addEventListener("click", (event) => {
      const closer = event.target.closest("[data-close-modal]");
      if (closer) {
        const modal = closer.closest(".modal");
        if (modal) closeModal(modal);
        return;
      }

      const copyButton = event.target.closest("[data-copy-field]");
      if (copyButton && !copyButton.disabled) {
        const data = paymentCopyData();
        const key = copyButton.dataset.copyField;
        const value =
          key === "all"
            ? data?.all
            : data?.fields.find((field) => field.key === key)?.value;
        if (value) copyToClipboard(value);
        return;
      }

      const catalogSwitchButton = event.target.closest("[data-catalog-switch]");
      if (catalogSwitchButton) {
        state.filter = state.filter === "extras" ? "kits" : "extras";
        renderFilters();
        renderCatalog();
        $("#catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const filter = event.target.closest("[data-filter]");
      if (filter) {
        state.filter = filter.dataset.filter;
        renderFilters();
        renderCatalog();
        return;
      }

      const galleryStep = event.target.closest("[data-gallery-step]");
      if (galleryStep) {
        stepGallery(galleryStep.closest(".product-gallery"), Number(galleryStep.dataset.galleryStep));
        return;
      }

      const galleryDot = event.target.closest("[data-gallery-dot]");
      if (galleryDot) {
        goToGallery(galleryDot.closest(".product-gallery"), Number(galleryDot.dataset.galleryDot));
        return;
      }

      const openProductButton = event.target.closest("[data-open-product]");
      if (openProductButton) {
        openProduct(openProductButton.dataset.openProduct);
        return;
      }

      const addButton = event.target.closest("[data-add]");
      if (addButton) {
        addToCart(addButton.dataset.add, 1);
        return;
      }

      const addDetail = event.target.closest("[data-add-detail]");
      if (addDetail) {
        addToCart(addDetail.dataset.addDetail, state.detailQty);
        closeModal(productModal);
        return;
      }

      const detailInc = event.target.closest("[data-detail-inc]");
      if (detailInc) {
        state.detailQty = Math.min(99, state.detailQty + 1);
        $("[data-detail-count]").textContent = String(state.detailQty);
        return;
      }

      const detailDec = event.target.closest("[data-detail-dec]");
      if (detailDec) {
        state.detailQty = Math.max(1, state.detailQty - 1);
        $("[data-detail-count]").textContent = String(state.detailQty);
        return;
      }

      const cartInc = event.target.closest("[data-cart-inc]");
      if (cartInc) {
        updateCartQty(cartInc.dataset.cartInc, 1);
        return;
      }

      const cartDec = event.target.closest("[data-cart-dec]");
      if (cartDec) {
        updateCartQty(cartDec.dataset.cartDec, -1);
        return;
      }

      const cartRemove = event.target.closest("[data-cart-remove]");
      if (cartRemove) {
        removeCartItem(cartRemove.dataset.cartRemove);
        return;
      }

      const closeCartButton = event.target.closest("[data-close-cart]");
      if (closeCartButton) {
        closeCart();
        return;
      }

      const methodButton = event.target.closest("[data-method]");
      if (methodButton) {
        capturePaymentFields();
        state.checkout.method = methodButton.dataset.method;
        if (state.checkout.method === "efectivo") {
          state.checkout.proofs = [];
          proofInput.value = "";
          markUploadError(false);
          renderProofPreview();
        }
        renderMethods();
        renderMethodDetails();
        return;
      }

      const orderButton = event.target.closest("[data-order-open]");
      if (orderButton) {
        openOrder(orderButton.dataset.orderOpen);
        return;
      }

      const adminExit = event.target.closest("[data-admin-exit]");
      if (adminExit) {
        event.preventDefault();
        try {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        } catch (error) {
          window.location.hash = "";
        }
        handleRoute();
        return;
      }
    });

    menuBtn?.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", String(isOpen));
    });

    $$("#mainNav a").forEach((link) => {
      link.addEventListener("click", () => {
        mainNav.classList.remove("is-open");
        menuBtn?.setAttribute("aria-expanded", "false");
      });
    });

    cartBtn?.addEventListener("click", openCart);
    cartClose?.addEventListener("click", closeCart);
    overlay?.addEventListener("click", closeCart);
    checkoutBtn?.addEventListener("click", openCheckout);

    window.addEventListener(
      "scroll",
      () => {
        siteHeader?.classList.toggle("is-scrolled", window.scrollY > 12);
      },
      { passive: true }
    );

    document.addEventListener(
      "scroll",
      (event) => {
        const track = event.target.closest?.("[data-gallery-track]");
        if (track) syncGallery(track);
      },
      true
    );

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const openModals = $$(".modal.is-open");
      if (openModals.length) {
        closeModal(openModals[openModals.length - 1]);
      } else if (cartDrawer.classList.contains("is-open")) {
        closeCart();
      }
    });

    deliveryType?.addEventListener("change", () => {
      const needsAddress = deliveryType.value === "Entrega a domicilio";
      addressField.hidden = !needsAddress;
      $("#custAddress").required = needsAddress;
    });

    checkoutForm?.addEventListener("submit", (event) => event.preventDefault());

    checkoutNext?.addEventListener("click", () => {
      if (!validateStep(1)) return;
      setCheckoutStep(2);
    });

    checkoutBack?.addEventListener("click", () => {
      capturePaymentFields();
      setCheckoutStep(1);
    });

    checkoutConfirm?.addEventListener("click", () => {
      if (!validateStep(2)) return;
      confirmOrder();
    });
    $("#successClose")?.addEventListener("click", () => closeModal(checkoutModal));

    proofPreview?.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-proof-remove]");
      if (removeButton) {
        const index = Number(removeButton.dataset.proofRemove);
        state.checkout.proofs.splice(index, 1);
        proofInput.value = "";
        markUploadError(false);
        renderProofPreview();
        return;
      }

      const viewImage = event.target.closest("[data-proof-view]");
      if (!viewImage || !proofLightbox || !proofLightboxImg) return;
      const index = Number(viewImage.dataset.proofView);
      const proof = state.checkout.proofs[index];
      if (!proof) return;
      proofLightboxImg.src = proof.data;
      proofLightboxImg.alt = `Captura ${index + 1} ampliada`;
      openModal(proofLightbox);
    });

    proofInput?.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      if (!files.length) return;

      const available = MAX_PROOFS - state.checkout.proofs.length;
      if (available <= 0) return;
      const accepted = [];

      for (const file of files.slice(0, available)) {
        if (!file.type.startsWith("image/")) {
          showToast("Subí imágenes del comprobante (JPG, PNG o WebP).");
          continue;
        }
        try {
          const data = await compressImage(file);
          state.checkout.proofs.push({ data, name: file.name });
          accepted.push(file);
        } catch (error) {
          console.error(error);
          showToast("No pudimos procesar una imagen. Probá con otra.");
        }
      }

      if (accepted.length) {
        markUploadError(false);
        renderProofPreview();
        showToast(
          accepted.length === 1
            ? "Captura del pago cargada."
            : `${accepted.length} capturas cargadas.`
        );
      }
    });

    window.addEventListener("hashchange", handleRoute);

    adminLoginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      adminError.hidden = true;

      if (useSupabase) {
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: adminEmail.value.trim(),
            password: adminPass.value.trim(),
          });
          if (error) throw error;
          adminPass.value = "";
          showAdminUI();
          showToast("Bienvenida al panel de órdenes.");
        } catch (error) {
          console.warn("Login fallido", error);
          adminError.hidden = false;
          adminPass.select();
        }
        return;
      }

      const password = adminPass.value.trim();
      if (password === (CFG.adminPassword || "lepetit2026")) {
        setAdminAuthed(true);
        adminError.hidden = true;
        adminPass.value = "";
        showAdminUI();
        showToast("Bienvenida al panel de órdenes.");
      } else {
        adminError.hidden = false;
        adminPass.select();
      }
    });

    adminLogout?.addEventListener("click", async () => {
      if (useSupabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          showToast("No se pudo cerrar la sesión. Intentá de nuevo.");
          return;
        }
      } else {
        setAdminAuthed(false);
      }
      showAdminUI();
      showToast("Sesión cerrada.");
    });

    adminSearch?.addEventListener(
      "input",
      debounce(() => {
        state.admin.search = adminSearch.value;
        renderCalendar(getOrders());
        renderAdminList(getOrders());
      }, 160)
    );

    adminStatusFilter?.addEventListener("change", () => {
      state.admin.status = adminStatusFilter.value;
      renderCalendar(getOrders());
      renderAdminList(getOrders());
    });

    $("#calPrev")?.addEventListener("click", () => {
      state.admin.calMonth -= 1;
      if (state.admin.calMonth < 0) {
        state.admin.calMonth = 11;
        state.admin.calYear -= 1;
      }
      renderCalendar(getOrders());
    });

    $("#calNext")?.addEventListener("click", () => {
      state.admin.calMonth += 1;
      if (state.admin.calMonth > 11) {
        state.admin.calMonth = 0;
        state.admin.calYear += 1;
      }
      renderCalendar(getOrders());
    });

    $("#calToday")?.addEventListener("click", () => {
      state.admin.calYear = new Date().getFullYear();
      state.admin.calMonth = new Date().getMonth();
      renderCalendar(getOrders());
    });

    exportBtn?.addEventListener("click", exportCSV);

    window.addEventListener("storage", (event) => {
      if (event.key === KEYS.orders && isAdminAuthed()) {
        renderAdmin();
      }
    });
  }

  /* ---------- Inicio ---------- */

  function setupRealtime() {
    if (!useSupabase) return;
    supabase
      .channel("lpsc-pedidos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordenes" },
        refreshAdmin
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orden_items" },
        refreshAdmin
      )
      .subscribe();

    // Respaldo: si el proyecto no tiene las tablas en la publicación de
    // realtime, el panel igual se refresca mientras esté abierto.
    setInterval(() => {
      if (!document.hidden && isAdminAuthed() && !adminPanel.hidden) refreshAdmin();
    }, 10000);
  }

  async function init() {
    applyConfig();
    setupImageFallbacks();
    renderFilters();
    renderCatalog();
    updateCartUI();
    observeReveals();
    setupEvents();
    handleRoute();

    await initAuth();
    try {
      await refreshOrders();
    } catch (error) {
      console.warn("No se pudieron cargar los pedidos", error);
    }
    if (isAdminAuthed()) renderAdmin();
    setupRealtime();
  }

  init();
})();
