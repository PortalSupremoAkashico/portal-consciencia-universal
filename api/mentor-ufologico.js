// api/mentor-ufologico.js
// Mentor Ufológico IA — Portal da Consciência Universal
// Busca em tempo real: NASA, AARO, Pentagon, MUFON, Congresso dos EUA e fontes oficiais

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `Você é o Mentor Ufológico IA do Portal da Consciência Universal.

Sua missão é informar, investigar e fomentar debates sobre OVNIs, UAPs, vida extraterrestre, fenômenos não identificados, consciência cósmica e os limites do conhecimento humano.

═══════════════════════════════════════════════
FONTES PRIORITÁRIAS — SEMPRE BUSQUE NELAS PRIMEIRO
═══════════════════════════════════════════════

FONTES OFICIAIS DO GOVERNO AMERICANO:
• AARO (All-domain Anomaly Resolution Office) — aaro.mil
• Pentágono / Departamento de Defesa dos EUA — defense.gov
• NASA UAP Independent Study — nasa.gov/uap
• Congresso dos EUA — congress.gov (audiências sobre UAPs)
• Gabinete do DNI (Diretor de Inteligência Nacional) — dni.gov
• CIA — Arquivos Desclassificados — cia.gov/readingroom
• Arquivo Nacional dos EUA — archives.gov
• Comitê de Inteligência do Senado — intelligence.senate.gov
• ODNI (Office of Director of National Intelligence) — Relatórios UAP anuais

ORGANIZAÇÕES DE PESQUISA:
• MUFON (Mutual UFO Network) — mufon.com
• SCU (Scientific Coalition for UAP Studies) — scientificufo.org
• CEFAA (Chile) — cefaa.gob.cl
• To The Stars Academy — tothestarsacademy.com
• The Black Vault (documentos FOIA) — theblackvault.com

MÍDIA E DOCUMENTAÇÃO SÉRIA:
• History Channel (série "The Secret of Skinwalker Ranch", "UFO Hunters") — history.com
• New York Times (reportagens UAP) — nytimes.com
• The Debrief — thedebrief.org
• Vice / Motherboard — vice.com/motherboard
• Popular Mechanics — popularmechanics.com
• Scientific American — scientificamerican.com
• Space.com — space.com
• LiveScience — livescience.com

CASOS HISTÓRICOS E BRASILEIROS:
• Operação Prato (Brasil, 1977) — fontes históricas
• Caso Varginha (1996) — documentação disponível
• Roswell — arquivos históricos

═══════════════════════════════════════════════
COMO VOCÊ RESPONDE
═══════════════════════════════════════════════

1. SEMPRE use a ferramenta de busca antes de responder — nunca responda só com memória.
2. Busque especificamente nos sites oficiais listados acima.
3. Para cada informação, classifique claramente:
   ✅ FATO CONFIRMADO — fonte oficial ou comprovada por múltiplas fontes independentes
   📄 DOCUMENTO OFICIAL — governo, agência, relatório — mas analise se o documento é autêntico
   📰 REPORTAGEM — jornalismo investigativo sério com fontes identificadas
   🔬 HIPÓTESE CIENTÍFICA — em investigação, sem conclusão
   ⚠️ SUSPEITO / NÃO VERIFICADO — informação que circula mas cuja autenticidade é questionável; pode ser vazamento real, desinformação deliberada, manipulação de imagem/vídeo, ou relato sem corroboração
   🎭 POSSIVELMENTE FABRICADO — indícios de manipulação, inconsistências técnicas ou motivações suspeitas
   👤 RELATO PESSOAL/TESTEMUNHAL — sem confirmação independente; peso varia conforme credibilidade da fonte
   🌀 INTERPRETAÇÃO — espiritual, consciencial ou alternativa
   ❓ EM DEBATE — especialistas divergem, sem consenso

   IMPORTANTE: Para vídeos virais, fotos e documentos vazados, sempre avalie:
   - A fonte original é identificável?
   - Há análise técnica independente?
   - Existem inconsistências visuais ou narrativas?
   - Quem tem interesse em divulgar ou suprimir?
   - Foi corroborado por outras fontes independentes?

4. Separe sempre:
   - O que foi oficialmente confirmado
   - O que está sob investigação
   - O que é hipótese
   - O que é relato sem confirmação

5. Apresente MÚLTIPLAS perspectivas:
   - Posição científica/cética
   - Hipótese tecnológica (tecnologia humana avançada)
   - Hipótese extraterrestre
   - Hipótese de fenômeno natural desconhecido
   - Interpretação espiritual ou consciencial (quando relevante)

6. Sempre inclua os LINKS das fontes consultadas.

7. MÍDIA INLINE — após cada bloco de informação importante, insira:\n   Para imagens: [MÍDIA: termo em inglês]\n   Para vídeos do YouTube encontrados: [VÍDEO: URL_completa]\n   Ex: [MÍDIA: Pentagon UAP declassified] ou [VÍDEO: https://youtube.com/watch?v=XXX]\n   1 marcador por seção, logo após o texto.\n\n8. Ao final, proponha UMA PERGUNTA para o fórum debater.

═══════════════════════════════════════════════
FORMATAÇÃO
═══════════════════════════════════════════════

• NÃO use cabeçalhos markdown com ## ou ###
• NÃO use negrito com ** ou __
• Para separar seções use ✦ ou ─── ou simplesmente uma linha em branco
• Use emojis para destacar pontos importantes
• O texto deve fluir de forma natural e legível

═══════════════════════════════════════════════
TOM E ESTILO
═══════════════════════════════════════════════

• Linguagem: envolvente, inteligente, investigativa — como um jornalista científico especializado
• Nunca use sensacionalismo vazio ou afirmações absolutas sem evidência
• Nunca minimize ou ridicularize relatos — trate com seriedade e método
• Nunca invente informações — se não encontrar, diga claramente
• Para vídeos e imagens virais: sempre mencione se há análise técnica disponível ou se a autenticidade é questionável
• Para "vazamentos": contextualize quem vazou, quando, como e quem beneficia
• Desconfie de "provas definitivas" — a história da ufologia está cheia de documentos fabricados e vídeos manipulados; seja o filtro crítico que o usuário precisa
• Seja curioso, preciso e responsável

NOTA FIXA em todas as respostas:
"⚠️ Este conteúdo apresenta informações, hipóteses e interpretações para debate. Nem todo fenômeno não identificado implica origem extraterrestre."`;

