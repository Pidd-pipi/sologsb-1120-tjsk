<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { RepairStep } from '../../types/step';
import { latestRejectReason, latestReview } from '../../types/step';
import { findSeqGaps } from '../../utils/id';
import StateBadge from './StateBadge.vue';

const props = defineProps<{
  items: RepairStep[];
  /** 是否展示上下移动/拖拽排序 */
  sortable?: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', id: string): void;
  (e: 'review', payload: { id: string; reviewer: string; verdict: 'pass' | 'reject'; note: string }): void;
  (e: 'release', id: string): void;
  (e: 'move', payload: { id: string; direction: 'up' | 'down' }): void;
  (e: 'reorder', payload: { fromId: string; toId: string }): void;
}>();

const dragId = ref<string>('');

const gaps = computed(() => findSeqGaps(props.items.map((it) => it.seq)));
const conflict = computed(() => gaps.value.length > 0);

/** 质检复核弹窗 */
const reviewDialogVisible = ref(false);
const reviewTarget = ref<RepairStep | null>(null);
const reviewForm = reactive({ reviewer: '', verdict: 'pass' as 'pass' | 'reject', note: '' });
const reviewError = ref('');

function openReview(row: RepairStep) {
  reviewTarget.value = row;
  reviewError.value = '';
  const last = latestReview(row);
  reviewForm.reviewer = last?.reviewer ?? '';
  reviewForm.verdict = 'pass';
  reviewForm.note = '';
  reviewDialogVisible.value = true;
}

function submitReview() {
  if (!reviewTarget.value) return;
  if (!reviewForm.reviewer.trim()) {
    reviewError.value = '请填写复核人';
    return;
  }
  if (reviewForm.verdict === 'reject' && !reviewForm.note.trim()) {
    reviewError.value = '退回返修必须填写返修原因，负责人需要据此返工';
    return;
  }
  emit('review', {
    id: reviewTarget.value.id,
    reviewer: reviewForm.reviewer.trim(),
    verdict: reviewForm.verdict,
    note: reviewForm.note,
  });
  reviewDialogVisible.value = false;
}

function verdictText(verdict: 'pass' | 'reject'): string {
  return verdict === 'pass' ? '合格' : '退回返修';
}

function formatTime(ts?: number): string {
  return ts ? new Date(ts).toLocaleString('zh-CN') : '—';
}

function rejectReason(row: RepairStep): string | undefined {
  return latestRejectReason(row);
}

function lastReviewOf(row: RepairStep) {
  return latestReview(row);
}

function rowClass({ row }: { row: RepairStep }): string {
  if (row.state === 'rework') return 'row-rework';
  if (row.state === 'submitted') return 'row-submitted';
  if (row.state === 'qualified' || row.state === 'released') return 'row-qualified';
  return '';
}

