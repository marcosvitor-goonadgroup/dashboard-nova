import { useMemo } from 'react';
import { ProcessedCampaignData } from '../types/campaign';
import { AudienceDefinition } from '../config/audiences';

interface AudiencePerformanceProps {
  data: ProcessedCampaignData[];
  audiences: AudienceDefinition[];
  // Conjuntos que entregam para todos os públicos: divididos igualmente entre eles.
  sharedMatches?: string[];
}

interface Totals {
  investimento: number;
  impressoes: number;
  cliques: number;
}

interface AudienceRow {
  label: string;
  detail?: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n));
const fmtPct = (n: number) => `${n.toFixed(2).replace('.', ',')}%`;

const sumItems = (items: ProcessedCampaignData[]): Totals => ({
  investimento: items.reduce((s, i) => s + (i.realInvestment || i.cost), 0),
  impressoes: items.reduce((s, i) => s + i.impressions, 0),
  cliques: items.reduce((s, i) => s + i.clicks, 0),
});

const buildRow = (label: string, t: Totals, detail?: string): AudienceRow => ({
  label,
  detail,
  ...t,
  ctr: t.impressoes > 0 ? (t.cliques / t.impressoes) * 100 : 0,
  cpc: t.cliques > 0 ? t.investimento / t.cliques : 0,
  cpm: t.impressoes > 0 ? (t.investimento / t.impressoes) * 1000 : 0,
});

const hasAny = (adGroup: string, needles: string[]) =>
  needles.some(m => adGroup.includes(m.toLowerCase()));

