'use strict';
/* Capa de interfaz: íconos vectoriales, tema claro/oscuro, buscador rápido (Cmd/Ctrl+K), saludo y componentes comunes.
   Se carga después de app.js y antes de secciones.js. Sin dependencias. */

const ICONOS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  sparkles: '<path d="M12 3l1.9 4.6 4.6 1.9-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  message: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.2.7 3.5 2.6 3.5 5.7"/>',
  kanban: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M12 7v10M16 7v4"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v.01M18 14.5v.01"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v3M16 3v3m-7 8 2 2 4-4"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5v.01"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  tiktok: '<path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.4 2.4 2 4 4.5 4.2"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  next: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  logout: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  download: '<path d="M12 4v11m-4-4 4 4 4-4M5 20h14"/>',
  link: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>'
};
function ico(nombre, tam = 20, extra = '') {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="ico ${extra}">${ICONOS[nombre] || ''}</svg>`, 'image/svg+xml');
  return document.importNode(doc.documentElement, true);
}
const volver = (href, texto) => h('a', { class: 'volver', href }, ico('back', 16), ' ', texto);
const vacio = (texto, icono = 'inbox', accion) => h('div', { class: 'vacio' }, ico(icono, 28), h('p', {}, texto), accion || null);
function esqueleto(n = 4) { return h('div', { class: 'esq', 'aria-busy': 'true', role: 'status', 'aria-label': 'Cargando' }, [...Array(n)].map(() => h('div', { class: 'esq-b' }))); }
const saludo = () => { const hh = new Date().getHours(); return hh < 12 ? 'Buen día' : hh < 20 ? 'Buenas tardes' : 'Buenas noches'; };
const fechaLarga = () => new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' });

/* ---------- tema claro / oscuro (sigue al sistema hasta que lo cambies) ---------- */
const TEMA_KEY = 'recover-tema';
function temaActual() { const t = document.documentElement.dataset.theme; return t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function aplicarTema(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = temaActual() === 'dark' ? '#0b3a5b' : '#0b3a5b';
}
try { aplicarTema(localStorage.getItem(TEMA_KEY)); } catch (e) {}
function alternarTema() { const n = temaActual() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(TEMA_KEY, n); } catch (e) {} aplicarTema(n); pintarPie(); }
function pintarPie() {
  const p = document.getElementById('pie-acciones'); if (!p) return;
  const oscuro = temaActual() === 'dark';
  p.replaceChildren(
    h('button', { class: 'sec', onclick: alternarTema, 'aria-label': oscuro ? 'Pasar a tema claro' : 'Pasar a tema oscuro' }, ico(oscuro ? 'sun' : 'moon', 18), oscuro ? ' Tema claro' : ' Tema oscuro'));
}

/* ---------- buscador rápido: Cmd/Ctrl+K o "/" ---------- */
let paletaAbierta = false;
function abrirPaleta() {
  if (paletaAbierta) return; paletaAbierta = true;
  const previo = document.activeElement;
  const entrada = h('input', { type: 'search', placeholder: 'Buscar cliente, teléfono, @instagram o sección…', 'aria-label': 'Buscar', autocomplete: 'off' });
  const lista = h('div', { class: 'pal-lista', role: 'listbox' });
  const velo = h('div', { class: 'pal-velo' }), caja = h('div', { class: 'pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Buscador' }, entrada, lista);
  const cont = h('div', { class: 'pal-cont' }, velo, caja); document.body.append(cont);
  let items = [], sel = 0;
  const cerrar = () => { cont.remove(); paletaAbierta = false; previo && previo.focus && previo.focus(); document.removeEventListener('keydown', teclas, true); };
  const ir = it => { cerrar(); location.hash = it.href; };
  function pintar() {
    const q = entrada.value.trim().toLowerCase().replace(/^@/, ''), qd = q.replace(/\D/g, '');
    const secs = (window.MENU || []).flatMap(([, l]) => l).map(([k, i, n]) => ({ t: n, s: 'Sección', i, href: '#/' + k })).filter(x => !q || x.t.toLowerCase().includes(q));
    const emps = q.length < 2 ? [] : EMP.filter(e => (e.nombre + ' ' + (e.instagram || '') + ' ' + (e.email || '')).toLowerCase().includes(q) || (qd.length >= 4 && (e.telefono || '').includes(qd))).slice(0, 8).map(e => ({ t: e.nombre, s: [e.etapa, e.rubro, lugar(e)].filter(Boolean).join(' · '), i: 'users', href: '#/empresa/' + e.id }));
    items = emps.concat(secs.slice(0, 7)); sel = Math.min(sel, Math.max(0, items.length - 1));
    lista.replaceChildren(...(items.length ? items.map((it, i) => h('a', { href: it.href, role: 'option', 'aria-selected': String(i === sel), class: 'pal-it' + (i === sel ? ' on' : ''), onclick: ev => { ev.preventDefault(); ir(it); } }, ico(it.i, 18), h('span', { class: 'sp' }, h('b', {}, it.t), h('small', {}, it.s)))) : [h('p', { class: 'vacio' }, 'Sin resultados')]));
  }
  function teclas(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); cerrar(); }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(items.length - 1, sel + 1); pintar(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); pintar(); }
    else if (ev.key === 'Enter' && items[sel]) { ev.preventDefault(); ir(items[sel]); }
  }
  document.addEventListener('keydown', teclas, true); velo.addEventListener('click', cerrar); entrada.addEventListener('input', () => { sel = 0; pintar(); });
  pintar(); entrada.focus();
}
document.addEventListener('keydown', ev => {
  const enCampo = /input|textarea|select/i.test((ev.target || {}).tagName || '');
  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); abrirPaleta(); }
  else if (ev.key === '/' && !enCampo && !paletaAbierta) { ev.preventDefault(); abrirPaleta(); }
  else if (ev.key === 'Escape' && typeof cerrarMenu === 'function') cerrarMenu();
});

/* app instalable: registra el service worker solo en https o localhost */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
