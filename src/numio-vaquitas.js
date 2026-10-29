// numio · Vaquitas: dividir gastos con amigos (viajes con varias vaquitas, o juntadas de una sola cuenta).
// Se empaqueta como script clásico (iife) y corre en numio después de numio-plus.js. Usa las funciones de la app
// (state, save, render, modal, notify, esc, icon, cash, storeIrisMovement…).
// Con sesión iniciada guarda en Supabase (tablas vq_*), así otros ven la vaquita con el link y se pueden sumar.
// Sin sesión guarda en el teléfono, dentro de los datos de numio.
import { summarizeGroup, summarizeScope, expenseShares, whatsappSummary, fromCents } from './vaquitas-core.js';

(() => {
  if (typeof irisMarkup !== 'function' || typeof state === 'undefined') return;
  const host = () => parent.EcosystemHost;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const today = () => (typeof localDay === 'function' ? localDay() : new Date().toISOString().slice(0, 10));
  const money = (n) => cash(n, 'ARS');
  const short = (d) => (d ? String(d).split('-').reverse().slice(0, 2).join('/') : '');
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const nice = (d) => (d ? `${+d.slice(8)} ${MONTHS[+d.slice(5, 7) - 1]}` : '');
  const range = (g) => (g.startsOn ? nice(g.startsOn) + (g.endsOn && g.endsOn !== g.startsOn ? ' – ' + nice(g.endsOn) : '') : '');
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  paths.users ||= '<path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9" cy="7" r="3.5"/><path d="M22 19v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>';
  paths.share ||= '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4M12 2v13"/>';
  paths.link ||= '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>';
  paths.left ||= '<path d="M15 18l-6-6 6-6"/>';

  // ── where the data lives ─────────────────────────────────────────────────────────────────────────────────────
  // Both stores answer the same calls with the shape vaquitas-core.js expects.
  // state can be replaced (sync, import), so always reach it through V()
  const V = () => (state.vq ||= { groups: [], participants: [], vaquitas: [], members: [], expenses: [], shares: [], payments: [] });

  // my position in a group, for the list
  function withMine(d) {
    const s = summarizeGroup(d), me = s.perPerson.find((p) => p.participantId === d.meId);
    return { id: d.id, kind: d.kind, title: d.title, startsOn: d.startsOn, endsOn: d.endsOn, status: d.status, participantCount: d.participants.length, people: d.participants.map((p) => p.name),
      total: s.total, pending: s.pendingTransfers, myNet: me ? me.net : 0, myInvolved: !!(me && (me.paid || me.fairShare)) };
  }
  const localStore = {
    shared: false,
    async list() {
      return Promise.all(V().groups.map(async (g) => withMine(await this.load(g.id))));
    },
    async load(id) {
      const g = V().groups.find((x) => x.id === id);
      if (!g) throw Error('No encontramos esta vaquita.');
      const participants = V().participants.filter((p) => p.groupId === id);
      const vaquitas = V().vaquitas.filter((v) => v.groupId === id).map((v) => ({ ...v, memberIds: V().members.filter((m) => m.vaquitaId === v.id).map((m) => m.participantId) }));
      const expenses = V().expenses.filter((e) => e.groupId === id).map((e) => ({ ...e, shares: V().shares.filter((s) => s.expenseId === e.id).map((s) => ({ participantId: s.participantId, value: s.value })) }));
      return { ...g, participants, vaquitas, expenses, payments: V().payments.filter((p) => p.groupId === id), meId: participants.find((p) => p.isMe)?.id, canEdit: g.status === 'open' };
    },
    async createGroup({ kind, title, startsOn, endsOn, meName, names }) {
      const g = { id: uid(), kind, title, startsOn, endsOn, status: 'open', linkCanEdit: false, createdAt: new Date().toISOString() };
      V().groups.push(g);
      V().participants.push({ id: uid(), groupId: g.id, name: meName, isMe: true });
      for (const n of names) V().participants.push({ id: uid(), groupId: g.id, name: n });
      save();
      return g.id;
    },
    async updateGroup(id, patch) { Object.assign(V().groups.find((g) => g.id === id), patch); save(); },
    async deleteGroup(id) {
      const ex = new Set(V().expenses.filter((e) => e.groupId === id).map((e) => e.id)), vs = new Set(V().vaquitas.filter((v) => v.groupId === id).map((v) => v.id));
      V().groups = V().groups.filter((g) => g.id !== id); V().participants = V().participants.filter((p) => p.groupId !== id);
      V().vaquitas = V().vaquitas.filter((v) => v.groupId !== id); V().members = V().members.filter((m) => !vs.has(m.vaquitaId));
      V().expenses = V().expenses.filter((e) => e.groupId !== id); V().shares = V().shares.filter((s) => !ex.has(s.expenseId));
      V().payments = V().payments.filter((p) => p.groupId !== id); save();
    },
    async addPerson(groupId, name) { const id = uid(); V().participants.push({ id, groupId, name }); save(); return id; },
    async reminders() { return []; },
    async updatePerson(id, patch) { Object.assign(V().participants.find((p) => p.id === id), patch); save(); },
    async removePerson(id) { V().participants = V().participants.filter((p) => p.id !== id); V().members = V().members.filter((m) => m.participantId !== id); save(); },
    async addVaquita(groupId, title, memberIds) {
      const id = uid(); V().vaquitas.push({ id, groupId, title, status: 'open' });
      for (const m of memberIds) V().members.push({ vaquitaId: id, participantId: m });
      save(); return id;
    },
    async deleteVaquita(id) {
      const ex = new Set(V().expenses.filter((e) => e.vaquitaId === id).map((e) => e.id));
      V().vaquitas = V().vaquitas.filter((v) => v.id !== id); V().members = V().members.filter((m) => m.vaquitaId !== id);
      V().expenses = V().expenses.filter((e) => e.vaquitaId !== id); V().shares = V().shares.filter((s) => !ex.has(s.expenseId));
      V().payments = V().payments.filter((p) => p.vaquitaId !== id); save();
    },
    async addExpense(e) {
      const id = uid();
      V().expenses.push({ id, groupId: e.groupId, vaquitaId: e.vaquitaId, title: e.title, amount: e.amount, payerId: e.payerId, splitMode: e.splitMode, spentOn: e.spentOn, numioTxn: e.numioTxn || null, receiptRef: e.receiptRef || null });
      if (e.receiptRef && V().expenses.filter((x) => x.groupId === e.groupId && x.receiptRef === e.receiptRef).length > 1) { V().expenses.pop(); throw Error('Ese comprobante ya está cargado en esta vaquita.'); }
      for (const s of e.shares) V().shares.push({ expenseId: id, participantId: s.participantId, value: s.value ?? null });
      save(); return id;
    },
    async deleteExpense(id) { V().expenses = V().expenses.filter((e) => e.id !== id); V().shares = V().shares.filter((s) => s.expenseId !== id); save(); },
    async addPayment(p) { V().payments.push({ id: uid(), ...p }); save(); },
    async deletePayment(id) { V().payments = V().payments.filter((p) => p.id !== id); save(); },
  };

  // Supabase: the tables of supabase/migrations/*_vaquitas.sql. RLS decides who sees and who edits.
  const remoteStore = (db, user) => {
    const ok = ({ data, error }) => { if (error) throw Error(/relation|does not exist|schema cache/.test(error.message || '') ? 'Falta crear las tablas de vaquitas en Supabase (el archivo vaquitas.sql).' : error.code === '23505' ? (/receipt/.test(error.message) ? 'Ese comprobante ya está cargado en esta vaquita.' : /username/.test(error.message) ? 'Ese @usuario ya lo tiene otra persona.' : 'Eso ya existe.') : error.message?.startsWith('Solo podés') ? error.message : 'No se pudo guardar: ' + error.message); return data; };
    const mapP = (p) => ({ id: p.id, name: p.name, aliasCbu: p.alias_cbu, userId: p.user_id, canEdit: p.can_edit, isMe: p.user_id === user.id });
    return {
      shared: true,
      async list() {
        const groups = ok(await db.from('vq_groups').select('id').order('created_at', { ascending: false }));
        return Promise.all(groups.map(async (g) => withMine(await this.load(g.id))));
      },
      async load(id) {
        const g = ok(await db.from('vq_groups').select('*').eq('id', id).maybeSingle());
        if (!g) throw Error('No encontramos esta vaquita.');
        const [ps, vs, es, pays] = await Promise.all([
          db.from('vq_participants').select('*').eq('group_id', id).order('created_at'),
          db.from('vq_vaquitas').select('*,vq_vaquita_members(participant_id)').eq('group_id', id).order('created_at'),
          db.from('vq_expenses').select('*,vq_expense_shares(participant_id,value)').eq('group_id', id).order('spent_on').order('created_at'),
          db.from('vq_payments').select('*').eq('group_id', id).order('created_at'),
        ]).then((r) => r.map(ok));
        const participants = ps.map(mapP), me = participants.find((p) => p.isMe);
        return {
          id: g.id, kind: g.kind, title: g.title, startsOn: g.starts_on, endsOn: g.ends_on, status: g.status, shareToken: g.share_token, linkCanEdit: g.link_can_edit, mine: g.owner_id === user.id,
          canEdit: g.status === 'open' && (g.owner_id === user.id || !!me?.canEdit),
          participants, meId: me?.id,
          vaquitas: vs.map((v) => ({ id: v.id, title: v.title, status: v.status, memberIds: v.vq_vaquita_members.map((m) => m.participant_id) })),
          expenses: es.map((e) => ({ id: e.id, vaquitaId: e.vaquita_id, title: e.title, amount: +e.amount, payerId: e.payer_id, splitMode: e.split_mode, spentOn: e.spent_on, numioTxn: e.numio_txn, receiptRef: e.receipt_ref, createdBy: e.created_by, shares: e.vq_expense_shares.map((s) => ({ participantId: s.participant_id, value: s.value == null ? null : +s.value })) })),
          payments: pays.map((p) => ({ id: p.id, vaquitaId: p.vaquita_id, fromId: p.from_id, toId: p.to_id, amount: +p.amount })),
        };
      },
      async createGroup({ kind, title, startsOn, endsOn, meName, names, friendIds }) {
        const g = ok(await db.from('vq_groups').insert({ kind, title, starts_on: startsOn || null, ends_on: endsOn || null }).select('id').single());
        const prof = await this.profile().catch(() => null);
        ok(await db.from('vq_participants').insert([{ group_id: g.id, user_id: user.id, name: meName, alias_cbu: prof?.aliasCbu || null }, ...names.map((name) => ({ group_id: g.id, name }))]));
        for (const f of friendIds || []) ok(await db.from('vq_participants').insert({ group_id: g.id, user_id: f.userId, name: f.name, alias_cbu: f.aliasCbu || null }));
        return g.id;
      },
      async updateGroup(id, patch) {
        const row = {};
        if ('status' in patch) row.status = patch.status;
        if ('linkCanEdit' in patch) row.link_can_edit = patch.linkCanEdit;
        if ('title' in patch) row.title = patch.title;
        ok(await db.from('vq_groups').update(row).eq('id', id));
      },
      async deleteGroup(id) { ok(await db.from('vq_groups').delete().eq('id', id)); },
      async addPerson(groupId, name, friend) { return ok(await db.from('vq_participants').insert({ group_id: groupId, name, user_id: friend?.userId || null, alias_cbu: friend?.aliasCbu || null }).select('id').single()).id; },
      // friends by @usuario
      async profile() { const p = ok(await db.from('vq_profiles').select('*').eq('user_id', user.id).maybeSingle()); return p && { username: p.username, name: p.name, aliasCbu: p.alias_cbu, friendsOnly: p.friends_only }; },
      async saveProfile(p) { ok(await db.from('vq_profiles').upsert({ user_id: user.id, username: p.username, name: p.name, alias_cbu: p.aliasCbu || null, friends_only: !!p.friendsOnly })); },
      async findUser(handle) { return (ok(await db.rpc('vq_find_user', { handle })) || []).map((u) => ({ userId: u.user_id, username: u.username, name: u.name })); },
      async friends() {
        const rows = ok(await db.from('vq_friends').select('*'));
        const ids = [...new Set(rows.flatMap((r) => [r.requester, r.addressee]).filter((x) => x !== user.id))];
        const profs = ids.length ? ok(await db.from('vq_profiles').select('user_id,username,name,alias_cbu').in('user_id', ids)) : [];
        const who = (id) => { const p = profs.find((x) => x.user_id === id); return { userId: id, username: p?.username || '', name: p?.name || 'Sin nombre', aliasCbu: p?.alias_cbu || null }; };
        return {
          accepted: rows.filter((r) => r.status === 'accepted').map((r) => who(r.requester === user.id ? r.addressee : r.requester)),
          incoming: rows.filter((r) => r.status === 'pending' && r.addressee === user.id).map((r) => who(r.requester)),
          outgoing: rows.filter((r) => r.status === 'pending' && r.requester === user.id).map((r) => who(r.addressee)),
        };
      },
      async request(userId) { ok(await db.from('vq_friends').insert({ requester: user.id, addressee: userId })); },
      async accept(userId) { ok(await db.from('vq_friends').update({ status: 'accepted' }).eq('requester', userId).eq('addressee', user.id)); },
      async unfriend(userId) { ok(await db.from('vq_friends').delete().or(`and(requester.eq.${user.id},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${user.id})`)); },
      // payment reminders
      async remind(r) { ok(await db.from('vq_reminders').insert({ group_id: r.groupId, from_id: r.fromId, to_id: r.toId, amount: r.amount })); },
      async reminders() {
        const mine = ok(await db.from('vq_participants').select('id').eq('user_id', user.id)).map((p) => p.id);
        if (!mine.length) return [];
        const rows = ok(await db.from('vq_reminders').select('id,group_id,from_id,amount,created_at,vq_groups(title),from:vq_participants!vq_reminders_from_id_fkey(name)').in('to_id', mine).eq('seen', false).order('created_at', { ascending: false }));
        return rows.map((r) => ({ id: r.id, groupId: r.group_id, amount: +r.amount, title: r.vq_groups?.title || '', from: r.from?.name || '' }));
      },
      async seen(id) { ok(await db.from('vq_reminders').update({ seen: true }).eq('id', id)); },
      async updatePerson(id, patch) { const row = {}; if ('name' in patch) row.name = patch.name; if ('aliasCbu' in patch) row.alias_cbu = patch.aliasCbu || null; ok(await db.from('vq_participants').update(row).eq('id', id)); },
      async removePerson(id) { ok(await db.from('vq_participants').delete().eq('id', id)); },
      async addVaquita(groupId, title, memberIds) {
        const v = ok(await db.from('vq_vaquitas').insert({ group_id: groupId, title }).select('id').single());
        ok(await db.from('vq_vaquita_members').insert(memberIds.map((m) => ({ vaquita_id: v.id, participant_id: m }))));
        return v.id;
      },
      async deleteVaquita(id) { ok(await db.from('vq_vaquitas').delete().eq('id', id)); },
      async addExpense(e) {
        const row = ok(await db.from('vq_expenses').insert({ group_id: e.groupId, vaquita_id: e.vaquitaId, title: e.title, amount: e.amount, payer_id: e.payerId, split_mode: e.splitMode, spent_on: e.spentOn, numio_txn: e.numioTxn || null, receipt_ref: e.receiptRef || null }).select('id').single());
        const { error } = await db.from('vq_expense_shares').insert(e.shares.map((s) => ({ expense_id: row.id, participant_id: s.participantId, value: s.value ?? null })));
        if (error) { await db.from('vq_expenses').delete().eq('id', row.id); ok({ error }); }
        return row.id;
      },
      async deleteExpense(id) { ok(await db.from('vq_expenses').delete().eq('id', id)); },
      async addPayment(p) { ok(await db.from('vq_payments').insert({ group_id: p.groupId, vaquita_id: p.vaquitaId, from_id: p.fromId, to_id: p.toId, amount: p.amount })); },
      async deletePayment(id) { ok(await db.from('vq_payments').delete().eq('id', id)); },
      async peek(token) { const d = ok(await db.rpc('vq_shared', { token })); if (!d) throw Error('Ese link no es de una vaquita, o la borraron.'); return d; },
      async join(token, participant, name) { return ok(await db.rpc('vq_join', { token, participant: participant || null, display_name: name || null })); },
    };
  };

  const store = () => {
    const c = host()?.cloud?.();
    return c?.client && c.user ? remoteStore(c.client, c.user) : localStore;
  };

  // ── screen state ────────────────────────────────────────────────────────────────────────────────────────────
  const vq = { listLoading: false, list: null, listError: '', reminders: [], open: null, data: null, scope: undefined, busy: false, loadingId: null, screen: 'list', friends: null, profile: undefined };
  const myName = () => (state.name || '').trim() || 'Yo';
  const shared = () => store().shared;

  async function refreshList() {
    if (vq.listLoading) return;
    vq.listLoading = true;
    try { const st = store(); [vq.list, vq.reminders] = await Promise.all([st.list(), st.reminders().catch(() => [])]); vq.listError = ''; }
    catch (e) { vq.listError = e.message; vq.list = vq.list || []; }
    vq.listLoading = false;
    if (irisTab === 'vaquitas') render();
  }
  async function refreshGroup(id = vq.open) {
    if (!id) return;
    vq.loadingId = id;
    try { const d = await store().load(id); if (vq.open === id) vq.data = d; } catch (e) { notify(e.message); vq.open = null; vq.data = null; }
    vq.loadingId = null;
    if (irisTab === 'vaquitas') render();
  }
  async function refreshFriends() {
    try { const st = store(); [vq.profile, vq.friends] = await Promise.all([st.profile(), st.friends()]); }
    catch (e) { vq.profile = null; vq.friends = { accepted: [], incoming: [], outgoing: [], error: e.message }; }
    if (irisTab === 'vaquitas') render();
  }
  async function act(fn, done = 'Listo') {
    if (vq.busy) return;
    vq.busy = true;
    try { await fn(); if (done) notify(done); } catch (e) { notify(e.message || 'No se pudo.'); }
    finally { vq.busy = false; }
    await Promise.all([refreshGroup(), refreshList(), vq.screen === 'friends' ? refreshFriends() : null]);
  }

  // ── pieces ──────────────────────────────────────────────────────────────────────────────────────────────────
  const nameOf = (d, id) => d.participants.find((p) => p.id === id)?.name || '—';
  const TONES = ['#5b8def', '#e0795a', '#3fa58a', '#a86fd6', '#d6a23f', '#d6608c', '#4aa3b8'];
  const tone = (n) => TONES[[...String(n)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
  const initials = (n) => esc(String(n).trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?');
  const avatar = (n, cls = '') => `<span class="vq-av ${cls}" style="--t:${tone(n)}" aria-hidden="true">${initials(n)}</span>`;
  const stack = (names) => `<span class="vq-stack">${names.slice(0, 4).map((n) => avatar(n)).join('')}${names.length > 4 ? `<span class="vq-av vq-more">+${names.length - 4}</span>` : ''}</span>`;
  const status = (net, involved) => !involved ? '<span class="vq-pill">Sin gastos</span>' : net > 0 ? `<span class="vq-pill in">Te deben ${money(net)}</span>` : net < 0 ? `<span class="vq-pill out">Debés ${money(-net)}</span>` : '<span class="vq-pill ok">Al día</span>';
  const SVG = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const I = {
    bell: SVG('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    more: SVG('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    receipt: SVG('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    paste: SVG('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h4"/>'),
    trip: SVG('<path d="M3 17h18M5 17l2-7h10l2 7M9 10V7h6v3"/>'),
    send: SVG('<path d="M4 12 20 4l-6 16-3-7z"/>'),
    arrow: SVG('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  };

  // ── receipt picker (numio expense form and vaquita expense form) ─────────────────────────────────────────────
  function receiptPicker(slot, onRead) {
    const canPaste = !!navigator.clipboard?.read;
    slot.innerHTML = `<div class="vq-receipt"><span class="vq-receipt-ic">${I.receipt}</span><div class="vq-receipt-copy"><strong>Desde un comprobante</strong><small>De Mercado Pago o tu banco. Se lee en el teléfono: la imagen no se sube.</small></div>
      <div class="vq-receipt-btns"><label class="vq-chip-btn">${icon('plus')}Elegir captura<input type="file" accept="image/*" hidden></label>${canPaste ? `<button type="button" class="vq-chip-btn" data-paste>${I.paste}Pegar</button>` : ''}</div><p class="vq-receipt-state" aria-live="polite" hidden></p></div>`;
    const out = slot.querySelector('.vq-receipt-state');
    const say = (t, bad) => { out.hidden = !t; out.textContent = t || ''; out.classList.toggle('bad', !!bad); };
    const read = async (blob) => {
      say('Leyendo el comprobante…');
      try {
        const r = await host().readReceipt(blob, (p) => { if (p?.phase === 'reading') say(`Leyendo el comprobante… ${Math.round((p.progress || 0) * 100)} %`); });
        say(`Listo: ${money(r.amount)}${r.who ? ' · ' + r.who : ''}${r.date ? ' · ' + nice(r.date) : ''}. Revisá y guardá.`);
        onRead(r);
      } catch (e) { say(e.message || 'No pude leer la imagen.', true); }
    };
    slot.querySelector('input[type=file]').onchange = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) read(f); };
    slot.querySelector('[data-paste]')?.addEventListener('click', async () => {
      try { for (const item of await navigator.clipboard.read()) { const t = item.types.find((x) => x.startsWith('image/')); if (t) return read(await item.getType(t)); } say('No hay ninguna imagen copiada. En Mercado Pago tocá Compartir comprobante → Copiar.', true); }
      catch { say('No pude leer lo copiado. Probá con «Elegir captura».', true); }
    });
  }
  const setNum = (input, v) => { if (input) { input.value = String(v); input.dispatchEvent(new Event('input', { bubbles: true })); } };
  const receiptTitle = (r) => r.who ? `${r.kind === 'payment' ? 'Pago a' : 'Transferencia a'} ${r.who}` : 'Pago con Mercado Pago';

  // numio's own expense form gets the same picker
  if (typeof movementForm === 'function') {
    const formBefore = movementForm;
    movementForm = function (kind, id, pre) {
      const out = formBefore.apply(this, arguments);
      if (id) return out;
      const f = document.getElementById(kind === 'incomes' ? 'incomeForm' : 'expenseForm');
      if (!f) return out;
      if (pre) {
        f.text.value = pre.title; setNum(f.amount, pre.amount); if (pre.date) f.date.value = pre.date;
        const m = [...f.method.options].find((o) => o.textContent === (pre.kind === 'payment' ? 'Billetera virtual' : 'Transferencia')); if (m) f.method.value = m.value;
        if (pre.operation && f.account) f.account.value = 'Mercado Pago · op. ' + pre.operation;
      }
      if (kind !== 'expenses') return out;
      const slot = document.createElement('div'); slot.className = 'vq-receipt-slot'; f.prepend(slot);
      receiptPicker(slot, (r) => {
        if (r.operation && [...state.expenses, ...state.incomes].some((x) => String(x.account || '').includes(r.operation))) notify('Ojo: ese comprobante ya está cargado.');
        if (r.incoming) { closeModal(); movementForm('incomes', undefined, { ...r, title: r.who ? 'Transferencia de ' + r.who : 'Transferencia recibida' }); notify('Era plata que recibiste: lo pasé a Ingreso.'); return; }
        f.text.value = receiptTitle(r); setNum(f.amount, r.amount); if (r.date) f.date.value = r.date;
        const m = [...f.method.options].find((o) => o.textContent === (r.kind === 'payment' ? 'Billetera virtual' : 'Transferencia')); if (m) f.method.value = m.value;
        if (r.operation && f.account) f.account.value = 'Mercado Pago · op. ' + r.operation;
      });
      return out;
    };
  }

  // ── list ────────────────────────────────────────────────────────────────────────────────────────────────────
  function listMarkup() {
    if (!vq.list) { refreshList(); return `<div class="vq-head"><div><h1>Vaquitas</h1><p class="vq-sub">Cargando…</p></div></div>`; }
    const open = vq.list.filter((g) => g.status === 'open'), closed = vq.list.filter((g) => g.status !== 'open');
    const owed = open.reduce((a, g) => a + Math.max(0, g.myNet), 0), owe = open.reduce((a, g) => a + Math.max(0, -g.myNet), 0);
    const row = (g) => `<button class="vq-row" onclick="vqOpen('${g.id}')"><span class="vq-tile ${g.kind}">${g.kind === 'viaje' ? I.trip : icon('users')}</span><span class="vq-row-copy"><strong>${esc(g.title)}</strong><small>${plural(g.participantCount, 'persona', 'personas')}${range(g) ? ' · ' + range(g) : ''}</small></span>${status(g.myNet, g.myInvolved)}<span class="vq-chev">${icon('right')}</span></button>`;
    return `<div class="vq-head"><div><h1>Vaquitas</h1><p class="vq-sub">Gastos compartidos: quién pagó qué y quién le pasa a quién.</p></div>
      <div class="vq-head-actions">${shared() ? `<button type="button" class="vq-ghost" onclick="vqFriends()">${icon('users')}Amigos</button>` : ''}<button type="button" class="primary vq-cta" onclick="vqNewForm()">${icon('plus')}Nueva</button></div></div>
    ${vq.reminders.map((r) => `<section class="vq-remind"><span class="vq-remind-ic">${I.bell}</span><div><strong>${esc(r.from)} te recordó un pago</strong><small>Le debés ${money(r.amount)} en ${esc(r.title)}</small></div><button type="button" onclick="vqSeen('${r.id}','${r.groupId}')">Ver</button></section>`).join('')}
    ${vq.listError ? `<section class="vq-note bad">${esc(vq.listError)}</section>` : ''}
    ${open.length && (owed || owe) ? `<section class="vq-balance"><div><span>Te deben</span><b class="in ${owed ? '' : 'zero'}">${money(owed)}</b></div><div><span>Debés</span><b class="out ${owe ? '' : 'zero'}">${money(owe)}</b></div></section>` : ''}
    ${open.length ? `<p class="vq-caption">Activas</p><section class="vq-list">${open.map(row).join('')}</section>` : ''}
    ${!vq.list.length ? `<section class="vq-empty"><span class="vq-empty-art">${stack(['Juli', 'Tomi', 'Vos'])}</span><h2>Todavía no armaste ninguna vaquita</h2><p>Un viaje, un asado, el regalo de alguien: sumá a tu gente, cargá quién pagó qué y numio calcula quién le transfiere a quién, con la menor cantidad de transferencias.</p><button type="button" class="primary vq-cta" onclick="vqNewForm()">${icon('plus')}Armar una vaquita</button>${shared() ? `<button type="button" class="vq-link" onclick="vqJoinForm()">Me pasaron un link</button>` : ''}</section>` : ''}
    ${closed.length ? `<p class="vq-caption">Cerradas</p><section class="vq-list vq-closed">${closed.map(row).join('')}</section>` : ''}
    ${vq.list.length && shared() ? `<button type="button" class="vq-link vq-join" onclick="vqJoinForm()">${icon('link')}Me pasaron un link</button>` : ''}
    <p class="vq-foot">${shared() ? 'Se guardan en tu cuenta. Con el link las ve cualquiera, aunque no tenga nubo.' : 'Sin sesión iniciada, las vaquitas quedan en este teléfono. Iniciá sesión en Ajustes › Cuenta para compartirlas con un link y sumar amigos.'}</p>`;
  }

  // ── friends ─────────────────────────────────────────────────────────────────────────────────────────────────
  function friendsMarkup() {
    const back = `<button type="button" class="vq-back" onclick="vqBack()">${icon('left')}Vaquitas</button>`;
    if (vq.friends === null) { refreshFriends(); return `<div class="vq-nav">${back}</div><h1 class="vq-title">Amigos</h1><p class="vq-sub">Cargando…</p>`; }
    const f = vq.friends, p = vq.profile;
    const person = (u, actions) => `<li>${avatar(u.name)}<span class="vq-row-copy"><strong>${esc(u.name)}</strong><small>@${esc(u.username)}${u.aliasCbu ? ' · ' + esc(u.aliasCbu) : ''}</small></span><span class="vq-row-end">${actions}</span></li>`;
    if (!p) return `<div class="vq-nav">${back}</div><h1 class="vq-title">Amigos</h1><p class="vq-sub">Elegí tu @usuario: así tus amigos te encuentran y te suman a sus vaquitas con un toque.</p>
      ${f.error ? `<section class="vq-note bad">${esc(f.error)}</section>` : ''}
      <form class="vq-card vq-form" id="vqProfile"><label>Tu @usuario<span class="vq-at"><i>@</i><input name="username" required minlength="3" maxlength="24" pattern="[a-z0-9_.]{3,24}" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="franco"></span></label>
      <label>Tu nombre<input name="name" required maxlength="60" value="${esc(state.name || '')}" autocomplete="name"></label>
      <label>Alias o CBU <small>para que te transfieran</small><input name="alias" maxlength="60" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="franco.mp"></label>
      <button class="primary">Guardar</button></form>`;
    return `<div class="vq-nav">${back}</div><h1 class="vq-title">Amigos</h1><p class="vq-sub">Tus amigos aparecen al armar una vaquita y entran directo, sin aceptar una invitación.</p>
      <section class="vq-card vq-me-card">${avatar(p.name, 'lg')}<div class="vq-row-copy"><strong>${esc(p.name)}</strong><small>@${esc(p.username)}${p.aliasCbu ? ' · ' + esc(p.aliasCbu) : ' · sin alias'}</small></div><button type="button" class="vq-ghost sm" onclick="vqProfileForm()">Editar</button></section>
      <form class="vq-search" id="vqFind"><span class="vq-at"><i>@</i><input name="h" required autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="usuario de tu amigo" aria-label="Buscar por @usuario"></span><button class="primary">Buscar</button></form>
      <div id="vqFound"></div>
      ${f.incoming.length ? `<p class="vq-caption">Quieren ser tus amigos</p><ul class="vq-card vq-people">${f.incoming.map((u) => person(u, `<button type="button" class="vq-ghost sm" onclick="vqUnfriend('${u.userId}','Solicitud rechazada')">Rechazar</button><button type="button" class="primary sm" onclick="vqAccept('${u.userId}')">Aceptar</button>`)).join('')}</ul>` : ''}
      <p class="vq-caption">Tus amigos</p>${f.accepted.length ? `<ul class="vq-card vq-people">${f.accepted.map((u) => person(u, `<button type="button" class="vq-x" aria-label="Quitar a ${esc(u.name)}" onclick="vqUnfriend('${u.userId}','${esc(u.name)} ya no está en tus amigos')">${icon('x')}</button>`)).join('')}</ul>` : `<section class="vq-card vq-muted-card">Todavía no agregaste a nadie. Buscalos por su @usuario.</section>`}
      ${f.outgoing.length ? `<p class="vq-caption">Esperando respuesta</p><ul class="vq-card vq-people">${f.outgoing.map((u) => person(u, `<button type="button" class="vq-ghost sm" onclick="vqUnfriend('${u.userId}','Solicitud cancelada')">Cancelar</button>`)).join('')}</ul>` : ''}
      <p class="vq-foot">Les llega la solicitud en su numio y, cuando aceptan, quedan como amigos los dos.</p>`;
  }
  function bindFriends() {
    const pf = document.getElementById('vqProfile');
    if (pf) pf.onsubmit = (e) => { e.preventDefault(); const u = pf.username.value.trim().toLowerCase().replace(/^@/, ''); act(() => store().saveProfile({ username: u, name: pf.name.value.trim(), aliasCbu: pf.alias.value.trim() }), 'Listo, ya sos @' + u); };
    const ff = document.getElementById('vqFind');
    if (ff) ff.onsubmit = async (e) => {
      e.preventDefault(); const box = document.getElementById('vqFound');
      try {
        const [u] = await store().findUser(ff.h.value); const f = vq.friends;
        if (!u) { box.innerHTML = `<p class="vq-note">No hay nadie con ese @usuario.</p>`; return; }
        const known = f.accepted.some((x) => x.userId === u.userId) ? 'Ya es tu amigo' : f.outgoing.some((x) => x.userId === u.userId) ? 'Enviado' : '';
        box.innerHTML = `<ul class="vq-card vq-people"><li>${avatar(u.name)}<span class="vq-row-copy"><strong>${esc(u.name)}</strong><small>@${esc(u.username)}</small></span><span class="vq-row-end">${known ? `<span class="vq-pill ok">${known}</span>` : `<button type="button" class="primary sm" onclick="vqRequest('${u.userId}','${esc(u.name)}')">Agregar</button>`}</span></li></ul>`;
      } catch (err) { box.innerHTML = `<p class="vq-note bad">${esc(err.message)}</p>`; }
    };
  }
  window.vqFriends = () => { vq.screen = 'friends'; vq.friends = null; render(); window.scrollTo(0, 0); };
  window.vqRequest = (id, n) => act(() => store().request(id), `Le mandaste la solicitud a ${n}`);
  window.vqAccept = (id) => act(() => store().accept(id), 'Ahora son amigos');
  window.vqUnfriend = (id, msg) => act(() => store().unfriend(id), msg);
  window.vqProfileForm = () => {
    const p = vq.profile;
    modal('Tu perfil', `<form class="form" id="vqProfileEdit"><label>Tu nombre<input name="name" required maxlength="60" value="${esc(p.name)}"></label><label>Alias o CBU<input name="alias" maxlength="60" autocapitalize="off" autocomplete="off" spellcheck="false" value="${esc(p.aliasCbu || '')}"></label>
      <label class="checklabel vq-check"><input type="checkbox" name="only" ${p.friendsOnly ? 'checked' : ''}><span>Solo mis amigos me pueden sumar a vaquitas</span></label><button class="primary">Guardar</button><button type="button" onclick="closeModal()">Cancelar</button></form>`);
    const f = document.getElementById('vqProfileEdit');
    f.onsubmit = (e) => { e.preventDefault(); closeModal(); act(() => store().saveProfile({ ...p, name: f.name.value.trim(), aliasCbu: f.alias.value.trim(), friendsOnly: f.only.checked }), 'Guardado'); };
  };
  window.vqSeen = (id, gid) => { store().seen(id).catch(() => {}); vq.reminders = vq.reminders.filter((r) => r.id !== id); vqOpen(gid); };

  // ── a group ─────────────────────────────────────────────────────────────────────────────────────────────────
  function transfers(d, scope) {
    if (!scope.expenseCount) return `<p class="vq-muted">Cargá el primer gasto y acá aparece quién le transfiere a quién.</p>`;
    if (!scope.settlements.length) return `<div class="vq-done">${icon('check')}<div><strong>Están todos al día</strong><small>No hace falta ninguna transferencia.</small></div></div>`;
    return `<ul class="vq-transfers">${scope.settlements.map((t, i) => {
      const to = d.participants.find((p) => p.id === t.toId), from = nameOf(d, t.fromId);
      return `<li>${avatar(from)}<div class="vq-t-copy"><strong>${esc(from)}${t.fromId === d.meId ? ' <i>vos</i>' : ''} <span class="vq-to">${I.arrow}</span> ${esc(to?.name || '')}${t.toId === d.meId ? ' <i>vos</i>' : ''}</strong>
        <small>${to?.aliasCbu ? `<button type="button" class="vq-alias" onclick="vqCopy('${esc(to.aliasCbu)}','Alias copiado')">alias ${esc(to.aliasCbu)}</button>` : 'sin alias cargado'}</small></div><b class="vq-amt">${money(t.amount)}</b>
        ${d.canEdit ? `<div class="vq-t-actions">${t.toId === d.meId ? `<button type="button" class="vq-ghost sm" onclick="vqRemind(${i})">${I.bell}Recordar</button>` : ''}<button type="button" class="vq-paid" onclick="vqPaid(${i})">Pagado</button></div>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  function expenseRows(d, vaquitaId) {
    const exps = d.expenses.filter((e) => (e.vaquitaId ?? null) === vaquitaId);
    if (!exps.length) return `<p class="vq-muted">Todavía no hay gastos. Sumá lo que pagó cada uno: la carne, la bebida, la nafta…</p>`;
    return `<ul class="vq-expenses">${exps.map((e) => {
      const mine = d.meId ? expenseShares(e).get(d.meId) : 0, how = e.splitMode === 'equal' ? `entre ${e.shares.length}` : { exact: 'montos exactos', shares: 'por partes', percent: 'por porcentaje' }[e.splitMode];
      return `<li><span class="vq-tile sm" style="--t:${tone(e.title)}">${esc(e.title.trim()[0]?.toUpperCase() || '·')}</span><span class="vq-row-copy"><strong>${esc(e.title)}</strong><small>${esc(nameOf(d, e.payerId))} pagó · ${nice(e.spentOn)} · ${how}${mine ? ` · te toca ${money(fromCents(mine))}` : ''}</small></span><b class="vq-amt">${money(e.amount)}</b>${d.canEdit ? `<button type="button" class="vq-x" aria-label="Borrar ${esc(e.title)}" onclick="vqDeleteExpense('${e.id}')">${icon('trash')}</button>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  function hero(d, s, scope) {
    const me = d.meId ? (scope ? scope.balances.find((b) => b.participantId === d.meId) : s.perPerson.find((p) => p.participantId === d.meId)) : null;
    const total = scope ? scope.total : s.total, pend = scope ? scope.settlements.length : s.pendingTransfers;
    const net = me ? me.net : 0, involved = me && (me.paid || me.fairShare);
    const [cls, label] = !d.meId ? ['', 'Total'] : !involved ? ['', 'Todavía no participás'] : net > 0 ? ['in', 'Te deben'] : net < 0 ? ['out', 'Debés'] : ['ok', 'Estás al día'];
    return `<section class="vq-hero ${cls}"><span>${label}</span><b>${!d.meId ? money(total) : involved && net ? money(Math.abs(net)) : '—'}</b>
      <div class="vq-hero-row"><span>Total${d.kind === 'viaje' && !scope ? ' del viaje' : ''}<strong>${money(total)}</strong></span>${d.kind === 'viaje' && !scope ? `<span>Vaquitas<strong>${s.vaquitaCount}</strong></span>` : ''}<span>Por pasar<strong>${pend}</strong></span></div></section>`;
  }
  function groupMarkup() {
    const d = vq.data;
    if (!d) { if (vq.loadingId !== vq.open) refreshGroup(); return `<div class="vq-nav"><button type="button" class="vq-back" onclick="vqBack()">${icon('left')}Vaquitas</button></div><h1 class="vq-title">Cargando…</h1>`; }
    const s = summarizeGroup(d), trip = d.kind === 'viaje', fab = d.canEdit ? `<button type="button" class="primary vq-fab" onclick="vqExpenseForm()">${icon('plus')}Agregar gasto</button>` : '';
    const inScope = trip && vq.scope !== undefined, scopeV = inScope && vq.scope ? d.vaquitas.find((v) => v.id === vq.scope) : null;
    if (inScope) {
      const scope = scopeV ? s.vaquitas.find((x) => x.vaquitaId === scopeV.id) : s.loose;
      const people = scopeV ? scopeV.memberIds.map((id) => nameOf(d, id)) : d.participants.map((p) => p.name);
      return `<div class="vq-nav"><button type="button" class="vq-back" onclick="vqScope()">${icon('left')}${esc(d.title)}</button>${scopeV && d.canEdit ? `<button type="button" class="vq-icon" aria-label="Opciones de la vaquita" onclick="vqDeleteVaquita('${scopeV.id}')">${icon('trash')}</button>` : ''}</div>
        <h1 class="vq-title">${esc(scopeV ? scopeV.title : 'Gastos sueltos')}</h1><div class="vq-people-line">${stack(people)}<span>${esc(people.join(', '))}</span></div>
        ${hero(d, s, scope)}<section class="vq-card"><h2>Quién le paga a quién</h2>${transfers(d, scope)}</section>
        ${paidMarkup(d, scope.vaquitaId)}<section class="vq-card"><h2>Gastos</h2>${expenseRows(d, scope.vaquitaId)}</section>${fab}`;
    }
    return `<div class="vq-nav"><button type="button" class="vq-back" onclick="vqBack()">${icon('left')}Vaquitas</button><button type="button" class="vq-icon" aria-label="Opciones" onclick="vqMenu()">${I.more}</button></div>
      <p class="vq-kind">${trip ? 'Viaje' : 'Juntada'}${range(d) ? ' · ' + range(d) : ''}${d.status !== 'open' ? ' · cerrada' : ''}</p><h1 class="vq-title">${esc(d.title)}</h1>
      <div class="vq-people-line">${stack(d.participants.map((p) => p.name))}<span>${plural(d.participants.length, 'persona', 'personas')}</span></div>
      ${d.status !== 'open' ? `<section class="vq-note">Vaquita cerrada. Ya no se pueden sumar gastos.</section>` : ''}
      ${hero(d, s)}
      ${trip ? `<section class="vq-card"><div class="vq-h2row"><h2>Vaquitas</h2>${d.canEdit ? `<button type="button" class="vq-ghost sm" onclick="vqVaquitaForm()">${icon('plus')}Nueva</button>` : ''}</div>
        ${s.vaquitas.length ? '' : `<p class="vq-muted">Armá una vaquita para cada cosa del viaje: la nafta, el hospedaje, el asado… Cada una con la gente que participa.</p>`}
        <div class="vq-list flat">${s.vaquitas.map((v) => { const vv = d.vaquitas.find((x) => x.id === v.vaquitaId); return `<button class="vq-row" onclick="vqScope('${v.vaquitaId}')"><span class="vq-tile sm" style="--t:${tone(v.title)}">${esc(v.title.trim()[0]?.toUpperCase() || '·')}</span><span class="vq-row-copy"><strong>${esc(v.title)}</strong><small>${plural(vv.memberIds.length, 'persona', 'personas')} · ${v.expenseCount ? money(v.total) : 'sin gastos'}</small></span>${v.settlements.length ? `<span class="vq-pill">${plural(v.settlements.length, 'transferencia', 'transferencias')}</span>` : v.expenseCount ? '<span class="vq-pill ok">Al día</span>' : ''}<span class="vq-chev">${icon('right')}</span></button>`; }).join('')}
        <button class="vq-row vq-loose" onclick="vqScope('')"><span class="vq-tile sm">${icon('users')}</span><span class="vq-row-copy"><strong>Gastos sueltos</strong><small>Entre todos · ${s.loose.expenseCount ? money(s.loose.total) : 'sin gastos'}</small></span>${s.loose.settlements.length ? `<span class="vq-pill">${plural(s.loose.settlements.length, 'transferencia', 'transferencias')}</span>` : ''}<span class="vq-chev">${icon('right')}</span></button></div></section>`
        : `<section class="vq-card"><h2>Quién le paga a quién</h2>${transfers(d, s.loose)}</section>${paidMarkup(d, null)}<section class="vq-card"><h2>Gastos</h2>${expenseRows(d, null)}</section>`}
      <section class="vq-card"><div class="vq-h2row"><h2>${trip ? 'Gente del viaje' : 'Gente'}</h2>${d.canEdit ? `<button type="button" class="vq-ghost sm" onclick="vqPersonForm()">${icon('plus')}Sumar</button>` : ''}</div>
        <ul class="vq-people">${d.participants.map((p) => { const b = s.perPerson.find((x) => x.participantId === p.id) || { paid: 0, fairShare: 0, net: 0 };
          return `<li><button type="button" onclick="vqPersonForm('${p.id}')" ${d.canEdit ? '' : 'disabled'}>${avatar(p.name)}<span class="vq-row-copy"><strong>${esc(p.name)}${p.isMe ? ' <i>vos</i>' : ''}${p.userId && !p.isMe ? ' <i class="acc">en nubo</i>' : ''}</strong><small>Puso ${money(b.paid)} · le toca ${money(b.fairShare)}</small></span><span class="vq-state ${b.net > 0 ? 'in' : b.net < 0 ? 'out' : ''}">${b.net > 0 ? 'Recibe ' + money(b.net) : b.net < 0 ? 'Pone ' + money(-b.net) : 'Al día'}</span></button></li>`; }).join('')}</ul>
        ${trip ? `<p class="vq-muted">Sumando todas las vaquitas. Cada vaquita se paga aparte: entrá a cada una para ver quién le pasa a quién.</p>` : ''}</section>
      <div class="vq-share"><button type="button" class="vq-wa" onclick="vqWhatsApp()">${I.send}Compartir por WhatsApp</button>${shared() ? `<button type="button" class="vq-ghost" onclick="vqCopyLink()">${icon('link')}Copiar link</button>` : ''}</div>
      <p class="vq-foot">${shared() ? (d.linkCanEdit ? 'Cualquiera con el link puede cargar gastos.' : 'Con el link la ven todos, solo para ver.') : 'Guardada en este teléfono.'}</p>${fab}`;
  }
  function paidMarkup(d, vaquitaId) {
    const pays = d.payments.filter((p) => (p.vaquitaId ?? null) === vaquitaId);
    return pays.length ? `<section class="vq-card"><h2>Ya transferido</h2><ul class="vq-paid-list">${pays.map((p) => `<li><span class="vq-row-copy"><strong>${esc(nameOf(d, p.fromId))} → ${esc(nameOf(d, p.toId))}</strong></span><b class="vq-amt">${money(p.amount)}</b>${d.canEdit ? `<button type="button" class="vq-x" aria-label="Deshacer transferencia" onclick="vqUndoPay('${p.id}')">${icon('x')}</button>` : ''}</li>`).join('')}</ul></section>` : '';
  }

  // ── actions ─────────────────────────────────────────────────────────────────────────────────────────────────
  window.vqOpen = (id) => { vq.screen = 'group'; vq.open = id; vq.data = null; vq.scope = undefined; render(); window.scrollTo(0, 0); };
  window.vqBack = () => { vq.screen = 'list'; vq.open = null; vq.data = null; vq.scope = undefined; refreshList(); render(); window.scrollTo(0, 0); };
  window.vqScope = (id) => { vq.scope = id === undefined ? undefined : id || null; render(); window.scrollTo(0, 0); };
  window.vqCopy = async (text, msg) => { try { await navigator.clipboard.writeText(text); notify(msg); } catch { notify('No se pudo copiar.'); } };
  const shareURL = (d) => location.origin + '/v/' + d.shareToken;
  window.vqCopyLink = () => vqCopy(shareURL(vq.data), 'Link copiado');
  const wa = (text) => { const url = 'https://wa.me/?text=' + encodeURIComponent(text); try { (parent.open || open)(url, '_blank', 'noopener'); } catch { open(url, '_blank'); } };
  window.vqWhatsApp = () => { const d = vq.data; wa(whatsappSummary(d, shared() ? shareURL(d) : '')); };
  window.vqMenu = () => {
    const d = vq.data, trip = d.kind === 'viaje';
    modal(d.title, `<div class="form vq-menu">${shared() && d.mine ? `<label class="checklabel vq-check"><input type="checkbox" id="vqLinkEdit" ${d.linkCanEdit ? 'checked' : ''}><span>Cualquiera con el link puede cargar gastos</span></label>` : ''}
      ${d.mine || !shared() ? `<button type="button" id="vqClose">${d.status === 'open' ? 'Cerrar vaquita' : 'Reabrir vaquita'}</button><button type="button" class="danger" id="vqDel">Borrar ${trip ? 'viaje' : 'vaquita'}</button>` : '<p class="small">Solo quien la armó puede cerrarla o borrarla.</p>'}<button type="button" onclick="closeModal()">Listo</button></div>`);
    document.getElementById('vqLinkEdit')?.addEventListener('change', (e) => act(() => store().updateGroup(vq.open, { linkCanEdit: e.target.checked }), e.target.checked ? 'Con el link también pueden cargar' : 'Con el link solo se ve'));
    document.getElementById('vqClose')?.addEventListener('click', vqToggleClose);
    document.getElementById('vqDel')?.addEventListener('click', vqDeleteGroup);
  };
  window.vqToggleClose = () => {
    const d = vq.data, s = summarizeGroup(d), closing = d.status === 'open';
    const text = closing ? (s.pendingTransfers ? `Todavía hay ${plural(s.pendingTransfers, 'transferencia', 'transferencias')} sin marcar como pagadas. Si la cerrás, ya no se pueden sumar gastos, pero el detalle sigue a la vista.` : 'Están todos al día. Al cerrarla ya no se pueden sumar gastos y deja de contar como vaquita activa.') : 'Se van a poder sumar gastos otra vez.';
    modal(closing ? 'Cerrar vaquita' : 'Reabrir vaquita', `<div class="form"><p>${text}</p><button class="primary" id="vqDo">${closing ? 'Cerrar' : 'Reabrir'}</button><button type="button" onclick="closeModal()">Cancelar</button></div>`);
    document.getElementById('vqDo').onclick = () => { closeModal(); act(() => store().updateGroup(vq.open, { status: closing ? 'settled' : 'open' }), closing ? 'Vaquita cerrada' : 'Vaquita reabierta'); };
  };
  window.vqDeleteGroup = () => {
    const d = vq.data;
    modal('Borrar', `<div class="form"><p>¿Borrar <strong>${esc(d.title)}</strong>? Se borran sus gastos y pagos${shared() ? ' para todos los que la ven' : ''}. No se puede deshacer.</p><button class="danger" id="vqDo">Borrar</button><button type="button" onclick="closeModal()">Cancelar</button></div>`);
    document.getElementById('vqDo').onclick = async () => { closeModal(); const id = vq.open; vq.open = null; vq.data = null; vq.screen = 'list'; await act(() => store().deleteGroup(id), 'Borrada'); render(); };
  };
  window.vqDeleteVaquita = (id) => {
    const v = vq.data.vaquitas.find((x) => x.id === id);
    modal('Borrar vaquita', `<div class="form"><p>¿Borrar <strong>${esc(v.title)}</strong> del viaje? Se borran sus gastos y pagos. No se puede deshacer.</p><button class="danger" id="vqDo">Borrar</button><button type="button" onclick="closeModal()">Cancelar</button></div>`);
    document.getElementById('vqDo').onclick = () => { closeModal(); vq.scope = undefined; act(() => store().deleteVaquita(id), 'Vaquita borrada'); };
  };
  window.vqDeleteExpense = (id) => {
    const e = vq.data.expenses.find((x) => x.id === id);
    modal('Borrar gasto', `<div class="form"><p>¿Borrar <strong>${esc(e.title)}</strong> (${money(e.amount)})? Las cuentas se recalculan.${e.numioTxn ? ' Tu parte anotada en numio queda como está.' : ''}</p><button class="danger" id="vqDo">Borrar</button><button type="button" onclick="closeModal()">Cancelar</button></div>`);
    document.getElementById('vqDo').onclick = () => { closeModal(); act(() => store().deleteExpense(id), 'Gasto borrado'); };
  };
  function currentScope() {
    const d = vq.data, s = summarizeGroup(d);
    if (d.kind !== 'viaje' || vq.scope === undefined || vq.scope === null) return { vaquitaId: null, scope: s.loose };
    return { vaquitaId: vq.scope, scope: s.vaquitas.find((v) => v.vaquitaId === vq.scope) };
  }
  window.vqPaid = (i) => {
    const d = vq.data, { vaquitaId, scope } = currentScope(), t = scope.settlements[i];
    if (!t) return;
    act(() => store().addPayment({ groupId: d.id, vaquitaId, fromId: t.fromId, toId: t.toId, amount: t.amount }), `${nameOf(d, t.fromId)} le pasó ${money(t.amount)} a ${nameOf(d, t.toId)}`);
  };
  window.vqRemind = async (i) => {
    const d = vq.data, { scope } = currentScope(), t = scope.settlements[i];
    if (!t) return;
    const me = d.participants.find((p) => p.id === t.toId), debtor = d.participants.find((p) => p.id === t.fromId);
    const text = `Hola ${debtor.name}! Te recuerdo que en *${d.title}* me tenés que pasar *${money(t.amount)}*${me?.aliasCbu ? `. Mi alias es ${me.aliasCbu}` : ''}.${shared() ? `\nAcá está el detalle: ${shareURL(d)}` : ''}`;
    if (shared() && debtor.userId) { try { await store().remind({ groupId: d.id, fromId: t.toId, toId: t.fromId, amount: t.amount }); notify(`Le avisé a ${debtor.name} en su numio`); } catch (e) { notify(e.message); } }
    wa(text);
  };
  window.vqUndoPay = (id) => act(() => store().deletePayment(id), 'Transferencia deshecha');

  window.vqNewForm = async () => {
    const friends = shared() ? (vq.friends?.accepted || (await store().friends().catch(() => ({ accepted: [] }))).accepted) : [];
    modal('Nueva vaquita', `<form class="form" id="vqNew"><div class="vq-seg" role="radiogroup" aria-label="Tipo"><label><input type="radio" name="kind" value="juntada" checked><span>Juntada</span></label><label><input type="radio" name="kind" value="viaje"><span>Viaje</span></label></div>
      <p class="small vq-kind-help">Una sola cuenta: un asado, una salida, un regalo.</p>
      <label>Nombre<input name="title" required maxlength="80" placeholder="Asado del sábado"></label>
      <div class="form-pair vq-dates" hidden><label>Desde<input name="startsOn" type="date"></label><label>Hasta<input name="endsOn" type="date"></label></div>
      <label>Vos<input name="me" required maxlength="60" value="${esc(myName() === 'Yo' ? '' : myName())}" placeholder="Tu nombre"></label>
      ${friends.length ? `<fieldset class="vq-pick"><legend>Tus amigos</legend><div class="vq-pick-chips">${friends.map((f) => `<label><input type="checkbox" name="friend" value="${f.userId}"><span>${avatar(f.name)}${esc(f.name)}</span></label>`).join('')}</div></fieldset>` : ''}
      <label>${friends.length ? 'Otras personas' : 'Quiénes más'}<textarea name="names" rows="2" placeholder="Un nombre por línea o separados por coma: Juli, Tomi"></textarea></label>
      <button class="primary">Armar</button><button type="button" onclick="closeModal()">Cancelar</button></form>`);
    const f = document.getElementById('vqNew');
    const sync = () => { const trip = f.kind.value === 'viaje'; f.querySelector('.vq-dates').hidden = !trip; f.querySelector('.vq-kind-help').textContent = trip ? 'Varias vaquitas adentro (nafta, hospedaje, asado), cada una con su gente.' : 'Una sola cuenta: un asado, una salida, un regalo.'; f.title.placeholder = trip ? 'Panaholma' : 'Asado del sábado'; };
    f.querySelectorAll('[name=kind]').forEach((r) => (r.onchange = sync));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const picked = [...f.querySelectorAll('[name=friend]:checked')].map((x) => friends.find((fr) => fr.userId === x.value));
      const names = [...new Set(f.names.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean))].filter((n) => n.toLowerCase() !== f.me.value.trim().toLowerCase() && !picked.some((p) => p.name.toLowerCase() === n.toLowerCase())).slice(0, 40);
      if (f.kind.value === 'viaje' && f.startsOn.value && f.endsOn.value && f.endsOn.value < f.startsOn.value) { notify('La fecha de vuelta es antes de la de ida.'); return; }
      closeModal();
      let id;
      await act(async () => { id = await store().createGroup({ kind: f.kind.value, title: f.title.value.trim(), startsOn: f.startsOn.value || null, endsOn: f.endsOn.value || null, meName: f.me.value.trim(), names, friendIds: picked }); }, names.length || picked.length ? 'Vaquita armada' : 'Vaquita armada. Sumá a tu gente desde «Gente».');
      if (id) vqOpen(id);
    };
  };

  window.vqPersonForm = async (id) => {
    const d = vq.data, p = d.participants.find((x) => x.id === id);
    const used = p && (d.expenses.some((e) => e.payerId === id || e.shares.some((s) => s.participantId === id)) || d.payments.some((x) => x.fromId === id || x.toId === id));
    const friends = !p && shared() ? ((vq.friends?.accepted || (await store().friends().catch(() => ({ accepted: [] }))).accepted).filter((f) => !d.participants.some((x) => x.userId === f.userId))) : [];
    modal(p ? p.name : 'Sumar a alguien', `<form class="form" id="vqPerson">${friends.length ? `<fieldset class="vq-pick"><legend>Tus amigos</legend><div class="vq-pick-chips">${friends.map((f) => `<button type="button" data-friend="${f.userId}">${avatar(f.name)}${esc(f.name)}</button>`).join('')}</div></fieldset><p class="small">O alguien sin nubo:</p>` : ''}
      <label>Nombre<input name="name" ${friends.length ? '' : 'required'} maxlength="60" value="${esc(p?.name || '')}"></label>
      ${p ? `<label>Alias o CBU<input name="alias" maxlength="60" autocapitalize="off" autocomplete="off" spellcheck="false" value="${esc(p.aliasCbu || '')}" placeholder="Para que sepan a dónde transferirle"></label>` : `<p class="small">Si es un viaje, después lo sumás a las vaquitas en las que participa. Los gastos sueltos ya lo incluyen.</p>`}
      <button class="primary">${p ? 'Guardar' : 'Sumar'}</button>
      ${p && !p.isMe && d.canEdit ? `<button type="button" class="danger" id="vqRemove" ${used ? 'disabled' : ''}>Sacar de la vaquita</button>${used ? '<p class="small">Tiene gastos o pagos: borralos primero para sacarlo.</p>' : ''}` : ''}
      <button type="button" onclick="closeModal()">Cancelar</button></form>`);
    const f = document.getElementById('vqPerson');
    f.querySelectorAll('[data-friend]').forEach((b) => (b.onclick = () => { const fr = friends.find((x) => x.userId === b.dataset.friend); closeModal(); act(() => store().addPerson(d.id, fr.name, fr), `${fr.name} se sumó`); }));
    document.getElementById('vqRemove')?.addEventListener('click', () => { closeModal(); act(() => store().removePerson(id), `${p.name} ya no está en la vaquita`); });
    f.onsubmit = (e) => {
      e.preventDefault();
      const name = f.name.value.trim();
      if (!name) return;
      if (d.participants.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) { notify('Ya hay alguien con ese nombre. Agregale la inicial del apellido.'); return; }
      closeModal();
      act(() => (p ? store().updatePerson(id, { name, aliasCbu: f.alias.value.trim() }) : store().addPerson(d.id, name)), p ? 'Guardado' : `${name} se sumó`);
    };
  };

  window.vqVaquitaForm = () => {
    const d = vq.data;
    modal('Nueva vaquita', `<form class="form" id="vqVaq"><label>Para qué<input name="title" required maxlength="60" placeholder="Nafta, hospedaje, asado…"></label>
      <fieldset class="vq-pick"><legend>Quiénes participan</legend><div class="vq-pick-chips">${d.participants.map((p) => `<label><input type="checkbox" name="m" value="${p.id}" checked><span>${avatar(p.name)}${esc(p.name)}</span></label>`).join('')}</div></fieldset>
      <button class="primary">Crear</button><button type="button" onclick="closeModal()">Cancelar</button></form>`);
    const f = document.getElementById('vqVaq');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const ids = [...f.querySelectorAll('[name=m]:checked')].map((x) => x.value);
      if (ids.length < 2) { notify('Elegí al menos dos personas.'); return; }
      closeModal();
      let id;
      await act(async () => { id = await store().addVaquita(d.id, f.title.value.trim(), ids); }, 'Vaquita creada');
      if (id) vqScope(id);
    };
  };

  const MODES = [['equal', 'Iguales'], ['exact', 'Montos'], ['shares', 'Partes'], ['percent', '%']];
  window.vqExpenseForm = () => {
    const d = vq.data, trip = d.kind === 'viaje';
    const pre = trip && vq.scope !== undefined ? vq.scope : null;
    const members = (vid) => (vid ? d.vaquitas.find((v) => v.id === vid).memberIds : d.participants.map((p) => p.id));
    const cats = (state.expenseCategories || ['Otros']), accounts = (state.accounts || []).filter((a) => !a.archived && a.currency === 'ARS');
    modal('Nuevo gasto', `<form class="form" id="vqExp"><div class="vq-receipt-slot"></div><label>Qué<input name="title" required maxlength="80" placeholder="Carne, nafta, hospedaje…"></label>
      <div class="form-pair"><label>Monto<input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required></label><label>Fecha<input name="spentOn" type="date" required value="${today()}"></label></div>
      ${trip ? `<label>Va a<select name="vaquita"><option value="">Todo el viaje (gasto suelto)</option>${d.vaquitas.map((v) => `<option value="${v.id}" ${pre === v.id ? 'selected' : ''}>${esc(v.title)}</option>`).join('')}</select></label>` : ''}
      <label>¿Quién pagó?<select name="payer">${d.participants.map((p) => `<option value="${p.id}" ${p.id === d.meId ? 'selected' : ''}>${esc(p.name)}${p.isMe ? ' (vos)' : ''}</option>`).join('')}</select></label>
      <div class="vq-seg vq-modes" role="radiogroup" aria-label="Cómo se divide">${MODES.map(([v, l], i) => `<label><input type="radio" name="mode" value="${v}" ${i ? '' : 'checked'}><span>${l}</span></label>`).join('')}</div>
      <fieldset class="vq-split"><legend>¿Entre quiénes se divide?</legend><div class="vq-split-rows"></div><p class="small vq-split-hint"></p></fieldset>
      ${d.meId && accounts.length ? `<label class="checklabel vq-mine"><input type="checkbox" name="toNumio" checked><span>Sumar mi parte a mis gastos de numio <small class="vq-mine-amount"></small></span></label>
      <div class="form-pair vq-mine-opts"><label>Categoría<select name="category">${cats.map((c) => `<option ${c === 'Salidas' || c === 'Comida' ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label>Cuenta<select name="account">${accounts.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label></div>` : ''}
      <button class="primary">Agregar</button><button type="button" onclick="closeModal()">Cancelar</button></form>`);
    const f = document.getElementById('vqExp'), rows = f.querySelector('.vq-split-rows'), hint = f.querySelector('.vq-split-hint');
    let receiptRef = null;
    receiptPicker(f.querySelector('.vq-receipt-slot'), (r) => { f.title.value = r.who || receiptTitle(r); setNum(f.amount, r.amount); if (r.date) f.spentOn.value = r.date; receiptRef = r.operation || null; check(); });
    const vid = () => (trip ? f.vaquita.value || null : null);
    const mode = () => f.mode.value;
    const rawOf = (r) => r.querySelector('input[data-v]:not([data-number-editor])');
    const paint = () => {
      const ids = members(vid()), m = mode(), prev = Object.fromEntries([...rows.querySelectorAll('[data-p]')].map((r) => [r.dataset.p, { on: r.querySelector('input[type=checkbox]').checked, v: rawOf(r)?.value }]));
      rows.innerHTML = ids.map((id) => {
        const p = d.participants.find((x) => x.id === id), on = prev[id] ? prev[id].on : true;
        const val = prev[id]?.v ?? (m === 'shares' ? '1' : '');
        return `<div class="vq-split-row" data-p="${id}"><label class="checklabel"><input type="checkbox" ${on ? 'checked' : ''}>${avatar(p.name)}<span>${esc(p.name)}</span></label>${m === 'equal' ? '<span class="vq-each"></span>' : `<input data-v type="number" inputmode="decimal" min="0" step="${m === 'shares' ? '1' : '0.01'}" value="${esc(val)}" aria-label="${m === 'exact' ? 'Monto' : m === 'percent' ? 'Porcentaje' : 'Partes'} de ${esc(p.name)}" placeholder="${m === 'exact' ? '$' : m === 'percent' ? '%' : '1'}">`}</div>`;
      }).join('');
      check();
    };
    const collect = () => [...rows.querySelectorAll('[data-p]')].filter((r) => r.querySelector('input[type=checkbox]').checked).map((r) => ({ participantId: r.dataset.p, value: mode() === 'equal' ? null : Number(rawOf(r).value) || 0 }));
    const check = () => {
      const amount = +f.amount.value || 0, shares = collect();
      let msg = '', mine = null;
      try {
        if (!shares.length) throw Error('Elegí al menos una persona.');
        if (amount > 0) {
          const map = expenseShares({ title: 'Gasto', amount, splitMode: mode(), shares });
          for (const r of rows.querySelectorAll('[data-p]')) { const each = r.querySelector('.vq-each'); if (each) each.textContent = map.has(r.dataset.p) ? money(fromCents(map.get(r.dataset.p))) : ''; }
          mine = d.meId && map.has(d.meId) ? fromCents(map.get(d.meId)) : 0;
          msg = mode() === 'equal' ? `${money(amount / shares.length)} cada uno` : mode() === 'shares' ? `${shares.reduce((a, s) => a + s.value, 0)} partes` : 'Cierra justo';
        } else msg = 'Poné el monto para ver cuánto le toca a cada uno.';
      } catch (e) { msg = e.message; mine = null; }
      hint.textContent = msg;
      const mineBox = f.querySelector('.vq-mine');
      if (mineBox) { mineBox.hidden = !mine; f.querySelector('.vq-mine-opts').hidden = !mine || !f.toNumio.checked; f.querySelector('.vq-mine-amount').textContent = mine ? '(' + money(mine) + ')' : ''; }
      return mine;
    };
    f.querySelectorAll('[name=mode]').forEach((r) => (r.onchange = paint));
    f.vaquita && (f.vaquita.onchange = paint);
    f.toNumio && (f.toNumio.onchange = check);
    f.amount.oninput = check;
    rows.addEventListener('input', check);
    rows.addEventListener('change', check);
    paint();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const shares = collect(), amount = Math.round(+f.amount.value * 100) / 100;
      const exp = { groupId: d.id, vaquitaId: vid(), title: f.title.value.trim(), amount, payerId: f.payer.value, splitMode: mode(), spentOn: f.spentOn.value, shares, receiptRef };
      let map;
      try { map = expenseShares(exp); } catch (err) { notify(err.message); return; }
      const mine = d.meId && map.has(d.meId) ? fromCents(map.get(d.meId)) : 0;
      if (mine && f.toNumio?.checked) {
        try {
          const before = new Set(state.expenses.map((x) => x.id));
          storeIrisMovement('expenses', { text: `${exp.title} · ${d.title}`, amount: mine, date: exp.spentOn, category: f.category.value, method: 'Vaquita', accountId: f.account.value });
          save();
          exp.numioTxn = state.expenses.find((x) => !before.has(x.id))?.id || null;
        } catch (err) { notify(err.message || 'No se pudo anotar en numio.'); return; }
      }
      closeModal();
      act(() => store().addExpense(exp), mine && f.toNumio?.checked ? `Gasto agregado y tu parte (${money(mine)}) anotada en numio` : 'Gasto agregado');
    };
  };

  window.vqJoinForm = () => {
    modal('Unirme a una vaquita', `<form class="form" id="vqJoin"><label>Link que te pasaron<input name="link" required placeholder="${esc(location.origin)}/v/…" autocapitalize="off" autocomplete="off"></label><div class="vq-join-who"></div><button class="primary">Buscar</button><button type="button" onclick="closeModal()">Cancelar</button></form>`);
    const f = document.getElementById('vqJoin'), who = f.querySelector('.vq-join-who');
    let token = null, found = null;
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!found) {
        token = (/\/v\/([a-f0-9]{16,64})/i.exec(f.link.value) || /^([a-f0-9]{16,64})$/i.exec(f.link.value.trim()) || [])[1];
        if (!token) { notify('Ese link no es de una vaquita.'); return; }
        try { found = await store().peek(token); } catch (err) { notify(err.message); return; }
        const free = found.participants.filter((p) => !p.linked);
        who.innerHTML = `<p><strong>${esc(found.group.title)}</strong> · ${plural(found.participants.length, 'persona', 'personas')}</p><fieldset class="vq-pick"><legend>¿Quién sos?</legend>${free.map((p, i) => `<label class="checklabel vq-check"><input type="radio" name="who" value="${p.id}" ${i ? '' : 'checked'}><span>${esc(p.name)}</span></label>`).join('')}<label class="checklabel vq-check"><input type="radio" name="who" value="" ${free.length ? '' : 'checked'}><span>No estoy en la lista</span></label></fieldset><p class="small">Si entrás como alguien nuevo, los gastos sueltos que son entre todos se dividen también con vos. Quien armó la vaquita lo ve y lo puede deshacer.</p>`;
        f.querySelector('button.primary').textContent = 'Sumarme';
        return;
      }
      const pid = f.querySelector('[name=who]:checked')?.value || null;
      closeModal();
      const gid = found.group.id;
      await act(() => store().join(token, pid, myName()), `Te sumaste a ${found.group.title}`);
      vqOpen(gid);
    };
  };

  // ── where it shows ──────────────────────────────────────────────────────────────────────────────────────────
  if (Array.isArray(IRIS_NAV) && !IRIS_NAV.some((n) => n[0] === 'vaquitas')) IRIS_NAV.splice(Math.max(1, IRIS_NAV.findIndex((n) => n[0] === 'debts')), 0, ['vaquitas', 'Vaquitas', 'users']);
  const markupBefore = irisMarkup;
  irisMarkup = function () {
    if (irisTab !== 'vaquitas') return markupBefore();
    const body = vq.screen === 'friends' ? friendsMarkup() : vq.open ? groupMarkup() : listMarkup();
    if (vq.screen === 'friends') queueMicrotask(bindFriends);
    return `<div class="vq-screen">${body}</div>`;
  };
  const goBefore = go;
  go = function (v) { if (v === 'vaquitas') { irisTab = 'vaquitas'; view = 'expenses'; query = ''; vq.screen = 'list'; vq.open = null; vq.data = null; vq.scope = undefined; vq.list = null; render(); window.scrollTo(0, 0); return; } return goBefore(v); };
  // reminders show up on the numio home too, as a quiet notice
  (async () => { try { const r = await store().reminders(); if (r.length) notify(`${r[0].from} te recordó que le debés ${money(r[0].amount)} en ${r[0].title}. Lo ves en Vaquitas.`); } catch {} })();
  window.ecosystemVaquitas = { state: vq, store, summarizeGroup, summarizeScope };
})();
