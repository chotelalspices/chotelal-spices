'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FlaskConical, Plus, Search, Pencil, Trash2,
  Loader2, ArrowLeft, Package2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';

interface ExtendedItem {
  id: string;
  date: string;
  companyName: string | null;
  productName: string;
  code: string | null;
  price: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export default function ExtendedInventoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const isAdmin = user?.roles?.includes('admin') || false;

  const [items, setItems] = useState<ExtendedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/extended-inventory');
      if (!res.ok) throw new Error();
      setItems(await res.json());
    } catch {
      toast({ title: 'Error', description: 'Failed to load extended inventory', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = items.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.productName.toLowerCase().includes(q) ||
      (item.companyName?.toLowerCase().includes(q) ?? false) ||
      (item.code?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      const res = await fetch(`/api/extended-inventory/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast({ title: 'Deleted', description: 'Item removed from extended inventory' });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/research')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package2 className="h-6 w-6 text-primary" />
                Extended Inventory
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                External product samples and reference materials
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => router.push('/research/extended-inventory/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product, company or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Desktop Table */}
        {!loading && !isMobile && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {isAdmin && <TableHead>Company</TableHead>}
                  <TableHead>Product Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Notes</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(item.date), 'dd MMM yyyy')}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="font-medium text-sm">{item.companyName}</TableCell>
                    )}
                    <TableCell className="font-medium text-sm">{item.productName}</TableCell>
                    <TableCell>
                      {item.code
                        ? <Badge variant="outline" className="font-mono text-xs">{item.code}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {item.price > 0 ? fmt(item.price) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {item.notes || '—'}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => router.push(`/research/extended-inventory/${item.id}/edit`)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Item</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete <strong>{item.productName}</strong>? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(item.id)}
                                  disabled={deletingId === item.id}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 5} className="text-center py-8 text-muted-foreground">
                      {items.length === 0 ? 'No items added yet' : 'No items match your search'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Mobile Cards */}
        {!loading && isMobile && (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <Package2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {items.length === 0 ? 'No items added yet' : 'No items match your search'}
                </p>
              </div>
            ) : filtered.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{item.productName}</p>
                      {isAdmin && item.companyName && (
                        <p className="text-sm text-muted-foreground">{item.companyName}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.date), 'dd MMM yyyy')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.code && (
                      <Badge variant="outline" className="font-mono text-xs">{item.code}</Badge>
                    )}
                    {item.price > 0 && (
                      <Badge variant="secondary">{fmt(item.price)}</Badge>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-sm text-muted-foreground">{item.notes}</p>
                  )}

                  {isAdmin && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => router.push(`/research/extended-inventory/${item.id}/edit`)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive hover:text-white">
                            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Item</AlertDialogTitle>
                            <AlertDialogDescription>Delete <strong>{item.productName}</strong>?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}