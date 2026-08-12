import axios from 'axios';
import { ApiResponse, ProcessedCampaignData, PIInfo } from '../types/campaign';
import { parse, startOfDay } from 'date-fns';

const CAMPAIGN_API_URLS = [
  'https://nmbcoamazonia-api.vercel.app/google/sheets/1kNz-74ISYZgVQhDPYABD8ifxHgUN_xt_6KqVoVlZTtA/data?range=Consolidado',
  'https://nmbcoamazonia-api.vercel.app/google/sheets/1oGRov7eFfbAc_iZu0Mv3rjQYWChL_mb46Oy1-9O0TjA/data?range=Consolidado',
  'https://nmbcoamazonia-api.vercel.app/google/sheets/12o_G1NmjZpIhff-ml68hfWWS5Oa_C18YlIa_3WyAi-c/data?range=Consolidado',
  'https://nmbcoamazonia-api.vercel.app/google/sheets/1S0yKsoLvblMRrzRfOxOrpROJ6nNAkrnTnQGTwelFwdY/data?range=Consolidado'
];

// Google Search vem de uma planilha própria, com granularidade por palavra-chave
// (uma linha por termo de busca) e cabeçalho diferente do Consolidado.
const GOOGLE_SEARCH_API_URL =
  'https://nmbcoamazonia-api.vercel.app/google/sheets/1S0yKsoLvblMRrzRfOxOrpROJ6nNAkrnTnQGTwelFwdY/data?range=Google%20Search';

const parseNumber = (value: string): number => {
  if (!value || value === '') return 0;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const parseCurrency = (value: string): number => {
  if (!value || value === '') return 0;
  // Remove "R$" e espaços, depois processa como número
  const cleaned = value.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};


const parseSearchDate = (dateString: string): Date => {
  try {
    if (!dateString) return startOfDay(new Date());
    if (dateString.includes('/')) {
      return startOfDay(parse(dateString, 'dd/MM/yyyy', new Date()));
    }
    return startOfDay(parse(dateString, 'yyyy-MM-dd', new Date()));
  } catch {
    return startOfDay(new Date());
  }
};

const normalizeVeiculo = (veiculo: string): string => {
  const normalized = veiculo.trim();
  const lower = normalized.toLowerCase();
  if (lower === 'audience network' || lower === 'messenger' || lower === 'threads' || lower === 'unknown') {
    return 'Facebook';
  }
  return normalized;
};

// Mapeia índices das colunas a partir do header. Algumas planilhas têm uma coluna
// extra "Localização" antes de "Cliente", então não podemos confiar em posições fixas.
const COLUMN_KEYS = [
  'data', 'campaignName', 'adGroupName', 'adName', 'impressions', 'reach', 'clicks',
  'videoViews', 'videoViews25', 'videoViews50', 'videoViews75', 'videoCompletions',
  'totalEngagements', 'agencia', 'veiculo', 'numeroPi', 'tipoDeCompra',
  'investimento', 'formato', 'image', 'campanha', 'cliente'
] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  data: ['data', 'date'],
  campaignName: ['campaign name'],
  adGroupName: ['ad group name', 'ad set name'],
  adName: ['ad name'],
  impressions: ['impressions'],
  reach: ['reach'],
  clicks: ['clicks'],
  videoViews: ['video view', 'video views'],
  videoViews25: ['views 25%', 'video views 25%'],
  videoViews50: ['views 50%', 'video views 50%'],
  videoViews75: ['views 75%', 'video views 75%'],
  videoCompletions: ['views 100%', 'video completions'],
  totalEngagements: ['va', 'engajamento', 'total engagements'],
  agencia: ['agência', 'agencia'],
  veiculo: ['veículo', 'veiculo'],
  numeroPi: ['número pi', 'numero pi', 'número pi'],
  tipoDeCompra: ['tipo de compra'],
  investimento: ['investimento', 'cost'],
  formato: ['formato', 'video_estatico_audio'],
  image: ['image'],
  campanha: ['campanha'],
  cliente: ['cliente']
};

const buildColumnIndex = (header: string[]): Record<ColumnKey, number> => {
  const normalized = header.map(h => (h || '').trim().toLowerCase());
  const index = {} as Record<ColumnKey, number>;
  for (const key of COLUMN_KEYS) {
    const aliases = HEADER_ALIASES[key];
    index[key] = normalized.findIndex(h => aliases.includes(h));
  }
  return index;
};

