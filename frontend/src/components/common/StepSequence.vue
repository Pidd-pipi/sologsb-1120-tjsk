<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { latestQcRecord, type RepairStep } from '../../types/step';
import { findSeqGaps } from '../../utils/id';
import StateBadge from './StateBadge.vue';

const props = defineProps<{
  items: RepairStep[];
  /** 是否展示上下移动/拖拽排序 */
  sortable?: boolean;
}>();

const emit = defineEmits<{
  (e: 'finish', id: string): void;
  (e: 'rollback', id: string): void;
  (e: 'inspect', payload: { id: string; result: 'passed' | 'rejected'; reviewer: string; note: string }): void;
  (e: 'release', id: string): void;
  (e: 'move', payload: { id: string; direction: 'up' | 'down' }): void;
  (e: 'reorder', payload: { fromId: string; toId: string }): void;
}>();

const dragId = ref<string>('');

const gaps = computed(() => findSeqGaps(props.items.map((it) => it.seq)));
const conflict = computed(() => gaps.value.length > 0);

function onDragStart(id: string) {
  dragId.value = id;
}
function onDrop(toId: string) {
  if (dragId.value && dragId.value !== toId) {
    emit('reorder', { fromId: dragId.value, toId });
  }
  dragId.value = '';
}

/** 质检复核弹窗 */
const inspectVisible = ref(false);
const inspectTarget = ref<RepairStep | null>(null);
const inspectForm = reactive({ result: 'passed' as 'passed' | 'rejected', reviewer: '', note: '' });
const inspectError = ref('');

function openInspect(row: RepairStep) {
  inspectTarget.value = row;
  inspectForm.result = 'passed';
  inspectForm.reviewer = '';
  inspectForm.note = '';
  inspectError.value = '';
  inspectVisible.value = true;
}

function submitInspect() {
  const row = inspectTarget.value;
  if (!row) return;
  if (!inspectForm.reviewer.trim()) {
    inspectError.value = '复核人必填';
    return;
  }
  if (inspectForm.result === 'rejected' && !inspectForm.note.trim()) {
    inspectError.value = '退回时必须填写备注，作为返修原因告知负责人';
    return;
  }
  emit('inspect', {
    id: row.id,
    result: inspectForm.result,
    reviewer: inspectForm.reviewer,
    note: inspectForm.note,
  });
  inspectVisible.value = false;
}

function fmtTime(at?: number): string {
  return at ? new Date(at).toLocaleString('zh-CN') : '';
}
</script>