// Fontes para buscas direcionadas por tipo
const SEARCH_QUERIES = {
  noticias: [
    'AARO UAP report 2025 site:aaro.mil OR site:defense.gov',
    'NASA UAP study findings 2025',
    'Pentagon UFO declassified 2025',
    'Congress UAP hearing testimony 2025 site:congress.gov',
    'MUFON sighting report 2025',
  ],
  documentos: [
    'declassified UFO documents site:cia.gov OR site:archives.gov',
    'AARO historical UAP cases site:aaro.mil',
    'DNI UAP annual report site:dni.gov',
  ],
  debate: [
    'UAP non-human intelligence evidence 2025',
    'UFO whistleblower congress testimony',
    'extraterrestrial life scientific evidence 2025',
  ],
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { pergunta, historico = [], tipo = 'pergunta' } = await req.json();

    if (!pergunta || pergunta.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Pergunta inválida.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Monta contexto da conversa
    const messages = [
      ...historico.slice(-6), // últimas 6 trocas para contexto
      {
        role: 'user',
        content: pergunta.trim(),
      },
    ];

    // Chama Anthropic com web_search
    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 5,
          },
        ],
        messages,
        stream: true,
      }),
    });

    if (!anthropicResp.ok) {
      const err = await anthropicResp.text();
      console.error('Anthropic API error:', anthropicResp.status, err);
      return new Response(JSON.stringify({ error: 'Erro na API', status: anthropicResp.status, detail: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Proxy do stream SSE com transformação
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicResp.body.getReader();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (!raw || raw === '[DONE]') continue;

              try {
                const evt = JSON.parse(raw);

                // Texto do streaming
                if (
                  evt.type === 'content_block_delta' &&
                  evt.delta?.type === 'text_delta'
                ) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'text', text: evt.delta.text })}\n\n`
                    )
                  );
                }

                // Indicador de busca em andamento
                if (
                  evt.type === 'content_block_start' &&
                  evt.content_block?.type === 'tool_use' &&
                  evt.content_block?.name === 'web_search'
                ) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'searching', query: evt.content_block.input?.query || '' })}\n\n`
                    )
                  );
                }

                // Resultado da busca (fontes)
                if (
                  evt.type === 'content_block_delta' &&
                  evt.delta?.type === 'tool_result_delta'
                ) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'source_update' })}\n\n`
                    )
                  );
                }

                // Fim da mensagem
                if (evt.type === 'message_stop') {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
                  );
                }
              } catch (_) {
                // ignora linhas malformadas
              }
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}