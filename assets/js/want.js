/* The want list form (/looking-for/). Sends the request to the shop's inbox
   through Web3Forms, using the same key as orders (read from the cart script's
   data-web3forms attribute). No backend, nothing stored in the browser. */
(function () {
  var form = document.getElementById("want-form");
  if (!form) return;
  var status = document.getElementById("want-status");
  var cartScript = document.querySelector("script[data-web3forms]");
  var KEY = cartScript ? (cartScript.getAttribute("data-web3forms") || "").trim() : "";
  var INBOX = "shop@atticandember.com";

  function val(id) { return (document.getElementById(id).value || "").trim(); }
  function fail(msg) { status.className = "of-status err"; status.textContent = msg; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (form.botcheck.checked) return;   // honeypot tripped: quietly ignore
    var item = val("want-item"), name = val("want-name"), contact = val("want-contact");
    if (!item) { fail("Tell us what you're looking for."); document.getElementById("want-item").focus(); return; }
    if (!name) { fail("Add your first name."); document.getElementById("want-name").focus(); return; }
    if (!contact) { fail("Add an email or phone number so we can reach you."); document.getElementById("want-contact").focus(); return; }
    if (!KEY) { fail("This form isn't working right now. Please email us at " + INBOX + "."); return; }

    // Labels exactly as the sourcing app's "Paste a request email" expects.
    var data = {
      access_key: KEY,
      subject: "Want list: " + item.slice(0, 80),
      from_name: name,
      "Item": item,
      "Max price": val("want-max") || "(not given)",
      "Name": name,
      "Contact": contact,
      "Notes": val("want-notes") || "(none)"
    };
    if (contact.indexOf("@") > 0) data.email = contact;   // lets "Reply" go straight to them

    var btn = form.querySelector(".want-send");
    btn.disabled = true;
    status.className = "of-status";
    status.textContent = "Sending…";
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res || !res.success) throw new Error((res && res.message) || "failed");
      document.getElementById("want-done-name").textContent = name;
      document.getElementById("want-done-item").textContent = item;
      form.hidden = true;
      var done = document.getElementById("want-done");
      done.hidden = false;
      done.scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function () {
      btn.disabled = false;
      fail("That didn't go through. Please email us at " + INBOX + " instead.");
    });
  });
})();
