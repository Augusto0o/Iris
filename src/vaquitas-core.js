// vaquitas-core.js — lógica pura de vaquitas para Nubo (sin dependencias, sin DOM).
// Todo el cálculo se hace en centavos enteros para que nunca sobre ni falte un peso.
//
// Modelo (igual que las tablas de supabase/vaquitas.sql):
//   group        { id, kind: 'viaje'|'juntada', title, status: 'open'|'settled', ... }
//   participants [{ id, name, aliasCbu?, userId? }]
//   vaquitas     [{ id, title, memberIds: [participantId] }]          (solo en viajes)
//   expenses     [{ id, vaquitaId|null, title, amount, payerId, splitMode, shares }]
//                  vaquitaId null = "gasto suelto" del viaje (o gasto de una juntada)
//                  splitMode: 'equal'   shares = [{participantId}]                 partes iguales
//                             'exact'   shares = [{participantId, value: monto}]   montos exactos
//                             'shares'  shares = [{participantId, value: partes}]  por partes (2 adultos = 2)
//                             'percent' shares = [{participantId, value: %}]       por porcentaje
//   payments     [{ id, vaquitaId|null, fromId, toId, amount }]                  transferencias marcadas "Pagado"

export const toCents = (n) => Math.round(Number(n || 0) * 100);
export const fromCents = (c) => c / 100;

/** Reparte `total` centavos según pesos enteros/decimales, sin perder centavos (método del resto mayor). */
export function allocate(totalCents, weights) {
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (sum <= 0) throw new Error('Nadie para dividir el gasto.');
  const raw = weights.map((w) => (Math.max(0, w) * totalCents) / sum);
  const base = raw.map(Math.floor);
  let rest = totalCents - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - base[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) base[order[k][1]]++;
  return base;
}

/** Cuánto le toca a cada participante de un gasto → Map(participantId → centavos). */
export function expenseShares(expense) {
  const total = toCents(expense.amount);
  const shares = (expense.shares || []).filter((s) => s && s.participantId);
  if (!shares.length) throw new Error(`"${expense.title || 'Gasto'}" no tiene entre quiénes se divide.`);
  const ids = shares.map((s) => s.participantId);
  let cents;
  switch (expense.splitMode || 'equal') {
    case 'equal':
      cents = allocate(total, shares.map(() => 1));
      break;
    case 'shares':
      cents = allocate(total, shares.map((s) => Number(s.value) || 0));
      break;
    case 'percent': {
      const pct = shares.reduce((a, s) => a + (Number(s.value) || 0), 0);
      if (Math.abs(pct - 100) > 0.01) throw new Error(`Los porcentajes suman ${pct}%, tienen que sumar 100%.`);
      cents = allocate(total, shares.map((s) => Number(s.value) || 0));
      break;
    }
    case 'exact': {
      cents = shares.map((s) => toCents(s.value));
      const diff = total - cents.reduce((a, b) => a + b, 0);
      if (diff !== 0) throw new Error(`Los montos suman ${fromCents(total - diff)} y el gasto es ${fromCents(total)}.`);
      break;
    }
    default:
      throw new Error(`Forma de dividir desconocida: ${expense.splitMode}`);
  }
  return new Map(ids.map((id, i) => [id, cents[i]]));
}

/**
 * Saldo de cada uno dentro de un alcance (una vaquita, o los gastos sueltos).
 * paid = lo que puso, fairShare = lo que le toca, net > 0 recibe, net < 0 pone.
 * Los pagos ya marcados mueven el saldo: quien transfirió queda más cerca de cero.
 */
export function balances(participants, expenses, payments = []) {
  const row = new Map(participants.map((p) => [p.id, { participantId: p.id, paid: 0, fairShare: 0, sent: 0, received: 0 }]));
  const get = (id) => {
    if (!row.has(id)) row.set(id, { participantId: id, paid: 0, fairShare: 0, sent: 0, received: 0 });
    return row.get(id);
  };
  for (const e of expenses) {
    get(e.payerId).paid += toCents(e.amount);
    for (const [id, c] of expenseShares(e)) get(id).fairShare += c;
  }
  for (const p of payments) {
    get(p.fromId).sent += toCents(p.amount);
    get(p.toId).received += toCents(p.amount);
  }
  return [...row.values()].map((r) => ({ ...r, net: r.paid - r.fairShare + r.sent - r.received }));
}

/**
 * Quién le transfiere a quién, con pocas transferencias: el que más debe le paga al que más tiene
 * que recibir, hasta cerrar. Nunca hace más de (personas − 1) transferencias. Montos en centavos.
 */
