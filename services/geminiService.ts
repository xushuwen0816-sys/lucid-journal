
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { BeliefMap, Affirmation, TarotCard, WishTags, DailyPractice, JournalEntry, TarotReading, Wish, ChatMessage } from "../types";

// Initialize Gemini Client Lazily
let aiInstance: GoogleGenAI | null = null;
const DEFAULT_PROXY = import.meta.env.VITE_DEFAULT_PROXY_URL || '';
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

let dynamicApiKey = typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_api_key') || '' : '';
let currentProvider: 'gemini' | 'siliconflow' = (typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_provider') as any : 'gemini') || 'gemini';

// --- HELPER: DATA SANITIZATION ---
// Prevents React errors when AI returns objects instead of strings (e.g. {title: "Joy"} instead of "Joy")

const cleanJsonString = (str: string): string => {
  if (!str) return "{}";
  let cleaned = str.trim();
  // Remove markdown code blocks if present
  cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  return cleaned;
};

const sanitizeString = (val: any): string => {
  if (!val) return "";
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
      // Prioritize common keys DeepSeek might return for a single string field
      return val.text || val.content || val.value || val.name || val.title || val.description || val.message || JSON.stringify(val);
  }
  return String(val);
};

const sanitizeStringArray = (arr: any[]): string[] => {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return String(item);
    if (typeof item === 'object' && item !== null) {
      // Try common property names DeepSeek/AI might return in object lists
      return item.text || item.title || item.name || item.content || item.label || item.value || item.description || JSON.stringify(item);
    }
    return String(item);
  }).filter(s => s && s.trim() !== '' && s !== '[object Object]');
};

// --- GRANDMA-FRIENDLY AUTO-FIX ---
// Helper to clean up potentially bad stored URLs
const getInitialBaseUrl = () => {
  if (typeof localStorage === 'undefined') return DEFAULT_PROXY;
  
  const stored = localStorage.getItem('lucid_base_url');
  
  // Case 1: No stored URL -> Use New Default
  if (!stored) return DEFAULT_PROXY;
  
  // Case 2: (Removed) Allow users to use their own workers.dev proxy
  // if (stored.includes('workers.dev') && !stored.includes('empty-feather')) {
  //   return DEFAULT_PROXY;
  // }
  
  // Case 3: Stored URL is empty string (User tried to direct connect) -> Force Update to New Domain (Assuming they are in China)
  if (stored.trim() === '') {
    return DEFAULT_PROXY;
  }

  return stored;
};

let dynamicBaseUrl = getInitialBaseUrl();
let userName = typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_user_name') || '旅行者' : '旅行者';

export const setAiConfig = (key: string, name: string, baseUrl?: string, provider: 'gemini' | 'siliconflow' = 'gemini') => {
  dynamicApiKey = key;
  userName = name || '旅行者';
  currentProvider = provider;
  
  // Robust URL formatting for Proxy/Base URL
  if (baseUrl && baseUrl.trim().length > 0) {
      let cleanUrl = baseUrl.trim();
      cleanUrl = cleanUrl.replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(cleanUrl)) {
          cleanUrl = `https://${cleanUrl}`;
      }
      
      // SAFETY CHECK: If provider is SiliconFlow but URL looks like Gemini Proxy, force Direct
      if (provider === 'siliconflow' && cleanUrl.includes('workers.dev')) {
          dynamicBaseUrl = SILICONFLOW_BASE_URL;
      } else {
          dynamicBaseUrl = cleanUrl;
      }
  } else {
      // If no custom URL provided:
      if (provider === 'siliconflow') {
          // Default SiliconFlow (Direct)
          dynamicBaseUrl = SILICONFLOW_BASE_URL;
      } else {
          // Default Gemini (Direct or handled by SDK defaults if empty)
          dynamicBaseUrl = '';
      }
  }
  
  if (typeof localStorage !== 'undefined') {
    // Only update the "generic" legacy key if we are in Gemini mode or to keep compat
    localStorage.setItem('lucid_api_key', key);
    localStorage.setItem('lucid_user_name', userName);
    localStorage.setItem('lucid_provider', provider);
    if (dynamicBaseUrl) {
      localStorage.setItem('lucid_base_url', dynamicBaseUrl);
    } else {
      localStorage.setItem('lucid_base_url', '');
    }
  }
  aiInstance = null; // Reset instance to apply new config
};

