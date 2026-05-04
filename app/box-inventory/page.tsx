'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus, Minus, History, Pencil, Save, Loader2, Trash2,
    AlertTriangle, CheckCircle2, X, Package2, ArrowUpRight,
    ArrowDownRight, ChevronDown, ChevronRight, Search, Filter,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/libs/utils';
import { format } from 'date-fns';
import { hasPermission } from '@/lib/role-permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoxType {
    id: string;
    name: string;
    costPerUnit: number;
    availableStock: number;
    minimumStock: number;
    description: string | null;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
}

interface BoxMovement {
    id: string;
    boxTypeId: string;
    boxTypeName: string;
    action: 'add' | 'reduce';
    quantity: number;
    reason: string;
    reference: string | null;
    remarks: string | null;
    performedByName: string;
    createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
    purchase: 'Purchase',
    packaging: 'Packaging',
    correction: 'Correction',
    wastage: 'Wastage/Damage',
};

const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

const stockStatus = (box: BoxType) => {
    if (box.availableStock <= 0) return 'out';
    if (box.availableStock <= box.minimumStock) return 'low';
    return 'ok';
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function BoxInventoryPage() {
    const { toast } = useToast();
    const { isAdmin, user } = useAuth();
    const canAccess = hasPermission((user?.roles || []) as any[], 'box_inventory')
        || (user?.roles || []).includes('packaging' as any);

    const [boxTypes, setBoxTypes] = useState<BoxType[]>([]);
    const [movements, setMovements] = useState<BoxMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [movLoading, setMovLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('active');
    const [stockFilter, setStockFilter] = useState<string>('all');
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [formQuantity, setFormQuantity] = useState('');

    // ── Add/Edit modal ────────────────────────────────────────────────────────
    const [formOpen, setFormOpen] = useState(false);
    const [editingBox, setEditingBox] = useState<BoxType | null>(null);
    const [formName, setFormName] = useState('');
    const [formCost, setFormCost] = useState('');
    const [formMinStock, setFormMinStock] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
    const [isSavingForm, setIsSavingForm] = useState(false);

    // ── Adjust modal ──────────────────────────────────────────────────────────
    const [adjustOpen, setAdjustOpen] = useState(false);
    const [adjustBox, setAdjustBox] = useState<BoxType | null>(null);
    const [adjustAction, setAdjustAction] = useState<'add' | 'reduce'>('add');
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustReason, setAdjustReason] = useState('purchase');
    const [adjustRef, setAdjustRef] = useState('');
    const [adjustRemarks, setAdjustRemarks] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);

    // ── History sheet ─────────────────────────────────────────────────────────
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyBox, setHistoryBox] = useState<BoxType | null>(null);
    const [historyFilter, setHistoryFilter] = useState<string>('all'); // boxTypeId or 'all'

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchBoxTypes = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/box-inventory');
            if (!res.ok) throw new Error();
            setBoxTypes(await res.json());
        } catch {
            toast({ title: 'Error', description: 'Failed to load box inventory', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchMovements = useCallback(async (boxTypeId?: string) => {
        try {
            setMovLoading(true);
            const url = boxTypeId
                ? `/api/box-inventory/adjust?boxTypeId=${boxTypeId}`
                : '/api/box-inventory/adjust';
            const res = await fetch(url);
            if (!res.ok) throw new Error();
            setMovements(await res.json());
        } catch { /* silent */ }
        finally { setMovLoading(false); }
    }, []);

    useEffect(() => {
        if (canAccess) fetchBoxTypes();
    }, [canAccess, fetchBoxTypes]);

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalInventoryValue = useMemo(
        () => boxTypes.filter(b => b.status === 'active')
            .reduce((sum, b) => sum + b.availableStock * b.costPerUnit, 0),
        [boxTypes]
    );

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return boxTypes.filter(b =>
            (!q.trim() ||
                b.name.toLowerCase().includes(q) ||
                (b.description?.toLowerCase().includes(q) ?? false)) &&
            (statusFilter === 'all' || b.status === statusFilter) &&
            (stockFilter === 'all' ||
                (stockFilter === 'normal' && stockStatus(b) === 'ok') ||
                (stockFilter === 'low' && stockStatus(b) === 'low') ||
                (stockFilter === 'out' && stockStatus(b) === 'out'))
        );
    }, [boxTypes, search, statusFilter, stockFilter]);

    const hasActiveFilters = statusFilter !== 'all' || stockFilter !== 'all';
    const clearFilters = () => {
        setStatusFilter('all');
        setStockFilter('all');
    };

    // ── Add/Edit form ─────────────────────────────────────────────────────────

    const openAdd = () => {
        setEditingBox(null);
        setFormName('');
        setFormCost('');
        setFormMinStock('0');
        setFormQuantity('0');
        setFormDesc('');
        setFormStatus('active');
        setFormOpen(true);
    };

    const openEdit = (box: BoxType) => {
        setEditingBox(box);
        setFormName(box.name);
        setFormCost(box.costPerUnit.toString());
        setFormMinStock(box.minimumStock.toString());
        setFormQuantity(box.availableStock.toString());
        setFormDesc(box.description || '');
        setFormStatus(box.status);
        setFormOpen(true);
    };

    const saveForm = async () => {
        if (!formName.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
        setIsSavingForm(true);
        try {
            const url = editingBox ? `/api/box-inventory/${editingBox.id}` : '/api/box-inventory';
            const method = editingBox ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formName.trim(),
                    costPerUnit: parseFloat(formCost) || 0,
                    minimumStock: parseInt(formMinStock) || 0,
                    availableStock: parseInt(formQuantity) || 0,
                    description: formDesc.trim() || null,
                    status: formStatus,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save');
            }
            toast({ title: editingBox ? 'Updated' : 'Created', description: `"${formName.trim()}" saved successfully.` });
            setFormOpen(false);
            fetchBoxTypes();
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
        } finally {
            setIsSavingForm(false);
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────────

    const handleDelete = async (box: BoxType) => {
        try {
            setDeletingId(box.id);
            const res = await fetch(`/api/box-inventory/${box.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete');
            }
            toast({ title: 'Deleted', description: `"${box.name}" removed.` });
            fetchBoxTypes();
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
        } finally {
            setDeletingId(null);
        }
    };

    // ── Adjust stock ──────────────────────────────────────────────────────────

    const openAdjust = (box: BoxType, action: 'add' | 'reduce') => {
        setAdjustBox(box);
        setAdjustAction(action);
        setAdjustQty('');
        setAdjustReason(action === 'add' ? 'purchase' : 'wastage');
        setAdjustRef(''); setAdjustRemarks('');
        setAdjustOpen(true);
    };

    const saveAdjust = async () => {
        const qty = parseInt(adjustQty);
        if (!qty || qty <= 0) { toast({ title: 'Enter a valid quantity', variant: 'destructive' }); return; }
        setIsAdjusting(true);
        try {
            const res = await fetch('/api/box-inventory/adjust', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boxTypeId: adjustBox!.id,
                    action: adjustAction,
                    quantity: qty,
                    reason: adjustReason,
                    reference: adjustRef || null,
                    remarks: adjustRemarks || null,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            toast({
                title: adjustAction === 'add' ? 'Stock Added' : 'Stock Reduced',
                description: `${qty} boxes ${adjustAction === 'add' ? 'added to' : 'removed from'} "${adjustBox!.name}".`,
            });
            setAdjustOpen(false);
            fetchBoxTypes();
            if (historyOpen) fetchMovements(historyBox?.id);
        } catch (err) {
            toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
        } finally {
            setIsAdjusting(false);
        }
    };

    // ── History ───────────────────────────────────────────────────────────────

    const openHistory = (box?: BoxType) => {
        setHistoryBox(box || null);
        setHistoryFilter(box ? box.id : 'all');
        fetchMovements(box?.id);
        setHistoryOpen(true);
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    if (!canAccess) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <p className="text-muted-foreground">Access denied.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Package2 className="h-6 w-6 text-primary" />
                            Box Inventory
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Track packaging box types and stock levels
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" onClick={() => openHistory()} className="gap-2">
                            <History className="h-4 w-4" />All Movements
                        </Button>
                        {isAdmin && (
                            <Button onClick={openAdd} className="gap-2">
                                <Plus className="h-4 w-4" />Add Box Type
                            </Button>
                        )}
                    </div>
                </div>

                {/* Summary stat */}
                {!loading && boxTypes.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-xs text-muted-foreground mb-1">Box Types</p>
                                <p className="text-2xl font-bold">{boxTypes.filter(b => b.status === 'active').length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-xs text-muted-foreground mb-1">Total Boxes</p>
                                <p className="text-2xl font-bold">
                                    {boxTypes.reduce((s, b) => s + b.availableStock, 0).toLocaleString('en-IN')}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-xs text-muted-foreground mb-1">Inventory Value</p>
                                <p className="text-2xl font-bold">{fmt(totalInventoryValue)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-xs text-muted-foreground mb-1">Low / Out</p>
                                <p className="text-2xl font-bold text-amber-600">
                                    {boxTypes.filter(b => stockStatus(b) !== 'ok').length}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Search and Filters */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search box types..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={stockFilter} onValueChange={setStockFilter}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Stock Level" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                                <SelectItem value="all">All Stock Levels</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="low">Low Stock</SelectItem>
                                <SelectItem value="out">Out of Stock</SelectItem>
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X className="h-4 w-4 mr-1" />
                                Clear
                            </Button>
                        )}
                    </div>

                    <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="md:hidden shrink-0">
                                <Filter className="h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-auto rounded-t-xl">
                            <SheetHeader className="text-left mb-4">
                                <SheetTitle>Filters</SheetTitle>
                            </SheetHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm font-medium text-foreground mb-2 block">Status</Label>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-popover">
                                            <SelectItem value="all">All Status</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium text-foreground mb-2 block">Stock Level</Label>
                                    <Select value={stockFilter} onValueChange={setStockFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Stock Level" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-popover">
                                            <SelectItem value="all">All Stock Levels</SelectItem>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="low">Low Stock</SelectItem>
                                            <SelectItem value="out">Out of Stock</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button variant="outline" onClick={clearFilters} className="flex-1">
                                        Clear Filters
                                    </Button>
                                    <Button onClick={() => setMobileFilterOpen(false)} className="flex-1">
                                        Apply
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                <div>
                    <p className="text-sm text-muted-foreground">
                        Showing {filtered.length} of {boxTypes.length} box types
                    </p>
                </div>

                {/* Box types table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Box Types</CardTitle>
                        <CardDescription>
                            {boxTypes.length} type{boxTypes.length !== 1 ? 's' : ''} registered
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">
                                {boxTypes.length === 0
                                    ? 'No box types added yet.'
                                    : 'No box types match your search.'}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40">
                                            <TableHead>Name</TableHead>
                                            <TableHead className="text-right">Stock</TableHead>
                                            <TableHead className="text-right">Min Stock</TableHead>
                                            <TableHead className="text-right">Cost/Box</TableHead>
                                            <TableHead className="text-right">Value</TableHead>
                                            <TableHead className="text-center">Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((box) => {
                                            const ss = stockStatus(box);
                                            return (
                                                <TableRow key={box.id}>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium text-sm">{box.name}</p>
                                                            {box.description && (
                                                                <p className="text-xs text-muted-foreground">{box.description}</p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={cn(
                                                            'font-semibold text-sm',
                                                            ss === 'out' && 'text-destructive',
                                                            ss === 'low' && 'text-amber-600',
                                                            ss === 'ok' && 'text-foreground',
                                                        )}>
                                                            {box.availableStock.toLocaleString('en-IN')}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-muted-foreground">
                                                        {box.minimumStock.toLocaleString('en-IN')}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                        {box.costPerUnit > 0 ? fmt(box.costPerUnit) : <span className="text-muted-foreground">—</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-medium">
                                                        {box.costPerUnit > 0
                                                            ? fmt(box.availableStock * box.costPerUnit)
                                                            : <span className="text-muted-foreground">—</span>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    'text-xs gap-1',
                                                                    ss === 'ok' && 'bg-green-50 text-green-700 border-green-300',
                                                                    ss === 'low' && 'bg-amber-50 text-amber-700 border-amber-300',
                                                                    ss === 'out' && 'bg-red-50 text-red-700 border-red-300',
                                                                )}
                                                            >
                                                                {ss === 'ok' && <CheckCircle2 className="h-3 w-3" />}
                                                                {ss === 'low' && <AlertTriangle className="h-3 w-3" />}
                                                                {ss === 'out' && <X className="h-3 w-3" />}
                                                                {ss === 'ok' ? 'OK' : ss === 'low' ? 'Low' : 'Out'}
                                                            </Badge>
                                                            {box.status === 'inactive' && (
                                                                <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {/* History */}
                                                            <Button variant="ghost" size="icon" className="h-7 w-7"
                                                                title="View movements"
                                                                onClick={() => openHistory(box)}>
                                                                <History className="h-3.5 w-3.5" />
                                                            </Button>
                                                            {/* Add stock */}
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700"
                                                                title="Add stock"
                                                                onClick={() => openAdjust(box, 'add')}>
                                                                <Plus className="h-3.5 w-3.5" />
                                                            </Button>
                                                            {/* Remove stock */}
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                                                title="Remove stock"
                                                                onClick={() => openAdjust(box, 'reduce')}>
                                                                <Minus className="h-3.5 w-3.5" />
                                                            </Button>
                                                            {/* Edit (admin only) */}
                                                            {isAdmin && (
                                                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                                                    onClick={() => openEdit(box)}>
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            {/* Delete (admin only) */}
                                                            {isAdmin && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button
                                                                            variant="ghost" size="icon"
                                                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                                                            disabled={deletingId === box.id}
                                                                        >
                                                                            {deletingId === box.id
                                                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                                : <Trash2 className="h-3.5 w-3.5" />}
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Delete "{box.name}"?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                {box.availableStock > 0
                                                                                    ? `Cannot delete — ${box.availableStock} boxes still in stock. Reduce to 0 first.`
                                                                                    : 'This will permanently delete this box type and all its movement history.'}
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            {box.availableStock === 0 && (
                                                                                <AlertDialogAction
                                                                                    onClick={() => handleDelete(box)}
                                                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                                >
                                                                                    Delete
                                                                                </AlertDialogAction>
                                                                            )}
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Add / Edit Modal ── */}
                <Dialog open={formOpen} onOpenChange={setFormOpen}>
                    <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                            <DialogTitle>{editingBox ? 'Edit Box Type' : 'Add Box Type'}</DialogTitle>
                            <DialogDescription>
                                {editingBox ? 'Update box type details.' : 'Create a new box type for packaging.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Name *</Label>
                                <Input placeholder="e.g. ATC-500, ATC-1kg" value={formName} onChange={(e) => setFormName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Cost per Box (₹)</Label>
                                <Input type="number" min="0" step="0.01" placeholder="0.00" value={formCost} onChange={(e) => setFormCost(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={formQuantity}
                                    onChange={(e) => setFormQuantity(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Set the initial available stock for this box type.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Minimum Stock</Label>
                                <Input type="number" min="0" placeholder="0" value={formMinStock} onChange={(e) => setFormMinStock(e.target.value)} />
                                <p className="text-xs text-muted-foreground">Alert when stock falls below this.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Description (optional)</Label>
                                <Textarea placeholder="Notes about this box type..." value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} />
                            </div>
                            {editingBox && (
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <Label className="cursor-pointer">Active</Label>
                                    <Switch
                                        checked={formStatus === 'active'}
                                        onCheckedChange={(c) => setFormStatus(c ? 'active' : 'inactive')}
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
                            <Button onClick={saveForm} disabled={isSavingForm} className="gap-2">
                                {isSavingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {editingBox ? 'Save Changes' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Adjust Stock Modal ── */}
                <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
                    <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                            <DialogTitle>
                                {adjustAction === 'add' ? 'Add Stock' : 'Remove Stock'} — {adjustBox?.name}
                            </DialogTitle>
                            <DialogDescription>
                                Current stock: <strong>{adjustBox?.availableStock.toLocaleString('en-IN') || 0} boxes</strong>
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Quantity *</Label>
                                <Input
                                    type="number" min="1"
                                    value={adjustQty}
                                    onChange={(e) => setAdjustQty(e.target.value)}
                                    placeholder="Enter number of boxes"
                                    autoFocus
                                />
                                {adjustQty && adjustBox && (
                                    <p className="text-xs text-muted-foreground">
                                        New stock: <strong>
                                            {adjustAction === 'add'
                                                ? adjustBox.availableStock + (parseInt(adjustQty) || 0)
                                                : adjustBox.availableStock - (parseInt(adjustQty) || 0)
                                            } boxes
                                        </strong>
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Reason *</Label>
                                <Select value={adjustReason} onValueChange={setAdjustReason}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {adjustAction === 'add' ? (
                                            <>
                                                <SelectItem value="purchase">Purchase</SelectItem>
                                                <SelectItem value="correction">Correction</SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                <SelectItem value="wastage">Wastage / Damage</SelectItem>
                                                <SelectItem value="correction">Correction</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Reference (optional)</Label>
                                <Input value={adjustRef} onChange={(e) => setAdjustRef(e.target.value)} placeholder="Invoice no., PO..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Remarks (optional)</Label>
                                <Textarea value={adjustRemarks} onChange={(e) => setAdjustRemarks(e.target.value)} rows={2} placeholder="Any notes..." />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
                            <Button
                                onClick={saveAdjust}
                                disabled={isAdjusting || !adjustQty}
                                className={cn('gap-2', adjustAction === 'reduce' && 'bg-destructive hover:bg-destructive/90')}
                            >
                                {isAdjusting
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : adjustAction === 'add' ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                {adjustAction === 'add' ? 'Add Stock' : 'Remove Stock'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Movement History Sheet ── */}
                <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                    <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-primary" />
                                {historyBox ? `Movements — ${historyBox.name}` : 'All Box Movements'}
                            </SheetTitle>
                        </SheetHeader>
                        <div className="mt-6">
                            {/* Filter by box type */}
                            <div className="mb-4">
                                <Select
                                    value={historyFilter}
                                    onValueChange={(v) => {
                                        setHistoryFilter(v);
                                        setHistoryBox(v === 'all' ? null : boxTypes.find(b => b.id === v) || null);
                                        fetchMovements(v === 'all' ? undefined : v);
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Box Types</SelectItem>
                                        {boxTypes.map(b => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {movLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : movements.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground text-sm">No movements recorded yet.</div>
                            ) : (
                                <div className="space-y-2">
                                    {movements.map((m) => (
                                        <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                                            <Badge variant="outline" className={cn(
                                                'gap-1 text-xs shrink-0 mt-0.5',
                                                m.action === 'add'
                                                    ? 'bg-green-50 text-green-700 border-green-300'
                                                    : 'bg-red-50 text-red-700 border-red-300',
                                            )}>
                                                {m.action === 'add'
                                                    ? <ArrowUpRight className="h-3 w-3" />
                                                    : <ArrowDownRight className="h-3 w-3" />}
                                                {m.action === 'add' ? '+' : '-'}{m.quantity}
                                            </Badge>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-sm">{m.boxTypeName}</span>
                                                    <span className="text-xs text-muted-foreground">{REASON_LABELS[m.reason] || m.reason}</span>
                                                    {m.reference && <span className="text-xs font-mono text-muted-foreground">{m.reference}</span>}
                                                </div>
                                                {m.remarks && <p className="text-xs text-muted-foreground mt-0.5">{m.remarks}</p>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs text-muted-foreground">{format(new Date(m.createdAt), 'dd MMM yy')}</p>
                                                <p className="text-xs text-muted-foreground">{m.performedByName}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </SheetContent>
                </Sheet>

            </div>
        </AppLayout>
    );
}
