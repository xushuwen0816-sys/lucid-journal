

import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BeliefMap, Affirmation, TarotCard, WishTags, DailyPractice, JournalEntry, TarotReading, Wish, ChatMessage } from "../types";

// Initialize Gemini Client Lazily
// This prevents the app from crashing at startup if process.env.API_KEY is not immediately available or configured
let aiInstance: GoogleGenAI | null = null;
let dynamicApiKey = typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_api_key') || '' : '';
let dynamicBaseUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_base_url') || '' : '';
let userName = typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_user_name') || '旅行者' : '旅行者';

export const setAiConfig = (key: string, name: string, baseUrl?: string) => {
  dynamicApiKey = key;
  userName = name || '旅行者';
  dynamicBaseUrl = baseUrl || '';
  
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('lucid_api_key', key);
    localStorage.setItem('lucid_user_name', userName);
    if (baseUrl) {
      localStorage.setItem('lucid_base_url', baseUrl);
    } else {
      localStorage.removeItem('lucid_base_url');
    }
  }
  aiInstance = null; // Reset instance to apply new config
};

// Keep specific setters for backward compatibility if needed, but internally they should update storage
export const setDynamicApiKey = (key: string) => {
  dynamicApiKey = key;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('lucid_api_key', key);
  }
  aiInstance = null;
};

export const setUserName = (name: string) => {
  userName = name || '旅行者';
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('lucid_user_name', userName);
  }
};

export const hasApiKey = () => {
  // Check strict equality to ensure we don't return true for empty strings or undefined
  return !!(process.env.API_KEY || dynamicApiKey);
};

const getAi = () => {
    if (!aiInstance) {
        const key = process.env.API_KEY || dynamicApiKey;
        const config: any = { apiKey: key || '' };
        
        // If a custom Base URL is set (e.g., for proxying from China), use it.
        // Otherwise, the SDK defaults to the official endpoint.
        if (dynamicBaseUrl) {
            config.baseUrl = dynamicBaseUrl;
        }

        aiInstance = new GoogleGenAI(config);
    }
    return aiInstance;
};

// --- Connection Check ---

export const checkConnection = async (): Promise<boolean> => {
    try {
        // Use a lightweight call to test connectivity
        await getAi().models.generateContent({
            model: "gemini-2.5-flash",
            contents: "ping",
            config: {
                maxOutputTokens: 1,
            }
        });
        return true;
    } catch (error) {
        console.error("Connection check failed:", error);
        return false;
    }
};

// --- Text & Analysis ---

export const analyzeWishDeepDive = async (wish: string, history: ChatMessage[]): Promise<string> => {
  const model = "gemini-2.5-flash"; 
  
  const systemInstructionText = `
    你是一个名为“LUCID（澄）”的潜意识操作系统向导。
    你的角色：像一位温柔、神秘、充满智慧的灵性疗愈师。
    你的服务对象名字是：${userName}。请在对话中自然、温暖地称呼对方（不要过于频繁，但要让对方感到被看见）。
    
    目标：帮助用户将模糊的愿望转化为清晰的意图，并挖掘深层阻碍。
    用户当前的愿望是：${wish}。
    
    沟通风格：
    1. 语言优美、治愈、但也一针见血。
    2. 请使用中文回复。
    3. 每次回复不要太长，保持对话的流动性。
    4. 每次只问 1 个最核心的问题，引导用户向内看。
    
    核心挖掘方向（不要一次问完，要循序渐进）：
       - 为什么这个愿望对你如此重要？(Why) 实现后的画面是怎样的？(Vision)
       - 你觉得内心有什么声音在阻碍你吗？(Conflict)
       - 如果无法实现，你最害怕的是什么？(Fear)
       - 愿望背后的核心情绪是什么？(Core Emotion)
  `;

  // Construct structured contents from history
  // Workaround for 500 Internal Server Error: Inject system instruction into the first message content
  // instead of using config.systemInstruction which can be unstable on some endpoints/models.
  const contents = history.map((msg, index) => {
    let text = msg.text;
    if (index === 0 && msg.role === 'user') {
      text = `${systemInstructionText}\n\n[User's Initial Input]: ${text}`;
    }
    return {
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: text }]
    };
  });

  try {
    const response = await getAi().models.generateContent({
      model,
      contents,
      // config: { systemInstruction: systemInstructionText } // Removed to fix 500 error
    });
    return response.text || "正在连接你的潜意识频率...";
  } catch (error) {
    console.error("Deep dive error:", error);
    return "信号受到了干扰，请检查网络连接或代理设置。";
  }
};