const AudiencePerformance = ({ data, audiences, sharedMatches = [] }: AudiencePerformanceProps) => {
  const { rows, others, total, shared } = useMemo(() => {
    const buckets = audiences.map(() => [] as ProcessedCampaignData[]);
    const sharedItems: ProcessedCampaignData[] = [];
    const unmatched: ProcessedCampaignData[] = [];

    data.forEach(item => {
      const adGroup = (item.adSetName || '').toLowerCase();
      const idx = audiences.findIndex(a => hasAny(adGroup, a.matches));
      if (idx >= 0) buckets[idx].push(item);
      else if (hasAny(adGroup, sharedMatches)) sharedItems.push(item);
      else unmatched.push(item);
    });

    // Parte igual do conjunto compartilhado que cabe a cada público
    const sharedTotals = sumItems(sharedItems);
    const n = audiences.length || 1;
    const sharedPart: Totals = {
      investimento: sharedTotals.investimento / n,
      impressoes: sharedTotals.impressoes / n,
      cliques: sharedTotals.cliques / n,
    };
    const hasShared = sharedItems.length > 0;

    const unmatchedGroups = Array.from(new Set(unmatched.map(i => i.adSetName).filter(Boolean)));

    return {
      rows: audiences.map((a, i) => {
        const own = sumItems(buckets[i]);
        return buildRow(
          a.label,
          {
            investimento: own.investimento + (hasShared ? sharedPart.investimento : 0),
            impressoes: own.impressoes + (hasShared ? sharedPart.impressoes : 0),
            cliques: own.cliques + (hasShared ? sharedPart.cliques : 0),
          },
          hasShared ? `Inclui ${fmtCurrency(sharedPart.investimento)} do conjunto compartilhado` : undefined
        );
      }),
      others: unmatched.length > 0
        ? buildRow('Outros conjuntos', sumItems(unmatched), unmatchedGroups.join(', '))
        : null,
      total: buildRow('Total', sumItems(data)),
      shared: hasShared
        ? {
            groups: Array.from(new Set(sharedItems.map(i => i.adSetName).filter(Boolean))),
            investimento: sharedTotals.investimento,
          }
        : null,
    };
  }, [data, audiences, sharedMatches]);

  const audienceInvest = rows.reduce((s, r) => s + r.investimento, 0);
  if (audienceInvest === 0 && rows.every(r => r.impressoes === 0)) return null;

  // Destaques entre os públicos (ignora "Outros")
  const withClicks = rows.filter(r => r.cliques > 0);
  const bestCtr = withClicks.length ? Math.max(...withClicks.map(r => r.ctr)) : null;
  const maxInvest = Math.max(...rows.map(r => r.investimento), 1);

  const renderRow = (r: AudienceRow, muted = false) => {
    const share = total.investimento > 0 ? (r.investimento / total.investimento) * 100 : 0;
    return (
      <tr key={r.label} className={muted ? 'bg-gray-50/60' : 'hover:bg-blue-50 transition-colors'}>
        <td className="py-3 px-3 align-top">
          <div className={`font-medium ${muted ? 'text-gray-500' : 'text-gray-900'}`}>{r.label}</div>
          {r.detail && (
            <div className="text-xs text-gray-400 mt-0.5 break-all">{r.detail}</div>
          )}
          {!muted && (
            <div className="mt-2 h-1.5 w-full max-w-[220px] rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#153ece]"
                style={{ width: `${(r.investimento / maxInvest) * 100}%` }}
              />
            </div>
          )}
        </td>
        <td className="py-3 px-3 text-right align-top whitespace-nowrap">
          <div className={muted ? 'text-gray-500' : 'text-gray-900'}>{fmtCurrency(r.investimento)}</div>
          <div className="text-xs text-gray-400">{share.toFixed(1).replace('.', ',')}% do total</div>
        </td>
        <td className="py-3 px-3 text-right align-top text-gray-700 whitespace-nowrap">{fmtNum(r.impressoes)}</td>
        <td className="py-3 px-3 text-right align-top text-gray-700 whitespace-nowrap">{fmtNum(r.cliques)}</td>
        <td className="py-3 px-3 text-right align-top whitespace-nowrap">
          <span className={!muted && r.ctr === bestCtr ? 'font-semibold text-green-600' : 'text-gray-700'}>
            {fmtPct(r.ctr)}
          </span>
        </td>
        <td className="py-3 px-3 text-right align-top whitespace-nowrap">
          <span className="text-gray-700">{r.cliques > 0 ? fmtCurrency(r.cpc) : '—'}</span>
        </td>
        <td className="py-3 px-3 text-right align-top text-gray-700 whitespace-nowrap">
          {r.impressoes > 0 ? fmtCurrency(r.cpm) : '—'}
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Desempenho por Público</h2>
        <p className="text-sm text-gray-600">
          Resultados por público atingido, identificado pelo conjunto de anúncios (Ad Group Name).
          Em verde, o público com melhor CTR.
        </p>
        {shared && (
          <p className="text-xs text-gray-500 mt-2">
            O conjunto <span className="font-medium break-all">{shared.groups.join(', ')}</span> entrega
            para todos os públicos: seus resultados ({fmtCurrency(shared.investimento)}) foram divididos
            igualmente entre os {audiences.length} públicos.
          </p>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 font-semibold text-gray-700">Público</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">Investimento</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">Impressões</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">Cliques</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">CTR</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">CPC</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-700">CPM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map(r => renderRow(r))}
            {others && renderRow(others, true)}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-900">
              <td className="py-2 px-3">Total</td>
              <td className="py-2 px-3 text-right whitespace-nowrap">{fmtCurrency(total.investimento)}</td>
              <td className="py-2 px-3 text-right whitespace-nowrap">{fmtNum(total.impressoes)}</td>
              <td className="py-2 px-3 text-right whitespace-nowrap">{fmtNum(total.cliques)}</td>
              <td className="py-2 px-3 text-right whitespace-nowrap">{fmtPct(total.ctr)}</td>
              <td className="py-2 px-3 text-right whitespace-nowrap">{total.cliques > 0 ? fmtCurrency(total.cpc) : '—'}</td>
              <td className="py-2 px-3 text-right whitespace-nowrap">{total.impressoes > 0 ? fmtCurrency(total.cpm) : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default AudiencePerformance;
