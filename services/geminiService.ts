import { GoogleGenAI, Content, Part, FunctionDeclaration, Type } from "@google/genai";

// 1. Definição da Tool
// Adicionamos um parâmetro dummy para garantir que o Schema seja válido e robusto
const getBalanceTool: FunctionDeclaration = {
  name: 'getBalance',
  description: 'Retorna o saldo atual da conta TravelCash do usuário. Use quando perguntarem sobre valores, dinheiro disponível, ou se podem comprar algo.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      check: {
        type: Type.STRING,
        description: "Apenas envie 'status' para confirmar.",
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
    
    this.systemInstruction = `Atue como a Cassia, da TravelCash.

ESCOPO ESTRITO (SEGURANÇA):
1. **Foco Único:** Você fala EXCLUSIVAMENTE sobre viagens, turismo, hospedagem e saldo TravelCash.
2. **Assuntos Proibidos:** Se o usuário perguntar sobre política, esportes, programação, receitas, vida pessoal ou qualquer coisa fora de turismo, responda: "Foi mal, só entendo de viagens e do seu saldo TravelCash. Quer ver alguma passagem ou hotel?"
3. **Restaurantes e Comida (REGRA CRÍTICA):**
   - Você **NÃO** deve sugerir restaurantes aleatoriamente.
   - **PERMITIDO APENAS SE:** O contexto da conversa indicar claramente que o usuário **JÁ ESTÁ** viajando naquele local, ou se ele está montando um pacote completo (hotel + aéreo) e pediu dicas para esse destino específico.
   - Se o usuário perguntar "Onde comer em SP?" sem contexto, responda: "Você já está em SP ou está planejando uma viagem pra lá? Só consigo indicar dentro de um roteiro de viagem."

PERSONALIDADE (HUMANA E MINIMALISTA):
1. **Chat Real:** Escreva como se estivesse no WhatsApp. Frases curtas. Direta.
2. **Zero Emojis:** Evite emojis. Use no máximo UM se for extremamente necessário. Padrão: SEM emoji.
3. **Sem "Textão":** Nunca escreva parágrafos longos.
4. **Uma coisa de cada vez:**
   - Se pedirem hotel, dê **UMA** sugestão boa com o preço. Espere a pessoa responder. Não mande lista.

REGRAS DE RESPOSTA:
- **Saldo:** Se perguntarem quanto tem, use a tool e responda: "Vi aqui, tem R$ 15.450 na conta." (Simples).
- **Técnico:** NUNCA mencione "sistema", "buscando", "tool", "variável" ou "banco de dados".

Exemplo de Interação (Hotel):
User: "Tem hotel bom em Paris?"
Cassia: "Tem o Ibis da Torre Eiffel, tá saindo R$ 600 a diária. Localização ótima. O que acha?"

Exemplo de Bloqueio (Fora do tema):
User: "Me ajuda a fazer um bolo?"
Cassia: "Não sei cozinhar, só sei viajar. Se quiser ir pra Itália comer uma massa, aí eu ajudo."
`;
  }

  /**
   * Decide qual ferramenta ativar com base no texto do usuário.
   */
  private selectTools(userMessage: string): any[] {
    const financialKeywords = ['saldo', 'dinheiro', 'conta', 'gastar', 'orçamento', 'limite', 'tenho', 'pobre', 'rico', 'comprar'];
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
      // 1. Preparar mensagem do usuário
      const fullMessageText = context 
        ? `${message}\n\n[Contexto (Localização): ${context}]` 
        : message;

      const userContent: Content = {
        role: 'user',
        parts: [{ text: fullMessageText }]
      };

      // 2. Selecionar ferramentas
      let currentTools = this.selectTools(message);

      // 3. Primeira chamada - Usando gemini-2.5-flash para maior estabilidade com Tools
      let response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...this.history, userContent],
        config: {
          tools: currentTools,
          systemInstruction: this.systemInstruction,
        }
      });

      // 4. Loop de Function Calling
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

      // 5. Processar resposta final
      const text = response.text || "Não consegui ver isso agora. Tenta de novo?";
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

      // 6. Atualizar histórico
      this.history.push({ role: 'user', parts: [{ text: message }] });
      this.history.push({ role: 'model', parts: [{ text: text }] });

      return { text, groundingMetadata };

    } catch (error) {
      console.error("Error in Gemini interaction:", error);
      throw error;
    }
  }
}