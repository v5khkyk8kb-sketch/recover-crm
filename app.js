'use strict';
/* Recover CRM — Fase 1. Modo local: datos migrados (data/seed.json) + tus cambios en este navegador (localStorage).
   Al conectar Supabase (db/schema.sql) los cambios pasan a la base compartida. */

const ETAPAS = ['Lead','Contactado','Respondió','Catálogo enviado','Oferta enviada','Cotización','Visita/Demo','Ganado','Perdido'];
const REGLAS = { // días hasta el próximo seguimiento y qué hacer (igual que db/schema.sql)
  'Contactado':[4,'Seguimiento corto: ¿pudieron ver?'], 'Respondió':[1,'Responder y mandar catálogo'],
  'Catálogo enviado':[3,'Ofrecer presupuesto o visita'], 'Oferta enviada':[3,'Llamar o proponer visita para cerrar'],
  'Cotización':[2,'Seguir la cotización'], 'Visita/Demo':[1,'Confirmar y pedir decisión'] };
const TIPOS = ['seguimiento','llamada','visita','demo','entrega','instalacion','sesion','otro'];
// Catálogo (igual que db/schema.sql). ofrecible=false = sin stock: no se cotiza.
const PRODUCTOS = [
  { c: 'PIS-BAS', n: 'Piscina circular básica', cat: 'piscina', p: 3950, cu: 1700 },
  { c: 'PIS-PRE', n: 'Piscina circular premium', cat: 'piscina', p: 4950, cu: 2250 },
  { c: 'PIS-OVA', n: 'Piscina ovalada', cat: 'piscina', p: 4990, cu: 2400 },
  { c: 'SAU-CLA', n: 'Sauna Clásico', cat: 'sauna', p: 18990, usd: 130 },
  { c: 'SAU-HEX', n: 'Sauna Hexagonal', cat: 'sauna', p: 20990, usd: 130 },
  { c: 'SAU-PRE', n: 'Sauna Premium', cat: 'sauna', p: 20990, usd: 130, sinStock: true },
  { c: 'SAU-XL', n: 'Sauna XL', cat: 'sauna', p: 22990, usd: 130, sinStock: true },
  { c: 'SES-FRIO', n: 'Sesión a domicilio: frío', cat: 'sesion', p: 1190 },
  { c: 'SES-SAU', n: 'Sesión a domicilio: sauna', cat: 'sesion', p: 1390 },
  { c: 'SES-AMB', n: 'Sesión a domicilio: frío + sauna', cat: 'sesion', p: 1990 }];
const PROD = Object.fromEntries(PRODUCTOS.map(p => [p.c, p]));
// Descuento por volumen (ventas/oferta-gimnasios.md): piscinas + saunas se suman. Tope 20%.
const descVolumen = u => u >= 6 ? 20 : u >= 4 ? 15 : u >= 2 ? 10 : 0;
const PAGOS = ['Transferencia', 'Abitab/RedPagos', 'Link Mercado Pago (con recargo)', 'POS al recibir (crédito +6%)'];
const ENTREGAS = ['Envío gratis (Mvd/Canelones/Maldonado)', 'Envío a coordinar (interior)', 'Retiro'];
const ESTADOS_VENTA = ['Falta pago', 'Para enviar', 'Enviado', 'Entregado', 'Cancelado'];
const pesos = n => '$' + Math.round(n).toLocaleString('es-UY');
function calcular(items, descManual) {
  const lineas = items.filter(i => PROD[i.c] && i.q > 0).map(i => ({ ...i, prod: PROD[i.c], sub: PROD[i.c].p * i.q }));
  const unidades = lineas.filter(l => l.prod.cat !== 'sesion').reduce((a, l) => a + l.q, 0);
  const auto = descVolumen(unidades), desc = Math.min(20, descManual != null && descManual !== '' ? +descManual : auto);
  const bruto = lineas.reduce((a, l) => a + l.sub, 0);
  const base = lineas.filter(l => l.prod.cat !== 'sesion').reduce((a, l) => a + l.sub, 0);
  const total = bruto - base * desc / 100;
  return { lineas, unidades, auto, desc, bruto, total };
}
function costoDe(items) { // UYU; saunas en USD × tipo de cambio configurado (si no hay TC, null)
  const tc = +(S.config && S.config.tc) || 0; let c = 0;
  for (const i of items) { const p = PROD[i.c]; if (!p) continue; if (p.cu) c += p.cu * i.q; else if (p.usd) { if (!tc) return null; c += p.usd * tc * i.q; } }
  return c;
}
const KEY = 'recover-crm-v1';
const $ = s => document.querySelector(s);
let seed, S; // seed = datos migrados; S = cambios locales

/* ---------- helpers ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, ''); else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const hoy = () => new Date().toISOString().slice(0, 10);
const sumar = (f, d) => { const x = new Date(f + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const ahora = () => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 2200); }
const fmtF = f => { if (!f) return ''; const [a, m, d] = f.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
const dias = f => Math.round((new Date(hoy() + 'T12:00:00') - new Date(f.slice(0, 10) + 'T12:00:00')) / 864e5);

/* ---------- datos ---------- */
// Dos modos: local (seed.json + localStorage) o Supabase (config.js con url y key). En Supabase, localStorage guarda solo filtros.
let db = null;
const CFG = window.RECOVER_CFG || {};
function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(db ? { filtros: S.filtros, segmentos: S.segmentos } : S)); } catch (e) { toast('No pude guardar en este navegador'); }
  if (db) sincronizar();
}
/* --- Supabase: se sube solo lo que cambió (tareas, mensajes, cotizaciones, ventas, config) --- */
const COLS = {
  tareas: ['empresa_id', 'tipo', 'titulo', 'detalle', 'canal', 'vence', 'hora', 'hecha', 'auto'],
  mensajes: ['empresa_id', 'canal', 'direccion', 'fecha', 'resumen'],
  cotizaciones: ['empresa_id', 'fecha', 'items', 'descuento', 'total', 'entrega', 'pago', 'nota'],
  ventas: ['empresa_id', 'fecha', 'cliente', 'telefono', 'direccion', 'ciudad', 'items', 'total', 'pago', 'entrega', 'costo', 'ganancia', 'comprobante', 'estado'] };
