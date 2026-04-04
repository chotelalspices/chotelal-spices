import { useState } from 'react';
import Link from 'next/link';
import { Eye, Edit, Package, MoreHorizontal, ToggleLeft, ToggleRight, Trash2, Loader2 } from 'lucide-react';
import { Formulation } from '@/data/formulationData';
import { formatDate } from '@/data/sampleData';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FormulationTableProps {
  formulations: Formulation[];
  isAdmin?: boolean;
  onStatusChange?: (id: string, newStatus: 'active' | 'inactive') => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function FormulationTable({
  formulations,
  isAdmin = false,
  onStatusChange,
  onDelete,
}: FormulationTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Formulation | null>(null);

  const handleStatusToggle = async (formulation: Formulation) => {
    if (!onStatusChange) return;
    const newStatus = formulation.status === 'active' ? 'inactive' : 'active';
    setLoadingId(formulation.id);
    try {
      await onStatusChange(formulation.id, newStatus);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !onDelete) return;
    setLoadingId(deleteTarget.id);
    try {
      await onDelete(deleteTarget.id);
    } finally {
      setLoadingId(null);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <div className="industrial-card overflow-hidden animate-fade-in">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead>Masala / Product Name</TableHead>
              <TableHead>Base Quantity</TableHead>
              <TableHead>Ingredients</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formulations.map((formulation) => (
              <TableRow key={formulation.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{formulation.name}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formulation.baseQuantity} {formulation.baseUnit}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formulation.ingredients.length} items
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(formulation.updatedAt)}
                </TableCell>
                <TableCell>
                  <span className={`status-badge ${formulation.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                    {formulation.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Products button — visible to all */}
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                      <Link href={`/formulations/${formulation.id}/products`}>
                        <Package className="h-4 w-4" />
                      </Link>
                    </Button>

                    {/* Admin actions dropdown */}
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={loadingId === formulation.id}
                          >
                            {loadingId === formulation.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <MoreHorizontal className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild>
                            <Link href={`/formulations/${formulation.id}`} className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/formulations/${formulation.id}/edit`} className="flex items-center gap-2">
                              <Edit className="h-4 w-4" />Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="flex items-center gap-2"
                            onClick={() => handleStatusToggle(formulation)}
                          >
                            {formulation.status === 'active'
                              ? <><ToggleLeft className="h-4 w-4 text-amber-600" /><span className="text-amber-600">Set Inactive</span></>
                              : <><ToggleRight className="h-4 w-4 text-green-600" /><span className="text-green-600">Set Active</span></>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}