<template>
  <div class="seq-wrap" data-testid="step-sequence">
    <el-alert
      v-if="conflict"
      type="error"
      :closable="false"
      show-icon
      :title="`顺序号存在缺口：${gaps.join('、')}（不得跳号，请用上下移动补齐）`"
      style="margin-bottom: 10px"
    />
    <el-table :data="items" size="small" border>
      <el-table-column label="顺序" width="70">
        <template #default="{ row }">
          <span :class="{ gap: conflict && gaps.includes(row.seq) }">#{{ row.seq }}</span>
        </template>
      </el-table-column>
      <el-table-column label="步骤" width="90">
        <template #default="{ row }">{{ row.stepType }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <StateBadge :state="row.state" />
        </template>
      </el-table-column>
      <el-table-column label="质检复核" min-width="210">
        <template #default="{ row }">
          <div class="qc-cell">
            <StateBadge :qc="row.qcState" />
            <span v-if="row.qcRecords.length > 1" class="muted">第 {{ row.qcRecords.length }} 次送检</span>
          </div>
          <template v-if="latestQcRecord(row)">
            <div class="qc-line">
              {{ latestQcRecord(row)!.reviewer }} · {{ latestQcRecord(row)!.conclusion }} ·
              {{ fmtTime(latestQcRecord(row)!.at) }}
            </div>
            <div v-if="latestQcRecord(row)!.note" class="qc-line muted">{{ latestQcRecord(row)!.note }}</div>
          </template>
          <div v-if="row.qcState === 'rejected' && latestQcRecord(row)" class="rework-reason">
            返修原因：{{ latestQcRecord(row)!.note }}（{{ latestQcRecord(row)!.reviewer }}）
          </div>
        </template>
      </el-table-column>
      <el-table-column label="清洗/润滑" min-width="180">
        <template #default="{ row }">
          <div v-if="row.cleanSolvent">清洗液：{{ row.cleanSolvent }}（{{ row.cleanMethod }}）</div>
          <div v-if="row.oilType">油脂：{{ row.oilType }} · 点位 {{ row.oilPoints }}</div>
          <div v-if="row.torque">力矩：{{ row.torque }} N·m</div>
          <div v-if="!row.cleanSolvent && !row.oilType && !row.torque">—</div>
        </template>
      </el-table-column>
      <el-table-column label="异常说明" min-width="140">
        <template #default="{ row }">{{ row.troubleNote || '—' }}</template>
      </el-table-column>
      <el-table-column label="责任人" width="90">
        <template #default="{ row }">{{ row.operator }}</template>
      </el-table-column>
      <el-table-column label="操作" width="280">
        <template #default="{ row, $index }">
          <el-button
            v-if="row.state !== 'done'"
            size="small"
            type="primary"
            @click="emit('finish', row.id)"
          >
            {{ row.qcState === 'rejected' ? '重新完成送检' : '完成送检' }}
          </el-button>
          <el-button
            v-if="row.qcState === 'pending'"
            size="small"
            type="warning"
            @click="openInspect(row)"
          >
            质检
          </el-button>
          <el-button
            v-if="row.qcState === 'passed'"
            size="small"
            type="success"
            @click="emit('release', row.id)"
          >
            放行
          </el-button>
          <el-button v-if="row.state === 'done'" size="small" type="warning" plain @click="emit('rollback', row.id)">
            回退
          </el-button>
          <template v-if="sortable">
            <el-button size="small" :disabled="$index === 0" @click="emit('move', { id: row.id, direction: 'up' })">
              上移
            </el-button>
            <el-button
              size="small"
              :disabled="$index === items.length - 1"
              @click="emit('move', { id: row.id, direction: 'down' })"
            >
              下移
            </el-button>
          </template>
          <span
            class="drag-handle"
            draggable="true"
            title="拖拽到目标行可交换顺序"
            @dragstart="onDragStart(row.id)"
            @dragover.prevent
            @drop="onDrop(row.id)"
            >⣿</span
          >
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="items.length === 0" description="暂无工序，请到「新建维修工序」登记" />

    <el-dialog v-model="inspectVisible" title="质检复核" width="480px">
      <div v-if="inspectTarget" class="inspect-target">
        #{{ inspectTarget.seq }} {{ inspectTarget.stepType }} · 责任人 {{ inspectTarget.operator }}
      </div>
      <el-alert v-if="inspectError" :title="inspectError" type="error" :closable="false" style="margin-bottom: 10px" />
      <el-form label-width="90px">
        <el-form-item label="复核人" required>
          <el-input v-model="inspectForm.reviewer" placeholder="质检复核人姓名" />
        </el-form-item>
        <el-form-item label="结论" required>
          <el-radio-group v-model="inspectForm.result">
            <el-radio-button value="passed">合格</el-radio-button>
            <el-radio-button value="rejected">退回返修</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="inspectForm.result === 'rejected' ? '返修原因' : '备注'" :required="inspectForm.result === 'rejected'">
          <el-input
            v-model="inspectForm.note"
            type="textarea"
            :rows="3"
            :placeholder="inspectForm.result === 'rejected' ? '必填：说明退回原因，负责人返修时可见' : '选填'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inspectVisible = false">取消</el-button>
        <el-button type="primary" @click="submitInspect">提交复核结论</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.gap {
  color: #d93025;
  font-weight: 700;
}
.drag-handle {
  margin-left: 8px;
  cursor: grab;
  color: #97a0ad;
  user-select: none;
}
.qc-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.qc-line {
  font-size: 12px;
  color: #5b6470;
  line-height: 1.6;
}
.muted {
  color: #7b8592;
  font-size: 12px;
}
.rework-reason {
  margin-top: 4px;
  padding: 4px 8px;
  border-left: 3px solid #d93025;
  background: #fdecea;
  color: #b3261e;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}
.inspect-target {
  margin-bottom: 12px;
  font-weight: 600;
}
</style>
