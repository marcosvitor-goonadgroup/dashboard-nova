// Públicos por rota de PI. O público é identificado pelo trecho do
// "Ad Group Name" que o descreve (comparação sem diferenciar maiúsculas).
// Só as rotas listadas aqui exibem o card "Desempenho por Público".

export interface AudienceDefinition {
  label: string;
  // Trechos do Ad Group Name que identificam o público (qualquer um casa).
  matches: string[];
}

export interface AudienceSetup {
  audiences: AudienceDefinition[];
  // Trechos do Ad Group Name de conjuntos que entregam para TODOS os públicos.
  // Seus resultados são divididos igualmente entre os públicos.
  sharedMatches?: string[];
}

interface AudienceRouteConfig extends AudienceSetup {
  clientSlug: string;
  campaignSlug: string;
  piSlug: string;
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
    // O conjunto 1st-party entrega para todos os públicos acima.
    sharedMatches: ['_1st-party_'],
  },
];

export const getAudiencesForRoute = (
  clientSlug: string,
  campaignSlug: string,
  piSlug: string
): AudienceSetup | null => {
  const route = AUDIENCE_ROUTES.find(
    r => r.clientSlug === clientSlug && r.campaignSlug === campaignSlug && r.piSlug === piSlug
  );
  return route ? { audiences: route.audiences, sharedMatches: route.sharedMatches } : null;
};
