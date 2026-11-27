'use strict';
/* Secciones del menú lateral: Claudio (avisos y ramas), Bandeja (WhatsApp·Instagram·Facebook·TikTok), Mails, Meta Ads, Instagram.
   Usa las funciones de app.js (h, S, EMP, POR_ID, nota, cambiar, tareaFila, ...). Se carga DESPUÉS de app.js.
   Qué es real hoy: todo lo que sale del historial migrado y de lo que cargues en el CRM.
   Qué todavía NO está conectado en vivo: recibir/mandar mensajes solos, Meta Ads, TikTok, Facebook (Fase 2/3/5). */

const CANALES = { whatsapp: ['WhatsApp', 'message'], instagram: ['Instagram', 'instagram'], facebook: ['Facebook', 'facebook'], tiktok: ['TikTok', 'tiktok'], mail: ['Mail', 'mail'], telefono: ['Llamada', 'phone'], nota: ['Nota', 'sliders'] };
const icCanal = k => h('span', { class: 'canal-ic canal-' + k }, ico((CANALES[k] || [0, 'message'])[1], 16));
const EN_VIVO = {}; // ningún canal está conectado en vivo todavía
const CL = () => (S.claudio = S.claudio || { nombre: 'Claudio', res: {}, prio: {} });
const todosMsgs = () => (seed.mensajes || []).concat(S.mensajes || []);
const ENTRANTE = /respondi|pidi[óo]|dijo|contest|^["“']|me pas|lo pas[óo] a|escribi[óo]/i;
const dirEf = m => m.direccion === 'in' ? 'in' : m.direccion === 'interno' ? 'int' : ENTRANTE.test(m.resumen || '') ? 'in' : 'out';
// "pidió catálogo -> catálogo enviado": ya se le respondió, no cuenta como pendiente (salvo que diga PENDIENTE)
const atendido = m => /->.*(enviad|ofrec[ií]|pregunt[eé]|ped[ií]|dije|recontactar)/i.test(m.resumen || '') && !/PENDIENTE/.test(m.resumen || '');
const infer = m => m.direccion === 'out' && dirEf(m) === 'in';
const textoSinRaya = t => t.replace(/\n?---\n?/g, '\n\n');
const soloDigitos = t => String(t || '').replace(/\D/g, '');

/* ---------- hilos (una conversación por empresa, todos los canales) ---------- */
function hilos() {
  const por = new Map();
  for (const m of todosMsgs()) { let l = por.get(m.empresa_id); if (!l) por.set(m.empresa_id, l = []); l.push(m); }
  return [...por].map(([id, l]) => {
    const e = POR_ID.get(id); if (!e) return null;
    l.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const reales = l.filter(m => m.canal !== 'nota'), u = reales[0] || l[0];
    return { e, msgs: l, ult: u, ultDir: dirEf(u) === 'in' && atendido(u) ? 'out' : dirEf(u), canales: [...new Set(reales.map(m => m.canal))] };
  }).filter(Boolean).sort((a, b) => (b.ult.fecha || '').localeCompare(a.ult.fecha || ''));
}
const atendible = e => e && !e.no_contactar && !(e.segmento_gabriel && !e.cliente);

/* ---------- Claudio: avisos con prioridad ---------- */
const P0 = /reclamo|roto|rota|quemad|denunci|estafa|defectuos|peligro|enojad|devoluci|reembols|garant[ií]a|mal estado|lastim/i;
const P3 = /bot|gracias|lo tendremos presente|RESPONDI[ÓO] NO|no tienen lugar|no interesad|sin acci[óo]n|audio/i;
const P1 = /compr|cotizaci|presupuesto|comprobante|transfer|pagar|reserv|pidi[óo]|pasame|mandame|PENDIENTE/i;
const FUERTE = /pidi[óo]|PENDIENTE|compr|cotizaci|presupuesto|pasame|mandame/i;
function prioDe(texto) {
  if (P0.test(texto)) return 0; if (/audio/i.test(texto)) return 2;
  if (P1.test(texto)) return /gracias/i.test(texto) && !FUERTE.test(texto) ? 3 : 1;
  return P3.test(texto) ? 3 : 2;
}
const RAZON = {
  0: t => `Tiene palabras de reclamo o problema ("${(t || '').slice(0, 60)}"). Atendelo vos, no el bot.`,
  1: t => /PENDIENTE/.test(t || '') ? 'Quedó algo prometido sin mandar (PENDIENTE). Cumplirlo primero.' : 'Pidió algo o muestra intención de compra: conviene responder rápido.',
  2: () => 'Consulta o respuesta que espera una contestación tuya.',
  3: () => 'Respuesta automática, agradecimiento o "no": baja urgencia.' };

function avisos() {
  const c = CL(), t = hoy(), out = [];
  for (const hl of hilos()) {
    const e = hl.e; if (!atendible(e)) continue;
    const u = hl.ult, txt = u.resumen || '', pend = /PENDIENTE/.test(txt);
    if (hl.ultDir === 'in' || pend) {
      const p = prioDe(txt);
      out.push({ key: 'resp:' + e.id + ':' + (u.fecha || u.id), emp: e.id, p, tipo: pend && hl.ultDir !== 'in' ? 'Pendiente' : 'Respondió', canal: u.canal, fecha: u.fecha, texto: txt, razon: RAZON[p](txt) });
    }
  }
  for (const x of S.tareas) {
    if (x.hecha || !x.vence || x.vence >= t) continue;
    const e = POR_ID.get(x.empresa_id); if (e && !atendible(e)) continue;
    out.push({ key: 'tarea:' + x.id, emp: x.empresa_id, tarea: x, p: 2, tipo: 'Tarea vencida', canal: x.canal, fecha: x.vence, texto: x.titulo, razon: `Vencida hace ${dias(x.vence)} días: ${x.titulo}` });
  }
  const conMsgIn = new Set(out.filter(a => a.tipo !== 'Tarea vencida').map(a => a.emp));
  for (const e of EMP) {
    if (!['Catálogo enviado', 'Oferta enviada'].includes(e.etapa) || !atendible(e) || !e.ultimo_contacto || conMsgIn.has(e.id)) continue;
    const d = dias(e.ultimo_contacto); if (d < 3) continue;
    out.push({ key: 'seg:' + e.id + ':' + e.etapa + ':' + e.ultimo_contacto.slice(0, 10), emp: e.id, p: 2, tipo: 'Seguimiento', canal: null, fecha: e.ultimo_contacto, texto: e.etapa, razon: `${e.etapa} hace ${d} días y no contestó: toca seguimiento.` });
  }
  for (const v of S.ventas || []) if (v.estado === 'Falta pago') out.push({ key: 'pago:' + v.id, emp: v.empresa_id, p: 1, tipo: 'Pago', canal: null, fecha: v.fecha, texto: 'Falta pago ' + v.cliente, razon: `Venta de ${v.cliente} esperando el pago (${pesos(v.total)}).` });
  return out.filter(a => {
    const r = c.res[a.key]; if (r && (r.est === 'hecho' || (r.est === 'pospuesto' && r.hasta > t))) return false; return true;
  }).map(a => ({ ...a, p: c.prio[a.key] ?? a.p, corregida: c.prio[a.key] != null })).sort((a, b) => a.p - b.p || (b.fecha || '').localeCompare(a.fecha || ''));
}
function claudioGuardar(key) {
  guardar();
  if (!db || !CL().enBase) return;
  const c = CL(), r = c.res[key], p = c.prio[key];
  db.from('claudio_estado').upsert({ clave: key, estado: r ? r.est : null, hasta: r && r.hasta ? r.hasta : null, prio: p === undefined ? null : p, actualizado: new Date().toISOString() })
    .then(({ error }) => error && toast('No se guardó en la base: ' + error.message));
}
function resolver(key, est, extra) { CL().res[key] = { est, fecha: ahora(), ...extra }; claudioGuardar(key); }

/* ---------- borradores de Claudio: solo datos confirmados, sin precios ni descuentos en el primer contacto ---------- */
function borrador(a) {
  const e = POR_ID.get(a.emp) || {};
  if (a.tipo === 'Pendiente') return 'Buenas! Te mando ahora el catálogo y el manual del sauna 🙌';
  if (a.tipo === 'Pago') return 'Buenas! Te escribo por el pago de tu pedido. ¿Pudiste hacer la transferencia? Si ya la hiciste, mandame el comprobante 🙌';
  if (a.tipo === 'Seguimiento') return e.etapa === 'Oferta enviada' ? 'Hola! ¿Pudiste ver la propuesta? Si querés, coordinamos una visita al Animal Club El Pinar para ver los saunas.' : 'Hola! ¿Pudieron ver el catálogo? Si quieren les armo un presupuesto sin compromiso 🙌';
  if (a.tipo === 'Tarea vencida') return 'Buenas! ¿Cómo va? Te escribo para retomar lo que hablamos 🙌';
  if (a.p === 3) return 'Gracias! Cualquier cosa me escribís 🙌';
  if (/cat[aá]logo|info|propuesta|pasame|mandame/i.test(a.texto || '')) return 'Buenas! Te paso el catálogo con los precios 🙌\n---\nCualquier duda me escribís';
  return 'Buenas! Gracias por responder 🙌\n---\n¿Querés que te pase el catálogo con los precios?';
}
function canalPara(e, pref) {
  if (pref && ['whatsapp', 'instagram', 'mail'].includes(pref)) return pref;
  if (e.telefono && e.telefono_tipo === 'movil' && !e.sin_whatsapp) return 'whatsapp';
  if (e.instagram) return 'instagram'; if (e.email) return 'mail'; return e.telefono ? 'whatsapp' : 'instagram';
}
function abrirCanal(e, canal, texto) {
  if (bloqueada(e)) return toast('Está en No contactar: no se envía nada');
  const t = textoSinRaya(texto || '');
  if (canal === 'whatsapp' && e.telefono) return window.open('https://wa.me/' + soloDigitos(e.telefono) + '?text=' + encodeURIComponent(t), '_blank', 'noopener');
  if (canal === 'instagram' && e.instagram) { navigator.clipboard && navigator.clipboard.writeText(t).catch(() => {}); toast('Texto copiado: pegalo en el chat'); return window.open('https://ig.me/m/' + e.instagram, '_blank', 'noopener'); }
  if (canal === 'mail' && e.email) return window.open('mailto:' + e.email + '?subject=' + encodeURIComponent('Recover') + '&body=' + encodeURIComponent(t));
  toast('Esta empresa no tiene ' + (CANALES[canal] || [canal])[0] + ' cargado');
}
function registrarEnvio(e, canal, texto, key) {
  if (bloqueada(e)) return toast('Está en No contactar');
  nota(e.id, canal, 'out', 'Mandado: ' + textoSinRaya(texto).replace(/\n+/g, ' ').slice(0, 160));
  cambiar(e.id, { ultimo_contacto: ahora() });
  if (key) resolver(key, 'hecho');
  toast('Registrado en el historial');
}

/* ---------- vistas ---------- */
const COLOR_P = ['bad', 'warn', 'pri', 'mut'], NOM_P = ['P0 Crítico', 'P1 Alto', 'P2 Medio', 'P3 Bajo'];
const chipP = p => h('span', { class: 'chip p' + p }, NOM_P[p]);
const hace = f => { if (!f) return ''; const d = dias(f); return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' d'; };


/* ---------- esfera de Claudio: núcleo flotando con hilos de luz hacia cada cliente que espera ---------- */
const COLOR_HILO = ['#ff4d6d', '#ffb703', '#38bdf8', '#94a3b8'];
function esfera(lista, nombre) {
  const cv = h('canvas', { class: 'esfera' }), tip = h('div', { class: 'hero-tip' });
  const caja = h('div', { class: 'hero' }, cv, tip,
    h('div', { class: 'hero-leyenda' }, [0, 1, 2, 3].map(p => h('span', {}, h('i', { style: 'background:' + COLOR_HILO[p] }), NOM_P[p] + ' ' + lista.filter(a => a.p === p).length))),
    h('div', { class: 'hero-ayuda' }, lista.length ? 'Tocá un hilo para ir a ese cliente · arrastrá para girar' : 'Sin clientes esperando'));
  const n = lista.length, nodos = lista.map((a, i) => { const y = n === 1 ? 0 : 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; return { a, x: Math.cos(th) * r, y, z: Math.sin(th) * r, fase: i * 1.7 }; });
  const quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, rotY = 0, rotX = .35, drag = null, mov = 0, hover = null, vis = [];
  const g = cv.getContext('2d');
  function medir() { const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, hh = cv.clientHeight; if (w !== W || hh !== H) { W = w; H = hh; cv.width = w * dpr; cv.height = hh * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); } }
  function proy(x, y, z, R) {
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    const X = x * cy + z * sy; let Z = -x * sy + z * cy; const Y = y * cx - Z * sx; Z = y * sx + Z * cx;
    const k = 1 / (1.5 - Z * .45); return { px: W / 2 + X * R * 1.25 * k, py: H / 2 + Y * R * k, z: Z, k };
  }
  function cuadro(t) {
    if (!cv.isConnected) return; medir();
    const R = Math.min(W * .42, H * .5), cx0 = W / 2, cy0 = H / 2 + Math.sin(t * .0012) * 5, rc = Math.min(W, H) * .13;
    if (!quieto && !drag) rotY += .0028;
    g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    // estrellitas de fondo
    for (let i = 0; i < 40; i++) { const sx = (i * 97.3 % 1) * W, sy = ((i * 53.7) % 1) * H; g.fillStyle = 'rgba(160,200,255,' + (.12 + .1 * Math.sin(t * .002 + i)) + ')'; g.fillRect((Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W, (Math.sin(i * 78.233) * 43758.5453 % 1 + 1) % 1 * H, 1.3, 1.3); }
    vis = nodos.map(nd => ({ nd, ...proy(nd.x, nd.y, nd.z, R) })).sort((a, b) => a.z - b.z);
    const hilo = v => {
      const c = COLOR_HILO[v.nd.a.p], prof = (v.z + 1) / 2, alfa = .25 + .6 * prof, curva = Math.sin(t * .0014 + v.nd.fase) * 18;
      const mx = (cx0 + v.px) / 2 - (v.py - cy0) * .18 + curva, my = (cy0 + v.py) / 2 + (v.px - cx0) * .18;
      g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(cx0, cy0, v.px, v.py); gr.addColorStop(0, 'rgba(120,200,255,0)'); gr.addColorStop(1, c);
      g.globalAlpha = alfa * .35; g.lineWidth = 4 * v.k; g.strokeStyle = gr; g.beginPath(); g.moveTo(cx0, cy0); g.quadraticCurveTo(mx, my, v.px, v.py); g.stroke();
      g.globalAlpha = alfa; g.lineWidth = 1.1 * v.k; g.stroke();
      // pulso de luz viajando por el hilo
      const u = (t * .00025 * (1 + v.nd.a.p * -.15) + v.nd.fase) % 1, bx = (1 - u) * (1 - u) * cx0 + 2 * (1 - u) * u * mx + u * u * v.px, by = (1 - u) * (1 - u) * cy0 + 2 * (1 - u) * u * my + u * u * v.py;
      g.globalAlpha = alfa; g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 1.6 * v.k, 0, 7); g.fill();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    };
    const punto = v => {
      const c = COLOR_HILO[v.nd.a.p], r = (v.nd.a.p === 0 ? 7 : v.nd.a.p === 1 ? 6 : 4.5) * v.k * (hover === v.nd ? 1.5 : 1);
      g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(v.px, v.py, 0, v.px, v.py, r * 3.2); gl.addColorStop(0, c); gl.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = .55 + .4 * (v.z + 1) / 2; g.fillStyle = gl; g.beginPath(); g.arc(v.px, v.py, r * 3.2, 0, 7); g.fill();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff'; g.beginPath(); g.arc(v.px, v.py, r * .45, 0, 7); g.fill();
    };
    vis.filter(v => v.z < 0).forEach(v => { hilo(v); punto(v); });
    // núcleo: la esfera de Claudio
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(cx0, cy0, rc * .6, cx0, cy0, rc * 3.4); halo.addColorStop(0, 'rgba(80,170,255,.55)'); halo.addColorStop(.5, 'rgba(120,90,255,.18)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(cx0, cy0, rc * 3.4, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
    const cuerpo = g.createRadialGradient(cx0 - rc * .35, cy0 - rc * .4, rc * .1, cx0, cy0, rc); cuerpo.addColorStop(0, '#d9f1ff'); cuerpo.addColorStop(.45, '#4aa8e0'); cuerpo.addColorStop(1, '#14265a');
    g.fillStyle = cuerpo; g.beginPath(); g.arc(cx0, cy0, rc, 0, 7); g.fill();
    g.strokeStyle = 'rgba(200,235,255,.45)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const a = rotY * 1.3 + i * Math.PI / 5; g.beginPath(); g.ellipse(cx0, cy0, Math.abs(Math.cos(a)) * rc, rc, 0, 0, 7); g.stroke(); }
    for (let i = -2; i <= 2; i++) { const yy = i * rc * .34, rr = Math.sqrt(Math.max(0, rc * rc - yy * yy)); g.beginPath(); g.ellipse(cx0, cy0 + yy, rr, rr * .22, 0, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(220,240,255,.9)'; g.font = '600 ' + Math.round(rc * .36) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(nombre, cx0, cy0 + rc * 1.65);
    vis.filter(v => v.z >= 0).forEach(v => { hilo(v); punto(v); });
    if (!quieto || !cv.dataset.listo) { cv.dataset.listo = 1; requestAnimationFrame(cuadro); }
  }
  const cerca = ev => { const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top; let mejor = null, d2 = 20 * 20; for (const v of vis) { const d = (v.px - x) ** 2 + (v.py - y) ** 2; if (d < d2) { d2 = d; mejor = v; } } return mejor && { v: mejor, x, y }; };
  cv.addEventListener('pointerdown', ev => { drag = { x: ev.clientX, y: ev.clientY }; mov = 0; cv.setPointerCapture(ev.pointerId); });
  cv.addEventListener('pointermove', ev => {
    if (drag) { const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; mov += Math.abs(dx) + Math.abs(dy); rotY += dx * .006; rotX = Math.max(-1, Math.min(1, rotX + dy * .004)); drag = { x: ev.clientX, y: ev.clientY }; }
    const c = cerca(ev); hover = c ? c.v.nd : null; cv.style.cursor = c ? 'pointer' : 'grab';
    if (c) { const e = POR_ID.get(c.v.nd.a.emp); tip.textContent = (e ? e.nombre : c.v.nd.a.texto) + ' · ' + NOM_P[c.v.nd.a.p]; tip.style.left = Math.min(c.x + 12, W - 180) + 'px'; tip.style.top = (c.y + 12) + 'px'; tip.classList.add('on'); } else tip.classList.remove('on');
  });
  cv.addEventListener('pointerup', ev => { const fue = mov < 6; drag = null; if (!fue) return; const c = cerca(ev); if (!c) return;
    const el = document.getElementById(idAviso(c.v.nd.a)); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('destacado'); setTimeout(() => el.classList.remove('destacado'), 1800); } });
  cv.addEventListener('pointerleave', () => { hover = null; tip.classList.remove('on'); });
  requestAnimationFrame(cuadro);
  return caja;
}

function vClaudio(app) {
  const c = CL(), av = avisos(), n = p => av.filter(a => a.p === p).length;
  const nombre = h('input', { value: c.nombre, style: 'max-width:200px;font-weight:700', onchange: ev => { c.nombre = ev.target.value.trim() || 'Claudio'; guardar(); if (db) db.from('config').upsert({ clave: 'claudio_nombre', valor: c.nombre }).then(({ error }) => error && toast('No se guardó el nombre: ' + error.message)); ruta(); } });
  app.append(h('div', { class: 'card row' }, h('div', { class: 'avatar' }, c.nombre[0]), h('div', { class: 'sp' }, nombre, h('small', {}, 'Mira todos tus canales, ordena lo urgente y te deja el borrador. Vos aprobás.'))));
  const f0 = location.hash.split('/')[2], l0 = f0 != null && f0 !== '' ? av.filter(a => a.p === +f0) : av;
  app.append(esfera(l0.slice(0, 40), c.nombre));
  app.append(h('div', { class: 'banner info' }, `${c.nombre} funciona hoy como asistente: arma avisos y borradores con lo que hay en el CRM. Todavía no recibe ni manda mensajes solo (eso es la Fase 3, con WhatsApp API). Nada sale sin que lo toques vos.`));
  app.append(h('div', { class: 'kpis' }, [0, 1, 2, 3].map(p => h('a', { class: 'kpi', href: '#/claudio/' + p }, h('b', {}, n(p)), h('small', {}, NOM_P[p])))));
  app.append(h('details', { class: 'card' }, h('summary', {}, 'Qué nunca resuelve solo'), h('small', {}, 'Reembolsos, garantías y cambios, temas médicos o contraindicaciones, temas legales y descuentos mayores al 20%: siempre te los deriva. Precios, stock y plazos solo los dice si están confirmados.')));
  const filtro = location.hash.split('/')[2], lista = filtro != null && filtro !== '' ? av.filter(a => a.p === +filtro) : av;
  app.append(h('div', { class: 'row' }, h('h2', { class: 'sp' }, 'Para resolver' + (filtro ? ' · ' + NOM_P[+filtro] : '')), filtro ? h('a', { class: 'btn sec', href: '#/claudio' }, 'Ver todos') : null));
  if (!lista.length) app.append(vacio('Nada pendiente', 'check'));
  lista.slice(0, 40).forEach(a => app.append(tarjetaAviso(a)));
  if (lista.length > 40) app.append(h('p', { class: 'vacio' }, `Mostrando 40 de ${lista.length}. Resolvé los de arriba y aparecen los siguientes.`));
}
const idAviso = a => 'av-' + a.key.replace(/[^a-z0-9]/gi, '_');
function tarjetaAviso(a) {
  const e = POR_ID.get(a.emp), blq = e && bloqueada(e);
  const ta = h('textarea', { rows: 3 }, borrador(a));
  const canal = h('select', {}, ['whatsapp', 'instagram', 'mail'].map(k => h('option', { value: k, selected: k === (e ? canalPara(e, a.canal) : 'whatsapp') }, CANALES[k][0])));
  const prio = h('select', { onchange: ev => { CL().prio[a.key] = +ev.target.value; claudioGuardar(a.key); toast('Prioridad corregida'); ruta(); } }, NOM_P.map((x, i) => h('option', { value: i, selected: i === a.p }, 'Prioridad: ' + x)));
  return h('div', { class: 'card aviso p' + a.p, id: idAviso(a) },
    h('div', { class: 'row' }, chipP(a.p), a.corregida && h('span', { class: 'chip' }, 'corregida'), h('small', { class: 'sp' }, `${a.tipo}${a.canal && CANALES[a.canal] ? ' · ' + CANALES[a.canal][0] : ''} · ${hace(a.fecha)}`)),
    e ? h('a', { class: 'item', href: '#/hilo/' + e.id }, h('b', {}, e.nombre)) : h('b', {}, a.texto), e && h('small', {}, [e.etapa, e.rubro, lugar(e)].filter(Boolean).join(' · ')),
    h('p', { class: 'razon' }, ico('sparkles', 18), h('span', {}, a.razon)), a.texto && a.tipo !== 'Seguimiento' && h('small', { class: 'cita' }, '“' + a.texto.slice(0, 160) + '”'),
    e && !blq && h('div', {}, h('small', {}, 'Borrador de ' + CL().nombre + ' (editalo):'), ta, h('div', { class: 'row' }, canal,
      h('button', { onclick: () => abrirCanal(e, canal.value, ta.value) }, 'Abrir y mandar'), h('button', { class: 'ok', onclick: () => { registrarEnvio(e, canal.value, ta.value, a.key); ruta(); } }, [ico('check', 18), ' Ya lo mandé']))),
    blq && h('div', { class: 'banner bad', role: 'alert' }, ico('ban', 20), h('div', {}, 'No contactar: ' + (e.no_contactar_motivo || ''))),
    h('div', { class: 'row' }, h('button', { class: 'sec', onclick: () => { resolver(a.key, 'hecho'); if (a.tarea) { a.tarea.hecha = true; guardar(); } ruta(); } }, 'Resuelto'),
      h('button', { class: 'sec', onclick: () => { resolver(a.key, 'pospuesto', { hasta: sumar(hoy(), 1) }); toast('Vuelve mañana'); ruta(); } }, 'Mañana'), prio,
      e && h('a', { class: 'btn sec', href: '#/rama/' + e.id }, 'Rama')));
}

/* rama: recorrido de un cliente con lo que sigue según responda */
const ORDEN = ['Lead', 'Contactado', 'Respondió', 'Catálogo enviado', 'Oferta enviada', 'Cotización', 'Visita/Demo', 'Ganado'];
function vRama(app, id) {
  const e = POR_ID.get(+id); if (!e) return app.append(h('p', { class: 'vacio' }, 'No encontré el cliente'));
  const hl = hilos().find(x => x.e.id === e.id), idx = ORDEN.indexOf(e.etapa), perdido = e.etapa === 'Perdido';
  app.append(volver('#/hilo/' + e.id, 'Conversación'), h('h2', {}, 'Rama de ' + e.nombre), h('div', {}, chips(e)));
  const paso = (nombre, est, detalle) => h('div', { class: 'paso ' + est }, h('b', {}, est === 'hecho' ? ico('check', 16) : null, est === 'hecho' ? ' ' : '', nombre), detalle && h('small', {}, detalle));
  const arbol = h('div', { class: 'rama' });
  ORDEN.forEach((et, i) => {
    const est = perdido ? (i <= 1 ? 'hecho' : 'futuro') : i < idx ? 'hecho' : i === idx ? 'actual' : 'futuro', r = REGLAS[et];
    arbol.append(paso(et, est, est === 'actual' && r ? `Siguiente: ${r[1]} (en ${r[0]} d)` : null));
    if (i === 1) arbol.append(h('div', { class: 'sub' }, paso('Si no responde en ' + REGLAS['Contactado'][0] + ' días', 'futuro', 'Seguimiento corto; si sigue sin respuesta, otro canal (nunca dos veces por el mismo día)')));
    if (i === 2) arbol.append(h('div', { class: 'sub' }, paso('Si dice que no', 'futuro', 'Se marca Perdido con motivo y queda bloqueado para envíos'), paso('Si pasa con otra persona', 'futuro', 'Se anota el nuevo contacto y se sigue por ahí')));
    if (i === 4) arbol.append(h('div', { class: 'sub' }, paso('Si pide algo especial o precio por mayor', 'futuro', 'El bot no cotiza: te lo deriva a vos')));
  });
  if (perdido) arbol.append(paso('Perdido', 'actual', e.no_contactar_motivo));
  app.append(arbol);
  if (hl) { app.append(h('h3', {}, 'Últimos movimientos')); hl.msgs.slice(0, 6).forEach(m => app.append(burbuja(m))); }
}

/* bandeja unificada */
let bandCanal = 'todos', bandQ = '', bandSolo = false, bandPag = 1;
const POR_PAG = 50, CANALES_BANDEJA = ['todos', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'mail', 'telefono'];
function listaHilos(sel) {
  const todos = hilos(), cuenta = k => todos.filter(x => k === 'todos' || x.canales.includes(k)).length;
  const caja = h('div', { class: 'izq' }), lista = h('div'), info = h('small', { class: 'sp' });
  caja.append(h('div', { class: 'row filtrocanal' }, CANALES_BANDEJA.map(k =>
    h('button', { class: k === bandCanal ? '' : 'sec', onclick: () => { bandCanal = k; bandPag = 1; ruta(); } }, k === 'todos' ? null : icCanal(k), (k === 'todos' ? 'Todos' : CANALES[k][0]) + ' ' + cuenta(k)))));
  if (['facebook', 'tiktok'].includes(bandCanal)) caja.append(h('div', { class: 'banner info' }, `${CANALES[bandCanal][0]} todavía no está conectado. ` + (bandCanal === 'tiktok' ? 'TikTok no tiene API abierta para mensajes directos: se atiende desde la app de TikTok y se anota acá. Comentarios y leads de anuncios sí se pueden integrar.' : 'Se conecta junto con Instagram (Meta) en la Fase 2.')));
  const q = h('input', { type: 'search', placeholder: 'Buscar cliente, @instagram o texto', value: bandQ, oninput: ev => { bandQ = ev.target.value; bandPag = 1; pintar(); } });
  const solo = h('input', { type: 'checkbox', style: 'width:auto', checked: bandSolo, onchange: ev => { bandSolo = ev.target.checked; bandPag = 1; pintar(); } });
  caja.append(q, h('div', { class: 'row' }, h('label', { class: 'row' }, solo, 'Solo sin responder'), info), lista);
  function pintar() {
    const qq = bandQ.trim().toLowerCase().replace(/^@/, '');
    const l = todos.filter(x => (bandCanal === 'todos' || x.canales.includes(bandCanal)) && (!bandSolo || (x.ultDir === 'in' && atendible(x.e)))
      && (!qq || (x.e.nombre + ' ' + (x.e.instagram || '') + ' ' + (x.ult.resumen || '')).toLowerCase().includes(qq)));
    info.textContent = l.length + ' conversaciones';
    lista.replaceChildren();
    if (!l.length) lista.append(h('p', { class: 'vacio' }, 'Sin conversaciones con este filtro'));
    l.slice(0, bandPag * POR_PAG).forEach(x => lista.append(h('a', { class: 'card item hilo' + (sel === x.e.id ? ' sel' : ''), href: '#/hilo/' + x.e.id },
      h('div', { class: 'row' }, h('b', { class: 'sp' }, x.e.nombre), h('small', {}, hace(x.ult.fecha)), x.ultDir === 'in' && atendible(x.e) && h('span', { class: 'punto' })),
      h('small', {}, x.canales.map(icCanal), ' ' + (x.ult.resumen || '').slice(0, 70)))));
    if (l.length > bandPag * POR_PAG) lista.append(h('button', { class: 'sec', style: 'width:100%', onclick: () => { bandPag++; pintar(); } }, `Ver más (${l.length - bandPag * POR_PAG} restantes)`));
  }
  pintar();
  return caja;
}
function vBandeja(app) {
  const sinR = hilos().filter(x => x.ultDir === 'in' && atendible(x.e)).length;
  app.append(h('div', { class: 'row' }, h('h2', { class: 'sp' }, 'Bandeja'), h('small', {}, sinR + ' esperan respuesta')));
  app.append(h('div', { class: 'banner info' }, 'Hoy la bandeja muestra el historial que ya tenías y lo que anotás. Los mensajes nuevos de WhatsApp, Instagram, Facebook y TikTok van a entrar solos cuando se conecten (Fase 2).'));
  app.append(listaHilos());
}
const burbuja = m => { const d = dirEf(m); return h('div', { class: 'burbuja ' + d }, h('small', {}, [fmtF(m.fecha), (CANALES[m.canal] || [m.canal])[0], infer(m) ? 'recibido (inferido)' : d === 'in' ? 'recibido' : d === 'int' ? 'nota' : 'enviado'].filter(Boolean).join(' · ')), h('div', {}, m.resumen || '')); };
const PLANTILLAS = { 'Catálogo': 'Te paso el catálogo con los precios 🙌', 'Seguimiento': 'Hola! ¿Pudieron ver el catálogo? Si quieren les armo un presupuesto sin compromiso',
  'Visita': 'Si querés podés ver los saunas en el Animal Club El Pinar (Av. Giannattasio 5288), de lunes a viernes de 8 a 15 h. ¿Te queda bien algún día?', 'Gracias': 'Gracias! Cualquier cosa me escribís 🙌' };
function vHilo(app, id) {
  const e = POR_ID.get(+id); if (!e) return app.append(h('p', { class: 'vacio' }, 'No encontré la conversación'));
  const wrap = h('div', { class: 'dos' }), der = h('div', { class: 'der' });
  wrap.append(listaHilos(e.id), der); app.append(wrap);
  const hl = hilos().find(x => x.e.id === e.id), msgs = hl ? [...hl.msgs].reverse() : [], blq = bloqueada(e);
  der.append(volver('#/bandeja', 'Bandeja'), h('h2', {}, e.nombre), h('div', {}, chips(e)),
    h('div', { class: 'row' }, h('a', { class: 'btn sec', href: '#/empresa/' + e.id }, 'Ficha'), h('a', { class: 'btn sec', href: '#/rama/' + e.id }, 'Rama'), h('a', { class: 'btn sec', href: '#/cotizar/' + e.id }, 'Cotizar')));
  if (blq) der.append(h('div', { class: 'banner bad', role: 'alert' }, ico('ban', 20), h('div', {}, 'No contactar: ' + (e.no_contactar_motivo || '') + '. No se puede enviar.')));
  const av = avisos().find(a => a.emp === e.id && a.tipo !== 'Tarea vencida');
  if (av && !blq) der.append(h('div', { class: 'card aviso p' + av.p }, chipP(av.p), h('p', { class: 'razon' }, ico('sparkles', 18), h('span', {}, av.razon)),
    h('button', { class: 'sec', onclick: () => { ta.value = borrador(av); ta.focus(); } }, 'Usar borrador de ' + CL().nombre)));
  const caja = h('div', { class: 'chat' }, msgs.length ? msgs.map(burbuja) : h('p', { class: 'vacio' }, 'Sin mensajes todavía'));
  der.append(caja);
  const ta = h('textarea', { rows: 3, placeholder: blq ? 'Bloqueado' : 'Escribí la respuesta', disabled: blq });
  const canal = h('select', { disabled: blq }, ['whatsapp', 'instagram', 'mail'].map(k => h('option', { value: k, selected: k === canalPara(e, hl && hl.ult.canal) }, CANALES[k][0])));
  const plant = h('select', { disabled: blq, onchange: ev => { if (ev.target.value) ta.value = PLANTILLAS[ev.target.value]; ev.target.value = ''; } }, h('option', { value: '' }, 'Respuestas rápidas…'), Object.keys(PLANTILLAS).map(k => h('option', { value: k }, k)));
  der.append(h('div', { class: 'card' }, ta, h('div', { class: 'row' }, plant, canal),
    h('div', { class: 'row' }, h('button', { disabled: blq, onclick: () => abrirCanal(e, canal.value, ta.value) }, 'Abrir y mandar'),
      h('button', { class: 'ok', disabled: blq, onclick: () => { if (!ta.value.trim()) return; registrarEnvio(e, canal.value, ta.value, av && av.key); ruta(); } }, [ico('check', 18), ' Ya lo mandé'])),
    h('small', {}, 'Se abre la app del canal con el texto. Cuando se conecten los canales (Fase 2) se manda desde acá.')));
}

/* mails */
function vMails(app, arg) {
  const tab = arg || 'enviados', ms = todosMsgs().filter(m => m.canal === 'mail' && POR_ID.has(m.empresa_id));
  const enviados = ms.filter(m => dirEf(m) === 'out'), recib = ms.filter(m => dirEf(m) === 'in');
  const hace24 = new Date(Date.now() - 864e5), ult24 = enviados.filter(m => m.fecha && new Date(m.fecha.replace(' ', 'T')) > hace24).length;
  const respondieron = new Set(recib.map(m => m.empresa_id)), empEnv = new Set(enviados.map(m => m.empresa_id));
  const sinResp = [...empEnv].filter(i => !respondieron.has(i) && atendible(POR_ID.get(i)));
  const rebotados = EMP.filter(e => e.mail_invalido).length;
  app.append(h('h2', {}, 'Mails'), h('div', { class: 'kpis' }, kpi(enviados.length, 'mails enviados'), kpi(respondieron.size, 'empresas que respondieron'), kpi(ult24 + ' / ~95', 'enviados en 24 h (cupo Gmail)'), kpi(rebotados, 'mails que rebotaron')));
  app.append(h('div', { class: 'row' }, [['enviados', 'Enviados'], ['respuestas', 'Respuestas'], ['sinrespuesta', 'Sin respuesta']].map(([k, n]) => h('a', { class: 'btn ' + (tab === k ? '' : 'sec'), href: '#/mails/' + k }, n))));
  const fila = (m, nota) => { const e = POR_ID.get(m.empresa_id); return h('a', { class: 'card item', href: '#/hilo/' + e.id }, h('b', {}, e.nombre), h('small', {}, [fmtF(m.fecha), e.email, nota || m.resumen].filter(Boolean).join(' · '))); };
  const lista = tab === 'respuestas' ? recib.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(m => fila(m))
    : tab === 'sinrespuesta' ? sinResp.map(i => { const m = enviados.filter(x => x.empresa_id === i).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0]; return fila(m, 'sin respuesta ' + hace(m.fecha)); })
    : enviados.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(m => fila(m));
  if (!lista.length) app.append(h('p', { class: 'vacio' }, 'Nada para mostrar'));
  lista.slice(0, 60).forEach(x => app.append(x));
  if (lista.length > 60) app.append(h('p', { class: 'vacio' }, `Mostrando 60 de ${lista.length}`));
  app.append(h('small', {}, 'Los envíos automáticos los hace el Apps Script de Gmail; el CRM muestra lo que quedó registrado. Para que los mails nuevos entren solos hay que conectar Gmail (Fase 2).'));
}

/* instagram: lo real es el control de DMs por día */
function vInstagram(app) {
  const dm = todosMsgs().filter(m => m.canal === 'instagram' && dirEf(m) === 'out' && m.fecha), por = {};
  dm.forEach(m => { const d = m.fecha.slice(0, 10); por[d] = (por[d] || 0) + 1; });
  const dias14 = [...Array(14)].map((_, i) => sumar(hoy(), -13 + i)), max = Math.max(25, ...dias14.map(d => por[d] || 0)), LIM = 15, ALTO = 20;
  const resp = hilos().filter(x => x.canales.includes('instagram') && x.ultDir === 'in' && atendible(x.e));
  app.append(h('h2', {}, 'Instagram · @recover.uy_'), h('div', { class: 'kpis' }, kpi(por[hoy()] || 0, 'DMs enviados hoy (límite ' + LIM + ')'), kpi(dias14.reduce((a, d) => a + (por[d] || 0), 0), 'DMs en 14 días'),
    kpi(dias14.filter(d => (por[d] || 0) > ALTO).length, 'días que pasaron de ' + ALTO + ' (riesgo)'), kpi(resp.length, 'esperan respuesta')));
  app.append(h('h3', {}, 'DMs por día (últimos 14)'), h('div', { class: 'card' }, dias14.map(d => { const n = por[d] || 0; return h('div', { class: 'barra' }, h('small', {}, fmtF(d).slice(0, 5)), h('div', { class: 'tira' }, h('i', { class: n > ALTO ? 'mal' : n > LIM ? 'ojo' : '', style: 'width:' + Math.round(n / max * 100) + '%' })), h('small', {}, n)); }),
    h('small', {}, 'Instagram limita los DMs en frío: más de ~15 a 20 por día arriesga la cuenta. Rojo = te pasaste.')));
  app.append(h('h3', {}, 'Respondieron por Instagram'), ...(resp.length ? resp.slice(0, 10).map(x => h('a', { class: 'card item', href: '#/hilo/' + x.e.id }, h('b', {}, x.e.nombre), h('small', {}, (x.ult.resumen || '').slice(0, 90)))) : [h('p', { class: 'vacio' }, 'Nadie esperando')]));
  app.append(h('h3', {}, 'Publicaciones y métricas'), conectar('Instagram (publicaciones, alcance, seguidores)', ['Vincular @recover.uy_ a una página de Facebook (hoy no está vinculada).', 'Crear la app en Meta for Developers y pedir permisos de mensajes y contenido.', 'Cargar el token en el gestor de secretos; el CRM avisa antes de que venza (60 días).'], 'Fase 2 y 4'));
}
function conectar(nombre, pasos, fase) {
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'sp' }, nombre), h('span', { class: 'chip gab' }, 'Sin conectar · ' + fase)), h('small', {}, 'Para conectarlo:'), h('ol', {}, pasos.map(p => h('li', {}, p))));
}

