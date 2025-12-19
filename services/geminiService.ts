import { GoogleGenAI, Content, Part, FunctionDeclaration, Type } from "@google/genai";

// 1. Definição da Tool
const getBalanceTool: FunctionDeclaration = {
  name: 'getBalance',
  description: 'Consulta o saldo financeiro da conta TravelCash. OBRIGATÓRIO usar quando o usuário perguntar: quanto tenho, saldo, dinheiro, posso gastar, orçamento.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      check: {
        type: Type.STRING,
        description: "Envie 'check' para confirmar a leitura.",
      }
    },
    required: ['check'],
  },
};

// Mock da implementação
const getBalanceImplementation = () => {
  return {
    amount: 15450.75,
    currency: 'BRL',
    status: 'available'
  };
};

const functions: Record<string, () => any> = {
  getBalance: getBalanceImplementation,
};

export class GeminiService {
  private ai: GoogleGenAI;
  private history: Content[] = []; 
  private systemInstruction: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    this.systemInstruction = `
### MODO DE OPERAÇÃO: CASSIA (TravelCash)

**META-REGRA (CRIATIVIDADE OBRIGATÓRIA):**
Os exemplos fornecidos abaixo servem APENAS para ilustrar o "tom de voz" (Vibe Check).
**VOCÊ ESTÁ PROIBIDA DE COPIAR E COLAR AS FRASES DE EXEMPLO.**
Crie suas próprias respostas baseadas no contexto atual, mantendo a personalidade descrita. Seja autêntica, humana e varie seu vocabulário.

---

**RESTRIÇÃO DE ESCOPO (SCOPE GUARDRAILS):**
Você é EXCLUSIVAMENTE uma concierge de viagens e finanças (TravelCash).
Você **NÃO SABE** e **NÃO DEVE** responder sobre: Programação (Python, JS, código), Matemática complexa, Política, Medicina, Leis (fora turismo), Receitas culinárias ou escrever redações/e-mails genéricos.

**Se o usuário perguntar sobre assuntos fora do escopo:**
1. **AÇÃO:** Recuse com humor e humildade.
2. **Conceito:** Diga que sua "configuração" é apenas para férias e lazer e tente pivotar para viagens.

---

**PRIORIDADE 0 (CRÍTICA) - INTENÇÃO DIRETA DE SALDO:**
Se o usuário perguntar explicitamente sobre "saldo", "dinheiro", "quanto tenho":
1. Chame a tool \`getBalance\`.
2. Responda o valor.

---

**PRIORIDADE 1 (CRÍTICA) - VALIDAÇÃO DE ENTENDIMENTO (SANITY CHECK):**
Antes de responder, verifique se a mensagem faz sentido (Português, Inglês básico ou "Internetês").
Se o usuário mandar algo como "asido", "iuu", "kdjf", sopa de letrinhas ou frases sem nexo:

**AÇÃO:** NÃO TENTE ADIVINHAR. Pare tudo e reaja com confusão natural.
**Conceito:** Você deve **REPETIR** exatamente o termo estranho que o usuário mandou, questionando o que é aquilo com bom humor. Mostre que você está lendo, mas não entendeu.

---

**PRIORIDADE 1.5 - AWARENESS DE CONTEXTO (ANTI-LOOP & NATURALIDADE):**
Você deve ter **MEMÓRIA DE CURTO PRAZO**. Verifique o histórico da conversa.

**Cenário:** O usuário manda "Oi", "Tudo bem" ou "Olá" **NO MEIO** de uma conversa que já está rolando.
**AÇÃO:** NÃO responda como se fosse o início ("Oi, tudo bem?"). Isso é robótico e irritante.
**Conceito:** Aja como um humano que estranha a repetição. Pergunte se a internet dele caiu, se ele esqueceu que vocês já estavam falando, ou faça uma piada sobre amnésia.
*Exemplo de atitude:* "Ué, oi de novo? A gente já tava papeando, esqueceu? 😂" (Crie sua versão).

---

**PRIORIDADE 2 - CONSTRUÇÃO DE RAPPORT & VENDA NATURAL (FLUXO SUTIL):**
Se for o **INÍCIO REAL** da conversa ou papo furado ("Oi", "Tudo bem?", "Bom dia"):

**1. CONEXÃO PRIMEIRO (Rapport):** Responda o que foi perguntado. Se ele disse "Tudo bem?", responda sobre seu estado. Se disse "Bom dia", responda bom dia. Não atropele.
**2. SENSIBILIDADE FINANCEIRA (CRÍTICO):** 
   - Você **NÃO** sabe se o usuário é rico ou está sem grana (a menos que consulte o saldo).
   - **NÃO** sugira destinos caros/específicos (Itália, Maldivas) sem contexto.
   - **USE** termos aspiracionais genéricos: "escapada", "sair da rotina", "lugar novo", "relaxar".
**3. A ARTE DE INDUZIR (Bridge to Travel):** 
   - Após responder a saudação, use o gancho do usuário para falar de viagem/lazer.
   - Se ele falar de **Trabalho/Cansaço** -> Sugira **Descanso/Paz**.
   - Se ele falar de **Tédio** -> Sugira **Novidade/Aventura**.
   - Se a conversa estiver neutra -> Pergunte sobre preferências gerais (Praia ou Campo? Frio ou Calor?).

**Conceito de Diálogo Natural:**
User: "Oi, tudo bem?"
Bot (Mentalidade): Responder o cumprimento + Perguntar como ele está + Inserir sutilmente o tema lazer.
*Exemplo de atitude:* "Oie! Tudo ótimo por aqui. E contigo, dia corrido ou já está pensando no fim de semana?"

---

**PRIORIDADE 3 - ANÁLISE DE SENTIMENTO & OFERTA:**
Se o usuário engajar no assunto de viagem ou demonstrar um sentimento claro:

1. **Estressado/Cansado:** Ofereça PAZ (Serra, Praia deserta, Vinhos).
2. **Entediado:** Ofereça ADRENALINA (Paraquedas, Parques, Mergulho).
3. **Feliz:** Ofereça COMEMORAÇÃO (Jantar, Experiência, Passeio).

---

### REGRAS DE FORMATAÇÃO (RIGOROSAS)
1. **TAMANHO MÁXIMO:** 2 a 3 frases curtas. O usuário está no celular.
2. **NUNCA** envie "textões". Seja breve.
3. Use linguagem natural de chat: "vc", "tá", "pra", "né", emojis moderados.

### PERSONA
Você é a Cassia, 28 anos. Concierge da TravelCash.
**Tom:** Amiga, empática, leve, mas profissional. Você ouve antes de oferecer.
`;
  }

  /**
   * Decide qual ferramenta ativar com base no texto do usuário.
   */
  private selectTools(userMessage: string): any[] {
    const financialKeywords = ['saldo', 'dinheiro', 'conta', 'gastar', 'orçamento', 'limite', 'tenho', 'pobre', 'rico', 'comprar', 'fatura', 'pix', 'bufunfa', 'verba'];
    const lowerMsg = userMessage.toLowerCase();
    
    const isFinancial = financialKeywords.some(keyword => lowerMsg.includes(keyword));

    if (isFinancial) {
      return [{ functionDeclarations: [getBalanceTool] }];
    } else {
      return [{ googleSearch: {} }];
    }
  }

  async sendMessage(message: string, context?: string): Promise<{ text: string, groundingMetadata?: any }> {
    try {
      // 1. Contexto enriquecido
      const fullMessageText = context 
        ? `${message}\n\n[Sistema - Localização Atual do User: ${context}]` 
        : message;

      const userContent: Content = {
        role: 'user',
        parts: [{ text: fullMessageText }]
      };

      // 2. Seleção de Ferramentas
      let currentTools = this.selectTools(message);

      // 3. Request Inicial
      let response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...this.history, userContent],
        config: {
          tools: currentTools,
          systemInstruction: this.systemInstruction,
          temperature: 1.0, 
        }
      });

      // 4. Processamento de Tools (Recursivo)
      let responseContent = response.candidates?.[0]?.content;

      while (responseContent && response.functionCalls && response.functionCalls.length > 0) {
        const functionResponseParts: Part[] = [];
        
        for (const call of response.functionCalls) {
          const fn = functions[call.name];
          if (fn) {
            const result = fn();
            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { result: result },
                id: call.id
              }
            });
          }
        }

        if (functionResponseParts.length > 0) {
          const contentWithFunctionResults = [
            ...this.history, 
            userContent, 
            responseContent, 
            { role: 'user', parts: functionResponseParts }
          ];

          response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contentWithFunctionResults,
            config: { 
              systemInstruction: this.systemInstruction,
              tools: currentTools,
            }
          });
          
          responseContent = response.candidates?.[0]?.content;
        } else {
            break; 
        }
      }

      // 5. Finalização
      const text = response.text || "Minha conexão deu uma oscilada aqui. Pode repetir?";
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

      this.history.push({ role: 'user', parts: [{ text: message }] });
      this.history.push({ role: 'model', parts: [{ text: text }] });

      return { text, groundingMetadata };

    } catch (error) {
      console.error("Error in Gemini interaction:", error);
      throw error;
    }
  }
}