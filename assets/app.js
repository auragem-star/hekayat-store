(function () {
  "use strict";
  var S = window.STORE, BOOKS = window.BOOKS, SERIES = window.SERIES;
  var KEY = "hm-cart-v1";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var money = function (n) { return n + " " + S.currency; };
  var book = function (id) { return BOOKS.filter(function (b) { return b.id === id; })[0]; };
  var series = function (id) { return SERIES.filter(function (s) { return s.id === id; })[0]; };

  /* ---------------- cart storage */
  var mem = [];
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); mem = Array.isArray(v) ? v.filter(book) : []; } catch (e) { /* storage unavailable: keep in memory */ }
    return mem.slice();
  }
  function save(ids) {
    mem = ids.slice();
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* ignore */ }
    refresh();
  }
  function has(id) { return mem.indexOf(id) !== -1; }
  function add(id) { if (!has(id)) save(mem.concat([id])); }
  function remove(id) { save(mem.filter(function (x) { return x !== id; })); }

  function pricing(ids) {
    var items = ids.map(book).filter(Boolean).sort(function (a, b) { return a.series === b.series ? a.num - b.num : (a.series < b.series ? -1 : 1); });
    var subtotal = items.reduce(function (a, b) { return a + b.price; }, 0);
    var discounts = [];
    SERIES.forEach(function (s) {
      if (!s.bundle) return;
      var all = s.bundle.items.every(function (i) { return ids.indexOf(i) !== -1; });
      if (all) {
        var full = s.bundle.items.reduce(function (a, i) { return a + book(i).price; }, 0);
        if (full > s.bundle.price) discounts.push({ label: "خصم الباقة الكاملة", amount: full - s.bundle.price });
      }
    });
    var off = discounts.reduce(function (a, d) { return a + d.amount; }, 0);
    return { items: items, subtotal: subtotal, discounts: discounts, total: subtotal - off };
  }

  /* ---------------- toast */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  /* ---------------- header + buttons state */
  function refresh() {
    var n = mem.length;
    $$(".cart-count").forEach(function (el) { el.textContent = n; });
    $$(".cart-btn").forEach(function (el) { el.classList.toggle("has-items", n > 0); el.setAttribute("aria-label", "السلة، فيها " + n + (n === 1 ? " قصة" : " قصص")); });
    $$("[data-add]").forEach(function (el) {
      var inCart = has(el.getAttribute("data-add"));
      el.setAttribute("aria-pressed", inCart ? "true" : "false");
      el.textContent = inCart ? "في السلة ✓" : "أضف للسلة";
    });
    $$("[data-add-bundle]").forEach(function (el) {
      var s = series(el.getAttribute("data-add-bundle"));
      var inCart = s.bundle.items.every(has);
      el.setAttribute("aria-pressed", inCart ? "true" : "false");
      el.textContent = inCart ? "الباقة في السلة ✓" : "أضف الباقة للسلة";
    });
    if (dlg && dlg.open && view === "cart") renderCart();
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-add]");
    if (a) {
      var id = a.getAttribute("data-add");
      if (has(id)) { openCart(); } else { add(id); toast("اتضافت «" + book(id).title + "» للسلة"); }
      return;
    }
    var b = e.target.closest("[data-add-bundle]");
    if (b) {
      var s = series(b.getAttribute("data-add-bundle"));
      if (s.bundle.items.every(has)) { openCart(); return; }
      save(mem.concat(s.bundle.items.filter(function (i) { return !has(i); })));
      toast("اتضافت الباقة كاملة للسلة");
      return;
    }
    if (e.target.closest(".cart-btn")) { openCart(); return; }
    var z = e.target.closest("[data-zoom]");
    if (z) { openZoom(z.getAttribute("data-zoom"), z.getAttribute("data-alt")); }
  });

  /* ---------------- cart dialog */
  var dlg, view = "cart", lastOrderUrl = "";
  function ensureDialog() {
    if (dlg) return;
    dlg = document.createElement("dialog");
    dlg.id = "cart";
    dlg.setAttribute("aria-labelledby", "cart-title");
    dlg.innerHTML = '<div class="dlg-head"><h2 id="cart-title">السلة</h2><button class="x" type="button" aria-label="اقفل السلة">×</button></div><div class="dlg-body"></div>';
    document.body.appendChild(dlg);
    $(".x", dlg).addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }
  function openCart() { ensureDialog(); view = "cart"; renderCart(); if (!dlg.open) dlg.showModal(); }

  function renderCart() {
    var body = $(".dlg-body", dlg);
    $("#cart-title", dlg).textContent = "السلة";
    var p = pricing(mem);
    if (!p.items.length) {
      body.innerHTML = '<div class="empty"><p>السلة فاضية. اختار قصة وابدأ.</p><a class="btn btn-primary" href="index.html#stories">شوف القصص</a></div>';
      $("a", body).addEventListener("click", function () { dlg.close(); });
      return;
    }
    var list = p.items.map(function (b) {
      return '<li><img src="' + esc(b.cover) + '" alt=""><div><div class="t">' + esc(b.title) + '</div><div class="p">' + money(b.price) + ' · PDF</div></div>' +
        '<button class="rm" type="button" data-rm="' + esc(b.id) + '">شيل</button></li>';
    }).join("");
    var disc = p.discounts.map(function (d) { return '<div class="disc"><span>' + esc(d.label) + '</span><span>−' + money(d.amount) + '</span></div>'; }).join("");
    var hint = "";
    SERIES.forEach(function (s) {
      if (!s.bundle) return;
      var inS = s.bundle.items.filter(has).length;
      if (inS > 0 && inS < s.bundle.items.length) {
        hint = '<p class="note">ضيف باقي ' + esc(s.name) + ' وخد الـ ' + s.bundle.items.length + ' قصص بـ ' + money(s.bundle.price) + ' بس. <button class="copy" type="button" data-add-bundle="' + esc(s.id) + '">كمّل الباقة</button></p>';
      }
    });
    body.innerHTML =
      '<ul class="cart-list">' + list + '</ul>' + hint +
      '<div class="totals"><div><span>المجموع</span><span>' + money(p.subtotal) + '</span></div>' + disc +
      '<div class="grand"><span>الإجمالي</span><span>' + money(p.total) + '</span></div></div>' +
      '<form id="order" novalidate>' +
      '<fieldset><legend>1. حوّل المبلغ</legend>' +
      payOpt("instapay", "إنستاباي", S.instapay, true) +
      payOpt("vodafone", "فودافون كاش", S.vodafoneCash, false) +
      '</fieldset>' +
      '<fieldset style="margin-top:18px"><legend>2. اكتب بياناتك</legend>' +
      '<div class="field"><label for="f-name">الاسم</label><input id="f-name" name="name" autocomplete="name" required><div class="err" id="e-name"></div></div>' +
      '<div class="field"><label for="f-phone">رقم الموبايل (واتساب)</label><input id="f-phone" name="phone" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="01xxxxxxxxx" required><div class="err" id="e-phone"></div></div>' +
      '</fieldset>' +
      '<fieldset style="margin-top:18px"><legend>3. ابعت الطلب</legend>' +
      '<p class="note">هيتفتح واتساب برسالة فيها طلبك. ابعتها، وبعدها ابعت سكرين التحويل في نفس المحادثة. ' + esc(S.deliveryNote) + '</p>' +
      '<button class="btn btn-wa btn-block" type="submit" style="margin-top:6px">ابعت الطلب على واتساب</button>' +
      '</fieldset></form>';
    $$("[data-rm]", body).forEach(function (el) { el.addEventListener("click", function () { remove(el.getAttribute("data-rm")); }); });
    $$("[data-copy]", body).forEach(function (el) { el.addEventListener("click", function (e) { e.preventDefault(); copy(el.getAttribute("data-copy")); }); });
    $("#order", body).addEventListener("submit", submitOrder);
  }

  function payOpt(val, label, acc, checked) {
    return '<label class="pay-opt"><input type="radio" name="pay" value="' + val + '"' + (checked ? " checked" : "") + '>' +
      '<b>' + label + '</b><span class="acc"><code>' + esc(acc) + '</code><button class="copy" type="button" data-copy="' + esc(acc) + '">انسخ</button></span></label>';
  }

  function copy(text) {
    var ok = function () { toast("اتنسخ: " + text); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text); ok(); });
    } else { fallbackCopy(text); ok(); }
  }
  function fallbackCopy(text) {
    var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) { /* ignore */ } t.remove();
  }

  function normDigits(s) {
    return String(s).replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); }).replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); });
  }

  function submitOrder(e) {
    e.preventDefault();
    var f = e.target;
    var name = f.name.value.trim();
    var phone = normDigits(f.phone.value).replace(/[\s-]/g, "").replace(/^\+?20/, "0");
    var ok = true;
    var setErr = function (input, el, msg) { input.setAttribute("aria-invalid", msg ? "true" : "false"); $(el, f).textContent = msg; if (msg) ok = false; };
    setErr(f.name, "#e-name", name.length < 2 ? "اكتب اسمك علشان نعرف الطلب بتاع مين." : "");
    setErr(f.phone, "#e-phone", /^01[0125]\d{8}$/.test(phone) ? "" : "اكتب رقم موبايل مصري من 11 رقم يبدأ بـ 01.");
    if (!ok) { var bad = $('[aria-invalid="true"]', f); if (bad) bad.focus(); return; }
    var pay = f.pay.value === "vodafone" ? "فودافون كاش" : "إنستاباي";
    var p = pricing(mem);
    var lines = ["أهلًا، عايز أطلب من " + S.name + ":"];
    p.items.forEach(function (b) { lines.push("• " + b.title + " (" + money(b.price) + ")"); });
    p.discounts.forEach(function (d) { lines.push(d.label + ": −" + money(d.amount)); });
    lines.push("الإجمالي: " + money(p.total));
    lines.push("طريقة الدفع: " + pay);
    lines.push("الاسم: " + name);
    lines.push("الموبايل: " + phone);
    lines.push("هبعت سكرين التحويل في الرسالة الجاية.");
    lastOrderUrl = "https://wa.me/" + S.whatsapp + "?text=" + encodeURIComponent(lines.join("\n"));
    window.open(lastOrderUrl, "_blank", "noopener");
    showDone(p.total, pay);
  }

  function showDone(total, pay) {
    view = "done";
    $("#cart-title", dlg).textContent = "خطوة أخيرة";
    var body = $(".dlg-body", dlg);
    body.innerHTML = '<div class="done"><div class="big">اتفتحت رسالة الطلب على واتساب</div>' +
      '<p>ابعت الرسالة، وبعدها ابعت سكرين تحويل ' + money(total) + ' على ' + esc(pay) + ' في نفس المحادثة.</p>' +
      '<p class="note">' + esc(S.deliveryNote) + '</p>' +
      '<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="' + esc(lastOrderUrl) + '">واتساب ما اتفتحش؟ افتحه من هنا</a>' +
      '<button class="btn btn-block" type="button" id="finish">تمام، فضّي السلة</button></div>';
    $("#finish", body).addEventListener("click", function () { save([]); dlg.close(); });
  }

  /* ---------------- image zoom */
  var zdlg;
  function openZoom(src, alt) {
    if (!zdlg) {
      zdlg = document.createElement("dialog"); zdlg.className = "zoom";
      zdlg.setAttribute("aria-label", "صفحة من القصة");
      zdlg.innerHTML = '<div class="dlg-head"><h2>صفحة من القصة</h2><button class="x" type="button" aria-label="اقفل">×</button></div><img alt="">';
      document.body.appendChild(zdlg);
      $(".x", zdlg).addEventListener("click", function () { zdlg.close(); });
      zdlg.addEventListener("click", function (e) { if (e.target === zdlg) zdlg.close(); });
    }
    var img = $("img", zdlg); img.src = src; img.alt = alt || "";
    zdlg.showModal();
  }

  /* ---------------- renderers */
  function numLabel(b) {
    var s = series(b.series);
    return s && s.standalone ? "قصة منفردة" : "الكتاب " + b.num;
  }
  function bookCard(b) {
    return '<article class="book" style="--tint:' + esc(b.tint) + '">' +
      '<a class="cover-link" href="book.html?id=' + esc(b.id) + '"><img src="' + esc(b.cover) + '" alt="غلاف ' + esc(b.title) + '" loading="lazy" width="420" height="594"></a>' +
      '<div class="info"><div class="num">' + numLabel(b) + '</div><h3><a href="book.html?id=' + esc(b.id) + '">' + esc(b.title) + '</a></h3><p class="tag">' + esc(b.tagline) + '</p></div>' +
      '<div class="row"><span class="price">' + money(b.price) + '</span>' +
      '<span style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-small" href="book.html?id=' + esc(b.id) + '">التفاصيل</a>' +
      '<button class="btn btn-small btn-primary" type="button" data-add="' + esc(b.id) + '">أضف للسلة</button></span></div></article>';
  }
  function bundleBlock(s) {
    if (!s.bundle) return "";
    var items = s.bundle.items.map(book);
    var full = items.reduce(function (a, b) { return a + b.price; }, 0);
    return '<div class="bundle"><div class="fan">' + items.map(function (b) { return '<img src="' + esc(b.cover) + '" alt="" loading="lazy">'; }).join("") + '</div>' +
      '<div><h3>' + esc(s.bundle.title) + '</h3><p>' + esc(s.bundle.blurb || ('كل قصص ' + s.name + ' مع بعض، بسعر أقل من شرائهم واحدة واحدة.')) + '</p>' +
      '<div class="row"><span class="price">' + money(s.bundle.price) + '<s>' + money(full) + '</s></span>' +
      '<button class="btn btn-primary" type="button" data-add-bundle="' + esc(s.id) + '">أضف الباقة للسلة</button></div></div></div>';
  }

  function renderHome() {
    var host = $("#series-list"); if (!host) return;
    host.innerHTML = SERIES.map(function (s) {
      var bs = BOOKS.filter(function (b) { return b.series === s.id; }).sort(function (a, b) { return a.num - b.num; });
      return '<div class="series"><div class="section-head"><h2>' + esc(s.name) + '</h2><p>' + esc(s.blurb) + '</p></div>' +
        '<div class="books">' + bs.map(bookCard).join("") + '</div>' + bundleBlock(s) + '</div>';
    }).join('<div style="height:56px"></div>');
  }

  function renderBook() {
    var host = $("#book"); if (!host) return;
    var id = new URLSearchParams(location.search).get("id");
    var b = book(id);
    if (!b) {
      host.innerHTML = '<div class="empty" style="padding:60px 0"><h1>القصة دي مش موجودة</h1><p style="margin:12px 0 20px">ممكن يكون الرابط ناقص. شوف كل القصص من هنا.</p><a class="btn btn-primary" href="index.html#stories">كل القصص</a></div>';
      return;
    }
    var s = series(b.series);
    document.title = b.title + " | " + S.name;
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute("content", b.summary);
    var others = BOOKS.filter(function (x) { return x.series === b.series && x.id !== b.id; });
    var li = function (arr) { return "<ul>" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };
    host.innerHTML =
      '<p class="crumb"><a href="index.html#stories">كل القصص</a> / ' + esc(s ? s.name : "") + '</p>' +
      '<div class="detail"><img class="cover" src="' + esc(b.cover) + '" alt="غلاف ' + esc(b.title) + '" width="420" height="594">' +
      '<div><div class="num">' + esc(s ? s.name : "") + ' · ' + numLabel(b) + '</div><h1>' + esc(b.title) + '</h1><p class="tag">' + esc(b.tagline) + '</p>' +
      '<ul class="facts"><li>لسن ' + esc(b.age) + '</li><li>' + b.pages + ' صفحة A4</li><li>' + b.storyPages + ' صفحة قصة للتلوين</li><li>ملف PDF تطبعه في البيت</li></ul>' +
      '<p class="summary">' + esc(b.summary) + '</p>' +
      '<div class="buy"><span class="price">' + money(b.price) + '</span><button class="btn btn-primary" type="button" data-add="' + esc(b.id) + '">أضف للسلة</button></div>' +
      (s && s.bundle ? '<p class="bundle-hint">أو خد الـ ' + s.bundle.items.length + ' قصص بـ ' + money(s.bundle.price) + ' بس. <a href="#" data-add-bundle-link="' + esc(s.id) + '">أضف الباقة كاملة</a></p>' : '') +
      '</div></div>' +
      '<section class="section" style="padding-top:8px"><div class="section-head"><h2>صفحات من جوه القصة</h2><p>اضغط على أي صفحة علشان تكبّرها.</p></div><div class="gallery">' +
      b.previews.map(function (src, i) { return '<button type="button" data-zoom="' + esc(src) + '" data-alt="صفحة ' + (i + 1) + ' من ' + esc(b.title) + '"><img src="' + esc(src) + '" alt="صفحة ' + (i + 1) + ' من ' + esc(b.title) + '" loading="lazy"></button>'; }).join("") +
      '</div></section>' +
      '<section class="section" style="padding-top:0"><div class="lists">' +
      '<div class="list-box"><h2>المواقف في القصة</h2>' + li(b.topics) + '</div>' +
      '<div class="list-box"><h2>طفلك هيتعلّم</h2>' + li(b.learns) + '</div>' +
      '<div class="list-box"><h2>وكمان في الكتاب</h2>' + li(b.extras) + '</div></div></section>' +
      (others.length ? '<section class="section" style="padding-top:0"><div class="section-head"><h2>باقي القصص في السلسلة</h2></div><div class="books">' + others.map(bookCard).join("") + '</div></section>' : '');
    var bl = $("[data-add-bundle-link]", host);
    if (bl) bl.addEventListener("click", function (e) {
      e.preventDefault();
      var ser = series(bl.getAttribute("data-add-bundle-link"));
      save(mem.concat(ser.bundle.items.filter(function (i) { return !has(i); })));
      openCart();
    });
  }

  /* ---------------- hero colour-in: the one orchestrated moment */
  function paintHero() {
    var svg = $(".hero-art"); if (!svg) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var parts = $$('[style*="--c"]', svg);
    if (!reduce) parts.forEach(function (el, i) { el.style.setProperty("--d", (0.25 + i * 0.03).toFixed(2) + "s"); });
    else parts.forEach(function (el) { el.style.transition = "none"; });
    requestAnimationFrame(function () { requestAnimationFrame(function () { svg.classList.add("painted"); }); });
  }

  /* ---------------- setup banner for the store owner */
  function setupBanner() {
    var placeholder = /^2010{8,}$/.test(S.whatsapp) || /yourname/.test(S.instapay) || /^010{8,}$/.test(S.vodafoneCash);
    if (!placeholder) return;
    var d = document.createElement("div");
    d.className = "setup-banner";
    d.textContent = "المتجر لسه في وضع التجربة: اكتب رقم الواتساب وإنستاباي وفودافون كاش في ملف assets/config.js قبل ما تنشره.";
    document.body.insertBefore(d, document.body.firstChild);
  }

  document.addEventListener("DOMContentLoaded", function () {
    $$("[data-store-name]").forEach(function (el) { el.textContent = S.name; });
    $$("[data-wa-link]").forEach(function (el) { el.href = "https://wa.me/" + S.whatsapp; });
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
    var fd = $("#faq-delivery"); if (fd) fd.textContent = S.deliveryNote;
    setupBanner();
    load();
    renderHome();
    renderBook();
    refresh();
    paintHero();
  });
})();
