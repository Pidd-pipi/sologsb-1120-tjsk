import { defineStore } from 'pinia';
import { db, toPlain } from '../utils/db';
import { newId } from '../utils/id';
import type { QcRecord, RepairStep, RepairStepDraft } from '../types/step';
import type { TimekeepingTest, TimekeepingTestDraft } from '../types/test';

/** 质检复核入参 */
export interface QcInspectInput {
  result: 'passed' | 'rejected';
  reviewer: string;
  note: string;
}

interface StepState {
  items: RepairStep[];
  tests: TimekeepingTest[];
  loaded: boolean;
}

export const useStepStore = defineStore('step', {
  state: (): StepState => ({ items: [], tests: [], loaded: false }),
  getters: {
    byClock: (state) => (clockId: string) =>
      state.items.filter((it) => it.clockId === clockId).sort((a, b) => a.seq - b.seq),
    testsByClock: (state) => (clockId: string) =>
      state.tests.filter((it) => it.clockId === clockId).sort((a, b) => b.testedAt - a.testedAt),
  },
  actions: {
    async load() {
      const steps = await db.steps.toArray();
      steps.sort((a, b) => a.seq - b.seq || a.startedAt - b.startedAt);
      this.items = steps;
      const tests = await db.tests.toArray();
      this.tests = tests.sort((a, b) => b.testedAt - a.testedAt);
      this.loaded = true;
    },
    async add(draft: RepairStepDraft) {
      const record: RepairStep = { ...toPlain(draft), id: newId('stp') };
      await db.steps.put(toPlain(record));
      this.items = [...this.items, record];
      return record;
    },
    /** 完工并送检：进入「完成待检」；返修后重新完成同样再次送检 */
    async finish(id: string) {
      const patch: Partial<RepairStep> = { state: 'done', finishedAt: Date.now(), qcState: 'pending' };
      await db.steps.update(id, toPlain(patch));
      this.items = this.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    },
    /** 手动回退：回到待办并清空质检状态（历史质检记录保留） */
    async rollback(id: string) {
      const patch: Partial<RepairStep> = { state: 'rolledback', finishedAt: undefined, qcState: 'none' };
      await db.steps.update(id, toPlain(patch));
      this.items = this.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    },
    /**
     * 质检复核：合格 → 质检合格；退回 → 质检退回并打回返修（state 回退）。
     * 每次复核都追加一条 QcRecord，退回备注即返修原因。
     */
    async inspect(id: string, input: QcInspectInput) {
      const step = this.items.find((it) => it.id === id);
      if (!step || step.qcState !== 'pending') return;
      const record: QcRecord = {
        id: newId('qc'),
        result: input.result,
        reviewer: input.reviewer.trim(),
        conclusion: input.result === 'passed' ? '合格' : '退回返修',
        note: input.note.trim(),
        at: Date.now(),
      };
      const patch: Partial<RepairStep> =
        input.result === 'passed'
          ? { qcState: 'passed', qcRecords: [...step.qcRecords, record] }
          : { qcState: 'rejected', state: 'rolledback', qcRecords: [...step.qcRecords, record] };
      await db.steps.update(id, toPlain(patch));
      this.items = this.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    },
    /** 放行：质检合格后标记「可放行」 */
    async release(id: string) {
      const step = this.items.find((it) => it.id === id);
      if (!step || step.qcState !== 'passed') return;
      const patch: Partial<RepairStep> = { qcState: 'released' };
      await db.steps.update(id, patch);
      this.items = this.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    },
    /** 上下移动排序：交换两个相邻步骤的 seq */
    async swapSeq(aId: string, bId: string) {
      const a = this.items.find((it) => it.id === aId);
      const b = this.items.find((it) => it.id === bId);
      if (!a || !b) return;
      const aSeq = a.seq;
      await db.steps.update(a.id, { seq: b.seq });
      await db.steps.update(b.id, { seq: aSeq });
      this.items = this.items.map((it) => {
        if (it.id === a.id) return { ...it, seq: b.seq };
        if (it.id === b.id) return { ...it, seq: aSeq };
        return it;
      });
    },
    async addTest(draft: TimekeepingTestDraft) {
      const record: TimekeepingTest = { ...toPlain(draft), id: newId('tst') };
      await db.tests.put(toPlain(record));
      this.tests = [record, ...this.tests];
      return record;
    },
    async removeTest(id: string) {
      await db.tests.delete(id);
      this.tests = this.tests.filter((it) => it.id !== id);
    },
  },
});
