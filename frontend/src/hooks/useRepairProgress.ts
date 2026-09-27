import { computed, unref, type Ref } from 'vue';
import { useStepStore } from '../stores/stepStore';
import { findSeqGaps } from '../utils/id';
import { isQcPassed, type RepairStep } from '../types/step';

export interface RepairProgress {
  steps: RepairStep[];
  total: number;
  /** 质检合格（含已放行）数量，进度只统计它 */
  passed: number;
  /** 完成待检（含历史未复核）数量 */
  pendingQc: number;
  /** 质检退回待返修数量 */
  rejected: number;
  percent: number;
  /** 全部工序质检合格 */
  allPassed: boolean;
  /** 当前卡点步骤（首个未质检合格的工序） */
  current: RepairStep | undefined;
  /** 顺序号缺口 */
  gaps: number[];
}

/**
 * 统计某台钟表的工序质检合格比例与当前卡点步骤。
 * 进度只统计质检合格事项；完成待检与质检退回单独计数，供页面醒目提示。
 * 被钟表详情页与工序录入页消费。
 */
export function useRepairProgress(clockId: string | Ref<string>) {
  const stepStore = useStepStore();
  const id = computed(() => unref(clockId));

  const steps = computed(() =>
    stepStore.items.filter((it) => it.clockId === id.value).sort((a, b) => a.seq - b.seq),
  );
  const total = computed(() => steps.value.length);
  const passed = computed(() => steps.value.filter((it) => isQcPassed(it)).length);
  const pendingQc = computed(() => steps.value.filter((it) => it.qcState === 'pending').length);
  const rejected = computed(() => steps.value.filter((it) => it.qcState === 'rejected').length);
  const percent = computed(() =>
    total.value === 0 ? 0 : Math.round((passed.value / total.value) * 100),
  );
  const allPassed = computed(() => total.value > 0 && passed.value === total.value);
  const current = computed(() => steps.value.find((it) => !isQcPassed(it)));
  const gaps = computed(() => findSeqGaps(steps.value.map((it) => it.seq)));

  const progress = computed<RepairProgress>(() => ({
    steps: steps.value,
    total: total.value,
    passed: passed.value,
    pendingQc: pendingQc.value,
    rejected: rejected.value,
    percent: percent.value,
    allPassed: allPassed.value,
    current: current.value,
    gaps: gaps.value,
  }));

  return { progress, steps, total, passed, pendingQc, rejected, percent, allPassed, current, gaps };
}