const VISTO = { tareas: new Map(), mensajes: new Map(), cotizaciones: new Map(), ventas: new Map() };
const aFila = (t, o) => { const r = {}; for (const c of COLS[t]) { let v = c === 'descuento' ? o.desc : o[c]; r[c] = v === '' ? null : v ?? null; } if (t === 'tareas') { r.auto = !!o.auto; if (o.hecha) r.hecha_en = o.hecha_en = o.hecha_en || new Date().toISOString(); } return r; };
let sincronizando = Promise.resolve();
function sincronizar() {
  sincronizando = sincronizando.then(async () => {
    for (const t of Object.keys(COLS)) {
      for (const o of S[t]) {
        const fila = aFila(t, o), js = JSON.stringify(fila);
        if (VISTO[t].get(String(o.id)) === js) continue;
        const nuevo = typeof o.id !== 'number';
        const { data, error } = nuevo ? await db.from(t).insert(fila).select('id').single() : await db.from(t).update(fila).eq('id', o.id);
        if (error) { toast('No se guardó en la base: ' + error.message); console.error(t, error); continue; }
        if (nuevo) { const viejo = o.id; o.id = data.id; if (t === 'cotizaciones' && location.hash.includes(viejo)) location.hash = location.hash.replace(viejo, o.id); }
        VISTO[t].set(String(o.id), js);
      }
    }
    const tc = JSON.stringify(S.config.tc ?? null);
    if (VISTO.tc !== tc) { const { error } = await db.from('config').upsert({ clave: 'tc', valor: S.config.tc ?? null }); if (!error) VISTO.tc = tc; }
  });
}
async function traerTodo(tabla, cols = '*', orden = 'id') {
  const out = [];
  for (let d = 0; ; d += 1000) {
    const { data, error } = await db.from(tabla).select(cols).order(orden).range(d, d + 999);
    if (error) throw new Error(tabla + ': ' + error.message);
    out.push(...data); if (data.length < 1000) return out;
  }
}
const sinNulos = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== false && !(Array.isArray(v) && !v.length)));
async function cargarDesdeBase() {
  $('#app').replaceChildren(h('p', { class: 'vacio' }, 'Cargando desde la base…'));
  const [empresas, tareas, mensajes, cotizaciones, ventas, config] = await Promise.all([
    traerTodo('empresas', 'id,nombre,rubro,departamento,localidad,direccion,telefono,telefono_tipo,telefonos_extra,instagram,email,emails_extra,web,google_maps,resenas,prioridad,origen,etapa,canales_usados,primer_contacto,ultimo_contacto,notas,historial_resumen,no_contactar,no_contactar_motivo,no_contactar_fecha,cliente,segmento_gabriel,sin_whatsapp,mail_invalido,etiquetas,nombres_fusionados,valor_estimado'),
    traerTodo('tareas'), traerTodo('mensajes', 'id,empresa_id,canal,direccion,fecha,resumen'), traerTodo('cotizaciones'), traerTodo('ventas'), traerTodo('config', '*', 'clave')]);
  const fecha = v => v && String(v).replace('T', ' ').slice(0, 16);
  seed = { empresas: empresas.map(e => sinNulos({ ...e, primer_contacto: fecha(e.primer_contacto), ultimo_contacto: fecha(e.ultimo_contacto) })), mensajes: [], tareas: [], etapas: [],
    informe: 'Datos desde Supabase. El informe de la migración está en crm/migracion/salida/informe.md.' };
  let loc = {}; try { loc = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  S = { patch: {}, nuevas: [], auditoria: [], filtros: loc.filtros || {}, segmentos: loc.segmentos || [],
    tareas: tareas.map(t => ({ ...t, hora: t.hora && t.hora.slice(0, 5) })), mensajes: mensajes.map(m => ({ ...m, fecha: fecha(m.fecha) })),
    cotizaciones: cotizaciones.map(c => ({ ...c, desc: +c.descuento, total: +c.total })), ventas: ventas.map(v => ({ ...v, total: +v.total, costo: v.costo == null ? null : +v.costo, ganancia: v.ganancia == null ? null : +v.ganancia })),
    config: { tc: (config.find(c => c.clave === 'tc') || {}).valor ?? null } };
  for (const t of Object.keys(COLS)) S[t].forEach(o => VISTO[t].set(String(o.id), JSON.stringify(aFila(t, o))));
  VISTO.tc = JSON.stringify(S.config.tc ?? null);
}
function pantallaLogin(msg) {
  const mail = h('input', { type: 'email', placeholder: 'tu mail', autocomplete: 'email' });
  $('#app').replaceChildren(h('h2', {}, 'Entrar'), h('div', { class: 'card' }, h('p', {}, 'Te mando un link al mail para entrar (sin contraseña). Solo funcionan los mails autorizados.'), mail,
    h('button', { onclick: async () => {
      const { error } = await db.auth.signInWithOtp({ email: mail.value.trim(), options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
      toast(error ? 'Error: ' + error.message : 'Listo, revisá tu mail y tocá el link');
    } }, 'Mandarme el link')), ...(msg ? [h('p', { class: 'vacio' }, msg)] : []));
}
function cargarLocal() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S) S = { patch: {}, nuevas: [], tareas: null, mensajes: [], auditoria: [], filtros: {}, segmentos: [] };
  if (!S.tareas) S.tareas = seed.tareas.map(t => ({ ...t, id: 's' + t.id }));
  S.cotizaciones = S.cotizaciones || []; S.ventas = S.ventas || []; S.config = S.config || {};
}
let EMP = [], POR_ID = new Map();
function armar() {
  EMP = seed.empresas.concat(S.nuevas).map(e => S.patch[e.id] ? { ...e, ...S.patch[e.id] } : e);
  POR_ID = new Map(EMP.map(e => [e.id, e]));
}
function cambiar(id, cambios, detalle) {
  const e = POR_ID.get(id); if (!e) return;
  if (db) {
    Object.assign(seed.empresas.find(x => x.id === id), cambios);
    const fila = { ...cambios, actualizado: new Date().toISOString() };
    db.from('empresas').update(fila).eq('id', id).then(({ error }) => error && toast('No se guardó en la base: ' + error.message));
    db.from('auditoria').insert({ accion: 'empresa.editar', tabla: 'empresas', registro_id: String(id), detalle: { campos: detalle || Object.keys(cambios) } }).then(() => {});
    S.auditoria.push({ cuando: ahora(), accion: 'empresa.editar', id, cambios: detalle || Object.keys(cambios) });
    return armar();
  }
  if (e.id >= 900000) Object.assign(S.nuevas.find(x => x.id === id), cambios);
  else S.patch[id] = { ...(S.patch[id] || {}), ...cambios };
  S.auditoria.push({ cuando: ahora(), accion: 'empresa.editar', id, cambios: detalle || Object.keys(cambios) });
  guardar(); armar();
}
const msgsDe = id => seed.mensajes.filter(m => m.empresa_id === id).concat(S.mensajes.filter(m => m.empresa_id === id))
  .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
function nota(id, canal, direccion, resumen) {
  S.mensajes.push({ id: 'n' + Date.now(), empresa_id: id, canal, direccion, fecha: ahora(), resumen }); guardar();
}
function tareaNueva(t) { S.tareas.push({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5), hecha: false, tipo: 'seguimiento', ...t }); guardar(); }

