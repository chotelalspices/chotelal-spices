'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit, Trash2, Package, Loader2 } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Product {
  id: string;
  name: string;
  quantity: number;
  unit: 'kg' | 'gm';
  formulationId: string;
  createdAt: string;
}

interface Formulation {
  id: string;
  name: string;
  baseQuantity: number;
  baseUnit: 'kg' | 'gm';
  status: 'active' | 'inactive';
}

export default function FormulationProducts() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const formulationId = params.id as string;

  const [formulation, setFormulation] = useState<Formulation | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch formulation details
        const formulationResponse = await fetch(`/api/formulations/${formulationId}`);
        if (!formulationResponse.ok) {
          throw new Error('Failed to fetch formulation');
        }
        const formulationData = await formulationResponse.json();
        setFormulation(formulationData);

        // Fetch products for this formulation
        const productsResponse = await fetch(`/api/formulations/${formulationId}/products`);
        if (!productsResponse.ok) {
          throw new Error('Failed to fetch products');
        }
        const productsData = await productsResponse.json();
        setProducts(productsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (formulationId) {
      fetchData();
    }
  }, [formulationId, toast]);

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      setProducts(products.filter(p => p.id !== productToDelete.id));
      setDeleteModalOpen(false);
      setProductToDelete(null);
      toast({
        title: 'Product Deleted',
        description: `${productToDelete.name} has been deleted successfully.`,
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!formulation) {
    return (
      <AppLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Formulation not found</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/formulations">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Formulations
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/formulations/${formulationId}`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="page-title">Products</h1>
              <p className="text-muted-foreground mt-1">
                Products created from: {formulation.name}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/formulations/${formulationId}/products/new`}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>

        {/* Formulation Summary */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Formulation</p>
                <p className="font-semibold">{formulation.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Base Quantity</p>
                <p className="font-semibold">
                  {formulation.baseQuantity} {formulation.baseUnit}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="font-semibold">
                  <Badge variant={formulation.status === 'active' ? 'default' : 'secondary'}>
                    {formulation.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Total Products</p>
                <p className="font-semibold">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Products List
            </CardTitle>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No products found</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first product from this formulation.
                </p>
                <Button asChild>
                  <Link href={`/formulations/${formulationId}/products/new`}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Product
                  </Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-center">Unit</TableHead>
                    <TableHead className="text-center">Created Date</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.quantity.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {product.unit}
                      </TableCell>
                      <TableCell className="text-center">
                        {new Date(product.createdAt).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/formulations/${formulationId}/products/${product.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <AlertDialog open={deleteModalOpen && productToDelete?.id === product.id}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteModal(product)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{productToDelete?.name}</strong>? 
                                  This action cannot be undone and will permanently remove this product from the system.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={handleDelete}
                                  disabled={isDeleting}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {isDeleting ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    'Delete Product'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between gap-3">
          <Button variant="outline" asChild>
            <Link href={`/formulations/${formulationId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Formulation
            </Link>
          </Button>

          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/formulations">
                All Formulations
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/formulations/${formulationId}/products/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