/* meta ads: no hay datos reales todavía, no se inventan */
function vMeta(app) {
  app.append(h('h2', {}, 'Meta Ads'), h('div', { class: 'banner info' }, 'Todavía no está conectado: no te muestro números inventados. Cuando se conecte vas a ver acá cada campaña.'));
  app.append(h('div', { class: 'kpis' }, ['Gasto', 'Alcance', 'Leads', 'Costo por lead'].map(k => h('div', { class: 'kpi' }, h('b', {}, '—'), h('small', {}, k)))));
  app.append(conectar('Meta Ads · cuenta "Joaquin Recover"', ['Crear la app en Meta for Developers (la misma de Instagram) y pedir el permiso de lectura de anuncios (ads_read).', 'Autorizar la cuenta publicitaria y guardar el token en el gestor de secretos.', 'Etiquetar los anuncios con UTM para saber de qué campaña vino cada lead.'], 'Fase 5'));
  app.append(h('div', { class: 'card' }, h('b', {}, 'Regla fija'), h('p', {}, 'El CRM nunca cambia inversión ni presupuesto sin tu confirmación explícita en el panel; cada cambio queda registrado. Pausar, editar textos y crear anuncios también pedirán tu OK.')));
  app.append(h('small', {}, 'Mercado Ads, Google Ads y TikTok Ads se suman en esta misma sección.'));
}