/* ---------- reglas de negocio ---------- */
// Bloqueo duro: a un "no contactar" no se le genera ninguna acción de contacto.
const bloqueada = e => !!e.no_contactar;

function moverEtapa(e, etapa) {
  if (etapa === 'Perdido') {
    const motivo = (prompt('Motivo de pérdida (obligatorio):') || '').trim();
    if (!motivo) return toast('Sin motivo no se puede marcar como Perdido');
    cambiar(e.id, { etapa, no_contactar: true, no_contactar_motivo: motivo, no_contactar_fecha: hoy() });
    nota(e.id, 'nota', 'interno', 'Pasó a Perdido: ' + motivo);
    return toast('Perdido guardado y bloqueado para envíos');
  }
  const c = { etapa };
  if (etapa === 'Ganado') c.cliente = true;
  cambiar(e.id, c);
  nota(e.id, 'nota', 'interno', 'Etapa: ' + etapa);
  // seguimiento automático según la etapa (reemplaza el pendiente anterior de la misma empresa)
  S.tareas.forEach(t => { if (t.empresa_id === e.id && !t.hecha && t.auto) t.hecha = true; });
  const r = REGLAS[etapa];
  if (r && !bloqueada(e) && !e.cliente) tareaNueva({ empresa_id: e.id, titulo: r[1] + ' — ' + e.nombre, vence: sumar(hoy(), r[0]), auto: true, canal: null });
  guardar();
  toast('Etapa: ' + etapa + (r && !bloqueada(e) ? ' · seguimiento en ' + r[0] + ' d' : ''));
}

/* ---------- vistas ---------- */
const VISTAS = { hoy: vHoy, contactos: vContactos, pipeline: vPipeline, tareas: vTareas, mas: vMas, empresa: vEmpresa, cotizar: vCotizar, ventas: vVentas };
function ruta() {
  const [, v = 'hoy', arg] = location.hash.split('/');
  const tab = { empresa: 'contactos', cotizar: 'contactos', ventas: 'mas' }[v] || v;
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === tab));
  const app = $('#app'); app.replaceChildren();
  (VISTAS[v] || vHoy)(app, arg); window.scrollTo(0, 0);
}
const chips = e => [
  e.no_contactar && h('span', { class: 'chip nc' }, 'No contactar'), e.cliente && h('span', { class: 'chip cli' }, 'Cliente'),
  e.segmento_gabriel && h('span', { class: 'chip gab' }, 'Gabriel'), e.prioridad && h('span', { class: 'chip' }, 'Prio ' + e.prioridad),
  h('span', { class: 'chip' }, e.etapa)];
const lugar = e => [e.localidad, e.departamento].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ');
function tarjeta(e) {
  return h('a', { class: 'card item', href: '#/empresa/' + e.id }, h('b', {}, e.nombre),
    h('small', {}, [e.rubro, lugar(e)].filter(Boolean).join(' · ')), h('div', {}, chips(e)));
}

function tareaFila(t, conEmpresa = true) {
  const e = POR_ID.get(t.empresa_id), d = t.vence ? dias(t.vence) : 0;
  return h('div', { class: 'card ' + (t.vence && d > 0 ? 'venc' : t.vence && d === 0 ? 'hoyc' : '') },
    h('div', { class: 'row' },
      h('div', { class: 'sp' }, h('b', {}, t.titulo), h('small', {}, [t.vence && fmtF(t.vence) + (d > 0 ? ` (venció hace ${d} d)` : d === 0 ? ' (hoy)' : ''), t.hora, t.tipo].filter(Boolean).join(' · '))),
      h('button', { class: 'ok', onclick: () => { t.hecha = true; guardar(); toast('Hecha'); ruta(); } }, '✓')),
    t.detalle && h('small', {}, t.detalle),
    conEmpresa && e && h('div', {}, h('a', { href: '#/empresa/' + e.id }, e.nombre), ' ', bloqueada(e) && h('span', { class: 'chip nc' }, 'No contactar')));
}

function vHoy(app) {
  const t = hoy(), pend = S.tareas.filter(x => !x.hecha).sort((a, b) => (a.vence || '9').localeCompare(b.vence || '9'));
  const venc = pend.filter(x => x.vence && x.vence < t), deHoy = pend.filter(x => x.vence === t);
  const resp = EMP.filter(e => e.etapa === 'Respondió' && !e.no_contactar);
  const nPend = EMP.filter(e => e.etapa === 'Catálogo enviado' || e.etapa === 'Oferta enviada').length;
  const vHoyL = S.ventas.filter(v => v.fecha === t && v.estado !== 'Cancelado');
  const faltaPago = S.ventas.filter(v => v.estado === 'Falta pago').length;
  app.append(h('div', { class: 'kpis' },
    kpi(venc.length, 'seguimientos vencidos'), kpi(deHoy.length, 'tareas de hoy'),
    kpi(resp.length, 'respondieron (a atender)'), kpi(nPend, 'con catálogo u oferta'),
    kpi(vHoyL.length ? pesos(vHoyL.reduce((a, v) => a + v.total, 0)) : '0', 'ventas de hoy'), kpi(faltaPago, 'ventas con falta de pago')));
  app.append(h('h2', {}, 'Vencidos'), ...(venc.length ? venc.map(x => tareaFila(x)) : [h('p', { class: 'vacio' }, 'Nada vencido 🎉')]));
  app.append(h('h2', {}, 'Hoy'), ...(deHoy.length ? deHoy.map(x => tareaFila(x)) : [h('p', { class: 'vacio' }, 'Nada para hoy')]));
  app.append(h('h2', {}, 'Respondieron — esperan respuesta'), ...resp.slice(0, 15).map(tarjeta));
  if (resp.length > 15) app.append(h('a', { href: '#/pipeline' }, `Ver las ${resp.length} en el pipeline`));
}
const kpi = (n, l) => h('div', { class: 'kpi' }, h('b', {}, n), h('small', {}, l));

