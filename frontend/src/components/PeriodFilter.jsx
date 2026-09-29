import { CalendarDays, CalendarRange } from 'lucide-react';
import { ptBR } from 'react-day-picker/locale';
import CalendarDialog from '@/components/ui/calendar-04';
import DayPickerDialog from '@/components/ui/day-picker-dialog';
import MonthPickerDialog from '@/components/ui/month-picker-dialog';
import { todayInLab } from '../services/format.js';

// Datas do filtro trafegam como texto AAAA-MM-DD; o calendário trabalha com Date local.
const pad = (n) => String(n).padStart(2, '0');
const toIso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromIso = (text) => {
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const lastDayOf = (year, month) => new Date(year, month, 0).getDate();
const brDate = (iso) => iso.split('-').reverse().join('/');

function dayLabel(iso) {
  return fromIso(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/** Um mês inteiro continua "Mensal"; qualquer outro intervalo vira "Intervalo". */
function periodFromRange({ from, to }, current) {
  const start = toIso(from);
  const end = toIso(to);
  const wholeMonth =
    start.slice(0, 7) === end.slice(0, 7) &&
    from.getDate() === 1 &&
    to.getDate() === lastDayOf(to.getFullYear(), to.getMonth() + 1);
  if (wholeMonth) return { ...current, period: 'month', month: start.slice(0, 7) };
  return { ...current, period: 'range', from: start, to: end };
}

/** Campo com rótulo cujo controle é o botão que abre um dialog de seleção. */
function PickerField({ id, label, children }) {
  return (
    <div className="field">
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>
      {children}
    </div>
  );
}

function PickerTrigger({ id, text, icon: Icon = CalendarDays, ...props }) {
  return (
    <button type="button" id={id} className="period-trigger" aria-labelledby={`${id}-label ${id}`} {...props}>
      <span>{text}</span>
      <Icon aria-hidden="true" size={20} />
    </button>
  );
}

/** Escolha do período: diário, mensal (RF-27) ou intervalo livre (auditoria, RF-30). */
export default function PeriodFilter({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const today = fromIso(todayInLab());
  return (
    <div className="form-row" role="group" aria-label="Período do relatório">
      <div className="field">
        <label htmlFor="period">Período</label>
        <select id="period" value={value.period} onChange={(e) => set({ period: e.target.value })}>
          <option value="day">Diário</option>
          <option value="month">Mensal</option>
          <option value="range">Intervalo</option>
        </select>
      </div>
      {value.period === 'day' && (
        <PickerField id="date" label="Dia">
          <DayPickerDialog
            className="period-dialog"
            selected={fromIso(value.date)}
            onApply={(date) => set({ date: toIso(date) })}
            description="Escolha o dia do relatório diário."
            locale={ptBR}
            maxDate={today}
            trigger={<PickerTrigger id="date" text={dayLabel(value.date)} />}
          />
        </PickerField>
      )}
      {value.period === 'month' && (
        <PickerField id="month" label="Mês">
          <MonthPickerDialog
            className="period-dialog"
            selected={{ year: Number(value.month.slice(0, 4)), month: Number(value.month.slice(5, 7)) - 1 }}
            onApply={({ year, month }) => set({ month: `${year}-${pad(month + 1)}` })}
            description="Escolha o mês do relatório mensal."
            maxDate={today}
            trigger={<PickerTrigger id="month" text={monthLabel(value.month)} />}
          />
        </PickerField>
      )}
      {value.period === 'range' && (
        <PickerField id="range" label="Intervalo">
          <CalendarDialog
            className="period-dialog"
            selected={{ from: fromIso(value.from), to: fromIso(value.to) }}
            onApply={(range) => onChange(periodFromRange(range, value))}
            dialogTitle="Selecionar período"
            description="Escolha o dia inicial e o final. Um mês inteiro gera o relatório mensal."
            applyLabel="Aplicar"
            cancelLabel="Cancelar"
            locale={ptBR}
            maxDate={today}
            trigger={
              <PickerTrigger id="range" text={`${brDate(value.from)} a ${brDate(value.to)}`} icon={CalendarRange} />
            }
          />
        </PickerField>
      )}
    </div>
  );
}

export function initialPeriod() {
  const today = todayInLab();
  return { period: 'day', date: today, month: today.slice(0, 7), from: today, to: today };
}

/** Converte o estado do filtro em parâmetros da API. */
export function periodParams(value) {
  if (value.period === 'month') return { period: 'month', month: value.month };
  if (value.period === 'range') return { from: value.from, to: value.to };
  return { period: 'day', date: value.date };
}

export function periodLabel(value) {
  if (value.period === 'month') return `Mês ${value.month.split('-').reverse().join('/')}`;
  if (value.period === 'range') return `${brDate(value.from)} a ${brDate(value.to)}`;
  return `Dia ${brDate(value.date)}`;
}
