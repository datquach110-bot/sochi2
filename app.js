/* Sổ Chi: ghi chi tiêu ngay lúc quét mã QR thanh toán. Dữ liệu chỉ lưu trên máy. */
(function () {
  'use strict';

  // ================= Dữ liệu =================
  const KEY = 'sochi.v1';
  const CATS = [
    { id: 'food', name: 'Ăn uống', ico: '🍜', color: '#D9822B' },
    { id: 'move', name: 'Đi lại', ico: '🛵', color: '#3A7CA5' },
    { id: 'shop', name: 'Mua sắm', ico: '🛍️', color: '#8E5BA8' },
    { id: 'home', name: 'Nhà & hóa đơn', ico: '🏠', color: '#4F6D7A' },
    { id: 'fun', name: 'Giải trí', ico: '🎮', color: '#C8505F' },
    { id: 'health', name: 'Sức khỏe', ico: '💊', color: '#2E9E7D' },
    { id: 'gift', name: 'Gia đình & quà', ico: '🎁', color: '#B5883A' },
    { id: 'other', name: 'Khác', ico: '📦', color: '#7D857F' }
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));

  function blank() {
    return { v: 1, txns: [], payees: {}, settings: { budget: 0, banks: ['mb', 'vcb', 'tcb', 'bidv', 'icb'], lastBank: '' }, awaiting: null };
  }
  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const d = JSON.parse(raw);
      const b = blank();
      return { ...b, ...d, settings: { ...b.settings, ...(d.settings || {}) } };
    } catch (e) { return blank(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { toast('Không lưu được dữ liệu. Bộ nhớ trình duyệt có thể đã đầy.'); return false; }
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ================= Tiện ích =================
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('vi-VN');
  const money = n => nf.format(Math.round(n)) + ' ₫';
  const parseAmount = s => parseInt(String(s).replace(/\D/g, ''), 10) || 0;
  const pad = n => String(n).padStart(2, '0');
  const DOW = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  const ym = d => d.getFullYear() * 12 + d.getMonth();
  const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  function dayLabel(d) {
    const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
    if (sameDay(d, t)) return 'Hôm nay';
    if (sameDay(d, y)) return 'Hôm qua';
    return DOW[d.getDay()] + ', ' + d.getDate() + '/' + (d.getMonth() + 1) + (d.getFullYear() !== t.getFullYear() ? '/' + d.getFullYear() : '');
  }
  const timeLabel = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const payeeLabel = t => t.payeeName || (t.method === 'manual' ? 'Chi tiêu' : 'Người nhận chưa đặt tên');

  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  // Chỉ tính các khoản đã trả
  const paid = () => db.txns.filter(t => t.status === 'paid');
  const inMonth = (list, y, m) => list.filter(t => { const d = new Date(t.ts); return d.getFullYear() === y && d.getMonth() === m; });
  const sum = list => list.reduce((a, t) => a + t.amount, 0);

  // ================= Điều hướng =================
  let current = 'home';
  const listState = { y: new Date().getFullYear(), m: new Date().getMonth(), cat: 'all', q: '' };

  function go(view) {
    current = view;
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    document.querySelectorAll('.tab[data-view]').forEach(b => {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    if (current === 'home') renderHome();
    else if (current === 'list') renderList();
    else renderSettings();
  }
  document.querySelectorAll('.tab[data-view]').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));

  // ================= Tổng quan =================
  function renderHome() {
    const el = $('#view-home');
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
    const all = paid();
    const month = inMonth(all, y, m);
    const pending = db.txns.filter(t => t.status === 'pending');

    if (!db.txns.length) {
      el.innerHTML = `
        <div class="view-head"><h1>Sổ Chi</h1></div>
        <div class="empty">
          <h2>Chưa có khoản chi nào</h2>
          <p>Lần tới khi trả tiền bằng mã QR, hãy quét bằng Sổ Chi. Số tiền được ghi lại, rồi app mở ngân hàng để bạn thanh toán.</p>
          <div class="btns">
            <button class="btn btn-primary" data-act="scan">Quét mã QR</button>
            <button class="btn btn-plain" data-act="manual">Thêm khoản chi tiền mặt</button>
          </div>
        </div>`;
      bindActs(el);
      return;
    }

    const spentMonth = sum(month);
    const today = month.filter(t => sameDay(new Date(t.ts), now));
    const spentToday = sum(today);
    const dim = daysIn(y, m); const dayN = now.getDate();
    const budget = db.settings.budget || 0;

    let hero;
    if (budget > 0) {
      const beforeToday = spentMonth - spentToday;
      const daysLeft = dim - dayN + 1;
      const allowToday = (budget - beforeToday) / daysLeft;
      const left = allowToday - spentToday;
      const monthLeft = budget - spentMonth;
      const over = left < 0;
      hero = `
        <p class="hero-label">${over ? 'Hôm nay đã vượt mức' : 'Hôm nay còn chi được'}</p>
        <p class="hero-amount${over ? ' over' : ''}">${money(Math.abs(left))}</p>
        <p class="hero-sub">${monthLeft >= 0
          ? `Ngân sách tháng còn ${money(monthLeft)} cho ${daysLeft} ngày.`
          : `Đã vượt ngân sách tháng ${money(-monthLeft)}.`} Hôm nay đã chi ${money(spentToday)}.</p>
        <div class="pace">
          <div class="pace-track" role="img" aria-label="Đã dùng ${Math.round(spentMonth / budget * 100)}% ngân sách, đã qua ${Math.round(dayN / dim * 100)}% tháng">
            <div class="pace-fill${spentMonth > budget ? ' over' : ''}" style="width:${Math.min(100, spentMonth / budget * 100)}%"></div>
            <div class="pace-tick" style="left:calc(${dayN / dim * 100}% - 1px)"></div>
          </div>
          <div class="pace-legend"><span class="num">${money(spentMonth)} / ${money(budget)}</span><span>Vạch dọc: hôm nay</span></div>
        </div>`;
    } else {
      hero = `
        <p class="hero-label">Đã chi tháng ${m + 1}</p>
        <p class="hero-amount">${money(spentMonth)}</p>
        <p class="hero-sub">Hôm nay đã chi ${money(spentToday)}. <button class="link" data-act="settings">Đặt ngân sách tháng</button> để biết mỗi ngày nên chi bao nhiêu.</p>`;
    }

    // So với cùng kỳ tháng trước
    const pm = m === 0 ? 11 : m - 1; const py = m === 0 ? y - 1 : y;
    const cut = Math.min(dayN, daysIn(py, pm));
    const prevSame = sum(inMonth(all, py, pm).filter(t => new Date(t.ts).getDate() <= cut));
    let compare = '';
    if (prevSame > 0) {
      const diff = spentMonth - prevSame; const pct = Math.round(diff / prevSame * 100);
      compare = `<p class="compare"><span class="delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${pct}%</span>
        <span class="muted">so với ${cut} ngày đầu tháng ${pm + 1} (${money(prevSame)})</span></p>`;
    }

    // Theo danh mục
    const byCat = CATS.map(c => ({ c, v: sum(month.filter(t => t.cat === c.id)) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const maxCat = byCat.length ? byCat[0].v : 1;
    const catHtml = byCat.length ? `<ul class="cats">${byCat.map(({ c, v }) => `
      <li><button class="cat-row" data-cat="${c.id}" aria-label="${c.name}: ${money(v)}, ${Math.round(v / spentMonth * 100)}%. Xem giao dịch">
        <span class="ico" aria-hidden="true">${c.ico}</span>
        <span class="name">${c.name} <span class="muted num" style="font-weight:400">${Math.round(v / spentMonth * 100)}%</span></span>
        <span class="amt">${money(v)}</span>
        <span class="bar"><i style="width:${v / maxCat * 100}%;background:${c.color}"></i></span>
      </button></li>`).join('')}</ul>` : `<p class="muted">Tháng này chưa có khoản chi nào đã trả.</p>`;

    // Trả nhiều nhất
    const groups = {};
    month.forEach(t => {
      const k = t.payeeKey || ('n:' + payeeLabel(t));
      const g = groups[k] || (groups[k] = { name: payeeLabel(t), cat: t.cat, n: 0, v: 0 });
      g.n++; g.v += t.amount;
    });
    const top = Object.values(groups).sort((a, b) => b.v - a.v).slice(0, 3);
    const topHtml = top.length ? `<ul class="list">${top.map(g => `
      <li><div class="tx"><span class="ico" aria-hidden="true">${(CAT[g.cat] || CAT.other).ico}</span>
        <span class="main"><span class="t1">${esc(g.name)}</span><span class="t2">${g.n} lần trong tháng</span></span>
        <span class="amt">${money(g.v)}</span></div></li>`).join('')}</ul>` : '';

    const recent = [...db.txns].sort((a, b) => b.ts - a.ts).slice(0, 5);

    el.innerHTML = `
      <div class="view-head"><h1>Tháng ${m + 1}</h1></div>
      ${pending.length ? `<button class="banner" data-act="pending"><span aria-hidden="true">⏳</span><span>${pending.length} khoản đang chờ xác nhận đã trả</span><span aria-hidden="true">›</span></button>` : ''}
      <section class="hero">${hero}${compare}</section>
      <section><h2>Theo danh mục</h2>${catHtml}</section>
      ${top.length ? `<section><h2>Trả nhiều nhất</h2>${topHtml}</section>` : ''}
      <section>
        <div class="sec-head"><h2>Gần đây</h2><button class="link" data-act="list">Xem tất cả</button></div>
        <ul class="list">${recent.map(txRow).join('')}</ul>
      </section>`;
    bindActs(el);
    el.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
      Object.assign(listState, { y, m, cat: b.dataset.cat, q: '' }); go('list');
    }));
  }

  function txRow(t) {
    const d = new Date(t.ts); const c = CAT[t.cat] || CAT.other;
    const sub = [c.name, dayLabel(d) + ' ' + timeLabel(d), t.note].filter(Boolean).join(', ');
    return `<li><button class="tx" data-tx="${t.id}">
      <span class="ico" aria-hidden="true">${c.ico}</span>
      <span class="main"><span class="t1">${esc(payeeLabel(t))}</span>
        <span class="t2">${esc(sub)}</span>
        ${t.status === 'pending' ? '<span class="tag">Chờ xác nhận</span>' : ''}</span>
      <span class="amt">${money(t.amount)}</span></button></li>`;
  }

  function bindActs(el) {
    el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'scan') openScanner();
      else if (a === 'manual') openForm({ mode: 'manual' });
      else if (a === 'settings') go('settings');
      else if (a === 'list') { const n = new Date(); Object.assign(listState, { y: n.getFullYear(), m: n.getMonth(), cat: 'all', q: '' }); go('list'); }
      else if (a === 'pending') { const p = db.txns.filter(t => t.status === 'pending').sort((a, b) => a.ts - b.ts)[0]; if (p) openConfirm(p); }
    }));
    el.querySelectorAll('[data-tx]').forEach(b => b.addEventListener('click', () => {
      const t = db.txns.find(x => x.id === b.dataset.tx); if (t) openForm({ mode: 'edit', txn: t });
    }));
  }

  // ================= Giao dịch =================
  function renderList() {
    const el = $('#view-list');
    const { y, m, cat, q } = listState;
    const now = new Date();
    const isCurrent = y === now.getFullYear() && m === now.getMonth();
    el.innerHTML = `
      <div class="view-head">
        <h1>Giao dịch</h1>
        <div class="month-nav">
          <button class="icon-btn" id="m-prev" aria-label="Tháng trước"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg></button>
          <span class="month-label num" aria-live="polite">${m + 1}/${y}</span>
          <button class="icon-btn" id="m-next" aria-label="Tháng sau" ${isCurrent ? 'disabled style="opacity:.35"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg></button>
        </div>
      </div>
      <label class="sr" for="q">Tìm giao dịch</label>
      <input id="q" class="search" type="search" placeholder="Tìm theo người nhận, ghi chú" value="${esc(q)}" autocomplete="off">
      <div class="chips" role="group" aria-label="Lọc theo danh mục">
        <button class="chip" data-f="all" aria-pressed="${cat === 'all'}">Tất cả</button>
        ${CATS.map(c => `<button class="chip" data-f="${c.id}" aria-pressed="${cat === c.id}">${c.ico} ${c.name}</button>`).join('')}
      </div>
      <div id="list-results"></div>`;

    $('#m-prev', el).addEventListener('click', () => { listState.m--; if (listState.m < 0) { listState.m = 11; listState.y--; } renderList(); });
    $('#m-next', el).addEventListener('click', () => { if (isCurrent) return; listState.m++; if (listState.m > 11) { listState.m = 0; listState.y++; } renderList(); });
    // Chỉ vẽ lại phần kết quả để bàn phím iPhone không bị đóng khi gõ
    $('#q', el).addEventListener('input', e => { listState.q = e.target.value; fillResults(); });
    el.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
      listState.cat = b.dataset.f;
      el.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', x === b));
      fillResults();
    }));
    fillResults();
  }

  function fillResults() {
    const box = $('#list-results'); if (!box) return;
    const { y, m, cat, q } = listState;
    let items = inMonth(db.txns, y, m);
    if (cat !== 'all') items = items.filter(t => t.cat === cat);
    if (q) {
      const s = q.toLowerCase();
      items = items.filter(t => (payeeLabel(t) + ' ' + (t.note || '') + ' ' + (CAT[t.cat] || CAT.other).name).toLowerCase().includes(s));
    }
    items.sort((a, b) => b.ts - a.ts);
    const paidItems = items.filter(t => t.status === 'paid');
    const days = [];
    items.forEach(t => {
      const d = new Date(t.ts); const k = d.toDateString();
      let g = days[days.length - 1];
      if (!g || g.k !== k) { g = { k, d, items: [] }; days.push(g); }
      g.items.push(t);
    });
    box.innerHTML = `
      <p class="list-total num">Đã trả ${money(sum(paidItems))}, ${paidItems.length} giao dịch${items.length > paidItems.length ? `, ${items.length - paidItems.length} đang chờ` : ''}</p>
      ${days.length ? days.map(g => `
        <div class="day">
          <div class="day-head"><span>${dayLabel(g.d)}</span><span class="num">${money(sum(g.items.filter(t => t.status === 'paid')))}</span></div>
          <ul class="list">${g.items.map(txRow).join('')}</ul>
        </div>`).join('') : `<div class="empty"><h2>Không có giao dịch</h2><p>${q || cat !== 'all' ? 'Thử bỏ bộ lọc hoặc đổi từ khóa tìm kiếm.' : 'Tháng này chưa ghi khoản chi nào.'}</p></div>`}`;
    bindActs(box);
  }

  // ================= Cài đặt =================
  function renderSettings() {
    const el = $('#view-settings');
    const s = db.settings;
    const payees = Object.entries(db.payees).sort((a, b) => (b[1].lastTs || 0) - (a[1].lastTs || 0));
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    el.innerHTML = `
      <div class="view-head"><h1>Cài đặt</h1></div>
      ${standalone ? '' : `<section><div class="warn">Để dùng như app: trong Safari bấm nút Chia sẻ, chọn "Thêm vào MH chính". Sau đó luôn mở Sổ Chi từ icon trên màn hình chính.</div></section>`}
      <section>
        <h2>Ngân sách mỗi tháng</h2>
        <div class="group">
          <form class="inline-form" id="budget-form">
            <label class="sr" for="budget">Ngân sách tháng</label>
            <input id="budget" class="input num" inputmode="numeric" placeholder="Ví dụ 8.000.000" value="${s.budget ? nf.format(s.budget) : ''}">
            <button class="btn btn-primary" type="submit">Lưu</button>
          </form>
          <p class="hint">Dùng để tính số tiền còn chi được mỗi ngày. Để trống nếu chưa muốn đặt.</p>
        </div>
      </section>
      <section>
        <h2>App ngân hàng của bạn</h2>
        <p class="muted" style="margin:0 0 var(--s3);font-size:14px">Chọn các app đã cài trên máy. App có nhãn "Tự điền" sẽ điền sẵn số tài khoản và số tiền khi mở.</p>
        <div class="group" style="padding-top:var(--s2);padding-bottom:var(--s2)">
          ${VietQR.APPS.map(a => `<label class="check-row"><input type="checkbox" data-bank="${a.id}" ${s.banks.includes(a.id) ? 'checked' : ''}><span class="grow">${a.name}</span>${a.autofill ? '<span class="pill">Tự điền</span>' : ''}</label>`).join('')}
        </div>
      </section>
      <section>
        <h2>Người nhận đã lưu</h2>
        ${payees.length ? `<ul class="list">${payees.map(([k, p]) => `<li><button class="tx" data-payee="${esc(k)}">
          <span class="ico" aria-hidden="true">${(CAT[p.cat] || CAT.other).ico}</span>
          <span class="main"><span class="t1">${esc(p.name || 'Chưa đặt tên')}</span><span class="t2">${esc(p.meta || '')}</span></span>
          <span class="amt muted" style="font-weight:400">${p.count || 0} lần</span></button></li>`).join('')}</ul>`
          : '<p class="muted">Mỗi khi quét mã của một người nhận mới, Sổ Chi nhớ tên và danh mục bạn chọn để lần sau tự điền.</p>'}
      </section>
      <section>
        <h2>Sao lưu dữ liệu</h2>
        <div class="group">
          <p class="muted" style="font-size:14px">Dữ liệu chỉ nằm trên máy này. Nên xuất bản sao lưu mỗi tháng và cất vào Tệp hoặc iCloud Drive.</p>
          <div class="btn-row" style="margin-top:var(--s3)">
            <button class="btn btn-secondary" id="exp-json">Xuất bản sao lưu</button>
            <button class="btn btn-plain" id="exp-csv">Xuất file Excel (CSV)</button>
            <button class="btn btn-plain" id="imp-json">Khôi phục từ bản sao lưu</button>
          </div>
        </div>
      </section>
      <section>
        <button class="btn btn-danger" id="wipe">Xóa toàn bộ dữ liệu</button>
        <p class="hint" style="text-align:center">${db.txns.length} giao dịch đang lưu trên máy này.</p>
      </section>`;

    $('#budget-form', el).addEventListener('submit', e => {
      e.preventDefault(); db.settings.budget = parseAmount($('#budget').value); save(); toast(db.settings.budget ? 'Đã lưu ngân sách' : 'Đã bỏ ngân sách'); renderSettings();
    });
    moneyInput($('#budget', el));
    el.querySelectorAll('[data-bank]').forEach(c => c.addEventListener('change', () => {
      const id = c.dataset.bank; const set = new Set(db.settings.banks);
      c.checked ? set.add(id) : set.delete(id);
      db.settings.banks = VietQR.APPS.map(a => a.id).filter(x => set.has(x)); save();
    }));
    el.querySelectorAll('[data-payee]').forEach(b => b.addEventListener('click', () => openPayee(b.dataset.payee)));
    $('#exp-json', el).addEventListener('click', exportJSON);
    $('#exp-csv', el).addEventListener('click', exportCSV);
    $('#imp-json', el).addEventListener('click', () => $('#import-file').click());
    $('#wipe', el).addEventListener('click', () => {
      if (confirm('Xóa toàn bộ giao dịch, người nhận và cài đặt? Không thể hoàn tác. Hãy xuất bản sao lưu trước nếu cần.')) {
        db = blank(); save(); toast('Đã xóa toàn bộ dữ liệu'); renderSettings();
      }
    });
  }

  // ================= Sheet =================
  let sheetClose = null;
  function openSheet(html, { onClose } = {}) {
    closeSheet(true);
    const root = $('#sheet-root');
    root.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div>${html}</div>`;
    const bd = root.firstElementChild; const sh = root.lastElementChild;
    const lastFocus = document.activeElement;
    requestAnimationFrame(() => { bd.classList.add('show'); sh.classList.add('show'); });
    bd.addEventListener('click', () => closeSheet());
    sh.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeSheet()));
    sheetClose = () => { if (onClose) onClose(); if (lastFocus && lastFocus.focus) lastFocus.focus(); };
    const h = sh.querySelector('h2'); if (h) { h.tabIndex = -1; setTimeout(() => h.focus({ preventScroll: true }), 50); }
    return sh;
  }
  function closeSheet(instant) {
    const root = $('#sheet-root'); if (!root.firstElementChild) return;
    const cb = sheetClose; sheetClose = null;
    if (instant) { root.innerHTML = ''; return; }
    root.firstElementChild.classList.remove('show'); root.lastElementChild.classList.remove('show');
    setTimeout(() => { root.innerHTML = ''; if (cb) cb(); }, 260);
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('#scanner').hidden) closeScanner(); else closeSheet(); }
  });

  function moneyInput(inp) {
    inp.addEventListener('input', () => {
      const v = parseAmount(inp.value); inp.value = v ? nf.format(v) : '';
    });
  }

  // ================= Form khoản chi =================
  // ctx: { mode: 'qr' | 'manual' | 'edit', q?, txn? }
  function openForm(ctx) {
    const edit = ctx.mode === 'edit'; const t = ctx.txn || {};
    const q = ctx.q || (t.qr ? VietQR.parse(t.qr) : null);
    const key = q ? q.key : t.payeeKey;
    const mem = key ? db.payees[key] : null;
    let cat = edit ? t.cat : (mem ? mem.cat : '');
    const amountLocked = !edit && q && q.amount > 0;
    const amount = edit ? t.amount : (q ? q.amount : 0);
    const name = edit ? (t.payeeName || '') : (mem ? mem.name : (q && q.merchantName && q.merchantName !== 'NA' ? q.merchantName : ''));
    const d = new Date(edit ? t.ts : Date.now());
    const dtVal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    let meta = '';
    if (q && q.type === 'vietqr') meta = `${q.bankName} ${q.account}${q.purpose ? ', nội dung: ' + q.purpose : ''}`;
    else if (q && q.type === 'merchant') meta = `Mã QR cửa hàng${q.merchantName ? ': ' + q.merchantName : ''}`;

    const title = edit ? 'Khoản chi' : (ctx.mode === 'qr' ? 'Ghi khoản chi rồi thanh toán' : 'Thêm khoản chi');
    const sh = openSheet(`
      <div class="sheet-head"><h2>${title}</h2><button class="close" data-close aria-label="Đóng">✕</button></div>
      <form id="tx-form" novalidate>
        ${q || (edit && t.method === 'qr') ? `
          <div class="recipient">
            <label for="f-name" class="muted" style="font-size:13px;font-weight:600">Người nhận</label>
            <input id="f-name" class="input" value="${esc(name)}" placeholder="Đặt tên dễ nhớ, ví dụ Phở cô Lan" autocomplete="off">
            ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
            ${mem && !edit ? `<div class="meta">Đã trả người này ${mem.count || 0} lần</div>` : ''}
          </div>
          ${q && !q.crcOk ? '<div class="warn">Mã QR này có dấu hiệu bị lỗi hoặc bị sửa. Kiểm tra kỹ người nhận trong app ngân hàng.</div>' : ''}`
        : `<label class="field"><span>Chi cho</span><input id="f-name" class="input" value="${esc(name)}" placeholder="Ví dụ Chợ, Grab, tiền điện" autocomplete="off"></label>`}
        <label class="field"><span>Số tiền</span>
          <input id="f-amount" class="input amount-input" inputmode="numeric" placeholder="0" value="${amount ? (amountLocked ? money(amount) : nf.format(amount)) : ''}" ${amountLocked ? 'readonly' : ''} aria-describedby="amt-hint">
          ${amountLocked ? '<p class="hint" id="amt-hint">Số tiền đã có sẵn trong mã QR.</p>' : '<p class="hint" id="amt-hint">Đơn vị: đồng</p>'}
        </label>
        <div class="field"><span id="cat-lbl">Danh mục</span>
          <div class="cat-grid" role="radiogroup" aria-labelledby="cat-lbl">
            ${CATS.map(c => `<button type="button" class="cat-opt" role="radio" data-c="${c.id}" aria-checked="${cat === c.id}"><b aria-hidden="true">${c.ico}</b>${c.name}</button>`).join('')}
          </div>
        </div>
        <label class="field"><span>Ghi chú (không bắt buộc)</span><input id="f-note" class="input" value="${esc(t.note || '')}" placeholder="Ví dụ ăn trưa với nhóm" autocomplete="off"></label>
        ${ctx.mode !== 'qr' ? `<label class="field"><span>Thời gian</span><input id="f-dt" class="input" type="datetime-local" value="${dtVal}"></label>` : ''}
        ${edit ? `<label class="check-row" style="margin-top:var(--s3)"><input type="checkbox" id="f-paid" ${t.status === 'paid' ? 'checked' : ''}><span class="grow">Đã thanh toán</span></label>` : ''}
        <p class="error" id="f-err" role="alert" hidden></p>
        <div class="btn-row">
          ${ctx.mode === 'qr' ? `
            <button type="submit" class="btn btn-primary" data-intent="pay">Chọn ngân hàng để thanh toán</button>
            <button type="submit" class="btn btn-plain" data-intent="paid">Đã trả cách khác, chỉ ghi lại</button>`
          : `<button type="submit" class="btn btn-primary" data-intent="save">${edit ? 'Lưu thay đổi' : 'Lưu khoản chi'}</button>`}
          ${edit && t.status === 'pending' && t.qr ? '<button type="button" class="btn btn-secondary" id="f-repay">Mở lại ngân hàng để thanh toán</button>' : ''}
          ${edit ? '<button type="button" class="btn btn-danger" id="f-del">Xóa khoản chi</button>' : ''}
        </div>
      </form>`);

    const amt = $('#f-amount', sh); if (!amountLocked) moneyInput(amt);
    sh.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.c; sh.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-checked', x === b));
    }));
    if (!edit && !amountLocked) setTimeout(() => amt.focus(), 320);

    let intent = 'save';
    sh.querySelectorAll('[data-intent]').forEach(b => b.addEventListener('click', () => { intent = b.dataset.intent; }));
    $('#tx-form', sh).addEventListener('submit', e => {
      e.preventDefault();
      const err = $('#f-err', sh);
      const v = amountLocked ? amount : parseAmount(amt.value);
      const miss = [];
      if (!v) miss.push('số tiền');
      if (!cat) miss.push('danh mục');
      if (miss.length) { err.textContent = 'Hãy nhập ' + miss.join(' và ') + '.'; err.hidden = false; return; }
      const nm = $('#f-name', sh).value.trim();
      const note = $('#f-note', sh).value.trim();
      const dtEl = $('#f-dt', sh);
      const ts = dtEl && dtEl.value ? new Date(dtEl.value).getTime() : (edit ? t.ts : Date.now());

      if (edit) {
        Object.assign(t, { amount: v, cat, payeeName: nm, note, ts, status: $('#f-paid', sh).checked ? 'paid' : 'pending' });
        rememberPayee(t, q); save(); closeSheet(); toast('Đã lưu thay đổi'); render(); return;
      }
      const txn = { id: uid(), amount: v, cat, payeeName: nm, note, ts, method: q ? 'qr' : 'manual', status: 'paid' };
      if (q) { txn.qr = q.raw; txn.payeeKey = q.key; }
      if (intent === 'pay') {
        txn.status = 'pending'; db.txns.push(txn); rememberPayee(txn, q); save();
        closeSheet(true); openBankPicker(txn, q);
      } else {
        db.txns.push(txn); rememberPayee(txn, q); save(); closeSheet(); toast('Đã ghi ' + money(v)); render();
      }
    });
    const del = $('#f-del', sh);
    if (del) del.addEventListener('click', () => {
      if (confirm('Xóa khoản chi ' + money(t.amount) + '?')) {
        db.txns = db.txns.filter(x => x.id !== t.id); if (db.awaiting && db.awaiting.id === t.id) db.awaiting = null;
        save(); closeSheet(); toast('Đã xóa khoản chi'); render();
      }
    });
    const rp = $('#f-repay', sh);
    if (rp) rp.addEventListener('click', () => { closeSheet(true); openBankPicker(t, q); });
  }

  function rememberPayee(txn, q) {
    const k = txn.payeeKey; if (!k) return;
    const p = db.payees[k] || { count: 0 };
    p.name = txn.payeeName || p.name || '';
    p.cat = txn.cat;
    if (q) p.meta = q.type === 'vietqr' ? `${q.bankName} ${q.account}` : `Cửa hàng ${q.merchantName || ''}`.trim();
    p.count = db.txns.filter(t => t.payeeKey === k).length;
    p.lastTs = Math.max(p.lastTs || 0, txn.ts);
    db.payees[k] = p;
  }

  function openPayee(k) {
    const p = db.payees[k]; if (!p) return;
    let cat = p.cat;
    const sh = openSheet(`
      <div class="sheet-head"><h2>Người nhận</h2><button class="close" data-close aria-label="Đóng">✕</button></div>
      <p class="muted" style="margin:0">${esc(p.meta || '')}</p>
      <label class="field"><span>Tên gợi nhớ</span><input id="p-name" class="input" value="${esc(p.name || '')}"></label>
      <div class="field"><span id="pc-lbl">Danh mục mặc định</span>
        <div class="cat-grid" role="radiogroup" aria-labelledby="pc-lbl">${CATS.map(c => `<button type="button" class="cat-opt" role="radio" data-c="${c.id}" aria-checked="${cat === c.id}"><b aria-hidden="true">${c.ico}</b>${c.name}</button>`).join('')}</div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="p-save">Lưu</button>
        <button class="btn btn-danger" id="p-del">Quên người nhận này</button>
      </div>`);
    sh.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { cat = b.dataset.c; sh.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-checked', x === b)); }));
    $('#p-save', sh).addEventListener('click', () => {
      p.name = $('#p-name', sh).value.trim(); p.cat = cat;
      if (confirm('Cập nhật tên này cho các giao dịch cũ của người nhận?')) db.txns.forEach(t => { if (t.payeeKey === k) t.payeeName = p.name; });
      save(); closeSheet(); toast('Đã lưu người nhận'); render();
    });
    $('#p-del', sh).addEventListener('click', () => {
      if (confirm('Sổ Chi sẽ không tự điền tên và danh mục cho người nhận này nữa. Giao dịch cũ vẫn giữ nguyên.')) { delete db.payees[k]; save(); closeSheet(); render(); }
    });
  }

  // ================= Chọn ngân hàng & thanh toán =================
  const initials = n => n.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase() || '₫';

  function openBankPicker(txn, q) {
    let ids = db.settings.banks.slice();
    if (db.settings.lastBank && ids.includes(db.settings.lastBank)) ids = [db.settings.lastBank, ...ids.filter(x => x !== db.settings.lastBank)];
    const apps = ids.map(id => VietQR.APPS.find(a => a.id === id)).filter(Boolean);
    const canFill = q && q.type === 'vietqr';
    const sh = openSheet(`
      <div class="sheet-head"><h2>Thanh toán bằng</h2><button class="close" data-close aria-label="Đóng">✕</button></div>
      <p class="muted" style="margin:0"><span class="num">${money(txn.amount)}</span> cho ${esc(payeeLabel(txn))}. Khoản này đã được ghi, đang chờ bạn xác nhận.</p>
      ${apps.length ? `<ul class="bank-list">${apps.map(a => `<li><button class="bank" data-app="${a.id}">
        <span class="logo" aria-hidden="true">${initials(a.name)}</span>
        <span><span class="b1">${a.name}</span><span class="b2">${a.autofill && canFill ? 'Tự điền người nhận và số tiền' : 'Mở app, bạn quét lại mã từ ảnh'}</span></span>
        <span class="go" aria-hidden="true">›</span></button></li>`).join('')}</ul>`
        : '<p class="warn">Bạn chưa chọn app ngân hàng nào. Vào Cài đặt để chọn.</p>'}
      <div class="btn-row"><button class="btn btn-plain" id="bp-settings">Thêm app ngân hàng khác</button></div>`);
    sh.querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', () => {
      const app = VietQR.APPS.find(a => a.id === b.dataset.app);
      db.settings.lastBank = app.id; txn.bank = app.id; save();
      if (app.autofill && canFill) launch(app, txn, q);
      else openFallback(app, txn, q);
    }));
    $('#bp-settings', sh).addEventListener('click', () => { closeSheet(); go('settings'); });
  }

  function qrDataURL(text) {
    try {
      const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
      return qr.createDataURL(8, 4);
    } catch (e) { return ''; }
  }

  function openFallback(app, txn, q) {
    const url = qrDataURL(q.raw);
    const sh = openSheet(`
      <div class="sheet-head"><h2>Mở ${esc(app.name)}</h2><button class="close" data-close aria-label="Đóng">✕</button></div>
      <p class="muted" style="margin:0">App này chưa tự điền thông tin. Lưu ảnh mã QR để quét lại trong app ngân hàng:</p>
      <ol class="steps">
        <li>Bấm "Lưu ảnh mã QR", chọn Lưu hình ảnh.</li>
        <li>Bấm "Mở ${esc(app.name)}".</li>
        <li>Trong app ngân hàng, vào Quét QR, chọn ảnh vừa lưu.</li>
      </ol>
      ${url ? `<img class="qr-img" src="${url}" alt="Mã QR thanh toán ${money(txn.amount)}">` : ''}
      <div class="btn-row">
        <button class="btn btn-secondary" id="fb-save">Lưu ảnh mã QR</button>
        ${q.type === 'vietqr' ? '<button class="btn btn-plain" id="fb-copy">Sao chép số tài khoản</button>' : ''}
        <button class="btn btn-primary" id="fb-open">Mở ${esc(app.name)}</button>
      </div>`);
    $('#fb-save', sh).addEventListener('click', async () => {
      if (!url) return toast('Không tạo được ảnh mã QR');
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'ma-qr-thanh-toan.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      toast('Nhấn giữ vào ảnh mã QR, chọn Lưu vào Ảnh');
    });
    const cp = $('#fb-copy', sh);
    if (cp) cp.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(q.account); toast('Đã chép số tài khoản ' + q.account); }
      catch (e) { toast('Không chép được. Số tài khoản: ' + q.account); }
    });
    $('#fb-open', sh).addEventListener('click', () => launch(app, txn, q));
  }

  function launch(app, txn, q) {
    db.awaiting = { id: txn.id, at: Date.now() }; save();
    closeSheet(true); render();
    const a = document.createElement('a');
    a.href = VietQR.deeplink(app.id, q, txn.amount); a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ================= Xác nhận đã trả =================
  function openConfirm(t) {
    const sh = openSheet(`
      <div class="sheet-head"><h2>Đã thanh toán xong?</h2><button class="close" data-close aria-label="Để sau">✕</button></div>
      <p class="confirm-amt">${money(t.amount)}</p>
      <p class="muted" style="margin:0">${esc(payeeLabel(t))}, ${(CAT[t.cat] || CAT.other).name}, ${dayLabel(new Date(t.ts))} ${timeLabel(new Date(t.ts))}</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="c-yes">Đã trả</button>
        <button class="btn btn-plain" id="c-later">Để sau</button>
        <button class="btn btn-danger" id="c-no">Không trả nữa, xóa khoản này</button>
      </div>`);
    const done = () => { if (db.awaiting && db.awaiting.id === t.id) db.awaiting = null; save(); closeSheet(); render(); };
    $('#c-yes', sh).addEventListener('click', () => { t.status = 'paid'; done(); toast('Đã ghi ' + money(t.amount)); });
    $('#c-later', sh).addEventListener('click', done);
    $('#c-no', sh).addEventListener('click', () => { db.txns = db.txns.filter(x => x.id !== t.id); done(); toast('Đã xóa khoản chưa trả'); });
  }

  function checkAwaiting() {
    const aw = db.awaiting; if (!aw) return;
    if (Date.now() - aw.at < 2500) return;          // vừa mới bấm mở ngân hàng
    const t = db.txns.find(x => x.id === aw.id);
    if (!t || t.status !== 'pending') { db.awaiting = null; save(); return; }
    if (!$('#sheet-root').firstElementChild && $('#scanner').hidden) openConfirm(t);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { db = load(); render(); setTimeout(checkAwaiting, 400); }
  });
  window.addEventListener('pageshow', () => setTimeout(checkAwaiting, 400));

  // ================= Máy quét QR =================
  let stream = null, raf = 0, lastMiss = 0;
  const canvas = document.createElement('canvas');
  const ctx2d = canvas.getContext('2d', { willReadFrequently: true });

  async function openScanner() {
    const sc = $('#scanner'); sc.hidden = false;
    const msg = $('#scan-msg'); msg.textContent = 'Đang mở camera…';
    $('#scan-close').focus();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      msg.textContent = 'Máy không mở được camera ở đây. Hãy chọn ảnh có mã QR.'; return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      if (sc.hidden) { stopStream(); return; }
      const v = $('#scan-video'); v.srcObject = stream; await v.play();
      msg.textContent = 'Đưa mã QR vào trong khung';
      tick();
    } catch (e) {
      msg.textContent = e && e.name === 'NotAllowedError'
        ? 'Sổ Chi chưa được dùng camera. Cho phép trong Cài đặt iPhone, hoặc chọn ảnh có mã QR.'
        : 'Không mở được camera. Hãy chọn ảnh có mã QR.';
    }
  }
  function stopStream() {
    cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    $('#scan-video').srcObject = null;
  }
  function closeScanner() { stopStream(); $('#scanner').hidden = true; }

  function tick() {
    const v = $('#scan-video');
    if (!stream) return;
    if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
      const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
      ctx2d.drawImage(v, 0, 0, canvas.width, canvas.height);
      const img = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data && handleCode(code.data, true)) return;
    }
    raf = requestAnimationFrame(tick);
  }

  function handleCode(text, live) {
    const q = VietQR.parse(text);
    if (!q || q.type === 'unknown') {
      if (Date.now() - lastMiss > 2500) {
        lastMiss = Date.now();
        $('#scan-msg').textContent = 'Đây không phải mã QR thanh toán. Thử mã khác.';
        if (!live) toast('Ảnh này không chứa mã QR thanh toán');
      }
      return false;
    }
    closeScanner();
    openForm({ mode: 'qr', q });
    return true;
  }

  $('#scan-file').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    $('#scan-msg').textContent = 'Đang đọc ảnh…';
    try {
      const url = URL.createObjectURL(f);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      let found = null;
      for (const max of [1400, 900, 600]) {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * s); canvas.height = Math.round(img.height * s);
        ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
        const d = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
        const c = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
        if (c && c.data) { found = c.data; break; }
      }
      URL.revokeObjectURL(url);
      if (!found) { $('#scan-msg').textContent = 'Không tìm thấy mã QR trong ảnh. Thử ảnh rõ hơn.'; return; }
      lastMiss = 0; handleCode(found, false);
    } catch (err) { $('#scan-msg').textContent = 'Không đọc được ảnh này.'; }
  });

  $('#scan-open').addEventListener('click', openScanner);
  $('#scan-close').addEventListener('click', closeScanner);
  $('#scan-manual').addEventListener('click', () => { closeScanner(); openForm({ mode: 'manual' }); });
  $('#manual-open').addEventListener('click', () => openForm({ mode: 'manual' }));

  // ================= Sao lưu =================
  async function shareOrDownload(name, text, type) {
    const blob = new Blob([text], { type });
    try {
      const file = new File([blob], name, { type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  function exportJSON() { shareOrDownload(`so-chi-sao-luu-${stamp()}.json`, JSON.stringify(db), 'application/json'); }
  function exportCSV() {
    const cell = v => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['Ngày', 'Giờ', 'Số tiền', 'Danh mục', 'Người nhận', 'Ghi chú', 'Trạng thái', 'Cách trả']];
    [...db.txns].sort((a, b) => a.ts - b.ts).forEach(t => {
      const d = new Date(t.ts);
      rows.push([`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, timeLabel(d), t.amount, (CAT[t.cat] || CAT.other).name,
        payeeLabel(t), t.note || '', t.status === 'paid' ? 'Đã trả' : 'Chờ xác nhận', t.method === 'qr' ? 'Mã QR' : 'Thêm tay']);
    });
    shareOrDownload(`so-chi-${stamp()}.csv`, '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n'), 'text/csv');
  }
  $('#import-file').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.txns) || typeof d.payees !== 'object') throw new Error('bad');
      if (!confirm(`Khôi phục ${d.txns.length} giao dịch từ bản sao lưu? Dữ liệu hiện tại trên máy sẽ bị thay thế.`)) return;
      const b = blank(); db = { ...b, ...d, settings: { ...b.settings, ...(d.settings || {}) }, awaiting: null };
      save(); toast('Đã khôi phục dữ liệu'); render();
    } catch (err) { toast('File này không phải bản sao lưu của Sổ Chi'); }
  });

  // ================= Khởi động =================
  render();
  setTimeout(checkAwaiting, 600);
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