export function settle(balanceRows) {
  const debt = balanceRows.filter((b) => b.net < 0).map((b) => ({ id: b.participantId, left: -b.net }));
  const cred = balanceRows.filter((b) => b.net > 0).map((b) => ({ id: b.participantId, left: b.net }));
  const out = [];
  const byLeft = (a, b) => b.left - a.left || String(a.id).localeCompare(String(b.id));
  while (debt.length && cred.length) {
    debt.sort(byLeft);
    cred.sort(byLeft);
    const d = debt[0], c = cred[0];
    const amt = Math.min(d.left, c.left);
    out.push({ fromId: d.id, toId: c.id, amountCents: amt });
    d.left -= amt;
    c.left -= amt;
    if (!d.left) debt.shift();
    if (!c.left) cred.shift();
  }
  return out;
}

/** Resumen de una vaquita (o de los gastos sueltos con vaquitaId = null). */
export function summarizeScope({ participants, expenses, payments }, vaquitaId = null, memberIds = null) {
  const exps = expenses.filter((e) => (e.vaquitaId ?? null) === vaquitaId);
  const pays = payments.filter((p) => (p.vaquitaId ?? null) === vaquitaId);
  const people = memberIds ? participants.filter((p) => memberIds.includes(p.id)) : participants;
  const rows = balances(people, exps, pays);
  const settlements = settle(rows);
  return {
    vaquitaId,
    total: fromCents(exps.reduce((a, e) => a + toCents(e.amount), 0)),
    expenseCount: exps.length,
    balances: rows.map((r) => ({ ...r, paid: fromCents(r.paid), fairShare: fromCents(r.fairShare), net: fromCents(r.net), sent: fromCents(r.sent), received: fromCents(r.received) })),
    settlements: settlements.map((s) => ({ fromId: s.fromId, toId: s.toId, amount: fromCents(s.amountCents) })),
  };
}

/** Resumen de todo el grupo: cada vaquita por separado + gastos sueltos + totales del viaje por persona. */
export function summarizeGroup(group) {
  const { participants, vaquitas = [], expenses = [], payments = [] } = group;
  const scopes = vaquitas.map((v) => ({ ...summarizeScope(group, v.id, v.memberIds), title: v.title }));
  const loose = summarizeScope(group, null);
  const all = [...scopes, loose];
  const perPerson = participants.map((p) => {
    let paid = 0, fair = 0, net = 0;
    for (const s of all) {
      const b = s.balances.find((x) => x.participantId === p.id);
      if (b) { paid += toCents(b.paid); fair += toCents(b.fairShare); net += toCents(b.net); }
    }
    return { participantId: p.id, paid: fromCents(paid), fairShare: fromCents(fair), net: fromCents(net), upToDate: net === 0 };
  });
  return {
    total: fromCents(expenses.reduce((a, e) => a + toCents(e.amount), 0)),
    vaquitaCount: vaquitas.length,
    pendingTransfers: all.reduce((a, s) => a + s.settlements.length, 0),
    vaquitas: scopes,
    loose,
    perPerson,
  };
}

const money = (n) => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/** Texto listo para WhatsApp (negritas con *), como el resumen de Valto. */
export function whatsappSummary(group, link = '') {
  const name = new Map(group.participants.map((p) => [p.id, p.name]));
  const alias = new Map(group.participants.map((p) => [p.id, p.aliasCbu]));
  const s = summarizeGroup(group);
  const lines = [`*${group.title}*`, `Total: *${money(s.total)}*`];
  const block = (scope, title) => {
    if (!scope.expenseCount) return;
    lines.push('', `*${title}* · ${money(scope.total)}`);
    if (!scope.settlements.length) { lines.push('¡Están todos al día!'); return; }
    const byTo = new Map();
    for (const t of scope.settlements) byTo.set(t.toId, [...(byTo.get(t.toId) || []), t]);
    for (const [to, ts] of byTo) {
      lines.push(`A ${name.get(to)} le pasan${alias.get(to) ? ` · alias \`${alias.get(to)}\`` : ''}`);
      for (const t of ts) lines.push(`  ${name.get(t.fromId)}  *${money(t.amount)}*`);
    }
  };
  for (const v of s.vaquitas) block(v, v.title);
  block(s.loose, group.kind === 'viaje' ? 'Gastos sueltos' : 'Gastos');
  if (!s.pendingTransfers && s.total) lines.push('', '¡Estamos todos al día!');
  if (link) lines.push('', `Mirá el detalle: ${link}`);
  return lines.join('\n');
}
