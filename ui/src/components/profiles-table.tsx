/**
 * Profiles Table Component
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Edit, Settings } from 'lucide-react';
import { useDeleteProfile } from '@/hooks/use-profiles';
import type { Profile } from '@/lib/api-client';

interface ProfilesTableProps {
  data: Profile[];
  onEdit?: (profile: Profile) => void;
  onEditSettings?: (profile: Profile) => void;
}

export function ProfilesTable({ data, onEdit, onEditSettings }: ProfilesTableProps) {
  const deleteMutation = useDeleteProfile();

  const columns: ColumnDef<Profile>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 200,
    },
    {
      accessorKey: 'settingsPath',
      header: 'Settings Path',
    },
    {
      accessorKey: 'configured',
      header: 'Status',
      size: 100,
      cell: ({ row }) => (
        <span className={row.original.configured ? 'text-green-600' : 'text-yellow-600'}>
          {row.original.configured ? '[OK]' : '[!]'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </DropdownMenuItem>
            )}
            {onEditSettings && (
              <DropdownMenuItem onClick={() => onEditSettings(row.original)}>
                <Settings className="w-4 h-4 mr-2" />
                Edit Settings
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => deleteMutation.mutate(row.original.name)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
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
        No profiles found. Create one to get started.
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
                const isAction = header.id === 'actions';
                const isStatus = header.id === 'configured';
                const isName = header.id === 'name';

                return (
                  <TableHead
                    key={header.id}
                    className={
                      isAction
                        ? 'w-[50px]'
                        : isStatus
                          ? 'w-[100px]'
                          : isName
                            ? 'w-[200px]'
                            : 'w-auto'
                    }
                  >
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