export const generateBeliefMapAndTags = async (wish: string, chatContext: string): Promise<{ beliefs: BeliefMap, tags: WishTags }> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    基于用户(${userName})愿望 "${wish}" 和深挖对话 "${chatContext}"。
    请生成 JSON 格式的信念地图(Belief Map)和愿望标签(Tags)。
    请全部使用中文。

    Requirements:
    1. beliefs: 识别用户的情绪阻碍、限制性信念，并设计一个新的身份(New Identity)。
    2. tags: 
       - emotional: 愿望背后的情绪关键词 (如: 丰盛, 安全感, 自由)
       - domain: 愿望所属领域 (如: 事业, 感情, 灵性)
       - style: 适合这个愿望的视觉/听觉风格 (如: 赛博朋克, 森林, 海洋, 极简)
  `;

  try {
    const response = await getAi().models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            beliefs: {
              type: Type.OBJECT,
              properties: {
                emotionalBlocks: { type: Type.ARRAY, items: { type: Type.STRING } },
                limitingBeliefs: { type: Type.ARRAY, items: { type: Type.STRING } },
                newIdentity: { type: Type.STRING },
              },
              required: ["emotionalBlocks", "limitingBeliefs", "newIdentity"]
            },
            tags: {
              type: Type.OBJECT,
              properties: {
                emotional: { type: Type.ARRAY, items: { type: Type.STRING } },
                domain: { type: Type.ARRAY, items: { type: Type.STRING } },
                style: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["emotional", "domain", "style"]
            }
          },
          required: ["beliefs", "tags"],
        },
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Belief/Tag error:", error);
    return {
      beliefs: { emotionalBlocks: ["未知阻碍"], limitingBeliefs: ["未知限制"], newIdentity: "全新的自己" },
      tags: { emotional: ["平静"], domain: ["生活"], style: ["柔和"] }
    };
  }
};

export const generateAffirmations = async (wish: string, beliefs: BeliefMap): Promise<Affirmation[]> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    愿望: "${wish}"
    新身份: "${beliefs.newIdentity}"
    用户: "${userName}"
    
    按照以下风格，请生成 **9条** 肯定语 (JSON格式)，即每种类型各生成 3 条。
    请用中文。
    
    1. conscious (显意识) - 3条: 
       - 风格：理性、逻辑、允许。
       - 句式："我选择..." "我允许自己..." "我意识到..."
       
    2. subconscious (潜意识) - 3条:
       - 风格：短促、有力、绝对、现在时。
       - 句式："我是..." (I AM)
       - 作用：直接指令，不容置疑。
       
    3. future_self (未来自我) - 3条:
       - 风格：充满画面感、感恩、扩张、已经实现的喜悦。
       - 句式："我如此感激..." "看着现在的我..."
  `;

  try {
    const response = await getAi().models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["conscious", "subconscious", "future_self"] },
            },
            required: ["text", "type"],
          },
        },
      },
    });
    return JSON.parse(response.text || "[]") as Affirmation[];
  } catch (error) {
    return [
        { text: "我允许自己接纳所有的丰盛。", type: "conscious" },
        { text: "我选择相信我的力量。", type: "conscious" },
        { text: "我意识到我是自由的。", type: "conscious" },
        { text: "我是丰盛本身。", type: "subconscious" },
        { text: "我是光。", type: "subconscious" },
        { text: "我是爱。", type: "subconscious" },
        { text: "我如此感激每一天自然流向我的财富。", type: "future_self" },
        { text: "看着现在的我，是如此的圆满。", type: "future_self" },
        { text: "谢谢你，这一切已经发生。", type: "future_self" }
    ];
  }
};

// --- Ritual ---

export const generateTarotReading = async (
    drawnCards: { name: string, isReversed: boolean, position: 'body' | 'mind' | 'spirit' }[],
    wishes: Wish[]
): Promise<TarotReading> => {
  const model = "gemini-2.5-flash";
  const wishSummary = wishes.map(w => w.content).join(", ") || "无特定愿望";
  
  const cardsDesc = drawnCards.map(c => `${c.position}: ${c.name} (${c.isReversed ? '逆位' : '正位'})`).join('\n');

  const prompt = `
    用户(${userName})刚刚抽取了以下三张塔罗牌：
    ${cardsDesc}
    
    用户的愿望列表：${wishSummary}。

    请根据这三张牌（注意正逆位含义）进行解读，分别对应身(Body)、心(Mind)、灵(Spirit)。
    并根据牌面能量，给出今日的行动指引。
    
    请用中文返回结果(JSON):
    1. cards: 包含 name(牌名), isReversed(是否逆位), meaning(详细解读，约80字，深入分析牌面含义和对用户当下的启示), position ("body", "mind", "spirit").
    2. guidance: 总体灵性指引 (General Guidance).
    3. actionHint: 今日具体的行动提示 (Action Hint).
    4. focusWishName: 在用户的愿望中，选出今天最值得推进的一个 (Focus Wish)，如无则填 "当下"。
  `;
  try {
    const response = await getAi().models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  isReversed: { type: Type.BOOLEAN },
                  meaning: { type: Type.STRING },
                  position: { type: Type.STRING, enum: ["body", "mind", "spirit"] },
                },
                required: ["name", "isReversed", "meaning", "position"]
              }
            },
            guidance: { type: Type.STRING },
            actionHint: { type: Type.STRING },
            focusWishName: { type: Type.STRING },
          },
          required: ["cards", "guidance", "actionHint", "focusWishName"]
        },
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Tarot error:", error);
    return {
        cards: drawnCards.map(c => ({ ...c, meaning: "能量读取中..." })),
        guidance: "相信直觉，答案在心中。",
        actionHint: "静心冥想 5 分钟。",
        focusWishName: "内在平静"
    };
  }
};

