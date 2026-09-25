// RF-32: exportação em planilha (CSV) e PDF (impressão do navegador).
// Ambos usam exatamente as colunas e valores exibidos na tela.

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * @param {string} filename
 * @param {{title: string, subtitle?: string, columns: {label: string}[], rows: string[][]}[]} sections
 */
export function downloadCsv(filename, sections) {
  const lines = [];
  for (const section of sections) {
    if (lines.length) lines.push('');
    lines.push(csvCell(section.title));
    if (section.subtitle) lines.push(csvCell(section.subtitle));
    lines.push(section.columns.map((c) => csvCell(c.label)).join(';'));
    for (const row of section.rows) lines.push(row.map(csvCell).join(';'));
  }
  // BOM + ";" para o Excel em português abrir com acentos e colunas corretas.
  const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre a caixa de impressão; escolha "Salvar como PDF". O CSS de impressão mostra só o relatório. */
export function printPdf(title) {
  const previous = document.title;
  document.title = title;
  window.print();
  document.title = previous;
}
