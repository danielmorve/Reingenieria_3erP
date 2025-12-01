const API_BASE = "http://18.217.113.123:3000/api";

const state = {
  authToken: null,
  user: null,
  cart: [],
};

// Utils
function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toastMessage");
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.remove("hidden", "opacity-0");

  // animación simple
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  // limpiar timeout previo si lo hubiera
  if (toast._timeoutId) {
    clearTimeout(toast._timeoutId);
  }

  toast._timeoutId = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 200);
  }, 2000);
}


async function api(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  if (state.authToken) {
    headers["Authorization"] = "Bearer " + state.authToken;
  }
  const res = await fetch(API_BASE + path, { ...options, headers });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok) {
    throw new Error(data.message || "Error " + res.status);
  }
  return data;
}

// ------------------- UI helpers -------------------
function showAuthModal(show) {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.toggle("hidden", !show);
}

function setUser(user, token) {
  state.user = user;
  state.authToken = token || state.authToken;

  const badge = document.getElementById("userBadge");
  const btnOpenAuth = document.getElementById("btnOpenAuth");

  if (user) {
    badge.textContent = `Sesión: ${user.name} (${user.email})`;
    badge.classList.remove("hidden");
    btnOpenAuth.textContent = "Cambiar usuario";
  } else {
    badge.classList.add("hidden");
    btnOpenAuth.textContent = "Iniciar sesión / Registro";
  }
}

function renderMenu(items) {
  const list = document.getElementById("menuList");
  const status = document.getElementById("menuStatus");
  list.innerHTML = "";
  if (!items || items.length === 0) {
    status.textContent = "No hay productos disponibles.";
    return;
  }
  status.textContent = `Se encontraron ${items.length} productos.`;

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className =
      "rounded-xl border border-slate-100 bg-white/60 px-3 py-2 flex items-center justify-between hover:border-orange-200 hover:shadow-sm transition";

    const info = document.createElement("div");
    info.className = "flex flex-col";
    const title = document.createElement("span");
    title.className = "text-sm font-medium text-slate-800";
    title.textContent = item.name;
    const desc = document.createElement("span");
    desc.className = "text-xs text-slate-500";
    desc.textContent = item.description || "";
    info.appendChild(title);
    info.appendChild(desc);

    const right = document.createElement("div");
    right.className = "flex items-center gap-2";

    const price = document.createElement("span");
    price.className = "text-sm font-semibold text-orange-600";
    price.textContent = formatMoney(item.price);

    const btn = document.createElement("button");
    btn.className =
      "text-xs px-2.5 py-1.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition";
    btn.textContent = "+ Agregar";
    btn.addEventListener("click", () => addToCart(item));

    right.appendChild(price);
    right.appendChild(btn);

    row.appendChild(info);
    row.appendChild(right);

    list.appendChild(row);
  });
}

function renderCart() {
  const list = document.getElementById("cartList");
  const empty = document.getElementById("cartEmpty");
  const subtotalEl = document.getElementById("cartSubtotal");
  const totalEl = document.getElementById("cartTotal");
  const btnCreateOrder = document.getElementById("btnCreateOrder");

  list.innerHTML = "";

  if (state.cart.length === 0) {
    empty.classList.remove("hidden");
    btnCreateOrder.disabled = true;
    subtotalEl.textContent = "$0.00";
    totalEl.textContent = "$0.00";
    return;
  }

  empty.classList.add("hidden");
  btnCreateOrder.disabled = false;

  let subtotal = 0;
  state.cart.forEach((item, index) => {
    const li = document.createElement("li");
    li.className =
      "flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2";

    const info = document.createElement("div");
    info.className = "flex flex-col";
    const title = document.createElement("span");
    title.className = "text-xs font-medium text-slate-800";
    title.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "text-[11px] text-slate-500";
    meta.textContent = `${item.quantity} x ${formatMoney(item.unitPrice)}`;
    info.appendChild(title);
    info.appendChild(meta);

    const controls = document.createElement("div");
    controls.className = "flex items-center gap-2";

    const qtyControls = document.createElement("div");
    qtyControls.className =
      "inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-1";

    const btnMinus = document.createElement("button");
    btnMinus.className =
      "w-5 h-5 flex items-center justify-center text-xs text-slate-500 hover:text-red-500";
    btnMinus.textContent = "−";
    btnMinus.addEventListener("click", () => updateCartQuantity(index, item.quantity - 1));

    const qty = document.createElement("span");
    qty.className = "text-xs w-5 text-center";
    qty.textContent = item.quantity;

    const btnPlus = document.createElement("button");
    btnPlus.className =
      "w-5 h-5 flex items-center justify-center text-xs text-slate-500 hover:text-emerald-500";
    btnPlus.textContent = "+";
    btnPlus.addEventListener("click", () => updateCartQuantity(index, item.quantity + 1));

    qtyControls.appendChild(btnMinus);
    qtyControls.appendChild(qty);
    qtyControls.appendChild(btnPlus);

    const totalItem = document.createElement("span");
    totalItem.className = "text-xs font-semibold text-slate-800";
    const total = item.unitPrice * item.quantity;
    totalItem.textContent = formatMoney(total);
    subtotal += total;

    const btnRemove = document.createElement("button");
    btnRemove.className =
      "text-[11px] text-slate-400 hover:text-red-500 transition";
    btnRemove.textContent = "Quitar";
    btnRemove.addEventListener("click", () => removeFromCart(index));

    controls.appendChild(qtyControls);
    controls.appendChild(totalItem);
    controls.appendChild(btnRemove);

    li.appendChild(info);
    li.appendChild(controls);

    list.appendChild(li);
  });

  subtotalEl.textContent = formatMoney(subtotal);
  const estimatedTotal = subtotal + (subtotal > 0 ? 40 : 0);
  totalEl.textContent = formatMoney(estimatedTotal);
}