export const hasApiKey = () => {
  return !!(process.env.API_KEY || dynamicApiKey);
};

const getAi = () => {
    if (!aiInstance) {
        const key = process.env.API_KEY || dynamicApiKey;
        
        // Construct config
        // NOTE: For @google/genai SDK, connection settings are passed differently depending on version.
        // Based on search results, 'httpOptions.baseUrl' or root config 'baseUrl' might be used.
        // We will try to set it in a way that covers most bases, but specifically for the new SDK:
        // It seems the constructor takes { apiKey, httpOptions: { baseUrl: ... } }
        
        const clientOptions: any = { apiKey: key || '' };

        if (dynamicBaseUrl && dynamicBaseUrl !== SILICONFLOW_BASE_URL) {
            // Ensure no trailing slash
            const cleanUrl = dynamicBaseUrl.replace(/\/+$/, '');
            console.log('[LUCID] Setting Custom Base URL:', cleanUrl);
            
            // Try Method 1: Top-level baseUrl (common in some versions)
            clientOptions.baseUrl = cleanUrl;
            
            // Try Method 2: httpOptions.baseUrl (common in newer @google/genai)
            clientOptions.httpOptions = {
                baseUrl: cleanUrl,
                apiVersion: 'v1beta'
            };
        }

        console.log('[LUCID] Initializing Gemini with options:', JSON.stringify(clientOptions, null, 2));

        aiInstance = new GoogleGenAI(clientOptions);
    }
    return aiInstance;
};

