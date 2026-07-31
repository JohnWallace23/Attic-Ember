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
  // Which payment methods are configured, and where each one sends the buyer.
  // `ref` (once we have an order number) is prefilled into the payment note
  // wherever the service supports it.
  function payMethods(ref) {
    var a = amt(), note = encodeURIComponent("Attic & Ember" + (ref ? " " + ref : " order"));
    var out = [];
    if (PAYPAL) {
      // A full link (e.g. a business profile) is used as-is — those don't
      // accept an amount in the path. Only PayPal.Me usernames get /amount.
      out.push({ id: "paypal", label: "PayPal", url: /^https?:\/\//i.test(PAYPAL)
        ? PAYPAL.replace(/\/+$/, "")
        : "https://paypal.me/" + PAYPAL + "/" + a });
    }
    if (VENMO) out.push({ id: "venmo", label: "Venmo",
      url: "https://venmo.com/" + VENMO + "?txn=pay&amount=" + a + "&note=" + note });
    if (CASHAPP) out.push({ id: "cashapp", label: "Cash App",
      url: "https://cash.app/$" + CASHAPP + "/" + a });
    return out;
  }
  function payChoices() {
    var m = payMethods();
    if (m.length === 0) return "";
    return '<span class="co-step-h">How would you like to pay?</span>' +
      '<div class="pay-choices">' + m.map(function (p) {
        // No default selection — the buyer has to pick one deliberately.
        return '<label class="pay-choice pay-' + p.id + '">' +
          '<input type="radio" name="pay_with" value="' + p.id + '">' +
          "<span>" + p.label + "</span></label>";
      }).join("") + "</div>";
  }
  function showCheckout() {
    titleEl.textContent = "Checkout";
    var summary = cart.map(function (i) {
      return '<div class="co-line"><span>' + esc(i.title) + "</span><span>" + money(parseFloat(i.price) || 0) + "</span></div>";
    }).join("");

    var step1;
    if (WEB3KEY) {
      // One flow: shipping details, payment choice, and a single button that
      // sends the order and opens the buyer's payment app.
      step1 =
        '<form class="order-form" novalidate>' +
          '<span class="co-step-h">Where should we ship it?</span>' +
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
          payChoices() +
          '<div class="pay-amount"><span>Amount to send</span><strong>' + money(subtotal()) + "</strong></div>" +
          '<button type="submit" class="btn order-submit">Place order &amp; pay ' + money(subtotal()) + " &rarr;</button>" +
          '<span class="co-hint">We’ll open your payment app — enter <strong>' + money(subtotal()) +
            "</strong> and put your name in the note.</span>" +
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
    // Which payment app they picked — required, no silent default.
    var methods = payMethods();
    var chosen = null;
    for (var i = 0; i < methods.length; i++) {
      if (methods[i].id === data.pay_with) { chosen = methods[i]; break; }
    }
    if (methods.length && !chosen) {
      status.className = "of-status err";
      status.textContent = "Please select a payment method.";
      var choices = form.querySelector(".pay-choices");
      if (choices) {
        choices.classList.remove("needs-pick");
        void choices.offsetWidth;          // restart the nudge animation
        choices.classList.add("needs-pick");
        choices.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      return;
    }

    // Short shared reference so the buyer and the shop can name this order:
    // AE-MMDD-XXX — the date makes orders sortable and easy to place, and the
    // random tail keeps two orders on the same day from ever colliding.
    var now = new Date();
    function pad2(n) { return (n < 10 ? "0" : "") + n; }
    var ref = "AE-" + pad2(now.getMonth() + 1) + pad2(now.getDate()) + "-" +
      Math.random().toString(36).slice(2, 5).toUpperCase();
    var items = cart.slice();

    data.access_key = WEB3KEY;
    data.order_ref = ref;
    data.subject = "Attic & Ember order " + ref + " — " + cart.length + " item" + (cart.length > 1 ? "s" : "") + ", " + money(subtotal());
    data.from_name = data.name;
    data.paying_with = chosen ? chosen.label : "(not selected)";
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
      if (!res || !res.success) throw new Error((res && res.message) || "failed");
      var total = money(subtotal());
      // Re-resolve the method now that we have a ref, so the payment note is
      // prefilled where the service supports it (Venmo, Cash App).
      var withRef = payMethods(ref);
      for (var j = 0; j < withRef.length; j++) {
        if (chosen && withRef[j].id === chosen.id) { chosen = withRef[j]; break; }
      }
      orderSent(form, data.name, chosen, total, ref, items, data.email);
    }).catch(function () {
      btn.disabled = false;
      status.className = "of-status err";
      status.innerHTML = 'That didn’t go through — please email us at <a href="mailto:' + esc(ORDER_EMAIL) + '">' + esc(ORDER_EMAIL) + "</a>.";
    });
  }
  function orderSent(form, name, chosen, total, ref, items, email) {
    var wrap = document.createElement("div");
    wrap.className = "order-sent";
    var first = (name || "").trim().split(/\s+/)[0];
    var html = "<strong>Thanks, " + esc(first) + "! Your order is in.</strong>" +
      '<div class="os-receipt">' +
        '<div class="os-ref"><span>Order</span><strong>' + esc(ref) + "</strong></div>" +
        (items || []).map(function (i) {
          return '<div class="co-line"><span>' + esc(i.title) + "</span><span>" +
            money(parseFloat(i.price) || 0) + "</span></div>";
        }).join("") +
        '<div class="co-line co-total"><span>Total</span><strong>' + total + "</strong></div>" +
      "</div>";
    if (chosen) {
      // Instructions come BEFORE the button on purpose: the payment site opens
      // in a new tab and takes focus, so anything below it never gets read.
      html +=
        '<div class="os-next">' +
          '<span class="os-next-h">Last step &mdash; send your payment</span>' +
          '<ol class="os-steps">' +
            "<li>Tap the button below to open " + esc(chosen.label) + ".</li>" +
            "<li>Enter <strong>" + total + "</strong> as the amount.</li>" +
            "<li>Put <strong>" + esc(ref) + "</strong> in the note " +
              '<button type="button" class="copy-ref" data-ref="' + esc(ref) + '">Copy</button></li>' +
          "</ol>" +
          '<a class="pay pay-' + chosen.id + ' os-pay" target="_blank" rel="noopener" ' +
            'data-ref="' + esc(ref) + '" href="' + esc(chosen.url) + '">' +
            "Pay " + total + " with " + esc(chosen.label) + " &rarr;</a>" +
          '<span class="os-note">Opens in a new tab &mdash; we’ll copy <strong>' + esc(ref) +
            "</strong> for you so you can paste it.</span>" +
        "</div>";
    } else {
      html += "<p>We’ll email you shortly with how to pay.</p>";
    }
    html += '<p class="os-foot">We’ll email ' + (email ? "<strong>" + esc(email) + "</strong>" : "you") +
      " to confirm it’s yours and let you know when it ships. " +
      "Questions? Just reply to that email or write us at " +
      '<a href="mailto:' + esc(ORDER_EMAIL) + '">' + esc(ORDER_EMAIL) + "</a>.</p>";
    wrap.innerHTML = html;
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
  // Copy the order reference so it can be pasted into the payment note.
  function copyRef(ref, btn) {
    function flash() {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = "Copied ✓";
      btn.classList.add("copied");
      setTimeout(function () { btn.textContent = old; btn.classList.remove("copied"); }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ref).then(flash, function () {});
    } else {
      var ta = document.createElement("textarea");
      ta.value = ref; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); flash(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }
  body.addEventListener("click", function (e) {
    var c = e.target.closest(".copy-ref");
    if (c) { copyRef(c.getAttribute("data-ref"), c); return; }
    // Clicking through to pay: put the reference on the clipboard first, so
    // pasting it into the payment note is one tap on the other side.
    var p = e.target.closest(".os-pay");
    if (p && p.getAttribute("data-ref")) copyRef(p.getAttribute("data-ref"), null);
  });
  // Picking a payment method clears the "please select one" warning.
  body.addEventListener("change", function (e) {
    if (!e.target || e.target.name !== "pay_with") return;
    var form = e.target.closest(".order-form");
    if (!form) return;
    var choices = form.querySelector(".pay-choices");
    if (choices) choices.classList.remove("needs-pick");
    var st = form.querySelector(".of-status");
    if (st && st.classList.contains("err")) { st.className = "of-status"; st.textContent = ""; }
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