/* ---------- menú lateral ---------- */
const MENU = [
  ['Principal', [['hoy', 'home', 'Hoy'], ['claudio', 'sparkles', 'Claudio · para resolver']]],
  ['Mensajes', [['bandeja', 'inbox', 'Bandeja (WA · IG · FB · TikTok)'], ['mails', 'mail', 'Mails']]],
  ['CRM', [['contactos', 'users', 'Contactos'], ['pipeline', 'kanban', 'Pipeline'], ['ventas', 'cash', 'Ventas'], ['tareas', 'calendar', 'Agenda y tareas']]],
  ['Marketing', [['meta', 'megaphone', 'Meta Ads'], ['instagram', 'instagram', 'Instagram']]],
  ['Sistema', [['mas', 'sliders', 'Más y ajustes']]]];
const TITULOS = { empresa: 'Ficha', cotizar: 'Cotizar', hilo: 'Conversación', rama: 'Rama' };
const TABS = [['hoy', 'home', 'Hoy'], ['claudio', 'sparkles', 'Claudio'], ['bandeja', 'inbox', 'Bandeja'], ['contactos', 'users', 'Contactos']];
const ALIAS = { empresa: 'contactos', cotizar: 'contactos', hilo: 'bandeja', rama: 'claudio' };
function marcarMenu(v) {
  const cont = $('#menu-items'); if (!cont) return;
  const av = avisos(), tareasV = S.tareas.filter(t => !t.hecha && t.vence && t.vence < hoy()).length, sinR = hilos().filter(x => x.ultDir === 'in' && atendible(x.e)).length;
  const badge = { claudio: av.filter(a => a.p <= 1).length, bandeja: sinR, tareas: tareasV };
  const activo = ALIAS[v] || v, plano = MENU.flatMap(([, l]) => l);
  cont.replaceChildren(h('div', { class: 'marca' }, h('img', { src: 'logo.png', alt: 'Recover' }), h('small', {}, 'CRM')),
    ...MENU.map(([t, items]) => h('div', {}, h('h4', {}, t), items.map(([k, i, n]) => h('a', { href: '#/' + k, class: k === activo ? 'on' : '', 'aria-current': k === activo ? 'page' : null, onclick: cerrarMenu },
      ico(i, 20), h('span', { class: 'sp' }, n), badge[k] ? h('em', { 'aria-label': badge[k] + ' pendientes' }, badge[k] > 99 ? '99+' : badge[k]) : null)))));
  const tabs = $('#tabs');
  tabs.replaceChildren(...TABS.map(([k, i, n]) => h('a', { href: '#/' + k, class: k === activo ? 'on' : '', 'data-t': k, 'aria-current': k === activo ? 'page' : null }, ico(i, 22), n, badge[k] ? h('em', {}, badge[k] > 99 ? '99+' : badge[k]) : null)),
    h('a', { href: '#/menu', onclick: ev => { ev.preventDefault(); abrirMenu(); } }, ico('menu', 22), 'Menú'));
  const it = plano.find(x => x[0] === activo); $('#tit').textContent = TITULOS[v] || (it ? it[2].split(' (')[0] : '');
  $('#menubtn').replaceChildren(ico('menu', 24)); $('#buscarbtn').replaceChildren(ico('search', 22));
  pintarPie(); cerrarMenu();
}
function cerrarMenu() { const l = $('#lateral'); if (!l) return; l.classList.remove('abierto'); $('#velo').classList.remove('on'); const b = $('#menubtn'); b && b.setAttribute('aria-expanded', 'false'); }
function abrirMenu() { $('#lateral').classList.add('abierto'); $('#velo').classList.add('on'); const b = $('#menubtn'); b && b.setAttribute('aria-expanded', 'true'); const p = $('#menu-items a.on') || $('#menu-items a'); p && p.focus(); }

/* franja de Claudio en Hoy: los 3 avisos más urgentes */
function franjaClaudio() {
  const av = avisos().slice(0, 3), c = CL();
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'avatar' }, c.nombre[0]), h('div', { class: 'sp' }, h('b', {}, c.nombre + ' te marca'), h('small', {}, av.length ? 'Lo más urgente ahora' : 'Nada urgente por ahora')), h('a', { class: 'btn sec', href: '#/claudio' }, 'Ver todo')),
    ...av.map(a => { const e = POR_ID.get(a.emp); return h('a', { class: 'item', href: '#/hilo/' + (e ? e.id : ''), style: 'padding:8px 0;border-top:1px solid var(--border);margin-top:8px' }, h('div', { class: 'row' }, chipP(a.p), h('b', { class: 'sp' }, e ? e.nombre : a.texto)), h('small', {}, a.razon)); }));
}

Object.assign(VISTAS, { claudio: vClaudio, rama: vRama, bandeja: vBandeja, hilo: vHilo, mails: vMails, instagram: vInstagram, meta: vMeta });
