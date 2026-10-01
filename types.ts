

export enum AppView {
  ENERGY = 'ENERGY', // New: Tarot & Practice
  JOURNAL = 'JOURNAL', // New: Journaling
  INTENT = 'INTENT', // Wish Creation
  ARCHIVE = 'ARCHIVE', // History + Affirmation Library
}

// Updated State for the new Intent Wizard Workflow (Simplified)
export interface IntentState {
  step: 'input' | 'deep-dive' | 'belief-reveal' | 'affirmation-select';
  wishInput: string;
  messages: ChatMessage[];
  isTyping: boolean;
  
  // Wizard Data
  generatedBeliefs?: BeliefMap;
  generatedTags?: WishTags;
  generatedAffirmations: Affirmation[];
}

export interface Wish {
  id: string;
  content: string;
  createdAt: number;
  tags: WishTags;
  status: 'draft' | 'active' | 'manifested';
  
  deepDiveChat: ChatMessage[];
  beliefs: BeliefMap;
  affirmations: Affirmation[];
}

export interface WishTags {
  emotional: string[];
  domain: string[];
  style: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// --- Agent Orchestration (Phase 2) ---
// 传给 Agent 的本地数据上下文。工具执行时从这里取数，无需额外网络请求。
export interface AgentContext {
  journals?: JournalEntry[];
  wishes?: Wish[];
}

// 一次工具调用的可展示轨迹（用于 UI 显示 Agent 的"行动"过程）
export interface AgentToolStep {
  /** 工具名 */
  tool: string;
  /** 模型给出的调用参数 */
  args: Record<string, unknown>;
  /** 本地执行结果的简短中文摘要 */
  summary: string;
}

// 流式回调 + 工具回调
export interface DeepDiveOptions {
  ctx?: AgentContext;
  /** 每收到一段增量 token 触发一次 */
  onChunk?: (delta: string) => void;
  /** 模型请求调用某个工具、且本地已执行完成时触发 */
  onTool?: (step: AgentToolStep) => void;
  /** 模型自主判断深挖已充分、要求生成信念地图时触发 */
  onProposeBeliefMap?: (reason: string) => void;
}

export interface BeliefMap {
  emotionalBlocks: string[];
  limitingBeliefs: string[];
  supportiveBeliefs: string[]; // Added: Current positive mindset
  newIdentity: string;
}

export interface Affirmation {
  text: string;
  type: 'conscious' | 'subconscious' | 'future_self';
  isFavorite?: boolean;
}

export interface TarotCard {
  name: string;
  isReversed: boolean;
  meaning: string;
  position: 'body' | 'mind' | 'spirit' | 'oracle';
}

export interface TarotReading {
  cards: TarotCard[];
  guidance: string;
  actionHint: string;
  focusWishName?: string;
}

export interface DailyPractice {
  energyStatus: string;
  todaysAffirmation: string;
  actionStep: string;
}

export interface JournalEntry {
  id: string;
  date: number;
  content: string;
  aiAnalysis?: {
    blocksIdentified: string[];
    emotionalState: string[]; // Changed to array for multiple tags
    summary: string;
    tomorrowsAdvice: string;
    highSelfTraits?: string[]; 
  };
}

export interface RitualArchiveEntry {
  id: string;
  date: number;
  reading?: TarotReading;
  oracleReading?: TarotReading;
  practice?: DailyPractice;
}

export interface FutureLetter {
  id: string;
  createdAt: number;
  content: string;
  sendDate: number;
  aiReply?: string;
  isLocked: boolean;
  isRead?: boolean;
}