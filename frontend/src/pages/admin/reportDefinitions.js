import { formatDateTime, formatDuration } from '../../services/format.js';

// Cada relatório vira uma lista de seções { title, columns, rows, footer }.
// A tela e a exportação usam exatamente estas seções (RF-32: arquivo idêntico à tela).

const n = (value) => String(value ?? 0);

export const REPORTS = [
  { name: 'summary', label: 'Quantitativo' },
  { name: 'detailed', label: 'Detalhado' },
  { name: 'average-time', label: 'Tempo médio (TM)' },
  { name: 'audit', label: 'Auditoria de atendimentos', filters: true },
  { name: 'system-log', label: 'Log do sistema', filters: true },
];

function summarySections(data) {
  const columns = [
    { key: 'tipo', label: 'Prioridade', text: (r) => `${r.tipo} — ${r.tipoDescricao}` },
    { key: 'emitidas', label: 'Emitidas', num: true, text: (r) => n(r.emitidas) },
    { key: 'atendidas', label: 'Atendidas', num: true, text: (r) => n(r.atendidas) },
    { key: 'naoCompareceu', label: 'Não compareceu', num: true, text: (r) => n(r.naoCompareceu) },
    { key: 'descartadas', label: 'Descartadas (fim do expediente)', num: true, text: (r) => n(r.descartadas) },
    { key: 'emAberto', label: 'Em aberto', num: true, text: (r) => n(r.emAberto) },
  ];
  const t = data.total;
  return [
    {
      title: 'Senhas emitidas e atendidas por prioridade',
      columns,
      rows: data.byType,
      footer: {
        tipo: 'Total geral',
        emitidas: n(t.emitidas),
        atendidas: n(t.atendidas),
        naoCompareceu: n(t.naoCompareceu),
        descartadas: n(t.descartadas),
        emAberto: n(t.emAberto),
      },
    },
  ];
}

function detailedSections(data) {
  return [
    {
      title: 'Relatório detalhado das senhas',
      columns: [
        { key: 'numero', label: 'Senha', mono: true, text: (r) => r.numero },
        { key: 'tipo', label: 'Tipo', text: (r) => `${r.tipo} — ${r.tipoDescricao}` },
        { key: 'emissao', label: 'Emissão', text: (r) => formatDateTime(r.emissao) },
        { key: 'atendimento', label: 'Atendimento', text: (r) => formatDateTime(r.atendimento) },
        { key: 'guiche', label: 'Guichê', text: (r) => r.guiche ?? '' },
        { key: 'situacao', label: 'Situação', text: (r) => r.situacao },
        { key: 'origem', label: 'Origem', text: (r) => (r.origem === 'CONTINGENCIA' ? 'Contingência' : 'Totem') },
      ],
      rows: data.rows,
    },
  ];
}

function averageSections(data) {
  return [
    {
      title: 'Tempo médio de atendimento (TM) por tipo de senha',
      columns: [
        { key: 'tipo', label: 'Prioridade', text: (r) => `${r.tipo} — ${r.tipoDescricao}` },
        { key: 'atendimentos', label: 'Atendimentos', num: true, text: (r) => n(r.atendimentos) },
        { key: 'tm', label: 'TM', num: true, text: (r) => formatDuration(r.tmSegundos) },
        { key: 'min', label: 'Menor', num: true, text: (r) => formatDuration(r.minSegundos) },
        { key: 'max', label: 'Maior', num: true, text: (r) => formatDuration(r.maxSegundos) },
      ],
      rows: data.rows,
      footer: { tipo: 'Geral', atendimentos: n(data.total.atendimentos), tm: formatDuration(data.total.tmSegundos) },
    },
  ];
}

function auditSections(data) {
  return [
    {
      title: 'Auditoria de atendimentos',
      columns: [
        { key: 'atendente', label: 'Atendente', text: (r) => r.atendente },
        { key: 'guiche', label: 'Guichê', text: (r) => r.guiche },
        { key: 'senha', label: 'Senha', mono: true, text: (r) => r.senha },
        { key: 'situacao', label: 'Situação', text: (r) => r.situacao },
        { key: 'primeira', label: '1ª chamada', text: (r) => formatDateTime(r.primeiraChamada) },
        { key: 'segunda', label: '2ª chamada', text: (r) => formatDateTime(r.segundaChamada) },
        { key: 'inicio', label: 'Início', text: (r) => formatDateTime(r.inicio) },
        { key: 'fim', label: 'Fim', text: (r) => formatDateTime(r.fim) },
      ],
      rows: data.rows,
    },
  ];
}

function systemLogSections(data) {
  return [
    {
      title: 'Log do sistema (logins, cadastros, relatórios)',
      columns: [
        { key: 'dataHora', label: 'Data e hora', text: (r) => formatDateTime(r.dataHora) },
        { key: 'acao', label: 'Ação', text: (r) => r.acao },
        { key: 'usuario', label: 'Usuário', text: (r) => r.usuario ?? 'Sistema' },
        { key: 'guiche', label: 'Guichê', text: (r) => r.guiche ?? '' },
        { key: 'registro', label: 'Registro', text: (r) => r.registro ?? '' },
        { key: 'detalhes', label: 'Detalhes', text: (r) => r.detalhes ?? '' },
      ],
      rows: data.rows,
    },
  ];
}

const BUILDERS = {
  summary: summarySections,
  detailed: detailedSections,
  'average-time': averageSections,
  audit: auditSections,
  'system-log': systemLogSections,
};

export function buildSections(name, data) {
  return data ? BUILDERS[name](data) : [];
}

/** Linhas de texto (as mesmas exibidas) para o CSV. */
export function sectionToCsv(section, subtitle) {
  const rows = section.rows.map((row) => section.columns.map((c) => c.text(row)));
  if (section.footer) rows.push(section.columns.map((c) => section.footer[c.key] ?? ''));
  return { title: section.title, subtitle, columns: section.columns, rows };
}
