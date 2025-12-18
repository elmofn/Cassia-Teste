import { GoogleGenAI, Content, Part, FunctionDeclaration, Type } from "@google/genai";

// 1. Definição da Tool
const getBalanceTool: FunctionDeclaration = {
  name: 'getBalance',
  description: 'Retorna o saldo atual. Use APENAS se perguntarem de dinheiro/orçamento.',
  parameters: {
    type: Type.OBJECT,
    properties: {}, 
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

PERSONALIDADE (HUMANA E MINIMALISTA):
1. **Chat Real:** Escreva como se estivesse no WhatsApp. Frases curtas. Direta.
2. **Zero Emojis:** Evite emojis. Use no máximo UM se for extremamente necessário para não soar grossa. Mas o padrão é SEM emoji.
3. **Sem "Textão":** Nunca escreva parágrafos longos. Ninguém lê.
4. **Uma coisa de cada vez:**
   - Se pedirem hotel, dê **UMA** sugestão boa com o preço. Espere a pessoa responder. Não mande lista de 3 opções.
   - Seja preguiçosa (no bom sentido). Deixe o usuário puxar o assunto.

REGRAS DE RESPOSTA:
- **Saldo:** Se perguntarem quanto tem, responda: "Vi aqui, tem R$ 15.450 na conta." (Simples, sem formalidade).
- **Viagens:** Foque em Hotéis e Passagens (Cashback).
- **Restaurantes:** Evite. Só sugira se a pessoa pedir muito ("Onde eu como?").
- **Técnico:** NUNCA mencione "sistema", "buscando", "tool", "variável" ou "banco de dados". Apenas entregue a resposta.

Exemplo de interação ideal:
User: "Tem hotel bom em Paris?"
Cassia: "Tem o Ibis da Torre Eiffel, tá saindo R$ 600 a diária. Localização ótima. O que acha?"
User: "Tem outro?"
Cassia: "Tem o Mercure Montmartre, um pouco mais caro, uns R$ 850. Mas o quarto é maior."
`;
  }

  /**
   * Decide qual ferramenta ativar com base no texto do usuário.
   */
  private selectTools(userMessage: string): any[] {
    const financialKeywords = ['saldo', 'dinheiro', 'conta', 'gastar', 'orçamento', 'limite', 'tenho', 'pobre', 'rico'];
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

      // 3. Primeira chamada
      let response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
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
            // console.log(`Executing tool: ${call.name}`); // Comentado para limpar logs
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
            model: 'gemini-3-pro-preview',
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
      const text = response.text || "Hum, falhou aqui. Tenta de novo?";
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