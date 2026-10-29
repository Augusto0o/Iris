import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate, expenseShares, balances, settle, summarizeGroup, whatsappSummary, toCents } from '../src/vaquitas-core.js';

const P = [
  { id: 'fa', name: 'Fabri', aliasCbu: 'fabri.mp' },
  { id: 'le', name: 'Leo' },
  { id: 'au', name: 'Augusto', aliasCbu: 'augustoserra10' },
];

test('allocate no pierde centavos', () => {
  const r = allocate(10000, [1, 1, 1]);
  assert.deepEqual(r, [3334, 3333, 3333]);
  assert.equal(r.reduce((a, b) => a + b), 10000);
});

test('formas de dividir', () => {
  const eq = expenseShares({ amount: 100, shares: [{ participantId: 'a' }, { participantId: 'b' }, { participantId: 'c' }] });
  assert.equal([...eq.values()].reduce((a, b) => a + b), 10000);
  const sh = expenseShares({ amount: 300, splitMode: 'shares', shares: [{ participantId: 'a', value: 2 }, { participantId: 'b', value: 1 }] });
  assert.deepEqual([...sh.values()], [20000, 10000]);
  const pc = expenseShares({ amount: 1000, splitMode: 'percent', shares: [{ participantId: 'a', value: 70 }, { participantId: 'b', value: 30 }] });
  assert.deepEqual([...pc.values()], [70000, 30000]);
  assert.throws(() => expenseShares({ amount: 1000, splitMode: 'percent', shares: [{ participantId: 'a', value: 70 }] }), /100%/);
  assert.throws(() => expenseShares({ amount: 100, splitMode: 'exact', shares: [{ participantId: 'a', value: 50 }] }), /suman/);
});

test('settle cierra todo con a lo sumo n-1 transferencias', () => {
  for (let k = 0; k < 300; k++) {
    const n = 2 + (k % 8);
    const people = Array.from({ length: n }, (_, i) => ({ id: 'p' + i }));
    const exps = Array.from({ length: 1 + (k % 6) }, (_, j) => ({
      amount: ((k * 37 + j * 101) % 50000) / 7 + 1,
      payerId: 'p' + ((k + j) % n),
      shares: people.filter((_, i) => (i + j) % 3 !== 0 || i === 0).map((p) => ({ participantId: p.id })),
    }));
    const rows = balances(people, exps);
    assert.equal(rows.reduce((a, r) => a + r.net, 0), 0, 'los saldos suman cero');
    const t = settle(rows);
    assert.ok(t.length <= n - 1);
    const after = new Map(rows.map((r) => [r.participantId, r.net]));
    for (const x of t) { after.set(x.fromId, after.get(x.fromId) + x.amountCents); after.set(x.toId, after.get(x.toId) - x.amountCents); }
    for (const v of after.values()) assert.equal(v, 0);
  }
});

test('un viaje con vaquitas, gastos sueltos y un pago marcado', () => {
  const group = {
    kind: 'viaje', title: 'Panaholma', participants: P,
    vaquitas: [
      { id: 'nafta', title: 'Nafta', memberIds: ['fa', 'au'] },
      { id: 'asado', title: 'Asado', memberIds: ['fa', 'le', 'au'] },
    ],
    expenses: [
      { id: 1, vaquitaId: 'nafta', title: 'YPF', amount: 40000, payerId: 'fa', shares: [{ participantId: 'fa' }, { participantId: 'au' }] },
      { id: 2, vaquitaId: 'asado', title: 'Carne', amount: 60000, payerId: 'le', shares: P.map((p) => ({ participantId: p.id })) },
      { id: 3, vaquitaId: 'asado', title: 'Bebida', amount: 15000, payerId: 'au', shares: P.map((p) => ({ participantId: p.id })) },
      { id: 4, vaquitaId: null, title: 'Peaje', amount: 3000, payerId: 'au', shares: P.map((p) => ({ participantId: p.id })) },
    ],
    payments: [{ vaquitaId: 'nafta', fromId: 'au', toId: 'fa', amount: 20000 }],
  };
  const s = summarizeGroup(group);
  assert.equal(s.total, 118000);
  assert.equal(s.vaquitas[0].settlements.length, 0, 'la nafta ya está pagada');
  // Asado: 75000 / 3 = 25000 c/u. Leo puso 60000 (+35000), Augusto 15000 (-10000), Fabri 0 (-25000)
  assert.deepEqual(s.vaquitas[1].settlements, [
    { fromId: 'fa', toId: 'le', amount: 25000 },
    { fromId: 'au', toId: 'le', amount: 10000 },
  ]);
  // Peaje: 1000 c/u, Augusto puso 3000
  assert.equal(s.loose.settlements.length, 2);
  assert.equal(s.pendingTransfers, 4);
  const txt = whatsappSummary(group, 'https://nubo/v/abc');
  assert.match(txt, /A Leo le pasan/);
  assert.match(txt, /alias `augustoserra10`/);
  assert.match(txt, /Nafta[^\n]*\n¡Están todos al día!/);
  
});

test('centavos raros no rompen nada', () => {
  const rows = balances(P, [{ amount: 1000.01, payerId: 'fa', shares: P.map((p) => ({ participantId: p.id })) }]);
  assert.equal(rows.reduce((a, r) => a + r.fairShare, 0), toCents(1000.01));
});
