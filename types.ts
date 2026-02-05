

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
  practice?: DailyPractice;
}

export interface FutureLetter {
  id: string;
  createdAt: number;
  content: string;
  sendDate: number;
  aiReply?: string;
  isLocked: boolean;
}