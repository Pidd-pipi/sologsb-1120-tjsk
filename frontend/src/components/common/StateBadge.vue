<script setup lang="ts">
import { computed } from 'vue';
import type { ConditionGrade } from '../../types/clock';
import type { StepState } from '../../types/step';

const props = defineProps<{
  /** 角标文案 */
  label?: string;
  /** 品相等级 */
  grade?: ConditionGrade;
  /** 工序状态 */
  state?: StepState;
  /** 磨损/决定等自由角标 */
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
}>();

const type = computed(() => {
  if (props.tone) return props.tone;
  if (props.state) {
    switch (props.state) {
      case 'released':
        return 'success';
      case 'qualified':
        return 'success';
      case 'rework':
        return 'danger';
      case 'submitted':
        return 'warning';
      default:
        return 'info';
    }
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
  if (props.state) {
    switch (props.state) {
      case 'released':
        return '可放行';
      case 'qualified':
        return '质检合格';
      case 'rework':
        return '返修中';
      case 'submitted':
        return '完成待检';
      default:
        return '待完成';
    }
  }
  return props.grade ?? '—';
});
</script>

<template>
  <el-tag :type="type" size="small" effect="light">{{ text }}</el-tag>
</template>
