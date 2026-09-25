// Componentes de interface reutilizáveis.

export function TypeBadge({ type, label }) {
  const text = label ?? { SP: 'Prioritária', SE: 'Exames', SG: 'Geral' }[type] ?? type;
  return (
    <span className={`type-badge type-${type}`}>
      <span aria-hidden="true">{type}</span>
      <span className="sr-only">Senha</span> {text}
    </span>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/** RNF-13: aviso claro de indisponibilidade, com reconexão automática. */
export function ConnectionBanner({ offline, message }) {
  if (!offline) return null;
  return (
    <div className="connection-banner" role="alert">
      <span className="pulse" aria-hidden="true" />
      {message ?? 'Sistema temporariamente indisponível. Reconectando automaticamente…'}
    </div>
  );
}

export function Field({ id, label, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function StatCard({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/**
 * Tabela genérica. `columns`: [{ key, label, num?, render?(row) }].
 * O mesmo array de colunas alimenta a exportação, garantindo arquivo igual à tela (RF-32).
 */
export function DataTable({ caption, columns, rows, footer, emptyText = 'Nenhum registro no período.' }) {
  return (
    <div className="table-wrap">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.num ? 'num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id ?? row.key ?? index}>
                {columns.map((c) => (
                  <td key={c.key} className={[c.num && 'num', c.mono && 'mono'].filter(Boolean).join(' ') || undefined}>
                    {c.render ? c.render(row) : cellText(c, row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && rows.length > 0 && (
          <tfoot>
            <tr>
              {columns.map((c) => (
                <td key={c.key} className={c.num ? 'num' : undefined}>
                  {footer[c.key] ?? ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Texto da célula (usado na tela e na exportação). */
export function cellText(column, row) {
  const value = column.text ? column.text(row) : row[column.key];
  return value === null || value === undefined ? '' : String(value);
}

export function Bars({ items, labelKey, valueKey, format = (v) => v }) {
  const max = Math.max(1, ...items.map((i) => i[valueKey] ?? 0));
  if (!items.length) return <p className="empty">Sem dados no período.</p>;
  return (
    <div className="bars">
      {items.map((item) => (
        <div className="bar-row" key={item[labelKey]}>
          <span>{item[labelKey]}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ display: 'block', width: `${((item[valueKey] ?? 0) / max) * 100}%` }} />
          </span>
          <span className="num">{format(item[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}
