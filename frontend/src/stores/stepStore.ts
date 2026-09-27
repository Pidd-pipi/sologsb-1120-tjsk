import { defineStore } from 'pinia';
import { db, toPlain } from '../utils/db';
import { newId } from '../utils/id';
import type { RepairStep, RepairStepDraft, ReviewVerdict, StepReview } from '../types/step';
import type { TimekeepingTest, TimekeepingTestDraft } from '../types/test';

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
    /**
     * 负责人完成工序 / 返修后重新送检：
     * 进入「完成待检」。首次完成写入 finishedAt，之后只刷新送检时间。
     */
    async submitForReview(id: string) {
      const current = this.items.find((it) => it.id === id);
      if (!current || (current.state !== 'pending' && current.state !== 'rework')) return;
      const now = Date.now();
      const patch: Partial<RepairStep> = {
        state: 'submitted',
        submittedAt: now,
        finishedAt: current.finishedAt ?? now,
      };
      await db.steps.update(id, patch);
      this.items = this.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    },
    /**
     * 质检复核：保存复核人、结论、备注、时间并追加到历史。
     * pass → 质检合格；reject → 返修（保留全部历史记录，返修原因对负责人可见）。
     */
    async review(id: string, payload: { reviewer: string; verdict: ReviewVerdict; note: string }) {
      const current = this.items.find((it) => it.id === id);
      if (!current || current.state !== 'submitted') return;
      const record: StepReview = {
        reviewer: payload.reviewer.trim(),
        verdict: payload.verdict,
        note: payload.note.trim(),
        reviewedAt: Date.now(),
      };
      const patch: Partial<RepairStep> = {
        reviews: [...current.reviews, record],
        state: payload.verdict === 'pass' ? 'qualified' : 'rework',
      };
      await db.steps.update(id, toPlain(patch));
      this.items = this.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    },
    /** 合格工序标记为可放行 */
    async release(id: string) {
      const current = this.items.find((it) => it.id === id);
      if (!current || current.state !== 'qualified') return;
      const patch: Partial<RepairStep> = { state: 'released', releasedAt: Date.now() };
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