// Mapeia a planilha do Google Search (linha por palavra-chave) para o mesmo
// formato ProcessedCampaignData usado no restante do dashboard, preservando o
// termo de busca em `searchTerm`. Assim a entrega já entra somada nos totais,
// no card do PI e em Performance por Veículo, sem tratamento especial.
const mapGoogleSearchData = (values: string[][]): ProcessedCampaignData[] => {
  if (!values || values.length <= 1) return [];

  const [header, ...rows] = values;
  const h = header.map(c => (c || '').trim().toLowerCase());
  const col = (...names: string[]): number => {
    for (const name of names) {
      const i = h.indexOf(name);
      if (i >= 0) return i;
    }
    return -1;
  };

  const idx = {
    day: col('day', 'data', 'date'),
    campaignName: col('campaign name'),
    adGroupName: col('ad group name'),
    keyword: col('search keyword', 'search term'),
    impressions: col('impressions'),
    clicks: col('clicks'),
    engagements: col('engagements', 'total engagements'),
    investimento: col('investimento', 'cost (spend)', 'cost'),
    agencia: col('agência', 'agencia'),
    veiculo: col('veículo', 'veiculo'),
    numeroPi: col('número pi', 'numero pi'),
    tipoDeCompra: col('tipo de compra'),
    campanha: col('campanha'),
    cliente: col('cliente'),
  };

  const get = (row: string[], i: number): string => (i >= 0 ? (row[i] || '') : '');

  const out: ProcessedCampaignData[] = [];
  rows.forEach(row => {
    if (row.length === 0) return;
    const campanha = get(row, idx.campanha);
    if (!campanha || campanha.trim() === '') return;

    out.push({
      date: parseSearchDate(get(row, idx.day)),
      campaignName: get(row, idx.campaignName),
      adSetName: get(row, idx.adGroupName),
      adName: '',
      cost: parseCurrency(get(row, idx.investimento)),
      impressions: parseNumber(get(row, idx.impressions)),
      reach: 0,
      clicks: parseNumber(get(row, idx.clicks)),
      videoViews: 0,
      videoViews25: 0,
      videoViews50: 0,
      videoViews75: 0,
      videoCompletions: 0,
      totalEngagements: parseNumber(get(row, idx.engagements)),
      veiculo: normalizeVeiculo(get(row, idx.veiculo)),
      tipoDeCompra: get(row, idx.tipoDeCompra),
      videoEstaticoAudio: '',
      image: '',
      campanha,
      numeroPi: get(row, idx.numeroPi),
      cliente: get(row, idx.cliente),
      agencia: get(row, idx.agencia),
      searchTerm: get(row, idx.keyword),
    });
  });

  return out;
};

const fetchGoogleSearchData = async (): Promise<ProcessedCampaignData[]> => {
  try {
    const res = await axios.get<ApiResponse>(GOOGLE_SEARCH_API_URL);
    if (!res.data.success) return [];
    return mapGoogleSearchData(res.data.data.values);
  } catch (error) {
    // Falha no Google Search não deve derrubar o carregamento do restante.
    console.error('Erro ao buscar dados do Google Search:', error);
    return [];
  }
};

export const fetchCampaignData = async (): Promise<ProcessedCampaignData[]> => {
  try {
    const [responses, googleSearchData] = await Promise.all([
      Promise.all(CAMPAIGN_API_URLS.map(url => axios.get<ApiResponse>(url))),
      fetchGoogleSearchData(),
    ]);

    const allData: ProcessedCampaignData[] = [];

    responses.forEach(response => {
      if (!response.data.success || response.data.data.values.length <= 1) return;

      const [header, ...rows] = response.data.data.values;
      const col = buildColumnIndex(header);
      const get = (row: string[], key: ColumnKey): string =>
        col[key] >= 0 ? (row[col[key]] || '') : '';

      rows.forEach(row => {
        if (row.length < 14) return;

        const numeroPi = get(row, 'numeroPi');
        if (numeroPi === '#VALUE!') return;

        const dataRow: ProcessedCampaignData = {
          date: parseSearchDate(get(row, 'data')),
          campaignName: get(row, 'campaignName'),
          adSetName: get(row, 'adGroupName'),
          adName: get(row, 'adName'),
          cost: parseCurrency(get(row, 'investimento')),
          impressions: parseNumber(get(row, 'impressions')),
          reach: parseNumber(get(row, 'reach')),
          clicks: parseNumber(get(row, 'clicks')),
          videoViews: parseNumber(get(row, 'videoViews')),
          videoViews25: parseNumber(get(row, 'videoViews25')),
          videoViews50: parseNumber(get(row, 'videoViews50')),
          videoViews75: parseNumber(get(row, 'videoViews75')),
          videoCompletions: parseNumber(get(row, 'videoCompletions')),
          totalEngagements: parseNumber(get(row, 'totalEngagements')),
          veiculo: normalizeVeiculo(get(row, 'veiculo')),
          tipoDeCompra: get(row, 'tipoDeCompra'),
          videoEstaticoAudio: get(row, 'formato'),
          image: get(row, 'image'),
          campanha: get(row, 'campanha'),
          numeroPi: numeroPi,
          cliente: get(row, 'cliente'),
          agencia: get(row, 'agencia')
        };
        allData.push(dataRow);
      });
    });

    allData.push(...googleSearchData);

    return allData;
  } catch (error) {
    console.error('Erro ao buscar dados das campanhas:', error);
    throw error;
  }
};

