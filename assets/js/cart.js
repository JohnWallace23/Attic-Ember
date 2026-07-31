/* ==========================================================================
   Attic & Ember — browser cart + manual checkout
   Static-site cart: items live in THIS browser's localStorage (no backend,
   no card data ever touches the site). One-of-a-kind inventory is handled by
   the `sold` flag on each product (sold items aren't addable). Checkout emails
   the order to the shop and hands off to PayPal / Venmo / Cash App.
   ========================================================================== */
(function () {
  "use strict";

  var KEY = "ae-cart";
  var tag = document.querySelector("script[data-order-email]");
  function attr(n, d) { return tag && tag.getAttribute(n) != null ? tag.getAttribute(n) : d; }
  var ORDER_EMAIL = attr("data-order-email", "shop@atticandember.com");
  var PAYPAL  = (attr("data-paypal", "") || "").trim();
  var VENMO   = (attr("data-venmo", "") || "").trim();
  var CASHAPP = (attr("data-cashapp", "") || "").trim();
  var SHIP_NOTE = attr("data-shipping-note", "");
  var WEB3KEY = (attr("data-web3forms", "") || "").trim();

  function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} }
  var cart = read();

  function has(id) { return cart.some(function (i) { return i.id === id; }); }
  function subtotal() { return cart.reduce(function (s, i) { return s + (parseFloat(i.price) || 0); }, 0); }
  function money(n) { return "$" + (Math.round(n * 100) / 100).toFixed(2); }
  function amt() { return (Math.round(subtotal() * 100) / 100).toFixed(2); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---- drawer shell ----
  var drawer = document.createElement("div");
  drawer.className = "cart-drawer";
  drawer.hidden = true;
  drawer.innerHTML =
    '<div class="cart-backdrop"></div>' +
    '<aside class="cart-panel" role="dialog" aria-modal="true" aria-label="Shopping cart">' +
      '<div class="cart-head">' +
        '<h2 class="cart-title">Your cart</h2>' +
        '<button class="cart-close" type="button" aria-label="Close cart">&times;</button>' +
      '</div>' +
      '<div class="cart-body"></div>' +
    '</aside>';
  document.body.appendChild(drawer);
  var body = drawer.querySelector(".cart-body");
  var titleEl = drawer.querySelector(".cart-title");

  function open() { drawer.hidden = false; document.body.classList.add("cart-open"); }
  function close() { drawer.hidden = true; document.body.classList.remove("cart-open"); showCart(); }
  drawer.querySelector(".cart-backdrop").addEventListener("click", close);
  drawer.querySelector(".cart-close").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !drawer.hidden) close(); });

  // ---- cart (items) view ----
  function showCart() {
    titleEl.textContent = "Your cart";
    if (cart.length === 0) {
      body.innerHTML =
        '<p class="cart-empty">Your cart is empty.</p>' +
        '<p class="cart-empty-sub">Find something with a little history in <a href="/shop/">the shop</a>.</p>';
      return;
    }
    var rows = cart.map(function (i) {
      return '<div class="cart-item">' +
        '<div class="cart-item-thumb">' + (i.image ? '<img src="' + esc(i.image) + '" alt="">' : "") + "</div>" +
        '<div class="cart-item-info">' +
          '<a href="' + esc(i.url) + '" class="cart-item-title">' + esc(i.title) + "</a>" +
          '<span class="cart-item-price">' + money(parseFloat(i.price) || 0) + "</span>" +
        "</div>" +
        '<button class="cart-remove" type="button" data-id="' + esc(i.id) + '" aria-label="Remove">&times;</button>' +
      "</div>";
    }).join("");
    body.innerHTML =
      '<div class="cart-items">' + rows + "</div>" +
      '<div class="cart-foot">' +
        '<div class="cart-subtotal"><span>Subtotal</span><strong>' + money(subtotal()) + "</strong></div>" +
        '<button class="btn cart-checkout" type="button">Checkout &rarr;</button>' +
      "</div>";
  }

  // ---- checkout view ----
  function orderBody() {
    var lines = cart.map(function (i) { return "- " + i.title + " (" + money(parseFloat(i.price) || 0) + ")"; }).join("\n");
    return "Hi Attic & Ember,\n\nI'd like to order:\n" + lines +
      "\n\nTotal: " + money(subtotal()) +
      "\n\nMy shipping details:\nName:\nAddress:\nCity / State / ZIP:\n\nI'll send payment by PayPal / Venmo / Cash App. Thanks!";
  }
  function mailtoUrl() {
    var subj = "Attic & Ember order — " + cart.length + " item" + (cart.length > 1 ? "s" : "") + ", " + money(subtotal());
    return "mailto:" + ORDER_EMAIL + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(orderBody());
  }
  function payButtons() {
    var a = amt(), note = encodeURIComponent("Attic & Ember order");
    var out = [];
    if (PAYPAL) {
      // A full link (e.g. a business profile) is used as-is — those don't
      // accept an amount in the path. Only PayPal.Me usernames get /amount.
      var href = /^https?:\/\//i.test(PAYPAL)
        ? PAYPAL.replace(/\/+$/, "")
        : "https://paypal.me/" + PAYPAL + "/" + a;
      out.push('<a class="pay pay-paypal" target="_blank" rel="noopener" href="' + esc(href) + '">PayPal</a>');
    }
    if (VENMO)   out.push('<a class="pay pay-venmo" target="_blank" rel="noopener" href="https://venmo.com/' + esc(VENMO) + "?txn=pay&amount=" + a + "&note=" + note + '">Venmo</a>');
    if (CASHAPP) out.push('<a class="pay pay-cashapp" target="_blank" rel="noopener" href="https://cash.app/$' + esc(CASHAPP) + "/" + a + '">Cash&nbsp;App</a>');
    if (out.length === 0) return '<p class="pay-none">Payment options are being set up — just send your order email and we’ll reply with how to pay.</p>';
    return '<div class="pay-buttons">' + out.join("") + "</div>";
  }
  function showCheckout() {
    titleEl.textContent = "Checkout";
    var summary = cart.map(function (i) {
      return '<div class="co-line"><span>' + esc(i.title) + "</span><span>" + money(parseFloat(i.price) || 0) + "</span></div>";
    }).join("");

    var step1;
    if (WEB3KEY) {
      // On-page order form — works for everyone, no email app required.
      step1 =
        '<form class="order-form" novalidate>' +
          '<span class="co-step-h">1 &middot; Where should we ship it?</span>' +
          '<input type="text" name="name" placeholder="Full name" autocomplete="name" required>' +
          '<input type="email" name="email" placeholder="Email" autocomplete="email" required>' +
          '<input type="text" name="address" placeholder="Street address" autocomplete="street-address">' +
          '<div class="of-row">' +
            '<input type="text" name="city" placeholder="City" autocomplete="address-level2">' +
            '<input type="text" name="state" placeholder="State" autocomplete="address-level1">' +
            '<input type="text" name="zip" placeholder="ZIP" autocomplete="postal-code">' +
          '</div>' +
          '<textarea name="note" placeholder="Anything we should know? (optional)"></textarea>' +
          '<input type="checkbox" name="botcheck" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px">' +
          '<button type="submit" class="btn order-submit">Send shipping info</button>' +
          '<span class="of-status" role="status" aria-live="polite"></span>' +
        "</form>";
    } else {
      // Safety net: only shown if the order-form key is ever removed.
      step1 =
        '<div><span class="co-step-h">1 &middot; Send your order &amp; shipping address</span>' +
          '<a class="btn email-order" href="' + mailtoUrl() + '">Email your order &rarr;</a>' +
          '<span class="co-hint">Opens your email with everything filled in — just add your address.</span></div>';
    }

    body.innerHTML =
      '<div class="checkout">' +
        '<div class="co-summary">' + summary +
          '<div class="co-line co-total"><span>Total</span><strong>' + money(subtotal()) + "</strong></div></div>" +
        (SHIP_NOTE ? '<p class="ship-note">' + esc(SHIP_NOTE) + "</p>" : "") +
        step1 +
        '<div class="pay-step">' +
          '<span class="co-step-h">2 &middot; Pay your total (' + money(subtotal()) + ")</span>" +
          payButtons() +
          '<span class="co-hint">Send <strong>' + money(subtotal()) + "</strong> and put your name in the note so we can match it to your order. " +
          "If the amount doesn’t fill in automatically, just type it.</span>" +
        "</div>" +
        '<button class="checkout-back" type="button">&larr; Back to cart</button>' +
      "</div>";
  }

  // ---- order form submission (Web3Forms — no mail app needed) ----
  function submitOrder(form) {
    var status = form.querySelector(".of-status");
    var btn = form.querySelector(".order-submit");
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    if (data.botcheck) return;   // honeypot tripped -> silently ignore
    if (!data.name || !data.name.trim() || !/.+@.+\..+/.test(data.email || "")) {
      status.className = "of-status err";
      status.textContent = "Please add your name and a valid email.";
      return;
    }
    data.access_key = WEB3KEY;
    data.subject = "Attic & Ember order — " + cart.length + " item" + (cart.length > 1 ? "s" : "") + ", " + money(subtotal());
    data.from_name = data.name;
    data.order = cart.map(function (i) { return "- " + i.title + " (" + money(parseFloat(i.price) || 0) + ")"; }).join("\n") +
      "\nTotal: " + money(subtotal());
    btn.disabled = true;
    status.className = "of-status";
    status.textContent = "Sending…";
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res && res.success) orderSent(form, data.name);
      else throw new Error((res && res.message) || "failed");
    }).catch(function () {
      btn.disabled = false;
      status.className = "of-status err";
      status.innerHTML = 'That didn’t go through — please email us at <a href="mailto:' + esc(ORDER_EMAIL) + '">' + esc(ORDER_EMAIL) + "</a>.";
    });
  }
  function orderSent(form, name) {
    var wrap = document.createElement("div");
    wrap.className = "order-sent";
    wrap.innerHTML = "<strong>Thanks, " + esc(name) + "! We’ve got your shipping details.</strong>" +
      "<p>Send your payment below and we’ll confirm by email and get it packed.</p>";
    form.parentNode.replaceChild(wrap, form);
    // Empty the cart (the receipt + pay step above already show the captured
    // total, so clearing now won't change what they see).
    cart = [];
    save();
    updateCount();
    syncButtons();
  }
  body.addEventListener("submit", function (e) {
    var form = e.target.closest(".order-form");
    if (!form) return;
    e.preventDefault();
    submitOrder(form);
  });

  // ---- clicks inside the drawer ----
  body.addEventListener("click", function (e) {
    var rm = e.target.closest(".cart-remove");
    if (rm) {
      var id = rm.getAttribute("data-id");
      cart = cart.filter(function (i) { return i.id !== id; });
      save(); updateCount(); syncButtons(); showCart();
    } else if (e.target.closest(".cart-checkout")) {
      showCheckout();
    } else if (e.target.closest(".checkout-back")) {
      showCart();
    }
  });

  // ---- add to cart (delegated, so it also covers dynamically-shown cards) ----
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".add-to-cart");
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute("data-id");
    if (!has(id)) {
      cart.push({
        id: id,
        title: btn.getAttribute("data-title"),
        price: btn.getAttribute("data-price"),
        url: btn.getAttribute("data-url"),
        image: btn.getAttribute("data-image")
      });
      save(); updateCount(); syncButtons();
    }
    showCart(); open();
  });

  // ---- header toggle(s) ----
  Array.prototype.forEach.call(document.querySelectorAll(".cart-toggle"), function (el) {
    el.addEventListener("click", function () { showCart(); open(); });
  });

  function updateCount() {
    Array.prototype.forEach.call(document.querySelectorAll(".cart-count"), function (el) {
      el.textContent = cart.length;
    });
  }
  function syncButtons() {
    Array.prototype.forEach.call(document.querySelectorAll(".add-to-cart"), function (btn) {
      var inCart = has(btn.getAttribute("data-id"));
      btn.classList.toggle("in-cart", inCart);
      btn.textContent = inCart ? "In cart ✓" : (btn.getAttribute("data-label") || btn.textContent);
    });
  }

  // remember each button's original label so we can restore it
  Array.prototype.forEach.call(document.querySelectorAll(".add-to-cart"), function (btn) {
    btn.setAttribute("data-label", btn.textContent.trim());
  });

  updateCount();
  syncButtons();
  showCart();
})();
