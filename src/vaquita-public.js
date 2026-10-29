// /v/<token>: the page a friend opens from WhatsApp. Read-only, no account, no app: it asks Supabase for that one
// vaquita (function vq_shared) and shows who paid, what each one owes and who transfers to whom.
import { summarizeGroup, whatsappSummary } from './vaquitas-core.js';

const CONFIG = __CONFIG__;
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nice = (d) => (d ? `${+d.slice(8)} ${M[+d.slice(5, 7) - 1]}` : '');
const token = (/\/v\/([a-f0-9]{16,64})/i.exec(location.pathname) || [])[1] || new URLSearchParams(location.search).get('t');

async function fetchShared() {
  if (window.__vqShared) return window.__vqShared; // tests
  if (!CONFIG.url || !CONFIG.key) throw Error('Este nubo no tiene la nube configurada.');
  const r = await fetch(CONFIG.url.replace(/\/$/, '') + '/rest/v1/rpc/vq_shared', { method: 'POST', headers: { apikey: CONFIG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  if (!r.ok) throw Error('No pudimos cargar la vaquita. Probá de nuevo en un rato.');
  return r.json();
}

function transfers(d, scope) {
  const name = (id) => d.participants.find((p) => p.id === id);
  if (!scope.expenseCount) return '<p class="muted">Todavía no hay gastos.</p>';
  if (!scope.settlements.length) return '<p class="ok">Están todos al día.</p>';
  return `<ul class="list">${scope.settlements.map((t) => { const to = name(t.toId); return `<li><span><b>${esc(name(t.fromId)?.name)}</b> le pasa a <b>${esc(to?.name)}</b>${to?.aliasCbu ? `<button class="alias" data-copy="${esc(to.aliasCbu)}">${esc(to.aliasCbu)}</button>` : ''}</span><strong>${money(t.amount)}</strong></li>`; }).join('')}</ul>`;
}

function paint(data) {
  const g = data.group, d = { ...g, participants: data.participants, vaquitas: data.vaquitas, expenses: data.expenses, payments: data.payments };
  const s = summarizeGroup(d), trip = g.kind === 'viaje';
  document.title = g.title + ' · Vaquita';
  const range = g.startsOn ? nice(g.startsOn) + (g.endsOn && g.endsOn !== g.startsOn ? ' – ' + nice(g.endsOn) : '') : '';
  const block = (scope, title) => `<section class="card"><h2>${esc(title)}<small>${money(scope.total)}</small></h2>${transfers(d, scope)}</section>`;
  $('#app').innerHTML = `<p class="kind">${trip ? 'Viaje' : 'Juntada'}${range ? ' · ' + range : ''}</p><h1>${esc(g.title)}</h1><p class="muted">${data.participants.length} personas${g.status !== 'open' ? ' · cerrada' : ''}</p>
  <div class="kpis"><div><span>Total</span><b>${money(s.total)}</b></div>${trip ? `<div><span>Vaquitas</span><b>${s.vaquitaCount}</b></div>` : ''}<div><span>Por pasar</span><b>${s.pendingTransfers}</b></div></div>
  ${trip ? s.vaquitas.map((v) => block(v, v.title)).join('') + (s.loose.expenseCount ? block(s.loose, 'Gastos sueltos') : '') : block(s.loose, 'Quién le paga a quién')}
  <section class="card"><h2>${trip ? 'Gente del viaje' : 'Gente'}</h2><ul class="list">${s.perPerson.map((p) => { const who = data.participants.find((x) => x.id === p.participantId); return `<li><span><b>${esc(who.name)}</b><small>Puso ${money(p.paid)} · le toca ${money(p.fairShare)}</small></span><em class="${p.net > 0 ? 'in' : p.net < 0 ? 'out' : ''}">${p.net > 0 ? 'Recibe ' + money(p.net) : p.net < 0 ? 'Pone ' + money(-p.net) : 'Al día'}</em></li>`; }).join('')}</ul></section>
  ${data.expenses.length ? `<section class="card"><h2>Gastos</h2><ul class="list">${data.expenses.map((e) => `<li><span><b>${esc(e.title)}</b><small>pagó ${esc(data.participants.find((p) => p.id === e.payerId)?.name)} · ${nice(e.spentOn)}${trip ? ' · ' + esc(data.vaquitas.find((v) => v.id === e.vaquitaId)?.title || 'todo el viaje') : ''}</small></span><strong>${money(e.amount)}</strong></li>`).join('')}</ul></section>` : ''}
  <div class="actions"><a class="primary" href="https://wa.me/?text=${encodeURIComponent(whatsappSummary(d, location.href))}">Compartir por WhatsApp</a><button data-copy="${esc(location.href)}">Copiar link</button></div>
  <p class="foot">Con este link la vaquita es solo para ver. ¿Usás nubo? En numio › Vaquitas › Unirme, pegá este link y la tenés en tu app.</p>`;
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); const t = b.textContent; b.textContent = 'Copiado'; setTimeout(() => (b.textContent = t), 1400); } catch {}
});

(async () => {
  try {
    if (!token) throw Error('Al link le falta una parte. Pedí que te lo manden de nuevo.');
    const data = await fetchShared();
    if (!data) throw Error('No encontramos esta vaquita. Puede que el link esté mal copiado o que la hayan borrado.');
    paint(data);
  } catch (e) {
    $('#app').innerHTML = `<h1>Vaquita</h1><p class="muted">${esc(e.message)}</p>`;
  }
})();
