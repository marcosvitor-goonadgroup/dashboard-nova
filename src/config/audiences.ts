// Públicos por rota de PI. O público é identificado pelo trecho do
// "Ad Group Name" que o descreve (comparação sem diferenciar maiúsculas).
// Só as rotas listadas aqui exibem o card "Desempenho por Público".

export interface AudienceDefinition {
  label: string;
  // Trechos do Ad Group Name que identificam o público (qualquer um casa).
  matches: string[];
}

interface AudienceRouteConfig {
  clientSlug: string;
  campaignSlug: string;
  piSlug: string;
  audiences: AudienceDefinition[];
}

const AUDIENCE_ROUTES: AudienceRouteConfig[] = [
  {
    // /sebrae/datasebrae/333436 — Taboola, conjuntos
    // leilao_cpc_display_desk-mob_all_all_18-mais_br_<publico>_na
    clientSlug: 'sebrae',
    campaignSlug: 'datasebrae',
    piSlug: '333436',
    audiences: [
      {
        label: 'Pesquisadores/Estudantes',
        matches: ['_pesquisadores-estudantes_'],
      },
      {
        label: 'Gestores Públicos / Agentes de Desenvolvimento / Formadores de Opinião',
        matches: ['_gestores-agentes-formadores_'],
      },
      {
        label: 'Jornalistas / Consultores e Agências de Fomento',
        matches: ['_jornalistas-consultores-agencias_'],
      },
      {
        label: 'Interessados em notícias, finanças e economia',
        // A planilha grafa "fnancas"; aceita também a grafia correta.
        matches: ['_noticias-fnancas-economia_', '_noticias-financas-economia_'],
      },
    ],
  },
];

export const getAudiencesForRoute = (
  clientSlug: string,
  campaignSlug: string,
  piSlug: string
): AudienceDefinition[] | null =>
  AUDIENCE_ROUTES.find(
    r => r.clientSlug === clientSlug && r.campaignSlug === campaignSlug && r.piSlug === piSlug
  )?.audiences ?? null;