/* ---- contactos ---- */
const LIM = 40;
function vContactos(app) {
  const F = S.filtros = { q: '', etapa: '', rubro: '', depto: '', prio: '', marca: '', gabriel: true, ...S.filtros };
  let pag = 1;
  const uniq = k => [...new Set(EMP.map(e => e[k]).filter(Boolean))].sort();
  const sel = (k, label, vals) => h('select', { onchange: ev => { F[k] = ev.target.value; pag = 1; lista(); } },
    h('option', { value: '' }, label), vals.map(v => h('option', { value: v, selected: F[k] === v }, v)));
  const out = h('div'), cont = h('p', { class: 'vacio' });
  const q = h('input', { type: 'search', placeholder: 'Buscar nombre, teléfono, @instagram o mail', value: F.q, oninput: ev => { F.q = ev.target.value; pag = 1; lista(); } });
  const marcas = h('select', { onchange: ev => { F.marca = ev.target.value; pag = 1; lista(); } },
    [['', 'Todas las marcas'], ['no_contactar', 'No contactar'], ['cliente', 'Clientes'], ['sin_ig_mail', 'Solo con teléfono'], ['sin_canal', 'Sin ningún canal'], ['revisar', 'A revisar (migración)']]
      .map(([v, l]) => h('option', { value: v, selected: F.marca === v }, l)));
  const gab = h('input', { type: 'checkbox', checked: F.gabriel, onchange: ev => { F.gabriel = ev.target.checked; pag = 1; lista(); } });
  app.append(h('div', { class: 'filtros' }, h('div', { class: 'full' }, q),
    sel('etapa', 'Etapa', ETAPAS), sel('prio', 'Prioridad', ['A', 'B', 'C']), sel('rubro', 'Rubro', uniq('rubro')), sel('depto', 'Departamento', uniq('departamento')),
    h('div', {}, marcas),
    h('label', { class: 'row' }, gab, 'Ocultar segmento de Gabriel')),
    h('div', { class: 'row' }, cont, h('span', { class: 'sp' }),
      h('button', { class: 'sec', onclick: guardarSegmento }, '★ Guardar filtro'), h('button', { class: 'sec', onclick: exportarCSV }, 'Excel (CSV)')),
    segmentosUI(), out);
  function filtrar() {
    const qq = F.q.trim().toLowerCase().replace(/^@/, ''), qd = qq.replace(/\D/g, '');
    return EMP.filter(e => {
      if (F.gabriel && e.segmento_gabriel) return false;
      if (F.etapa && e.etapa !== F.etapa) return false;
      if (F.prio && e.prioridad !== F.prio) return false;
      if (F.rubro && e.rubro !== F.rubro) return false;
      if (F.depto && e.departamento !== F.depto) return false;
      if (F.marca === 'no_contactar' && !e.no_contactar) return false;
      if (F.marca === 'cliente' && !e.cliente) return false;
      if (F.marca === 'sin_ig_mail' && (e.instagram || e.email || !e.telefono)) return false;
      if (F.marca === 'sin_canal' && (e.telefono || e.instagram || e.email)) return false;
      if (F.marca === 'revisar' && !(e.etiquetas || []).some(x => x.startsWith('revisar'))) return false;
      if (qq) {
        const blob = (e.nombre + ' ' + (e.instagram || '') + ' ' + (e.email || '') + ' ' + (e.nombres_fusionados || []).join(' ')).toLowerCase();
        if (!blob.includes(qq) && !(qd.length >= 4 && ((e.telefono || '').includes(qd) || (e.telefonos_extra || []).some(t => t.includes(qd))))) return false;
      }
      return true;
    });
  }
  function lista() {
    const r = filtrar().sort((a, b) => (a.prioridad || 'Z').localeCompare(b.prioridad || 'Z') || a.nombre.localeCompare(b.nombre));
    guardar(); out.replaceChildren(...r.slice(0, pag * LIM).map(tarjeta));
    cont.textContent = r.length + ' contactos';
    if (r.length > pag * LIM) out.append(h('button', { class: 'sec', onclick: () => { pag++; lista(); } }, 'Ver más'));
    lista.actual = r;
  }
  function exportarCSV() {
    const r = lista.actual || [], cols = ['nombre', 'rubro', 'departamento', 'localidad', 'telefono', 'instagram', 'email', 'web', 'prioridad', 'etapa', 'no_contactar', 'cliente', 'segmento_gabriel'];
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [cols.join(',')].concat(r.map(e => cols.map(c => esc(e[c])).join(','))).join('\n');
    const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: 'contactos-recover.csv' }); a.click();
  }
  function guardarSegmento() {
    const n = prompt('Nombre del segmento:'); if (!n) return;
    S.segmentos.push({ n, f: { ...F } }); guardar(); ruta();
  }
  lista();
}
function segmentosUI() {
  if (!S.segmentos.length) return h('span');
  return h('div', {}, S.segmentos.map((s, i) => h('span', { class: 'chip', onclick: () => { S.filtros = { ...s.f }; guardar(); ruta(); }, oncontextmenu: ev => { ev.preventDefault(); if (confirm('Borrar segmento ' + s.n + '?')) { S.segmentos.splice(i, 1); guardar(); ruta(); } } }, '★ ' + s.n)));
}