const PI_INFO_BASE_URL = 'https://nmbcoamazonia-api.vercel.app/google/sheets/1T35Pzw9ZA5NOTLHsTqMGZL5IEedpSGdZHJ2ElrqLs1M/data';
const PI_INFO_API_URL = `${PI_INFO_BASE_URL}?range=base`;
const PI_INFO_REPRESENTACAO_URL = `${PI_INFO_BASE_URL}?range=representacao`;

// [0] Agência, [1] Cliente, [2] Número PI, [3] Veículo, [4] Canal, [5] Formato,
// [6] Modelo Compra, [7] Valor Uni, [8] Desconto, [9] Valor Negociado, [10] Qtd,
// [11] TT Bruto, [12] Reaplicação, [13] Status, [14] Segmentação, [15] Alcance,
// [16] Inicio, [17] Fim, [18] Público, [19] Praça, [20] Objetivo
const mapBaseRow = (row: string[]): PIInfo => ({
  numeroPi: row[2] || '',
  veiculo: row[3] || '',
  canal: row[4] || '',
  formato: row[5] || '',
  modeloCompra: row[6] || '',
  valorNegociado: row[9] || '',
  quantidade: row[10] || '',
  totalBruto: row[11] || '',
  status: row[13] || '',
  segmentacao: row[14] || '',
  alcance: row[15] || '',
  inicio: row[16] || '',
  fim: row[17] || '',
  publico: row[18] || '',
  praca: row[19] || '',
  objetivo: row[20] || ''
});

const mapRepresentacaoRow = (row: string[]): PIInfo => ({
  numeroPi: row[2] || '',
  veiculo: row[3] || '',
  canal: '',
  formato: row[4] || '',
  modeloCompra: row[5] || '',
  valorNegociado: row[12] || '',
  quantidade: row[10] || '',
  totalBruto: row[14] || '',
  status: '',
  segmentacao: row[6] || '',
  alcance: row[7] || '',
  inicio: row[8] || '',
  fim: row[9] || '',
  publico: '',
  praca: row[15] || '',
  objetivo: row[16] || ''
});

export const fetchPIInfo = async (numeroPi: string): Promise<PIInfo[] | null> => {
  try {
    const normalizedPi = numeroPi.replace(/^0+/, '').replace(/\./g, '').replace(',', '.');

    const [baseRes, reprRes] = await Promise.allSettled([
      axios.get(PI_INFO_API_URL),
      axios.get(PI_INFO_REPRESENTACAO_URL)
    ]);

    const piInfo: PIInfo[] = [];

    if (baseRes.status === 'fulfilled' && baseRes.value.data.success && baseRes.value.data.data.values) {
      const rows: string[][] = baseRes.value.data.data.values.slice(1);
      rows
        .filter(row => (row[2] || '').replace(/^0+/, '').replace(/\./g, '').replace(',', '.') === normalizedPi)
        .forEach(row => piInfo.push(mapBaseRow(row)));
    }

    if (reprRes.status === 'fulfilled' && reprRes.value.data.success && reprRes.value.data.data.values) {
      const rows: string[][] = reprRes.value.data.data.values.slice(1);
      rows
        .filter(row => (row[2] || '').replace(/^0+/, '').replace(/\./g, '').replace(',', '.') === normalizedPi)
        .forEach(row => piInfo.push(mapRepresentacaoRow(row)));
    }

    return piInfo.length > 0 ? piInfo : null;
  } catch (error) {
    console.error('Erro ao buscar informações do PI:', error);
    return null;
  }
};

