/** 维修步骤类型 */
export type StepType = '拆解' | '清洗' | '润滑' | '装配' | '调试' | '走时测试';

export const STEP_TYPES: StepType[] = ['拆解', '清洗', '润滑', '装配', '调试', '走时测试'];

/**
 * 步骤状态：
 * - pending 待完成
 * - submitted 完成待检（负责人自检后提交，等待质检复核）
 * - rework 返修（质检退回，负责人查看原因后返工并再次送检）
 * - qualified 质检合格（进度统计的唯一口径）
 * - released 可放行
 */
export type StepState = 'pending' | 'submitted' | 'rework' | 'qualified' | 'released';

/** 质检结论 */
export type ReviewVerdict = 'pass' | 'reject';

/** 一次质检复核记录；每次送检都会追加一条，历史不覆盖 */
export interface StepReview {
  /** 复核人 */
  reviewer: string;
  /** 复核结论：合格 / 退回返修 */
  verdict: ReviewVerdict;
  /** 复核备注（退回时即返修原因） */
  note: string;
  /** 复核时间 */
  reviewedAt: number;
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
  /** 首次完成时间（保留原义，不因返修重检而丢失） */
  finishedAt?: number;
  /** 最近一次送检时间 */
  submittedAt?: number;
  /** 合格后放行时间 */
  releasedAt?: number;
  state: StepState;
  /** 历次质检复核记录，第一条即首次复核，末条为最近一次 */
  reviews: StepReview[];
}

export type RepairStepDraft = Omit<RepairStep, 'id'>;

/** 最近一次质检复核（未复核为 undefined） */
export function latestReview(step: Pick<RepairStep, 'reviews'>): StepReview | undefined {
  return step.reviews.length > 0 ? step.reviews[step.reviews.length - 1] : undefined;
}

/** 最近一次退回的返修原因（无退回记录为 undefined） */
export function latestRejectReason(step: Pick<RepairStep, 'reviews'>): string | undefined {
  for (let i = step.reviews.length - 1; i >= 0; i -= 1) {
    if (step.reviews[i].verdict === 'reject') return step.reviews[i].note;
  }
  return undefined;
}

/** 是否已质检合格（合格或已放行都计入进度） */
export function isQualified(state: StepState): boolean {
  return state === 'qualified' || state === 'released';
}

/** 是否处于待质检复核（完成待检） */
export function isPendingReview(state: StepState): boolean {
  return state === 'submitted';
}

/** 是否处于返修中 */
export function isRework(state: StepState): boolean {
  return state === 'rework';
}
