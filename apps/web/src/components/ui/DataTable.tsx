import type { ReactNode } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  render: (row: T, rowIndex: number) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  className?: string;
  dense?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
  dense,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <div className="py-10 text-center text-sm text-slate-500">{empty}</div>;
  }

  const paddingCell = dense ? 'px-4 py-2.5' : 'px-4 py-3.5';

  return (
    <div className={['overflow-x-auto scrollarea', className].filter(Boolean).join(' ')}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={[
                  paddingCell,
                  'text-xs font-medium uppercase tracking-wider text-slate-500',
                  c.align === 'right'
                    ? 'text-right'
                    : c.align === 'center'
                      ? 'text-center'
                      : 'text-left',
                  c.className,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={[
                'border-b border-slate-100 last:border-b-0 transition-colors',
                onRowClick ? 'cursor-pointer hover:bg-slate-50' : '',
              ].join(' ')}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={[
                    paddingCell,
                    'text-sm text-slate-800',
                    c.align === 'right'
                      ? 'text-right'
                      : c.align === 'center'
                        ? 'text-center'
                        : 'text-left',
                    c.className,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
