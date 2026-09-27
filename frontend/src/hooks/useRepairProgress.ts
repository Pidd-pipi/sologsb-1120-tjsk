import { computed, unref, type Ref } from 'vue';
import { useStepStore } from '../stores/stepStore';
import { findSeqGaps } from '../utils/id';
import { isQualified, type RepairStep, type StepState } from '../types/step';

export interface RepairProgress {
  steps: RepairStep[];
  total: number;
  /** 质检合格（含已放行）数量 —— 台账与详情进度的唯一统计口径 */
  done: number;
  /** 完成待检数量 */
  pendingReview: number;
  /** 返修数量 */
  rework: number;
  /** 待完成数量 */
  pending: number;
  percent: number;
  /** 当前卡点步骤 */
  current: RepairStep | undefined;
  /** 顺序号缺口 */
  gaps: number[];
  /** 是否全部质检合格（全部合格前不能标记已完成） */
  allQualified: boolean;
}

/** 卡点优先级：返修 > 完成待检 > 待完成 */
const BOTTLENECK_WEIGHT: Record<StepState, number> = {
  rework: 0,
  submitted: 1,
  pending: 2,
  qualified: 3,
  released: 3,
};

/**
 * 统计某台钟表的工序完成比例与当前卡点步骤。
 * 进度只统计质检合格事项；被钟表详情页与工序录入页消费。
 */
export function useRepairProgress(clockId: string | Ref<string>) {
  const stepStore = useStepStore();
  const id = computed(() => unref(clockId));

  const steps = computed(() =>
    stepStore.items.filter((it) => it.clockId === id.value).sort((a, b) => a.seq - b.seq),
  );
  const total = computed(() => steps.value.length);
  const done = computed(() => steps.value.filter((it) => isQualified(it.state)).length);
  const pendingReview = computed(() => steps.value.filter((it) => it.state === 'submitted').length);
  const rework = computed(() => steps.value.filter((it) => it.state === 'rework').length);
  const pending = computed(() => steps.value.filter((it) => it.state === 'pending').length);
  const percent = computed(() => (total.value === 0 ? 0 : Math.round((done.value / total.value) * 100)));
  const allQualified = computed(() => total.value > 0 && done.value === total.value);
  const current = computed(() => {
    const unfinished = steps.value.filter((it) => !isQualified(it.state));
    if (unfinished.length === 0) return undefined;
    return [...unfinished].sort((a, b) => {
      const weight = BOTTLENECK_WEIGHT[a.state] - BOTTLENECK_WEIGHT[b.state];
      return weight !== 0 ? weight : a.seq - b.seq;
    })[0];
  });
  const gaps = computed(() => findSeqGaps(steps.value.map((it) => it.seq)));

  const progress = computed<RepairProgress>(() => ({
    steps: steps.value,
    total: total.value,
    done: done.value,
    pendingReview: pendingReview.value,
    rework: rework.value,
    pending: pending.value,
    percent: percent.value,
    current: current.value,
    gaps: gaps.value,
    allQualified: allQualified.value,
  }));

  return {
    progress,
    steps,
    total,
    done,
    pendingReview,
    rework,
    pending,
    percent,
    current,
    gaps,
    allQualified,
  };
}
