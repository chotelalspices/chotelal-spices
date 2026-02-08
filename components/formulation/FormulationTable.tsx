import Link from 'next/link';
import { Eye, Edit, Package } from 'lucide-react';
import { Formulation } from '@/data/formulationData';
import { formatDate } from '@/data/sampleData';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FormulationTableProps {
  formulations: Formulation[];
  isAdmin?: boolean;
}

export function FormulationTable({ formulations, isAdmin = false }: FormulationTableProps) {
  return (
    <div className="industrial-card overflow-hidden animate-fade-in">
      <Table className="data-table">
        <TableHeader>
          <TableRow>
            <TableHead>Masala / Product Name</TableHead>
            <TableHead>Base Quantity</TableHead>
            <TableHead>Ingredients</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin && <TableHead className="text-right">Actions</TableHead>}
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
              {isAdmin && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                          <Link href={`/formulations/${formulation.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View Formulation</TooltipContent>
                    </Tooltip>
                    {isAdmin && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href={`/formulations/${formulation.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit Formulation</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                          <Link href={`/formulations/${formulation.id}/products`}>
                            <Package className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View Products</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
