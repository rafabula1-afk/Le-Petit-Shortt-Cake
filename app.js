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
          : `Tasa euro: Bs ${fmtAmount(rate)} por cada EUR · ${state.checkout.rateSource}.`,
      };
    }
    return {
      amount: total,
      currency: "USD",
      label: `USD ${fmtAmount(total)}`,
      rate: null,
      note:
        state.checkout.method === "efectivo"
          ? "Se paga al recibir el pedido."
          : "Precio en dólares.",
    };
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
      price: 22,
      badge: "La favorita",
      short: "La clásica casita para armar y decorar en familia.",
      description:
        "Nuestra casita de jengibre viene con todas las galletas y los dulces para armar una escena navideña completa. Ideal para compartir en familia y sacar fotos hermosas.",
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
      image: "assets/productos/casita.webp",
      tone: "casitas",
    },
    {
      id: "munecos",
      name: "Muñecos de jengibre",
      category: "grupos",
      price: 15,
      badge: "Personalizable",
      short: "15 muñecos medianos y 5 mangas de colores para decorar.",
      description:
        "Una opción pensada para grupos: cada persona puede decorar su propio muñeco de jengibre. Se puede personalizar dependiendo de las necesidades del cliente.",
      includes: [
        "15 muñecos de jengibre medianos",
        "5 mangas pasteleras con glaseado",
        "Blanco, rojo, verde, amarillo y azul",
        "Personalizable a pedido",
      ],
      size: "10 × 5 cm",
      people: "Ideal para grupos",
      image: "assets/productos/munecos.webp",
      tone: "grupos",
    },
    {
      id: "minicasitas",
      name: "Minicasitas de jengibre",
      category: "grupos",
      price: 16,
      short: "Una aldea en miniatura con 5 casitas y mini muñecos.",
      description:
        "Cinco mini casitas y mini muñecos de jengibre con dulces y mangas de glaseado para armar una aldea entera. Perfectas como regalo o para mesas dulces.",
      includes: [
        "5 mini casitas y mini muñecos",
        "100 g de dulces y gomitas",
        "5 mangas pasteleras con glaseado",
        "Verde, rojo y amarillo",
      ],
      size: "5 × 5 × 5 cm",
      people: "5 mini casitas",
      image: "assets/productos/minicasitas.webp",
      tone: "grupos",
    },
    {
      id: "pesebre",
      name: "Pesebre de jengibre",
      category: "pesebre",
      price: 35,
      badge: "Edición especial",
      short: "El pesebre completo con personajes y 10 mangas de glaseado.",
      description:
        "Una pieza especial para la temporada: el pesebre de jengibre con todos sus personajes, techos, paredes y una paleta de glaseados para decorar cada detalle.",
      includes: [
        "Fachada y contrafachada de galleta",
        "2 paredes y 2 techos",
        "10 mangas pasteleras con glaseado",
        "Jesús, María, José y el ángel",
        "Melchor, Gaspar y Baltasar",
        "Buey, mula, pastor y oveja",
      ],
      size: "15 × 15 cm",
      people: "5 a 10 personas",
      image: "assets/productos/pesebre.webp",
      tone: "pesebre",
    },
    {
      id: "coronas",
      name: "Coronas de Adviento",
      category: "adviento",
      price: 25,
      badge: "Suscripción",
      short: "Una corona con vela y oración cada domingo de Adviento.",
      description:
        "Suscripción especial de Adviento: se entrega una corona con vela y oración cada domingo, hasta completar las cuatro coronas de la temporada.",
      includes: [
        "Galleta base y galletas estructura",
        "Sprinkles y vela",
        "Manga con glaseado verde",
        "Mini manga con glaseado rojo",
        "Oración para cada domingo",
        "4 coronas en total",
      ],
      size: "10 cm",
      people: "4 domingos",
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
        "Manga pastelera individual con glaseado listo para usar. Elegí el color al coordinar tu pedido.",
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
        "Porción de 100 gramos de dulces y gomitas variadas para decorar y completar tu kit.",
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
        "Mini casita de jengibre con una mini manga de glaseado. Ideal para regalar o como detalle individual.",
      includes: ["1 mini casita", "1 mini manga de glaseado"],
      size: "5 × 5 × 5 cm",
      people: "Extra",
      image: "assets/productos/extra-mini-casita.webp",
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
      image: "assets/productos/extra-muneco.webp",
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
      image: "assets/productos/extra-arbolito.webp",
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
      image: "assets/productos/extra-reyes.webp",
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
        "Pesebre 2D con las galletas de Jesús, María y José, más cinco mini mangas de glaseado para decorar.",
      includes: [
        "Pesebre 2D de galleta",
        "Jesús, María y José",
        "5 mini mangas de glaseado",
      ],
      size: "",
      people: "Extra",
      image: "assets/productos/extra-pesebre-2d.webp",
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
      image: "assets/productos/extra-gigante.webp",
      icon: "i-ginger",
      tone: "extras",
    },
  ];

  const CATEGORIES = [
    { id: "todos", label: "Todos" },
    { id: "casitas", label: "Casitas" },
    { id: "grupos", label: "Grupos" },
    { id: "pesebre", label: "Pesebre" },
    { id: "adviento", label: "Adviento" },
    { id: "extras", label: "Little Extras" },
  ];

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
    filter: "todos",
    detailQty: 1,
    checkout: {
      step: 1,
      method: Object.keys(CFG.payment || {})[0] || "pagoMovil",
      proof: null,
      proofName: "",
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
  const checkoutSummary = $("#checkoutSummary");
  const orderPreview = $("#orderPreview");
  const methodGrid = $("#methodGrid");
  const payInstructions = $("#payInstructions");
  const proofSection = $("#proofSection");
  const uploadBox = $("#uploadBox");
  const proofHint = $("#proofHint");
  const proofInput = $("#proofInput");
  const proofPreview = $("#proofPreview");
  const paymentNote = $("#paymentNote");
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

  function syncBodyLock() {
    const hasOpenModal = Boolean($(".modal.is-open"));
    const cartOpen = cartDrawer.classList.contains("is-open");
    document.body.classList.toggle("no-scroll", hasOpenModal || cartOpen);
  }

  function openModal(modal) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
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
        link.dataset.waMessage || "Hola! Quiero hacer un pedido en Le Petit Shortt Cake."
      );
    });

    $$('[data-link="instagram"]').forEach((link) => {
      link.href = CFG.instagram || "#";
    });

    $$('[data-link="tiktok"]').forEach((link) => {
      link.href = CFG.tiktok || "#";
    });

    const priceNote = $("#priceNote");
    if (priceNote) priceNote.textContent = CFG.priceNote || "";

    const deliveryNote = $("#deliveryNote");
    if (deliveryNote) deliveryNote.textContent = CFG.deliveryNote || "";

    if (useSupabase) {
      if (adminEmailField) adminEmailField.hidden = false;
      if (adminEmail) adminEmail.value = SB.adminEmail || "";
      if (adminLoginHint) {
        adminLoginHint.textContent =
          "Ingresá con el correo y la contraseña de la administradora para ver el calendario de pedidos.";
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
          <div class="embed-placeholder">
            <svg aria-hidden="true"><use href="#i-spotify"/></svg>
            <div class="equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
            <strong>Playlist muy pronto</strong>
            <span>Mientras tanto, poné tu música navideña favorita.</span>
          </div>`;
      }
    }

    const youtubeSlot = $("#youtubeSlot");
    const youtubeLink = $("#youtubeLink");
    if (youtubeSlot) {
      if (CFG.youtubeEmbed) {
        youtubeSlot.innerHTML = `
          <iframe class="video-frame" src="${esc(CFG.youtubeEmbed)}"
            title="Video tutorial de Le Petit Shortt Cake" loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen></iframe>`;
        if (CFG.youtubeUrl && youtubeLink) {
          youtubeLink.href = CFG.youtubeUrl;
          youtubeLink.hidden = false;
        }
      } else {
        youtubeSlot.innerHTML = `
          <div class="embed-placeholder">
            <svg aria-hidden="true"><use href="#i-youtube"/></svg>
            <strong>Video tutorial muy pronto</strong>
            <span>Estamos preparando el paso a paso para armar tu casita.</span>
          </div>`;
      }
    }
  }

  /* ---------- Catálogo ---------- */

  function renderFilters() {
    filters.innerHTML = CATEGORIES.map(
      (category) => `
        <button type="button" class="filter-btn ${state.filter === category.id ? "is-active" : ""}"
          data-filter="${category.id}" role="tab" aria-selected="${state.filter === category.id}">
          ${category.label}
        </button>`
    ).join("");
  }

  function productMedia(product) {
    if (product.image) {
      return `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">`;
    }
    return `<span class="product-icon"><svg aria-hidden="true"><use href="#${product.icon}"/></svg></span>`;
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
    const list = PRODUCTS.filter(
      (product) => state.filter === "todos" || product.category === state.filter
    );
    catalogGrid.innerHTML = list.map(productCard).join("");
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

    productModalBody.innerHTML = `
      <button type="button" class="modal-close" data-close-modal aria-label="Cerrar detalle">
        <svg aria-hidden="true"><use href="#i-close"/></svg>
      </button>
      <div class="product-detail">
        <div class="detail-media tone-${product.tone}">${productMedia(product)}</div>
        <div class="detail-body">
          <p class="product-cat">${categoryLabel(product.category)}</p>
          <h2>${esc(product.name)}</h2>
          <p class="detail-desc">${esc(product.description)}</p>
          <div class="detail-meta">
            ${product.size ? `<span>${esc(product.size)}</span>` : ""}
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
    payInstructions.innerHTML = `
      <h3>Datos para pagar</h3>
      <ul>${(method.instructions || [])
        .map((line) => `<li>${esc(line)}</li>`)
        .join("")}</ul>
      <p class="pay-amount">
        <span>Monto a pagar</span>
        <strong>${esc(amount.label)}</strong>
        <span>${esc(amount.note)}</span>
      </p>`;

    const isCash = state.checkout.method === "efectivo";
    if (proofSection) proofSection.hidden = isCash;
    if (proofHint) {
      proofHint.textContent = isCash
        ? "En efectivo no necesitás subir captura: pagás al recibir."
        : "La captura del pago es obligatoria para confirmar el pedido.";
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
    checkoutNext.hidden = step === 3;
    checkoutConfirm.hidden = step !== 3;

    if (step === 3) renderCheckoutSummary();
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
      if (state.checkout.method !== "efectivo" && !state.checkout.proof) {
        markUploadError(true);
        uploadBox?.scrollIntoView({ behavior: "smooth", block: "center" });
        showToast("Subí la captura del pago para continuar.");
        return false;
      }
      markUploadError(false);
      return true;
    }

    if (step === 3) {
      capturePaymentFields();
      return true;
    }

    return true;
  }

  function resetCheckout() {
    state.checkout = {
      step: 1,
      method: Object.keys(CFG.payment || {})[0] || "pagoMovil",
      proof: null,
      proofName: "",
      paymentNote: "",
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
    proofPreview.innerHTML = "";
    proofInput.value = "";
    markUploadError(false);

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

  function renderCheckoutSummary() {
    const customer = state.checkout.customer;
    const items = cartDetails();
    const method = (CFG.payment || {})[state.checkout.method];
    const total = cartTotalValue();
    const amount = paymentAmountInfo();
    const isCash = state.checkout.method === "efectivo";

    const paymentRows = [
      method ? `<div class="summary-row"><span>Método</span><strong>${esc(method.label)}</strong></div>` : "",
      `<div class="summary-row"><span>Monto a pagar</span><strong>${esc(amount.label)}</strong></div>`,
      state.checkout.method === "pagoMovil"
        ? `<div class="summary-row"><span>Tasa euro</span><strong>${esc(`Bs ${fmtAmount(amount.rate || 0)}`)}</strong></div>`
        : "",
      state.checkout.paymentNote
        ? `<div class="summary-row"><span>Nota</span><strong>${esc(state.checkout.paymentNote)}</strong></div>`
        : "",
      isCash
        ? `<div class="summary-row"><span>Pago</span><strong>Al recibir</strong></div>`
        : state.checkout.proof
          ? `<div class="summary-row"><span>Captura del pago</span><strong>Cargada ✓</strong></div>`
          : `<div class="summary-row"><span>Captura del pago</span><strong>Faltante</strong></div>`,
    ]
      .filter(Boolean)
      .join("");

    checkoutSummary.innerHTML = `
      <div class="summary-box">
        <h3>Productos</h3>
        <ul class="summary-items">
          ${items
            .map(
              (item) =>
                `<li><span>${item.qty} × ${esc(item.name)}</span><strong>${money(item.price * item.qty)}</strong></li>`
            )
            .join("")}
        </ul>
        <div class="summary-total"><span>Total</span><strong>${money(total)}</strong></div>
      </div>
      <div class="summary-box">
        <h3>Cliente y entrega</h3>
        <div class="summary-row"><span>Nombre</span><strong>${esc(customer?.name || "")}</strong></div>
        <div class="summary-row"><span>WhatsApp</span><strong>${esc(customer?.phone || "")}</strong></div>
        ${customer?.email ? `<div class="summary-row"><span>Correo</span><strong>${esc(customer.email)}</strong></div>` : ""}
        <div class="summary-row"><span>Fecha deseada</span><strong>${formatDate(customer?.date)}</strong></div>
        <div class="summary-row"><span>Entrega</span><strong>${esc(customer?.deliveryType || "")}</strong></div>
        ${customer?.address ? `<div class="summary-row"><span>Dirección</span><strong>${esc(customer.address)}</strong></div>` : ""}
        ${customer?.notes ? `<div class="summary-row"><span>Notas</span><strong>${esc(customer.notes)}</strong></div>` : ""}
      </div>
      <div class="summary-box">
        <h3>Pago</h3>
        ${paymentRows}
      </div>`;
  }

  /* ---------- Pedidos: adaptador local / Supabase ---------- */

  function orderToRow(order) {
    const customer = order.customer || {};
    const payment = order.payment || {};
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
      proof_path: payment.proofPath || null,
      status: order.status || "pendiente_verificacion",
      delivery_status: order.deliveryStatus || "por_asignar",
      history: order.history || [],
      delivery_history: order.deliveryHistory || [],
    };
  }

  function orderFromRow(row) {
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
        proof: null,
        proofPath: row.proof_path || null,
        proofName: row.proof_path ? "comprobante" : "",
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
    const needsProof = order.payment?.method !== "efectivo";
    if (needsProof && !order.payment?.proof && !order.payment?.proofPath) {
      throw new Error("Falta la captura del pago");
    }

    if (!useSupabase) {
      const orders = getOrders();
      orders.unshift(order);
      const saved = saveJSON(KEYS.orders, orders);
      if (!saved && order.payment?.proof) {
        order.payment.proof = null;
        order.payment.proofDropped = true;
        throw new Error("No se pudo guardar la captura del pago");
      }
      state.admin.orders = orders;
      return order;
    }

    let uploadedPath = null;
    if (order.payment?.proof) {
      const blob = await dataUrlToBlob(order.payment.proof);
      const path = `${order.id}.${proofExtension(order.payment.proofName, blob.type)}`;
      const { error: uploadError } = await supabase.storage
        .from(proofBucket)
        .upload(path, blob, {
          contentType: blob.type || "image/jpeg",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      uploadedPath = path;
      order.payment.proofPath = path;
    }

    try {
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
      if (uploadedPath) {
        try {
          await supabase.storage.from(proofBucket).remove([uploadedPath]);
        } catch (cleanupError) {
          console.warn("No se pudo limpiar la captura", cleanupError);
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
    const path = order?.payment?.proofPath;
    if (path) {
      const { error: storageError } = await supabase.storage
        .from(proofBucket)
        .remove([path]);
      if (storageError) console.warn("No se pudo borrar el comprobante", storageError);
    }
    await refreshOrders();
  }

  function orderWhatsAppMessage(order) {
    const lines = [
      `Hola! Acabo de hacer el pedido ${order.number} en la web.`,
      "",
      ...order.items.map(
        (item) => `• ${item.qty} × ${item.name} — ${money(item.price * item.qty)}`
      ),
      "",
      `Total: ${money(order.total)}`,
      `Nombre: ${order.customer.name}`,
      `Entrega: ${formatDate(order.deliveryDate)} · ${order.customer.deliveryType}`,
      `Método de pago: ${CFG.payment?.[order.payment.method]?.label || order.payment.method}`,
      order.payment.amountLabel ? `Monto a pagar: ${order.payment.amountLabel}` : "",
      order.payment.method === "pagoMovil" && order.payment.euroRate
        ? `Tasa euro: Bs ${fmtAmount(order.payment.euroRate)}`
        : "",
      order.payment.method === "efectivo"
        ? "Pago al recibir."
        : "Captura del pago cargada en la web.",
      order.customer.notes ? `Notas: ${order.customer.notes}` : "",
    ];
    return lines.filter((line) => line !== null && line !== undefined).join("\n");
  }

  async function confirmOrder() {
    capturePaymentFields();
    const customer = state.checkout.customer;
    const items = cartDetails();

    if (!customer || !items.length) {
      showToast("Faltan datos del pedido. Revisá el carrito e intentá de nuevo.");
      return;
    }
    if (state.checkout.method !== "efectivo" && !state.checkout.proof) {
      markUploadError(true);
      setCheckoutStep(2);
      showToast("Subí la captura del pago antes de confirmar.");
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
        note: [
          state.checkout.paymentNote,
          `Monto a pagar: ${amountInfo.label}`,
          state.checkout.method === "pagoMovil"
            ? `Tasa euro: Bs ${fmtAmount(amountInfo.rate || 0)} (${state.checkout.rateSource})`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        proof: state.checkout.proof,
        proofName: state.checkout.proofName,
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
          : "Guardá este número. Ya recibimos la captura del pago; la dueña lo verificará y te confirmará por WhatsApp.";
    }
    const successWa = $("#successWa");
    successWa.href = waLink(orderWhatsAppMessage(order));

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
    if (!state.checkout.proof) {
      proofPreview.innerHTML = "";
      return;
    }
    proofPreview.innerHTML = `
      <img src="${state.checkout.proof}" alt="Comprobante de pago cargado">
      <div class="proof-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="proofRemove">
          <svg aria-hidden="true"><use href="#i-trash"/></svg> Quitar comprobante
        </button>
      </div>`;
    $("#proofRemove")?.addEventListener("click", () => {
      state.checkout.proof = null;
      state.checkout.proofName = "";
      proofInput.value = "";
      markUploadError(false);
      renderProofPreview();
    });
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

    if (useSupabase && order.payment?.proofPath) {
      try {
        const { data, error } = await supabase.storage
          .from(proofBucket)
          .createSignedUrl(order.payment.proofPath, 60 * 60);
        if (error) throw error;
        order = {
          ...order,
          payment: { ...order.payment, proof: data?.signedUrl || null },
        };
      } catch (error) {
        console.warn("No se pudo abrir el comprobante", error);
      }
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
    const proof = order.payment?.proof;

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
          ${proof ? "Captura del pago cargada ✓" : order.payment?.method === "efectivo" ? "Pago al recibir" : "Sin comprobante"}</p>
        </div>
        <div class="order-info">
          <h3>Registro</h3>
          <p>Creado: ${formatDateTime(order.createdAt)}<br>
          ${order.customer?.notes ? `Notas: ${esc(order.customer.notes)}` : "Sin notas especiales"}</p>
        </div>
      </div>

      ${proof ? `<div class="order-proof"><h3 class="includes-title">Comprobante</h3><img src="${proof}" alt="Comprobante del pedido ${esc(order.number)}"><br><a href="${proof}" download="comprobante-${esc(order.number)}.jpg" class="btn btn-ghost btn-sm" style="margin-top:8px"><svg aria-hidden="true"><use href="#i-download"/></svg> Descargar comprobante</a></div>` : ""}

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
    document.addEventListener("click", (event) => {
      const closer = event.target.closest("[data-close-modal]");
      if (closer) {
        const modal = closer.closest(".modal");
        if (modal) closeModal(modal);
        return;
      }

      const filter = event.target.closest("[data-filter]");
      if (filter) {
        state.filter = filter.dataset.filter;
        renderFilters();
        renderCatalog();
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
          state.checkout.proof = null;
          state.checkout.proofName = "";
          proofInput.value = "";
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
      if (!validateStep(state.checkout.step)) return;
      setCheckoutStep(Math.min(3, state.checkout.step + 1));
    });

    checkoutBack?.addEventListener("click", () => {
      capturePaymentFields();
      setCheckoutStep(Math.max(1, state.checkout.step - 1));
    });

    checkoutConfirm?.addEventListener("click", confirmOrder);
    $("#successClose")?.addEventListener("click", () => closeModal(checkoutModal));

    proofInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showToast("Subí una imagen del comprobante (JPG, PNG o WebP).");
        return;
      }
      try {
        state.checkout.proof = await compressImage(file);
        state.checkout.proofName = file.name;
        markUploadError(false);
        renderProofPreview();
        showToast("Captura del pago cargada.");
      } catch (error) {
        console.error(error);
        showToast("No pudimos procesar la imagen. Probá con otra.");
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