/* ---- ficha ---- */
function vEmpresa(app, id) {
  const e = POR_ID.get(+id); if (!e) return app.append(h('p', { class: 'vacio' }, 'No encontré esa empresa'));
  app.append(h('a', { href: '#/contactos' }, '← Contactos'), h('h2', {}, e.nombre), h('div', {}, chips(e)));
  if (e.no_contactar) app.append(h('div', { class: 'banner bad' }, '🚫 No contactar: ' + (e.no_contactar_motivo || 'sin motivo') + (e.no_contactar_fecha ? ' (' + e.no_contactar_fecha + ')' : ''), h('br'),
    'No se generan seguimientos ni envíos para esta empresa.'));
  if (e.segmento_gabriel && !e.cliente) app.append(h('div', { class: 'banner warn' }, 'Segmento de Gabriel (socio): no va en tu prospección.'));
  if ((e.etiquetas || []).includes('revisar-motivo')) app.append(h('div', { class: 'banner warn' }, 'Está en no-contactar sin motivo: ¿cliente cerrado o dijo que no? Corregilo abajo.'));
  const tel = e.telefono, wa = tel && tel.replace('+', '');
  const acciones = h('div', { class: 'row' },
    tel && h('a', { class: 'btn sec', href: 'tel:' + tel }, '📞 Llamar'),
    tel && e.telefono_tipo === 'movil' && !e.no_contactar && !e.sin_whatsapp && h('a', { class: 'btn', href: 'https://wa.me/' + wa, target: '_blank', rel: 'noopener' }, 'WhatsApp'),
    e.instagram && !e.no_contactar && h('a', { class: 'btn sec', href: 'https://instagram.com/' + e.instagram, target: '_blank', rel: 'noopener' }, '@' + e.instagram),
    e.email && !e.no_contactar && h('a', { class: 'btn sec', href: 'mailto:' + e.email }, '✉ Mail'));
  app.append(h('div', { class: 'card' }, acciones, e.no_contactar && h('small', {}, 'Botones de mensaje ocultos por la marca No contactar.')));

  const dato = (k, v) => v ? h('div', { class: 'dato' }, h('span', {}, k), h('span', {}, v)) : null;
  app.append(h('div', { class: 'card' }, dato('Rubro', e.rubro), dato('Lugar', lugar(e)), dato('Dirección', e.direccion), dato('Teléfono', [e.telefono, ...(e.telefonos_extra || [])].filter(Boolean).join(' · ')),
    dato('Instagram', e.instagram && '@' + e.instagram), dato('Mail', [e.email, ...(e.emails_extra || [])].filter(Boolean).join(' · ')), dato('Web', e.web),
    dato('Primer contacto', fmtF(e.primer_contacto)), dato('Último contacto', fmtF(e.ultimo_contacto)), dato('Canales usados', (e.canales_usados || []).join(', ')),
    dato('Origen', (e.origen || []).join(', ')), e.google_maps && h('div', { class: 'dato' }, h('span', {}, 'Mapa'), h('a', { href: e.google_maps, target: '_blank', rel: 'noopener' }, 'Abrir')),
    dato('Otras sedes / nombres', (e.nombres_fusionados || []).slice(0, 8).join(' · '))));

  // etapa
  const selE = h('select', { onchange: ev => { moverEtapa(e, ev.target.value); ruta(); } }, ETAPAS.map(x => h('option', { value: x, selected: x === e.etapa }, x)));
  app.append(h('h3', {}, 'Pipeline'), h('div', { class: 'card' }, selE, h('small', {}, 'Cada etapa programa su seguimiento solo. "Perdido" pide motivo.'),
    e.valor_estimado && h('div', { class: 'dato' }, h('span', {}, 'Valor estimado'), h('span', {}, pesos(e.valor_estimado))),
    h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/cotizar/' + e.id }, '🧾 Cotizar / registrar venta'))));
  const cots = S.cotizaciones.filter(c => c.empresa_id === e.id), vts = S.ventas.filter(v => v.empresa_id === e.id);
  if (cots.length || vts.length) app.append(h('h3', {}, 'Cotizaciones y ventas'),
    ...cots.slice().reverse().map(c => h('div', { class: 'card' }, h('small', {}, fmtF(c.fecha) + ' · cotización · ' + c.desc + '% off'), h('div', {}, resumenItems(c.items) + ' — ' + pesos(c.total)),
      h('div', { class: 'row' }, h('button', { class: 'sec', onclick: () => imprimir(e, c) }, 'PDF'), h('a', { class: 'btn sec', href: '#/cotizar/' + e.id + '?c=' + c.id }, 'Usar')))),
    ...vts.slice().reverse().map(v => h('div', { class: 'card' }, h('small', {}, fmtF(v.fecha) + ' · venta · ' + v.estado), h('div', {}, resumenItems(v.items) + ' — ' + pesos(v.total)))));
  // marcas
  const marca = (k, label, extra) => h('label', { class: 'row' }, h('input', { type: 'checkbox', style: 'width:auto', checked: !!e[k], onchange: ev => {
    if (k === 'no_contactar') {
      if (ev.target.checked) { const m = (prompt('Motivo (obligatorio):') || '').trim(); if (!m) { ev.target.checked = false; return; }
        cambiar(e.id, { no_contactar: true, no_contactar_motivo: m, no_contactar_fecha: hoy(), etiquetas: (e.etiquetas || []).filter(x => x !== 'revisar-motivo') });
        S.tareas.forEach(t => { if (t.empresa_id === e.id && !t.hecha) t.hecha = true; }); guardar(); }
      else cambiar(e.id, { no_contactar: false, no_contactar_motivo: null });
    } else cambiar(e.id, { [k]: ev.target.checked });
    ruta(); } }), label);
  app.append(h('h3', {}, 'Marcas'), h('div', { class: 'card' }, marca('no_contactar', 'No contactar'), marca('cliente', 'Cliente'), marca('segmento_gabriel', 'Segmento de Gabriel')));
  // notas
  const ta = h('textarea', { rows: 3, placeholder: 'Notas de la empresa' }, e.notas || '');
  app.append(h('h3', {}, 'Notas'), h('div', { class: 'card' }, ta, h('button', { class: 'sec', onclick: () => { cambiar(e.id, { notas: ta.value }); toast('Guardado'); } }, 'Guardar notas')));
  // tareas
  const mias = S.tareas.filter(t => t.empresa_id === e.id && !t.hecha);
  const tt = h('input', { placeholder: 'Nueva tarea (ej: llamar)' }), tf = h('input', { type: 'date', value: sumar(hoy(), 1) }), ty = h('select', {}, TIPOS.map(x => h('option', { value: x }, x)));
  app.append(h('h3', {}, 'Tareas y agenda'), ...mias.map(t => tareaFila(t, false)), h('div', { class: 'card' }, tt, h('div', { class: 'row' }, tf, ty),
    h('button', { onclick: () => { if (!tt.value.trim()) return; if (bloqueada(e) && ['seguimiento', 'llamada'].includes(ty.value)) return toast('Está en No contactar: no se agendan contactos'); tareaNueva({ empresa_id: e.id, titulo: tt.value.trim(), vence: tf.value, tipo: ty.value }); ruta(); } }, 'Agregar')));
  // historial
  const rn = h('input', { placeholder: 'Anotar algo (llamada, charla, etc.)' }), rc = h('select', {}, ['telefono', 'whatsapp', 'instagram', 'mail', 'nota'].map(x => h('option', { value: x }, x)));
  app.append(h('h3', {}, 'Historial'), h('div', { class: 'card' }, h('div', { class: 'row' }, rc, rn), h('button', { class: 'sec', onclick: () => { if (rn.value.trim()) { nota(e.id, rc.value, 'interno', rn.value.trim()); cambiar(e.id, { ultimo_contacto: ahora() }); ruta(); } } }, 'Agregar al historial')),
    ...msgsDe(e.id).map(m => h('div', { class: 'card' }, h('small', {}, [fmtF(m.fecha), m.canal, m.direccion === 'out' ? '→ enviado' : m.direccion === 'in' ? '← recibido' : 'nota'].join(' · ')), h('div', {}, m.resumen || ''))),
    e.historial_resumen && h('div', { class: 'card' }, h('small', {}, 'Resumen del CRM anterior'), h('div', {}, e.historial_resumen)));
}

/* ---- pipeline ---- */
function vPipeline(app) {
  app.append(h('h2', {}, 'Pipeline'), h('small', {}, 'Los Leads no se muestran acá (están en Contactos). Tocá una tarjeta para mover de etapa.'));
  const k = h('div', { class: 'kanban' });
  ETAPAS.filter(x => x !== 'Lead').forEach(et => {
    const l = EMP.filter(e => e.etapa === et && !(e.segmento_gabriel && S.filtros.gabriel !== false)).sort((a, b) => (b.ultimo_contacto || '').localeCompare(a.ultimo_contacto || ''));
    const col = h('div', { class: 'col' }, h('h4', {}, et, h('span', {}, l.length)));
    l.slice(0, 25).forEach(e => col.append(h('div', { class: 'card' }, h('a', { class: 'item', href: '#/empresa/' + e.id }, h('b', {}, e.nombre), h('small', {}, [e.rubro, e.ultimo_contacto && 'últ. ' + fmtF(e.ultimo_contacto)].filter(Boolean).join(' · '))),
      !['Ganado', 'Perdido'].includes(et) && h('div', { class: 'row' },
        h('button', { class: 'sec', onclick: () => { const i = ETAPAS.indexOf(et); moverEtapa(e, ETAPAS[i + 1]); ruta(); } }, '→ ' + ETAPAS[ETAPAS.indexOf(et) + 1])))));
    if (l.length > 25) col.append(h('small', {}, `+ ${l.length - 25} más (buscalos en Contactos filtrando por etapa)`));
    k.append(col);
  });
  app.append(k);
}

/* ---- cotizador y ventas ---- */
const resumenItems = items => items.filter(i => PROD[i.c]).map(i => i.q + '× ' + PROD[i.c].n).join(', ');
function textoCotizacion(e, c) {
  const r = calcular(c.items, c.desc);
  return [`Hola! Te paso el presupuesto de Recover para ${e.nombre}:`, '',
    ...r.lineas.map(l => `• ${l.q} × ${l.prod.n}: ${pesos(l.prod.p)} c/u`),
    '', r.desc ? `Subtotal: ${pesos(r.bruto)}\nDescuento por volumen ${r.desc}%: -${pesos(r.bruto - r.total)}` : null,
    `Total: ${pesos(r.total)}`, c.entrega ? 'Entrega: ' + c.entrega : null, c.pago ? 'Pago: ' + c.pago : null,
    c.nota || null, '', '¿Te lo confirmo así?'].filter(x => x !== null).join('\n');
}
function imprimir(e, c) {
  const r = calcular(c.items, c.desc), w = window.open('', '_blank'); if (!w) return toast('Permití las ventanas emergentes para el PDF');
  const fila = l => `<tr><td>${l.q}</td><td>${l.prod.n}</td><td>${pesos(l.prod.p)}</td><td>${pesos(l.sub)}</td></tr>`;
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Presupuesto Recover - ${e.nombre}</title>
<style>body{font:14px system-ui,sans-serif;margin:40px;color:#14212b}h1{color:#0b3a5b;margin:0}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border-bottom:1px solid #dbe4ec;padding:8px;text-align:left}.t{font-size:18px;font-weight:700}small{color:#64748b}</style>
<h1>Recover</h1><small>Ice baths y saunas para recuperación</small><h2>Presupuesto</h2>
<p><b>${e.nombre}</b><br>${fmtF(c.fecha)}</p><table><tr><th>Cant.</th><th>Producto</th><th>Precio</th><th>Subtotal</th></tr>${r.lineas.map(fila).join('')}</table>
${r.desc ? `<p>Subtotal: ${pesos(r.bruto)}<br>Descuento por volumen (${r.desc}%): -${pesos(r.bruto - r.total)}</p>` : ''}
<p class="t">Total: ${pesos(r.total)}</p><p>${c.entrega ? 'Entrega: ' + c.entrega + '<br>' : ''}${c.pago ? 'Pago: ' + c.pago : ''}</p>${c.nota ? `<p>${c.nota}</p>` : ''}
<small>Precios en pesos uruguayos. Presupuesto válido por 7 días, sujeto a stock.</small><script>print()<\/script>`);
  w.document.close();
}
function vCotizar(app, arg) {
  const [id, qs] = (arg || '').split('?'), e = POR_ID.get(+id);
  if (!e) return app.append(h('p', { class: 'vacio' }, 'No encontré esa empresa'));
  const previa = qs && S.cotizaciones.find(c => String(c.id) === new URLSearchParams(qs).get('c'));
  const C = previa ? JSON.parse(JSON.stringify(previa)) : { items: [{ c: 'PIS-PRE', q: 1 }], desc: '', entrega: ENTREGAS[0], pago: PAGOS[0], nota: '' };
  app.append(h('a', { href: '#/empresa/' + e.id }, '← ' + e.nombre), h('h2', {}, 'Cotizar'));
  if (e.no_contactar) app.append(h('div', { class: 'banner bad' }, '🚫 Está en No contactar (' + (e.no_contactar_motivo || 'sin motivo') + '). Podés registrar una venta si te escribió él, pero no se envía nada desde acá.'));
  const lineas = h('div'), res = h('div', { class: 'card' }), descI = h('input', { type: 'number', min: 0, max: 20, placeholder: 'auto', value: C.desc, oninput: ev => { C.desc = ev.target.value; pintar(); } });
  const selF = (vals, k) => h('select', { onchange: ev => { C[k] = ev.target.value; pintar(); } }, vals.map(v => h('option', { value: v, selected: C[k] === v }, v)));
  const notaI = h('input', { placeholder: 'Nota (opcional)', value: C.nota, oninput: ev => { C.nota = ev.target.value; pintar(); } });
  function pintarLineas() {
    lineas.replaceChildren(...C.items.map((it, i) => h('div', { class: 'row' },
      h('select', { class: 'sp', onchange: ev => { it.c = ev.target.value; pintar(); } }, PRODUCTOS.filter(p => !p.sinStock || p.c === it.c).map(p => h('option', { value: p.c, selected: p.c === it.c }, p.n + ' — ' + pesos(p.p)))),
      h('input', { type: 'number', min: 1, value: it.q, style: 'width:70px', oninput: ev => { it.q = Math.max(0, +ev.target.value || 0); pintar(); } }),
      h('button', { class: 'sec', onclick: () => { C.items.splice(i, 1); pintarLineas(); pintar(); } }, '✕'))),
      h('button', { class: 'sec', onclick: () => { C.items.push({ c: 'PIS-PRE', q: 1 }); pintarLineas(); pintar(); } }, '+ Producto'));
  }
  function pintar() {
    const r = calcular(C.items, C.desc), txt = textoCotizacion(e, C), wa = e.telefono && e.telefono.replace('+', '');
    descI.placeholder = 'auto: ' + r.auto + '%';
    res.replaceChildren(
      h('div', { class: 'dato' }, h('span', {}, 'Unidades (piscinas + saunas)'), h('span', {}, r.unidades)),
      h('div', { class: 'dato' }, h('span', {}, 'Subtotal'), h('span', {}, pesos(r.bruto))),
      h('div', { class: 'dato' }, h('span', {}, 'Descuento'), h('span', {}, r.desc + '%' + (r.desc !== r.auto ? ' (manual; volumen daría ' + r.auto + '%)' : ''))),
      h('div', { class: 'dato' }, h('span', {}, h('b', {}, 'Total')), h('span', {}, h('b', {}, pesos(r.total)))),
      h('pre', {}, txt),
      h('div', { class: 'row' },
        h('button', { class: 'sec', onclick: async () => { try { await navigator.clipboard.writeText(txt); toast('Copiado'); } catch (_) { toast('No pude copiar'); } } }, 'Copiar texto'),
        wa && !e.no_contactar && !e.sin_whatsapp && h('a', { class: 'btn sec', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(txt) }, 'WhatsApp'),
        h('button', { class: 'sec', onclick: () => imprimir(e, { ...C, fecha: hoy() }) }, 'PDF')),
      h('div', { class: 'row' },
        h('button', { onclick: () => {
          if (!r.lineas.length) return toast('Agregá al menos un producto');
          S.cotizaciones.push({ id: 'c' + Date.now(), empresa_id: e.id, fecha: hoy(), ...JSON.parse(JSON.stringify(C)), desc: r.desc, total: r.total }); guardar();
          cambiar(e.id, { valor_estimado: r.total }); nota(e.id, 'nota', 'interno', 'Cotización: ' + resumenItems(C.items) + ' — ' + pesos(r.total));
          if (ETAPAS.indexOf(e.etapa) < ETAPAS.indexOf('Cotización')) moverEtapa(POR_ID.get(e.id), 'Cotización');
          toast('Cotización guardada'); location.hash = '#/empresa/' + e.id; } }, 'Guardar cotización'),
        h('button', { class: 'ok', onclick: () => registrarVenta(e, C, r) }, 'Registrar venta')));
  }
  app.append(h('h3', {}, 'Productos'), h('div', { class: 'card' }, lineas, h('small', {}, 'Saunas Premium y XL sin stock: no aparecen.')),
    h('h3', {}, 'Condiciones'), h('div', { class: 'card' },
      h('label', {}, 'Descuento % (vacío = automático por volumen, tope 20%)'), descI,
      h('label', {}, 'Entrega'), selF(ENTREGAS, 'entrega'), h('label', {}, 'Forma de pago'), selF(PAGOS, 'pago'), notaI),
    h('h3', {}, 'Resultado'), res);
  pintarLineas(); pintar();
}
function registrarVenta(e, C, r) {
  if (!r.lineas.length) return toast('Agregá al menos un producto');
  const dir = prompt('Dirección de entrega (o "retiro"):', e.direccion || ''); if (dir === null) return;
  const ciudad = prompt('Ciudad:', e.localidad || e.departamento || ''); if (ciudad === null) return;
  const total = +(prompt('Total cobrado (pesos):', Math.round(r.total)) || r.total);
  const costo = costoDe(C.items);
  S.ventas.push({ id: 'v' + Date.now(), empresa_id: e.id, fecha: hoy(), cliente: e.nombre, telefono: e.telefono || '', direccion: dir, ciudad,
    items: JSON.parse(JSON.stringify(C.items.filter(i => PROD[i.c] && i.q > 0))), total, pago: C.pago, entrega: C.entrega,
    costo, ganancia: costo == null ? null : total - costo, comprobante: '', estado: 'Falta pago' });
  guardar();
  nota(e.id, 'nota', 'interno', 'Venta: ' + resumenItems(C.items) + ' — ' + pesos(total));
  moverEtapa(POR_ID.get(e.id), 'Ganado');
  location.hash = '#/ventas';
}
function vVentas(app) {
  app.append(h('a', { href: '#/mas' }, '← Más'), h('h2', {}, 'Ventas'));
  const mes = hoy().slice(0, 7), act = S.ventas.filter(v => v.estado !== 'Cancelado');
  const delMes = act.filter(v => v.fecha.startsWith(mes)), gan = delMes.filter(v => v.ganancia != null);
  app.append(h('div', { class: 'kpis' }, kpi(pesos(delMes.reduce((a, v) => a + v.total, 0)), 'vendido este mes'), kpi(delMes.length, 'ventas este mes'),
    kpi(gan.length ? pesos(gan.reduce((a, v) => a + v.ganancia, 0)) : '—', 'ganancia del mes' + (S.config.tc ? '' : ' (cargá el tipo de cambio)')),
    kpi(S.ventas.filter(v => v.estado === 'Falta pago').length, 'falta pago')));
  app.append(h('div', { class: 'row' }, h('button', { class: 'sec', onclick: exportarVentas }, 'Excel (CSV) — formato planilla del bot')));
  if (!S.ventas.length) app.append(h('p', { class: 'vacio' }, 'Todavía no hay ventas. Se registran desde la ficha → Cotizar.'));
  S.ventas.slice().reverse().forEach(v => app.append(h('div', { class: 'card' },
    h('div', { class: 'row' }, h('div', { class: 'sp' }, h('b', {}, v.cliente), h('small', {}, [fmtF(v.fecha), v.ciudad, v.pago].filter(Boolean).join(' · '))), h('b', {}, pesos(v.total))),
    h('small', {}, resumenItems(v.items) + (v.ganancia != null ? ' · ganancia ' + pesos(v.ganancia) : '')),
    h('div', { class: 'row' }, h('select', { onchange: ev => { v.estado = ev.target.value; guardar(); toast('Estado: ' + v.estado); } }, ESTADOS_VENTA.map(x => h('option', { value: x, selected: x === v.estado }, x))),
      h('input', { placeholder: 'Comprobante (nº o link)', value: v.comprobante || '', onchange: ev => { v.comprobante = ev.target.value; guardar(); } })),
    h('a', { href: '#/empresa/' + v.empresa_id }, 'Ver ficha'))));
}
function exportarVentas() {
  const cols = ['Fecha', 'Cliente', 'Teléfono', 'Dirección', 'Ciudad', 'Productos', 'Cantidad', 'Total cobrado', 'Forma de pago', 'Forma de entrega', 'Costo', 'Ganancia', 'Comprobante', 'Estado'];
  const esc = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';
  const filas = S.ventas.map(v => [fmtF(v.fecha), v.cliente, v.telefono, v.direccion, v.ciudad, resumenItems(v.items), v.items.reduce((a, i) => a + i.q, 0), Math.round(v.total), v.pago, v.entrega,
    v.costo == null ? '' : Math.round(v.costo), v.ganancia == null ? '' : Math.round(v.ganancia), v.comprobante, v.estado].map(esc).join(','));
  h('a', { href: URL.createObjectURL(new Blob(['﻿' + [cols.join(',')].concat(filas).join('\n')], { type: 'text/csv' })), download: 'ventas-recover.csv' }).click();
}

/* ---- tareas / calendario ---- */
function vTareas(app, arg) {
  const pend = S.tareas.filter(t => !t.hecha).sort((a, b) => (a.vence || '9').localeCompare(b.vence || '9') || (a.hora || '').localeCompare(b.hora || ''));
  app.append(h('div', { class: 'row' }, h('h2', { class: 'sp' }, 'Agenda'),
    h('a', { class: 'btn ' + (arg ? 'sec' : ''), href: '#/tareas' }, 'Lista'), h('a', { class: 'btn ' + (arg ? '' : 'sec'), href: '#/tareas/' + hoy().slice(0, 7) }, 'Mes')));
  if (arg) return vMes(app, arg, pend);
  if (!pend.length) app.append(h('p', { class: 'vacio' }, 'Sin tareas pendientes'));
  let ult = null;
  pend.forEach(t => { const g = !t.vence ? 'Sin fecha' : t.vence < hoy() ? 'Vencidas' : t.vence === hoy() ? 'Hoy' : fmtF(t.vence);
    if (g !== ult) { app.append(h('h3', {}, g)); ult = g; } app.append(tareaFila(t)); });
  const hechas = S.tareas.filter(t => t.hecha).length;
  if (hechas) app.append(h('p', { class: 'vacio' }, hechas + ' tareas hechas'));
}
function vMes(app, arg, pend) {
  const [ym, diaSel] = arg.split('-').length === 3 ? [arg.slice(0, 7), arg] : [arg, null];
  const [a, m] = ym.split('-').map(Number), p = n => String(n).padStart(2, '0');
  const mov = d => { const x = new Date(a, m - 1 + d, 1); return x.getFullYear() + '-' + p(x.getMonth() + 1); };
  const nombre = new Date(a, m - 1, 1).toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });
  const porDia = {}; pend.forEach(t => { if (t.vence && t.vence.startsWith(ym)) (porDia[t.vence] = porDia[t.vence] || []).push(t); });
  S.ventas.forEach(v => { if (v.fecha.startsWith(ym)) (porDia['v' + v.fecha] = porDia['v' + v.fecha] || []).push(v); });
  app.append(h('div', { class: 'row' }, h('a', { class: 'btn sec', href: '#/tareas/' + mov(-1) }, '‹'), h('b', { class: 'sp', style: 'text-align:center' }, nombre), h('a', { class: 'btn sec', href: '#/tareas/' + mov(1) }, '›')));
  const grid = h('div', { class: 'mes' }, ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => h('small', {}, d)));
  const off = (new Date(a, m - 1, 1).getDay() + 6) % 7, nd = new Date(a, m, 0).getDate();
  for (let i = 0; i < off; i++) grid.append(h('span'));
  for (let d = 1; d <= nd; d++) {
    const f = `${ym}-${p(d)}`, n = (porDia[f] || []).length, v = (porDia['v' + f] || []).length;
    grid.append(h('a', { href: '#/tareas/' + f, class: 'dia' + (f === hoy() ? ' hoy' : '') + (f === diaSel ? ' sel' : '') + (n && f < hoy() ? ' venc' : '') },
      h('b', {}, d), n ? h('small', {}, n + ' tar.') : null, v ? h('small', { class: 'vta' }, v + ' vta.') : null));
  }
  app.append(grid);
  if (diaSel) {
    app.append(h('h3', {}, fmtF(diaSel)));
    const l = porDia[diaSel] || [], vs = porDia['v' + diaSel] || [];
    if (!l.length && !vs.length) app.append(h('p', { class: 'vacio' }, 'Nada ese día'));
    l.forEach(t => app.append(tareaFila(t)));
    vs.forEach(v => app.append(h('div', { class: 'card' }, h('b', {}, 'Venta: ' + v.cliente), h('small', {}, resumenItems(v.items) + ' — ' + pesos(v.total) + ' · ' + v.estado))));
  }
}

/* ---- más ---- */
function vMas(app) {
  const tc = h('input', { type: 'number', placeholder: 'ej: 40', value: S.config.tc || '', onchange: ev => { S.config.tc = +ev.target.value || null; guardar(); toast('Tipo de cambio guardado'); } });
  app.append(h('h2', {}, 'Ventas'), h('div', { class: 'card' }, h('a', { class: 'btn', href: '#/ventas' }, 'Ver ventas (' + S.ventas.length + ')'),
    h('label', {}, 'Tipo de cambio USD → pesos (para costo y ganancia de saunas)'), tc));
  app.append(h('h2', {}, 'Informe de migración'), h('div', { class: 'card' }, h('pre', {}, seed.informe)));
  app.append(h('h2', {}, 'Registro de actividad'), h('div', { class: 'card' }, S.auditoria.length ? S.auditoria.slice(-25).reverse().map(a => h('div', {}, h('small', {}, a.cuando + ' · ' + a.accion + ' #' + a.id + ' · ' + a.cambios.join(', ')))) : h('small', {}, 'Todavía no hiciste cambios.')));
  app.append(h('h2', {}, 'Datos'), h('div', { class: 'card' }, h('p', {}, 'Modo local: tus cambios se guardan solo en este navegador. Para usarlo desde el celular y con ayudante hay que conectar la base (Supabase).'),
    h('button', { class: 'bad', onclick: () => { if (confirm('Esto borra TUS cambios locales y vuelve a los datos migrados. ¿Seguro?')) { localStorage.removeItem(KEY); location.reload(); } } }, 'Borrar mis cambios locales')));
}

/* ---------- arranque ---------- */
(async function () {
  if (CFG.url && CFG.key && window.supabase) {
    db = window.supabase.createClient(CFG.url, CFG.key);
    const { data: { session } } = await db.auth.getSession();
    if (!session) return pantallaLogin();
    try { await cargarDesdeBase(); }
    catch (e) { return pantallaLogin('No pude leer la base (' + e.message + '). ¿Tu mail está en la tabla "permitidos"?'); }
    if (!seed.empresas.length) return pantallaLogin('Entraste como ' + session.user.email + ' pero no veo datos: o ese mail no está autorizado, o falta cargar db/datos/*.sql.');
    armar();
    $('#sub').textContent = EMP.length.toLocaleString('es-UY') + ' empresas · ' + session.user.email;
  } else {
    try { seed = await (await fetch('data/seed.json')).json(); }
    catch (e) { $('#app').textContent = 'No pude cargar data/seed.json. Corré build_seed.py (ver LEEME).'; return; }
    cargarLocal(); armar();
    $('#sub').textContent = EMP.length.toLocaleString('es-UY') + ' empresas · modo local';
  }
  window.addEventListener('hashchange', ruta); ruta();
})();