// --- Helper: API Call with Retry ---
const callGeminiWithRetry = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 2000
): Promise<T> => {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (error: any) {
            attempt++;
            if (attempt > maxRetries) throw error;
            
            // Check if error is 429 (Resource Exhausted)
            const is429 = error.message && (
                error.message.includes("429") || 
                error.message.includes("Resource exhausted") ||
                error.message.includes("quota")
            );

            if (is429) {
                console.warn(`[LUCID] Gemini 429 Error (Attempt ${attempt}/${maxRetries}). Retrying in ${baseDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, baseDelay));
            } else {
                throw error; // Non-retriable error
            }
        }
    }
};

// --- SiliconFlow Adapter (OpenAI Compatible) ---

const callSiliconFlow = async (
    systemPrompt: string, 
    userPrompt: string | { role: string, content: string }[], 
    jsonMode: boolean = false
): Promise<string> => {
    // IMPORTANT: Prioritize dynamicApiKey (User Input) over process.env.API_KEY if dynamic is present
    const key = dynamicApiKey || process.env.API_KEY;
    if (!key) throw new Error("API Key missing");

    const messages = [];
    
    // Add System Prompt if exists
    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }

    // Add User Prompt / History
    if (Array.isArray(userPrompt)) {
        messages.push(...userPrompt);
    } else {
        messages.push({ role: "user", content: userPrompt });
    }

    // Use dynamicBaseUrl if set, otherwise fallback to default
    const baseUrl = dynamicBaseUrl || SILICONFLOW_BASE_URL;

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: "deepseek-ai/DeepSeek-V3", // SiliconFlow Model ID
                messages: messages,
                stream: false,
                response_format: jsonMode ? { type: "json_object" } : undefined
            })
        });

        if (!response.ok) {
            const err = await response.text();
            
            // Handle common 402/401 explicitly for better UX
            if (response.status === 402) {
                 throw new Error("SiliconFlow Error: 余额不足 (Insufficient Balance). Please top up your SiliconFlow account.");
            }
            if (response.status === 401) {
                 throw new Error("SiliconFlow Error: 认证失败 (Auth Failed). Check your API Key.");
            }

            throw new Error(`SiliconFlow API Error: ${response.status} - ${err}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
        console.error("SiliconFlow Call Failed:", error);
        throw error;
    }
};

// --- Connection Check ---

export const checkConnection = async (): Promise<{ success: boolean; message?: string }> => {
    try {
        if (currentProvider === 'siliconflow') {
             // SiliconFlow connection check - use empty system prompt
             await callSiliconFlow("", "Hello");
             return { success: true };
        } else {
            // Use gemini-1.5-flash-latest or gemini-2.0-flash which are active
            // Refer to: https://ai.google.dev/gemini-api/docs/models/gemini
            const model = "gemini-2.5-flash";
            
            await callGeminiWithRetry(() => getAi().models.generateContent({
                model,
                contents: "ping",
                config: {
                    maxOutputTokens: 1,
                }
            }));
            return { success: true };
        }
    } catch (error: any) {
        console.error("Connection check failed:", error);
        let msg = `连接失败: `;
        
        if (error.message) {
            msg += error.message;
            
            // Add helpful tips based on keywords
            if (msg.includes("401") || msg.includes("Auth Failed")) {
                msg += " (请检查 API Key)";
            } else if (msg.includes("Failed to fetch")) {
                msg += " (请检查域名拼写、SSL设置或是否被防火墙拦截)";
            } else if (msg.includes("404") || msg.includes("Not Found")) {
                msg += " (模型未找到，可能该版本已下线或 Key 权限不足)";
            } else if (msg.includes("429") || msg.includes("Resource exhausted")) {
                msg += " (API调用频率过高，请稍后再试)";
            }
        } else {
            msg += JSON.stringify(error);
        }
        
        return { success: false, message: msg };
    }
};

// --- Text & Analysis ---

export const analyzeWishDeepDive = async (wish: string, history: ChatMessage[]): Promise<string> => {
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

  try {
      if (currentProvider === 'siliconflow') {
          // Convert history to OpenAI format
          const openAIMessages = history.map(msg => ({
              role: msg.role === 'model' ? 'assistant' : 'user',
              content: msg.text
          }));
          return await callSiliconFlow(systemInstructionText, openAIMessages);
      } else {
          // Gemini Logic
          // Use gemini-2.0-flash as it is the current stable version
          const model = "gemini-2.5-flash"; 
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

          const response = await callGeminiWithRetry(() => getAi().models.generateContent({
            model,
            contents,
          }));
          return response.text || "正在连接你的潜意识频率...";
      }
  } catch (error) {
    console.error("Deep dive error:", error);
    return "信号受到了干扰，请检查网络连接或API设置。";
  }
};

export const generateBeliefMapAndTags = async (wish: string, chatContext: string): Promise<{ beliefs: BeliefMap, tags: WishTags }> => {
  const prompt = `
    基于用户(${userName})愿望 "${wish}" 和深挖对话 "${chatContext}"。
    请生成 JSON 格式的信念地图(Belief Map)和愿望标签(Tags)。
    请全部使用中文。

    Requirements:
    1. beliefs: 
       - emotionalBlocks: 识别用户的情绪阻碍（2-4个字）。
       - limitingBeliefs: 识别用户的限制性信念。**关键要求**：请提取**通用的核心心理模式**（例如："不配得感"、"匮乏心态"、"完美主义"、"对未知的恐惧"），**严禁**使用长句复述具体事件。这用于数据统计，必须抽象化、标签化。
       - supportiveBeliefs: 识别用户当前已具备的、有助于实现愿望的正确思路或内在优势（例如："成长型思维"、"行动力"）。同样保持短语形式。
       - newIdentity: 设计一个新的身份(New Identity)，基于愿望实现后的状态。
    2. tags: 
       - emotional: 愿望背后的情绪关键词 (如: 丰盛, 安全感, 自由)
       - domain: 愿望所属领域 (如: 事业, 感情, 灵性)
       - style: 适合这个愿望的视觉/听觉风格 (如: 赛博朋克, 森林, 海洋, 极简)
       
    返回格式必须是纯 JSON。
  `;

  try {
      let jsonStr = "";
      
      if (currentProvider === 'siliconflow') {
          jsonStr = await callSiliconFlow(
              "You are a subconscious analysis engine. You output strictly JSON.", 
              prompt, 
              true // Force JSON mode
          );
      } else {
          const model = "gemini-2.5-flash";
          const response = await callGeminiWithRetry(() => getAi().models.generateContent({
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
                        supportiveBeliefs: { type: Type.ARRAY, items: { type: Type.STRING } },
                        newIdentity: { type: Type.STRING },
                      },
                      required: ["emotionalBlocks", "limitingBeliefs", "supportiveBeliefs", "newIdentity"]
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
            }));
            jsonStr = response.text || "{}";
      }
      
      const parsed = JSON.parse(cleanJsonString(jsonStr));
      
      // Sanitize fields
      if (parsed.beliefs) {
          parsed.beliefs.emotionalBlocks = sanitizeStringArray(parsed.beliefs.emotionalBlocks);
          parsed.beliefs.limitingBeliefs = sanitizeStringArray(parsed.beliefs.limitingBeliefs);
          parsed.beliefs.supportiveBeliefs = sanitizeStringArray(parsed.beliefs.supportiveBeliefs);
          parsed.beliefs.newIdentity = sanitizeString(parsed.beliefs.newIdentity);
      }
      if (parsed.tags) {
          parsed.tags.emotional = sanitizeStringArray(parsed.tags.emotional);
          parsed.tags.domain = sanitizeStringArray(parsed.tags.domain);
          parsed.tags.style = sanitizeStringArray(parsed.tags.style);
      }
      
      return parsed;
  } catch (error) {
    console.error("Belief/Tag error:", error);
    return {
      beliefs: { 
          emotionalBlocks: ["未知阻碍"], 
          limitingBeliefs: ["未知限制"], 
          supportiveBeliefs: ["未发现优势"],
          newIdentity: "全新的自己" 
      },
      tags: { emotional: ["平静"], domain: ["生活"], style: ["柔和"] }
    };
  }
};

export const generateAffirmations = async (wish: string, beliefs: BeliefMap): Promise<Affirmation[]> => {
  const prompt = `
    愿望: "${wish}"
    新身份: "${beliefs.newIdentity}"
    用户: "${userName}"
    
    按照以下要求，请生成 **18条** 肯定语 (JSON格式)，即每种类型各生成 6 条。
    请用中文。
    肯定语应当非常强大，旨在洗清用户的限制性信念，重塑用户的思维。
    
    1. conscious (显意识) - 6条: 
       - 风格：理性、逻辑、允许。
       - 句式："我选择..." "我允许自己..." "我意识到..." "我释放..."
       
    2. subconscious (潜意识) - 6条:
       - 风格：短促、有力、绝对、现在时。
       - 句式："我是..." (I AM)
       - 作用：直接指令，不容置疑，如同重写代码。
       
    3. future_self (未来自我) - 6条:
       - 风格：具像化地描写用户实现愿望之后的现实细节和情绪状态。
       - 内容：包含具体的感官细节（看到了什么、听到了什么）和强烈的积极情绪（感恩、狂喜、平静）。
       - 句式："我如此感激..." "看着窗外的..." "这一切发生得如此自然..."，只是风格示范，实际输出应有多种句式。

    Output JSON Array only: [{ text: "...", type: "conscious" | "subconscious" | "future_self" }]
  `;

  try {
      let jsonStr = "";
      if (currentProvider === 'siliconflow') {
           jsonStr = await callSiliconFlow(
              "You are an affirmation generator. Output strictly JSON array.",
              prompt,
              true
           );
           const cleanStr = cleanJsonString(jsonStr);
           const parsed = JSON.parse(cleanStr);
           
           let affirmations: any[] = [];
           if (Array.isArray(parsed)) {
               affirmations = parsed;
           } else if (parsed.affirmations && Array.isArray(parsed.affirmations)) {
               affirmations = parsed.affirmations;
           }

           // Sanitize affirmations
           return affirmations.map((a: any) => ({
               text: sanitizeString(a.text || a), // Use sanitizeString to extract text if object
               type: a.type
           }));

      } else {
           const model = "gemini-2.5-flash";
           const response = await callGeminiWithRetry(() => getAi().models.generateContent({
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
            }));
            jsonStr = response.text || "[]";
            return JSON.parse(jsonStr);
      }
  } catch (error) {
    // Fallback affirmations
    return [
        { text: "我允许自己接纳所有的丰盛。", type: "conscious" },
        { text: "我是丰盛本身。", type: "subconscious" },
        { text: "我如此感激每一天自然流向我的财富。", type: "future_self" },
    ];
  }
};

// --- Ritual ---

export const generateTarotReading = async (
    drawnCards: { name: string, isReversed: boolean, position: 'body' | 'mind' | 'spirit' }[],
    wishes: Wish[]
): Promise<TarotReading> => {
  const wishSummary = wishes.map(w => w.content).join(", ") || "无特定愿望";
  const cardsDesc = drawnCards.map(c => `${c.position}: ${c.name} (${c.isReversed ? '逆位' : '正位'})`).join('\n');

  const prompt = `
    用户(${userName})刚刚抽取了以下三张塔罗牌：
    ${cardsDesc}
    
    用户的愿望列表：${wishSummary}。

    请根据这三张牌（注意正逆位含义）进行解读，分别对应身(Body)、心(Mind)、灵(Spirit)。
    并根据牌面能量，给出今日的行动指引。

    【重要解读风格要求】：
    1. **生活化与落地感**：解读必须紧贴**今天**的日常生活（如饮食、睡眠、工作节奏、具体心情）。拒绝宏大叙事（如“人生转折”、“灵魂使命”）。
    2. **温暖轻松，如挚友交谈**：语气平和，像一位值得信赖的老友在轻声叮嘱。
       - **禁止**使用“嬉皮笑脸”或过于亢奋的语气。
       - **禁止**频繁使用问号和感叹号（全篇回复中，问号最多1个，感叹号最多1个）。
    3. **具体示例**：
       - 将“你需要调整生活状态，重视健康”转化为：“昨天是不是没睡好呀？记得今天好好补个觉。”
       - 将“你这段时间压力很大”转化为：“即便工作辛苦，也要好好照顾自己呀，摸摸头。”
       - 将“不要抗拒变化”转化为：“扔掉一件你很久不用的旧东西，适当断舍离能让心情更轻松～”
    
    请用中文返回结果(JSON):
    1. cards: 包含 name(牌名), isReversed(是否逆位), meaning(详细解读，约80字，深入分析牌面含义和对用户当下的启示), position ("body", "mind", "spirit").
    2. guidance: 总体灵性指引 (General Guidance).
    3. actionHint: 今日具体的行动提示 (Action Hint).
    4. focusWishName: 在用户的愿望中，选出今天最值得推进的一个 (Focus Wish)，如无则填 "当下"。
  `;
  try {
    let jsonStr = "";
    if (currentProvider === 'siliconflow') {
        jsonStr = await callSiliconFlow(
            "You are a Tarot Reader. Output strictly JSON.",
            prompt,
            true
        );
    } else {
        const model = "gemini-2.5-flash";
        const response = await callGeminiWithRetry(() => getAi().models.generateContent({
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
        }));
        jsonStr = response.text || "{}";
    }
    const raw = JSON.parse(cleanJsonString(jsonStr));
    
    // Sanitize fields
    if (raw.cards && Array.isArray(raw.cards)) {
         raw.cards = raw.cards.map((c: any) => ({
             ...c,
             name: sanitizeString(c.name),
             meaning: sanitizeString(c.meaning)
         }));
    }
    raw.guidance = sanitizeString(raw.guidance);
    raw.actionHint = sanitizeString(raw.actionHint);
    raw.focusWishName = sanitizeString(raw.focusWishName);

    return raw;
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

export const generateOracleReading = async (
    drawnCards: { name: string, keywords: string[], meaning?: string, description?: string, position: 'body' | 'mind' | 'spirit' | 'oracle' }[],
    wishes: Wish[]
): Promise<TarotReading> => {
  const wishSummary = wishes.map(w => w.content).join(", ") || "无特定愿望";
  const cardsDesc = drawnCards.map(c => 
      `${c.name}
       [关键词: ${c.keywords.join(', ')}]
       [画面: ${c.description || '无'}]
       [原牌义: ${c.meaning || '无'}]`
  ).join('\n\n');

  const prompt = `
    用户(${userName})刚刚抽取了一张神谕卡，使用的是《女神神谕卡》（The Goddess Oracle）：
    ${cardsDesc}
    
    用户的愿望列表：${wishSummary}。

    请根据这张神谕卡进行解读。
    请结合提供的【原牌义】和【画面】描述，给出温暖、疗愈、低压感且富有洞察力的指引。
    不要进行身、心、灵的分类，而是给出一个核心的神谕讯息 (Oracle Message)。
    
    请用中文返回结果(JSON):
    1. cards: 包含 name(牌名), isReversed(固定为false), meaning(详细解读，约120字，结合关键词和画面给予指引), position (固定为 "oracle").
    2. guidance: 总体神谕指引 (Oracle Guidance)，作为整次解读的总结升华。
    3. actionHint: 今日具体的能量行动提示 (Energy Action).
    4. focusWishName: 在用户的愿望中，选出今天最值得关注的一个，如无则填 "当下"。
  `;
  
  try {
    let jsonStr = "";
    if (currentProvider === 'siliconflow') {
        jsonStr = await callSiliconFlow(
            "You are an Oracle Card Reader. Output strictly JSON.",
            prompt,
            true
        );
    } else {
        const model = "gemini-2.5-flash";
        const response = await callGeminiWithRetry(() => getAi().models.generateContent({
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
                      position: { type: Type.STRING, enum: ["oracle"] },
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
        }));
        jsonStr = response.text || "{}";
    }
    
    const raw = JSON.parse(cleanJsonString(jsonStr));
    
    // Sanitize
    if (raw.cards && Array.isArray(raw.cards)) {
         raw.cards = raw.cards.map((c: any) => ({
             ...c,
             name: sanitizeString(c.name),
             meaning: sanitizeString(c.meaning)
         }));
    }
    raw.guidance = sanitizeString(raw.guidance);
    raw.actionHint = sanitizeString(raw.actionHint);
    raw.focusWishName = sanitizeString(raw.focusWishName);

    return raw;
  } catch (error) {
    console.error("Oracle error:", error);
    return {
        cards: drawnCards.map(c => ({ ...c, isReversed: false, meaning: "神谕下载中...", position: "oracle" as const })),
        guidance: "宇宙正在对你耳语。",
        actionHint: "聆听内心的声音。",
        focusWishName: "当下"
    };
  }
};


export const generateDailyPractice = async (readingContext: string): Promise<DailyPractice> => {
  const prompt = `
    基于以下塔罗解读和能量状态 (User: ${userName})：
    "${readingContext}"
    
    请生成今日的修行练习(JSON):
    1. energyStatus: 用一个富有画面感、诗意或力量感的短语形容今日能量场 (例如: 破茧成蝶, 暖阳融雪, 乘风破浪, 静水流深). 请尽量避免使用“整合”、“平稳”等过于抽象或重复的词汇，给出一个独特的能量隐喻.
    2. todaysAffirmation: 一句简短有力的肯定语.
    3. actionStep: 一个具体可执行的微行动 (Micro-Action).
  `;

  try {
    let jsonStr = "";
    if (currentProvider === 'siliconflow') {
         jsonStr = await callSiliconFlow("You are a spiritual guide. Output strictly JSON.", prompt, true);
    } else {
         const model = "gemini-2.5-flash";
         const response = await callGeminiWithRetry(() => getAi().models.generateContent({
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
         }));
         jsonStr = response.text || "{}";
    }
    const raw = JSON.parse(cleanJsonString(jsonStr));
    return {
        energyStatus: sanitizeString(raw.energyStatus),
        todaysAffirmation: sanitizeString(raw.todaysAffirmation),
        actionStep: sanitizeString(raw.actionStep)
    };
  } catch (error) {
    return { energyStatus: "平静如水", todaysAffirmation: "我与当下同在。", actionStep: "深呼吸三次。" };
  }
};

export const analyzeJournalEntry = async (text: string): Promise<JournalEntry['aiAnalysis']> => {
  const prompt = `
    分析以下用户(${userName})的觉察日记：
    "${text}"

    请返回 JSON，请确保内容有良好的可读性，适当使用换行符(\\n\\n)分段：
    1. blocksIdentified: 识别出的限制性信念 (Array of strings)。
       **核心定义**：限制性信念是深层的、固化的**思维范式**或**世界观**（例如："我不配得"、"我必须完美才值得被爱"、"世界是不安全的"）。
       **严格禁止**：
       - **禁止**包含情绪感受（如"被抛弃感"、"孤独感"、"焦虑" —— 这些是情绪，不是信念）。
       - **禁止**单纯列举性格标签（如"完美主义" —— 这只是现象，请挖掘其背后的信念，如"容错度低"或"必须完美"）。
       - **禁止**无中生有。如果日记中没有明显的限制性信念，请留空，不要强行凑数。
       - 保持客观中立，不要让用户感到被评判或挑刺。
       每个词建议2-8个字，保持抽象和通用性。

    2. emotionalState: 用户当下的情绪状态关键词 (Array of strings, e.g. ["释然", "期待", "疲惫"])。

    3. summary: 一段富有洞察力的心理分析和反馈 (Deep Insight)。
       - 风格：**温暖、接纳、像一位深谙人性的智者好友**。
       - 目标：鼓励用户表达，确认看见用户的感受。不要高高在上地教导，也不要盲目吹捧。
       - 格式：如果内容较长，请分段落（使用 \\n\\n）。

    4. tomorrowsAdvice: 给明天的建议。请提供具体的指引，并分段落（使用 \\n\\n）使其清晰易读。

    5. highSelfTraits: 从日记中发现的用户的高我特质/优点 (Array of strings)。
       **严格筛选**：
       - **禁止**使用"自我觉察"、"内省"、"愿意改变"等词汇（因为写日记本身就代表了这些，说了等于没说）。
       - 请挖掘更具体的特质（如："诚实面对自我"、"逻辑清晰"、"富有同理心"、"坚韧"、"细腻的感知力"）。
       - 态度要真诚客观，不要过度溢美（捧杀）。
  `;

  try {
      let jsonStr = "";
      if (currentProvider === 'siliconflow') {
          jsonStr = await callSiliconFlow("You are a psychology expert. Output strictly JSON.", prompt, true);
      } else {
          const model = "gemini-2.5-flash";
          const response = await callGeminiWithRetry(() => getAi().models.generateContent({
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
            }));
            jsonStr = response.text || "{}";
      }
      
      const rawData = JSON.parse(cleanJsonString(jsonStr));
      
      return {
          ...rawData,
          blocksIdentified: sanitizeStringArray(rawData.blocksIdentified),
          emotionalState: sanitizeStringArray(rawData.emotionalState),
          highSelfTraits: sanitizeStringArray(rawData.highSelfTraits),
          summary: sanitizeString(rawData.summary),
          tomorrowsAdvice: sanitizeString(rawData.tomorrowsAdvice),
      };

  } catch (error) {
    console.error(error);
    return undefined;
  }
};

// --- Archive / Reporting ---

export const generateWeeklyReport = async (entries: JournalEntry[]): Promise<string> => {
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
        if (currentProvider === 'siliconflow') {
            return await callSiliconFlow("You are a spiritual mentor.", prompt);
        } else {
            const model = "gemini-2.5-flash";
            const response = await callGeminiWithRetry(() => getAi().models.generateContent({
                model,
                contents: prompt,
            }));
            return response.text || "能量整合中...";
        }
    } catch (error) {
        return "无法生成报告。";
    }
};

export const generateFutureLetterReply = async (userLetter: string): Promise<string> => {
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
        if (currentProvider === 'siliconflow') {
            return await callSiliconFlow("You are the Higher Self.", prompt);
        } else {
            const model = "gemini-2.5-flash";
            const response = await callGeminiWithRetry(() => getAi().models.generateContent({
                model,
                contents: prompt,
            }));
            return response.text || "收到。我在未来等你。";
        }
    } catch (error) {
        return "信号连接中...";
    }
};