export const generateDailyPractice = async (readingContext: string): Promise<DailyPractice> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    基于以下塔罗解读和能量状态 (User: ${userName})：
    "${readingContext}"
    
    请生成今日的修行练习(JSON):
    1. energyStatus: 用一个富有画面感、诗意或力量感的短语形容今日能量场 (例如: 破茧成蝶, 暖阳融雪, 乘风破浪, 静水流深). 请尽量避免使用“整合”、“平稳”等过于抽象或重复的词汇，给出一个独特的能量隐喻.
    2. todaysAffirmation: 一句简短有力的肯定语.
    3. actionStep: 一个具体可执行的微行动 (Micro-Action).
  `;

  try {
    const response = await getAi().models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                energyStatus: { type: Type.STRING },
                todaysAffirmation: { type: Type.STRING },
                actionStep: { type: Type.STRING },
            },
            required: ["energyStatus", "todaysAffirmation", "actionStep"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    return { energyStatus: "平静如水", todaysAffirmation: "我与当下同在。", actionStep: "深呼吸三次。" };
  }
};

export const analyzeJournalEntry = async (text: string): Promise<JournalEntry['aiAnalysis']> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    分析以下用户(${userName})的觉察日记：
    "${text}"

    请返回 JSON，请确保内容有良好的可读性，适当使用换行符(\\n\\n)分段：
    1. blocksIdentified: 识别出的限制性信念或思维模式 (Array of strings).
    2. emotionalState: 用户当下的情绪状态关键词 (Array of strings, e.g. ["焦虑", "期待"]).
    3. summary: 一段富有洞察力的心理分析和反馈 (Deep Insight)。请像一位智慧的导师一样，如果内容较长，请分段落（使用 \\n\\n），不要写成一大块。
    4. tomorrowsAdvice: 给明天的建议。请提供具体的指引，并分段落（使用 \\n\\n）使其清晰易读。
    5. highSelfTraits: 从日记中发现的用户的高我特质/优点 (Array of strings, e.g. ["诚实", "勇敢"]).
  `;

  try {
    const response = await getAi().models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            blocksIdentified: { type: Type.ARRAY, items: { type: Type.STRING } },
            emotionalState: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
            tomorrowsAdvice: { type: Type.STRING },
            highSelfTraits: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["blocksIdentified", "emotionalState", "summary", "tomorrowsAdvice", "highSelfTraits"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

// --- Archive / Reporting ---

export const generateWeeklyReport = async (entries: JournalEntry[]): Promise<string> => {
    const model = "gemini-2.5-flash";
    const entriesText = entries.map(e => `[${new Date(e.date).toLocaleDateString()}] ${e.content}`).join('\n');
    
    const prompt = `
      基于以下过去一周的觉察日记 (User: ${userName})：
      ${entriesText}

      请生成一份 "LUCID 能量周报" (Markdown格式)，并直接返回报告，不要提及“好的，这是基于你日记生成的分析”等语句，直接与用户对话。
      
      结构要求：
      1. **本周能量关键词** (Heading 2)
      2. **核心突破** (Heading 2): 识别出的主要模式和已转化的信念。
      3. **情绪流动图谱** (Heading 2): 情绪的变化趋势分析。
      4. **高我特质闪光点** (Heading 2): 肯定用户的成长。
      5. **下周指引** (Heading 2): 灵性建议，可以是心态调整，也可以是具体可操作的一件事，或者二者兼有。

      风格：温暖、深度、充满力量。不要频繁引用用户的原话，用自己的话转述，让用户感觉被看见，被关心。
    `;

    try {
        const response = await getAi().models.generateContent({
            model,
            contents: prompt,
        });
        return response.text || "能量整合中...";
    } catch (error) {
        return "无法生成报告。";
    }
};

export const generateFutureLetterReply = async (userLetter: string): Promise<string> => {
    const model = "gemini-2.5-flash";
    const prompt = `
      User (${userName}) send a letter to their future self:
      "${userLetter}"

      You are the "Higher Self" or "Future Self" of ${userName}.
      Please write a reply.
      
      Important Formatting Rules:
      1. Use standard letter format. Start with a warm salutation (e.g., "亲爱的${userName}").
      2. Use paragraph breaks (\n\n) often. Do not write a single block of text. Break ideas into separate paragraphs.
      3. End with a warm closing (e.g., "爱你的未来", "永远陪伴你的...").
      
      Guidelines:
      1. Tone: Deeply empathetic, wise, unconditional love, comforting, and empowering.
      2. If the user seems distressed, anxious, or self-critical, prioritize emotional validation and comfort. Tell them it's okay, and that this too shall pass.
      3. If the user is happy, celebrate with them.
      4. Length: meaningful and substantial (approx 150-200 words).
      5. Language: Chinese.
      6. Context: You are speaking from a timeline where everything has already worked out.
    `;

    try {
        const response = await getAi().models.generateContent({
            model,
            contents: prompt,
        });
        return response.text || "收到。我在未来等你。";
    } catch (error) {
        return "信号连接中...";
    }
};