function renderOrders(orders) {
  const list = document.getElementById("ordersList");
  list.innerHTML = "";

  if (!orders || orders.length === 0) {
    const li = document.createElement("li");
    li.className = "text-xs text-slate-400";
    li.textContent = "Aún no tienes pedidos.";
    list.appendChild(li);
    return;
  }

  orders.forEach((o) => {
    const li = document.createElement("li");
    li.className =
      "flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2";

    const left = document.createElement("div");
    left.className = "flex flex-col";
    const title = document.createElement("span");
    title.className = "text-xs font-semibold text-slate-800";
    title.textContent = `Pedido #${o.id}`;
    const meta = document.createElement("span");
    meta.className = "text-[11px] text-slate-500";
    meta.textContent = `${o.status} · ${new Date(o.createdAt).toLocaleString()}`;
    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("span");
    right.className = "text-xs font-semibold text-orange-600";
    right.textContent = formatMoney(o.total);

    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });
}

// ------------------- Cart logic -------------------
function addToCart(product) {
  const existing = state.cart.find((c) => c.productId === product.id);
  if (existing) {
    existing.quantity += 1;
    showToast(`Se agregó otra unidad de "${product.name}" al carrito`);
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      quantity: 1,
    });
    showToast(`"${product.name}" se agregó al carrito`);
  }
  renderCart();
}


function updateCartQuantity(index, quantity) {
  if (quantity <= 0) {
    state.cart.splice(index, 1);
  } else {
    state.cart[index].quantity = quantity;
  }
  renderCart();
}

function removeFromCart(index) {
  state.cart.splice(index, 1);
  renderCart();
}

function clearCart() {
  state.cart = [];
  renderCart();
}

// ------------------- Actions -------------------
async function loadMenu() {
  const status = document.getElementById("menuStatus");
  status.textContent = "Cargando menú...";
  try {
    const items = await api("/catalog/menu?restaurantId=1");
    renderMenu(items);
  } catch (err) {
    status.textContent = "Error al cargar menú: " + err.message;
  }
}

async function registerUser() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value.trim();
  const out = document.getElementById("regResult");
  out.textContent = "Registrando...";
  try {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    out.textContent = "Registrado: " + data.email;
  } catch (err) {
    out.textContent = "Error: " + err.message;
  }
}

async function loginUser() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const out = document.getElementById("loginResult");
  out.textContent = "Iniciando sesión...";
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user, data.token);
    out.textContent = "Bienvenido " + data.user.name;
    showAuthModal(false);
  } catch (err) {
    out.textContent = "Error: " + err.message;
  }
}

async function createOrder() {
  const out = document.getElementById("orderResult");
  out.textContent = "Creando pedido...";
  if (!state.user) {
    out.textContent = "Debes iniciar sesión para crear un pedido.";
    showAuthModal(true);
    return;
  }
  if (state.cart.length === 0) {
    out.textContent = "El carrito está vacío.";
    return;
  }
  const deliveryAddress = document.getElementById("deliveryAddress").value.trim();
  const couponCode = document.getElementById("couponCode").value.trim() || undefined;

  try{
    const body = {
      restaurantId: 1,
      items: state.cart.map((c) => ({
        productId: c.productId,
        quantity: c.quantity,
      })),
      deliveryAddress,
      couponCode,
    };
    const data = await api("/orders", {
      method: "POST",
      body: JSON.stringify(body),
    });
    out.textContent = `Pedido creado #${data.id} total ${formatMoney(data.total)}`;
    clearCart();
    // refrescar pedidos
    await loadMyOrders();
  } catch (err) {
    out.textContent = "Error al crear pedido: " + err.message;
  }
}

async function loadMyOrders() {
  const list = document.getElementById("ordersList");
  list.innerHTML = "<li class='text-xs text-slate-400'>Cargando...</li>";
  try {
    const items = await api("/orders/my");
    renderOrders(items);
  } catch (err) {
    list.innerHTML = "";
    const li = document.createElement("li");
    li.className = "text-xs text-red-500";
    li.textContent = "Error: " + err.message;
    list.appendChild(li);
  }
}

// ------------------- Init -------------------
function init() {
  renderCart(); // vacío al inicio

  document.getElementById("btnOpenAuth").addEventListener("click", () => {
    showAuthModal(true);
  });
  document.getElementById("btnCloseAuth").addEventListener("click", () => {
    showAuthModal(false);
  });

  document.getElementById("btnRegister").addEventListener("click", registerUser);
  document.getElementById("btnLogin").addEventListener("click", loginUser);

  document.getElementById("btnLoadMenu").addEventListener("click", loadMenu);
  document.getElementById("btnCreateOrder").addEventListener("click", createOrder);
  document.getElementById("btnMyOrders").addEventListener("click", loadMyOrders);
  document.getElementById("btnClearCart").addEventListener("click", clearCart);
}

document.addEventListener("DOMContentLoaded", init);