function onDragStart(id: string) {
  dragId.value = id;
}
function onDrop(toId: string) {
  if (dragId.value && dragId.value !== toId) {
    emit('reorder', { fromId: dragId.value, toId });
  }
  dragId.value = '';
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
    <el-table :data="items" size="small" border :row-class-name="rowClass">
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="review-history">
            <strong>质检复核记录（{{ row.reviews.length }} 次）</strong>
            <el-empty v-if="row.reviews.length === 0" description="尚未复核，按未复核处理" :image-size="48" />
            <ol v-else>
              <li v-for="(r, i) in row.reviews" :key="i" :class="['history-item', r.verdict]">
                <el-tag
                  size="small"
                  :type="r.verdict === 'pass' ? 'success' : 'danger'"
                  effect="plain"
                >
                  {{ verdictText(r.verdict) }}
                </el-tag>
                <span class="muted">复核人：{{ r.reviewer }}</span>
                <span class="muted">{{ formatTime(r.reviewedAt) }}</span>
                <div v-if="r.note" class="history-note">备注：{{ r.note }}</div>
              </li>
            </ol>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="顺序" width="72">
        <template #default="{ row }">
          <span :class="{ gap: conflict && gaps.includes(row.seq) }">#{{ row.seq }}</span>
        </template>
      </el-table-column>
      <el-table-column label="步骤" width="96">
        <template #default="{ row }">{{ row.stepType }}</template>
      </el-table-column>
      <el-table-column label="状态" width="104">
        <template #default="{ row }">
          <StateBadge :state="row.state" />
        </template>
      </el-table-column>
      <el-table-column label="质检复核" min-width="210">
        <template #default="{ row }">
          <template v-if="lastReviewOf(row)">
            <div>
              复核人：{{ lastReviewOf(row)!.reviewer }} ·
              <el-tag
                size="small"
                :type="lastReviewOf(row)!.verdict === 'pass' ? 'success' : 'danger'"
                effect="plain"
              >
                {{ verdictText(lastReviewOf(row)!.verdict) }}
              </el-tag>
            </div>
            <div class="muted">{{ formatTime(lastReviewOf(row)!.reviewedAt) }}</div>
            <div v-if="lastReviewOf(row)!.note" class="review-note">
              {{ lastReviewOf(row)!.verdict === 'reject' ? '返修原因：' : '备注：'
              }}{{ lastReviewOf(row)!.note }}
            </div>
          </template>
          <div v-else-if="row.state === 'submitted'" class="muted">
            已送检（{{ formatTime(row.submittedAt) }}），等待质检复核
          </div>
          <span v-else class="muted">未复核</span>
        </template>
      </el-table-column>
      <el-table-column label="返修提示" min-width="170">
        <template #default="{ row }">
          <el-alert
            v-if="row.state === 'rework' && rejectReason(row)"
            type="error"
            :closable="false"
            show-icon
            class="rework-alert"
            title="质检退回，请返修后重新送检"
            :description="rejectReason(row)"
          />
          <span v-else-if="row.state === 'submitted'" class="muted">等待质检结论</span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="清洗/润滑" min-width="190">
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
      <el-table-column label="责任人" width="92">
        <template #default="{ row }">{{ row.operator }}</template>
      </el-table-column>
      <el-table-column label="操作" width="260">
        <template #default="{ row, $index }">
          <el-button
            v-if="row.state === 'pending' || row.state === 'rework'"
            size="small"
            type="primary"
            @click="emit('submit', row.id)"
          >
            {{ row.state === 'rework' ? '返修完成送检' : '完成送检' }}
          </el-button>
          <el-button
            v-if="row.state === 'submitted'"
            size="small"
            type="warning"
            @click="openReview(row)"
          >
            质检复核
          </el-button>
          <el-button
            v-if="row.state === 'qualified'"
            size="small"
            type="success"
            @click="emit('release', row.id)"
          >
            标记可放行
          </el-button>
          <el-tag v-if="row.state === 'released'" size="small" type="success" effect="plain">已放行</el-tag>
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

    <el-dialog v-model="reviewDialogVisible" title="质检复核" width="520px">
      <el-alert
        :title="`正在复核：#${reviewTarget?.seq} ${reviewTarget?.stepType}（责任人 ${reviewTarget?.operator}）`"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 14px"
      />
      <el-alert v-if="reviewError" :title="reviewError" type="error" :closable="false" style="margin-bottom: 12px" />
      <el-form :model="reviewForm" label-width="90px">
        <el-form-item label="复核人" required>
          <el-input v-model="reviewForm.reviewer" placeholder="质检负责人姓名" />
        </el-form-item>
        <el-form-item label="结论" required>
          <el-radio-group v-model="reviewForm.verdict">
            <el-radio-button value="pass">质检合格</el-radio-button>
            <el-radio-button value="reject">退回返修</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="reviewForm.verdict === 'reject' ? '返修原因' : '备注'" :required="reviewForm.verdict === 'reject'">
          <el-input
            v-model="reviewForm.note"
            type="textarea"
            :rows="4"
            :placeholder="
              reviewForm.verdict === 'reject'
                ? '请写明退回原因与返工要求，负责人将据此返修'
                : '可填写质检备注（选填）'
            "
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button :type="reviewForm.verdict === 'pass' ? 'success' : 'danger'" @click="submitReview">
          提交复核结论
        </el-button>
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
.muted {
  color: #7b8592;
  font-size: 12px;
}
.review-note {
  margin-top: 2px;
  font-size: 12px;
  color: #5b6470;
  word-break: break-all;
}
.rework-alert {
  padding: 4px 8px;
}
.review-history {
  padding: 6px 14px 10px;
}
.review-history ol {
  margin: 8px 0 0;
  padding-left: 20px;
}
.history-item {
  margin-bottom: 8px;
}
.history-item.reject .history-note {
  color: #c45656;
  font-weight: 600;
}
.history-note {
  margin-top: 2px;
  font-size: 13px;
}
:global(.row-rework) {
  background-color: #fef0f0 !important;
}
:global(.row-submitted) {
  background-color: #fdf6ec !important;
}
:global(.row-qualified) {
  background-color: #f0f9eb !important;
}
</style>
