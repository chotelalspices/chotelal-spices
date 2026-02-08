import Link from 'next/link';
import { Eye, Edit, Package } from 'lucide-react';
import { Formulation } from '@/data/formulationData';
import { formatDate } from '@/data/sampleData';
import { Button } from '@/components/ui/button';

interface FormulationCardProps {
  formulation: Formulation;
  isAdmin?: boolean;
}

export function FormulationCard({ formulation, isAdmin = false }: FormulationCardProps) {
  return (
    <div className="mobile-card animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{formulation.name}</h3>
          <p className="text-sm text-muted-foreground">
            Base: {formulation.baseQuantity} {formulation.baseUnit}
          </p>
        </div>
        <span className={`status-badge ${formulation.status === 'active' ? 'status-active' : 'status-inactive'}`}>
          {formulation.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>{formulation.ingredients.length} ingredients</span>
        <span>Updated {formatDate(formulation.updatedAt)}</span>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/formulations/${formulation.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/formulations/${formulation.id}/edit`}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/formulations/${formulation.id}/products`}>
              <Package className="h-4 w-4 mr-1" />
              Products
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
