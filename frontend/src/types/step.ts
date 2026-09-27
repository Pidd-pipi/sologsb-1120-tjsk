/** 维修步骤类型 */
export type StepType = '拆解' | '清洗' | '润滑' | '装配' | '调试' | '走时测试';

export const STEP_TYPES: StepType[] = ['拆解', '清洗', '润滑', '装配', '调试', '走时测试'];

/** 步骤状态 */
export type StepState = 'pending' | 'done' | 'rolledback';

/**
 * 质检状态流转：完成待检 → 质检合格 → 可放行；
 * 质检退回后进入返修，重新完成后再次送检（回到「完成待检」）。
 */
export type QcState = 'none' | 'pending' | 'passed' | 'released' | 'rejected';

export const QC_STATE_LABEL: Record<QcState, string> = {
  none: '未送检',
  pending: '完成待检',
  passed: '质检合格',
  released: '可放行',
  rejected: '质检退回',
};

/** 一次质检复核记录（退回即返修原因，永久留痕） */
export interface QcRecord {
  id: string;
  /** 复核结论 */
  result: 'passed' | 'rejected';
  /** 复核人 */
  reviewer: string;
  /** 结论文案：合格 / 退回返修 */
  conclusion: string;
  /** 备注；退回时必填，即返修原因 */
  note: string;
  /** 复核时间 */
  at: number;
}

/** 是否已质检合格（含合格后放行） */
export function isQcPassed(step: Pick<RepairStep, 'qcState'>): boolean {
  return step.qcState === 'passed' || step.qcState === 'released';
}

/** 最近一条质检记录 */
export function latestQcRecord(step: Pick<RepairStep, 'qcRecords'>): QcRecord | undefined {
  return step.qcRecords.length === 0 ? undefined : step.qcRecords[step.qcRecords.length - 1];
}

/** 各步骤类型的动态字段开关 */
export const STEP_FIELD_MAP: Record<
  StepType,
  { needSolvent: boolean; needOil: boolean; needTorque: boolean }
> = {
  拆解: { needSolvent: false, needOil: false, needTorque: true },
  清洗: { needSolvent: true, needOil: false, needTorque: false },
  润滑: { needSolvent: false, needOil: true, needTorque: false },
  装配: { needSolvent: false, needOil: true, needTorque: true },
  调试: { needSolvent: false, needOil: false, needTorque: false },
  走时测试: { needSolvent: false, needOil: false, needTorque: false },
};

/** 维修工序 */
export interface RepairStep {
  id: string;
  clockId: string;
  stepType: StepType;
  /** 顺序号，不得跳号 */
  seq: number;
  /** 关联零件 */
  partIds: string[];
  /** 清洗液 */
  cleanSolvent: string;
  /** 清洗方式 */
  cleanMethod: string;
  /** 润滑油脂型号 */
  oilType: string;
  /** 润滑点位 */
  oilPoints: string;
  /** 拧紧力矩 N·m */
  torque: number;
  troubleNote: string;
  operator: string;
  startedAt: number;
  finishedAt?: number;
  state: StepState;
  /** 质检状态，历史数据按未复核（完成待检/none）处理 */
  qcState: QcState;
  /** 历次质检复核记录（含退回原因） */
  qcRecords: QcRecord[];
}

export type RepairStepDraft = Omit<RepairStep, 'id'>;
