/**
 * Accounts Table Component
 * Phase 03: REST API Routes & CRUD
 */

import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useSetDefaultAccount } from '@/hooks/use-accounts';
import type { Account } from '@/lib/api-client';

interface AccountsTableProps {
  data: Account[];
  defaultAccount: string | null;
}

export function AccountsTable({ data, defaultAccount }: AccountsTableProps) {
  const setDefaultMutation = useSetDefaultAccount();

  const columns: ColumnDef<Account>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.name}
          {row.original.name === defaultAccount && (
            <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
              default
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => row.original.type || 'oauth',
    },
    {
      accessorKey: 'created',
      header: 'Created',
      cell: ({ row }) => {
        const date = new Date(row.original.created);
        return date.toLocaleDateString();
      },
    },
    {
      accessorKey: 'last_used',
      header: 'Last Used',
      cell: ({ row }) => {
        if (!row.original.last_used) return '-';
        const date = new Date(row.original.last_used);
        return date.toLocaleDateString();
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const isDefault = row.original.name === defaultAccount;
        return (
          <Button
            variant={isDefault ? 'outline' : 'default'}
            size="sm"
            disabled={isDefault || setDefaultMutation.isPending}
            onClick={() => setDefaultMutation.mutate(row.original.name)}
          >
            <Check className="w-4 h-4 mr-1" />
            {isDefault ? 'Default' : 'Set Default'}
          </Button>
        );
      },
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No accounts found. Use <code className="text-sm bg-muted px-1 rounded">ccs login</code> to
        add accounts.
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const widthClass =
                  {
                    name: 'w-[200px]',
                    type: 'w-[100px]',
                    created: 'w-[150px]',
                    last_used: 'w-[150px]',
                    actions: 'w-[120px]',
                  }[header.id] || 'w-auto';

                return (
                  <TableHead key={header.id} className={widthClass}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
