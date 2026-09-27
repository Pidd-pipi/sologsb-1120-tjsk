<script setup lang="ts">
import { computed } from 'vue';
import type { ConditionGrade } from '../../types/clock';
import { QC_STATE_LABEL, type QcState, type StepState } from '../../types/step';

const props = defineProps<{
  /** 角标文案 */
  label?: string;
  /** 品相等级 */
  grade?: ConditionGrade;
  /** 工序状态 */
  state?: StepState;
  /** 质检状态 */
  qc?: QcState;
  /** 磨损/决定等自由角标 */
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
}>();

const type = computed(() => {
  if (props.tone) return props.tone;
  if (props.qc) {
    if (props.qc === 'passed' || props.qc === 'released') return 'success';
    if (props.qc === 'rejected') return 'danger';
    if (props.qc === 'pending') return 'warning';
    return 'info';
  }
  if (props.state) {
    if (props.state === 'done') return 'success';
    if (props.state === 'rolledback') return 'danger';
    return 'info';
  }
  switch (props.grade) {
    case '一级':
      return 'success';
    case '二级':
      return 'primary';
    case '三级':
      return 'warning';
    default:
      return 'danger';
  }
});

const text = computed(() => {
  if (props.label) return props.label;
  if (props.qc) return QC_STATE_LABEL[props.qc];
  if (props.state) {
    if (props.state === 'done') return '已完工';
    if (props.state === 'rolledback') return '已回退';
    return '待办';
  }
  return props.grade ?? '—';
});
</script>

<template>
  <el-tag :type="type" size="small" effect="light">{{ text }}</el-tag>
</template>
