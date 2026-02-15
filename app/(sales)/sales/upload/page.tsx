'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Loader2,
  User,
} from 'lucide-react';

import { toast } from 'sonner';
import { formatCurrency } from '@/data/salesData';

/* ================================================================
   TYPES
================================================================ */

export interface ParsedSaleRow {
  rowNumber: number;
  siNo: number;
  clientName: string;
  voucherType: string;
  voucherNo: string;
  saleDate: string;
  productName: string;
  pricePerUnit: number;
  numberOfPackets: number;
  totalPrice: number;
  id: string;
  availableQuantity: number;
  sellingPricePerPacket: number;
  discount: number;
  productionCost: number;
  finalAmount: number;
  profitLoss: number;
  isFree: boolean;
  status: 'valid' | 'invalid';
  errors?: string[];
}

// A client session groups one client header + their product rows
interface ClientSession {
  sessionKey: string;      // unique key = voucherNo
  clientName: string;
  voucherType: string;
  voucherNo: string;
  saleDate: string;
  sessionTotal: number;    // from column I in the header row
  products: ParsedSaleRow[];
}

interface FinishedProduct {
  id: string;
  name: string;
  availableQuantity: number;
  unit: 'packets';
  productionCostPerPacket: number;
}

/* ================================================================
   HELPERS
================================================================ */

function excelSerialToDate(serial: number): string {
  if (!serial || isNaN(serial)) return '';
  const date = new Date(
    new Date(1900, 0, 1).getTime() + (serial - 2) * 86400000
  );
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function parseExcelFile(
  file: File
): Promise<{ sessions: ClientSession[]; allRows: ParsedSaleRow[] }> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: false,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });

  const sessions: ClientSession[] = [];
  const SKIP = new Set(['new ref', 'sales a/c', '']);

  let rowNumber = 1;
  let siNo = 1;
  let current: ClientSession | null = null;

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const colA = String(r[0] ?? '').trim();
    const colB = String(r[1] ?? '').trim();
    const colC = r[2];
    const colD = r[3];
    const colE = r[4];
    const colG = String(r[6] ?? '').trim();
    const colH = String(r[7] ?? '').trim();
    const colI = r[8]; // transaction value (session total)

    // ── Client header row: col A is a numeric Excel date serial
    const aNum = Number(colA);
    if (!isNaN(aNum) && aNum > 40000 && colB && colB !== 'Date') {
      current = {
        sessionKey: colH,
        clientName: colB,
        voucherType: colG,
        voucherNo: colH.replace('/25-26', '').replace('/24-25', ''),
        saleDate: excelSerialToDate(aNum),
        sessionTotal: Number(colI) || 0,
        products: [],
      };
      sessions.push(current);
      continue;
    }

    // ── Skip meta / header rows
    if (
      !current ||
      !colB ||
      SKIP.has(colB.toLowerCase()) ||
      colA === 'Date' ||
      colA === 'Total:'
    ) continue;

    // ── Product row
    const pricePerUnit = Number(colC);
    const numberOfPackets = Number(colD);
    const totalPrice = Number(colE);

    if (
      colB &&
      !isNaN(pricePerUnit) && pricePerUnit > 0 &&
      !isNaN(numberOfPackets) && numberOfPackets > 0
    ) {
      current.products.push({
        rowNumber: rowNumber++,
        siNo: siNo++,
        clientName: current.clientName,
        voucherType: current.voucherType,
        voucherNo: current.voucherNo,
        saleDate: current.saleDate,
        productName: colB,
        pricePerUnit,
        numberOfPackets,
        totalPrice: isNaN(totalPrice) ? pricePerUnit * numberOfPackets : totalPrice,
        id: '',
        availableQuantity: 0,
        sellingPricePerPacket: pricePerUnit,
        discount: 0,
        productionCost: 0,
        finalAmount: totalPrice || pricePerUnit * numberOfPackets,
        profitLoss: 0,
        isFree: false,
        status: 'invalid',
        errors: ['Product not matched yet'],
      });
    }
  }

  const allRows = sessions.flatMap((s) => s.products);
  return { sessions, allRows };
}

function enrichRows(
  rows: ParsedSaleRow[],
  products: FinishedProduct[]
): ParsedSaleRow[] {
  return rows.map((row) => {
    const errors: string[] = [];
    const product = products.find(
      (p) => p.name.trim().toLowerCase() === row.productName.trim().toLowerCase()
    );
    const qty = row.numberOfPackets;
    const price = row.sellingPricePerPacket;
    const discount = row.discount;
    const finalAmount = price * qty * (1 - discount / 100);
    const isFree = finalAmount === 0;
    const productionCost = product ? product.productionCostPerPacket * qty : 0;
    const profitLoss = isFree ? 0 : finalAmount - productionCost;

    if (!row.productName) errors.push('Product name is required');
    if (!product) errors.push(`"${row.productName}" not found in system`);
    if (qty <= 0) errors.push('Invalid quantity');
    if (!isFree && price <= 0) errors.push('Invalid selling price');
    if (product && qty > product.availableQuantity)
      errors.push(`Insufficient stock (${product.availableQuantity} avail.)`);

    return {
      ...row,
      id: product?.id ?? '',
      availableQuantity: product?.availableQuantity ?? 0,
      productionCost,
      finalAmount,
      profitLoss,
      isFree,
      status: errors.length === 0 ? 'valid' : 'invalid',
      errors: errors.length > 0 ? errors : undefined,
    };
  });
}

// Re-apply enrichment into sessions structure
function enrichSessions(
  sessions: ClientSession[],
  products: FinishedProduct[]
): ClientSession[] {
  return sessions.map((s) => ({
    ...s,
    products: enrichRows(s.products, products),
  }));
}

/* ================================================================
   COMPONENT
================================================================ */

export default function SalesUpload() {
  const router = useRouter();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetch('/api/sales/products')
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => toast.error('Failed to load products.'));
  }, []);

  /* ── derived counts ── */
  const allRows = sessions.flatMap((s) => s.products);
  const validRows = allRows.filter((r) => r.status === 'valid');
  const invalidRows = allRows.filter((r) => r.status === 'invalid');
  const totalAmount = validRows.reduce((s, r) => s + r.finalAmount, 0);

  /* ── drag & drop ── */
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  }, [products]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  /* ── file processing ── */
  const processFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    setIsUploading(true);
    try {
      const { sessions: parsed } = await parseExcelFile(file);
      const enriched = enrichSessions(parsed, products);
      setUploadedFile(file);
      setSessions(enriched);
      const total = enriched.flatMap((s) => s.products).length;
      toast.success(`Parsed ${total} records across ${enriched.length} clients`);
    } catch (err) {
      toast.error('Failed to parse file', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  /* ── inline row edit ── */
  const handleUpdateRow = (
    rowNumber: number,
    field: keyof ParsedSaleRow,
    value: any
  ) => {
    setSessions((prev) =>
      enrichSessions(
        prev.map((s) => ({
          ...s,
          products: s.products.map((r) =>
            r.rowNumber === rowNumber ? { ...r, [field]: value } : r
          ),
        })),
        products
      )
    );
  };

  const handleClearUpload = () => { setUploadedFile(null); setSessions([]); };

  /* ── import ── */
  const handleConfirmImport = async () => {
    setShowConfirmDialog(false);
    setIsImporting(true);
    try {
      const salesData = validRows.map((row) => ({
        productId: row.id,
        clientName: row.clientName,
        voucherNo: row.voucherNo,
        saleDate: row.saleDate,
        numberOfPackets: row.numberOfPackets,
        sellingPricePerPacket: row.sellingPricePerPacket,
        discount: row.discount,
        productionCost: row.productionCost,
        remarks: `Bulk import – ${uploadedFile?.name ?? 'Excel file'}`,
      }));

      const res = await fetch('/api/sales/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales: salesData }),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Import failed');

      const result = await res.json();
      if (result.successCount > 0) toast.success(`${result.successCount} sales imported`);
      if (result.errorCount > 0) toast.error(`${result.errorCount} records failed`);
      router.push('/sales');
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sales')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Upload Sales</h1>
            <p className="text-sm text-muted-foreground">Import sales records from Excel</p>
          </div>
        </div>

        {/* ── Drop zone ── */}
        {!uploadedFile ? (
          <Card
            className={`border-2 border-dashed transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CardContent className="py-16 text-center">
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Parsing Excel file…</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                  <p className="mb-4 font-medium">Drag & drop Excel file or browse</p>
                  <label htmlFor="file-input" className="sr-only">Choose Excel file</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-input"
                    title="Choose Excel file"
                    aria-label="Choose Excel file"
                  />
                  <Button variant="outline" onClick={() => document.getElementById('file-input')?.click()}>
                    Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    Supported: .xlsx, .xls (Tally export format)
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Clients</p>
                    <p className="text-2xl font-bold">{sessions.length}</p>
                  </div>
                  <User className="h-7 w-7 text-muted-foreground" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Records</p>
                    <p className="text-2xl font-bold">{allRows.length}</p>
                  </div>
                  <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Valid</p>
                    <p className="text-2xl font-bold text-green-600">{validRows.length}</p>
                  </div>
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Invalid</p>
                    <p className="text-2xl font-bold text-red-600">{invalidRows.length}</p>
                  </div>
                  <XCircle className="h-7 w-7 text-red-600" />
                </CardContent>
              </Card>
            </div>

            {/* ── Grouped table ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Parsed Sales Data</CardTitle>
                    <CardDescription>
                      {uploadedFile.name} · {sessions.length} client(s) · {allRows.length} line items
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleClearUpload} disabled={isImporting}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                    {validRows.length > 0 && (
                      <Button onClick={() => setShowConfirmDialog(true)} disabled={isImporting}>
                        {isImporting ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>
                        ) : (
                          `Import ${validRows.length} Valid Records`
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60">
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Packets</TableHead>
                        <TableHead className="text-right">Price / Pkt</TableHead>
                        <TableHead className="text-right">Discount %</TableHead>
                        <TableHead className="text-right">Final Amt</TableHead>
                        <TableHead className="text-right">Prod. Cost</TableHead>
                        <TableHead className="text-right">Profit / Loss</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {sessions.map((session) => {
                        const sessionValid = session.products.filter((p) => p.status === 'valid');
                        const sessionInvalid = session.products.filter((p) => p.status === 'invalid');
                        const sessionTotal = session.products.reduce((s, p) => s + p.finalAmount, 0);

                        return (
                          <>
                            {/* ── CLIENT HEADER ROW ── */}
                            <TableRow
                              key={`session-${session.sessionKey}`}
                              className="bg-primary/5 border-t-2 border-primary/20"
                            >
                              <TableCell colSpan={11} className="py-2.5 px-4">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  {/* Left: client info */}
                                  <div className="flex items-center gap-3">
                                    <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                                      <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <span className="font-semibold text-sm">
                                        {session.clientName}
                                      </span>
                                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                        <span>{session.saleDate}</span>
                                        <span className="text-muted-foreground/40">|</span>
                                        <span>{session.voucherType}</span>
                                        <span className="text-muted-foreground/40">|</span>
                                        <span className="font-mono">{session.voucherNo}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {/* Right: session summary badges */}
                                  <div className="flex items-center gap-2 text-xs">
                                    {sessionValid.length > 0 && (
                                      <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        {sessionValid.length} valid
                                      </Badge>
                                    )}
                                    {sessionInvalid.length > 0 && (
                                      <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                                        <XCircle className="h-3 w-3 mr-1" />
                                        {sessionInvalid.length} invalid
                                      </Badge>
                                    )}
                                    <span className="font-semibold text-sm ml-1">
                                      {formatCurrency(sessionTotal)}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* ── PRODUCT ROWS ── */}
                            {session.products.map((row) => (
                              <TableRow
                                key={row.rowNumber}
                                className={`
                                  ${row.status === 'invalid' ? 'bg-red-50/50' : 'bg-white'}
                                  hover:bg-muted/30
                                `}
                              >
                                {/* Si No — indented to show it's a child */}
                                <TableCell className="text-muted-foreground text-xs pl-8">
                                  {row.siNo}
                                </TableCell>

                                {/* Product select */}
                                <TableCell>
                                  <Select
                                    value={row.productName}
                                    onValueChange={(v) =>
                                      handleUpdateRow(row.rowNumber, 'productName', v)
                                    }
                                  >
                                    <SelectTrigger className="w-48 h-8 text-sm">
                                      <SelectValue placeholder="Select product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {products.map((p) => (
                                        <SelectItem key={p.id} value={p.name}>
                                          {p.name}
                                          <span className="text-muted-foreground text-xs ml-1">
                                            ({p.availableQuantity} pkts)
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>

                                {/* Packets */}
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    value={row.numberOfPackets}
                                    onChange={(e) =>
                                      handleUpdateRow(row.rowNumber, 'numberOfPackets', parseFloat(e.target.value) || 0)
                                    }
                                    className="w-20 h-8 text-sm text-right ml-auto"
                                    min="0"
                                  />
                                </TableCell>

                                {/* Price per packet */}
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    value={row.sellingPricePerPacket}
                                    onChange={(e) =>
                                      handleUpdateRow(row.rowNumber, 'sellingPricePerPacket', parseFloat(e.target.value) || 0)
                                    }
                                    className="w-24 h-8 text-sm text-right ml-auto"
                                    min="0"
                                    step="0.01"
                                  />
                                </TableCell>

                                {/* Discount */}
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    value={row.discount}
                                    onChange={(e) =>
                                      handleUpdateRow(row.rowNumber, 'discount', parseFloat(e.target.value) || 0)
                                    }
                                    className="w-20 h-8 text-sm text-right ml-auto"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                  />
                                </TableCell>

                                {/* Final amount */}
                                <TableCell className="text-right font-medium text-sm">
                                  {formatCurrency(row.finalAmount)}
                                </TableCell>

                                {/* Production cost */}
                                <TableCell className="text-right text-sm text-muted-foreground">
                                  {formatCurrency(row.productionCost)}
                                </TableCell>

                                {/* Profit/Loss */}
                                <TableCell
                                  className={`text-right text-sm font-medium ${
                                    row.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  {formatCurrency(row.profitLoss)}
                                </TableCell>

                                {/* Type */}
                                <TableCell className="text-center">
                                  {row.isFree ? (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                                      FREE
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-gray-600 text-xs">
                                      PAID
                                    </Badge>
                                  )}
                                </TableCell>

                                {/* Status */}
                                <TableCell className="text-center">
                                  {row.status === 'valid' ? (
                                    <Badge className="bg-green-100 text-green-800 text-xs border-0">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />Valid
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-xs">
                                      <XCircle className="h-3 w-3 mr-1" />Invalid
                                    </Badge>
                                  )}
                                </TableCell>

                                {/* Errors */}
                                <TableCell className="max-w-[200px]">
                                  {row.errors?.map((err, i) => (
                                    <div key={i} className="text-xs text-red-600 flex items-start gap-1">
                                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                      <span>{err}</span>
                                    </div>
                                  ))}
                                </TableCell>
                              </TableRow>
                            ))}

                            {/* ── SESSION SUBTOTAL ROW ── */}
                            <TableRow
                              key={`subtotal-${session.sessionKey}`}
                              className="bg-muted/30 border-b-2 border-muted"
                            >
                              <TableCell colSpan={5} className="pl-8 py-2">
                                <span className="text-xs text-muted-foreground">
                                  {session.products.length} item(s) for {session.clientName}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-sm py-2">
                                {formatCurrency(sessionTotal)}
                              </TableCell>
                              <TableCell colSpan={5} />
                            </TableRow>
                          </>
                        );
                      })}

                      {/* ── GRAND TOTAL ROW ── */}
                      {sessions.length > 0 && (
                        <TableRow className="bg-muted/60 border-t-2 font-semibold">
                          <TableCell colSpan={5} className="py-3 pl-4 text-sm">
                            Grand Total — {sessions.length} client(s) · {validRows.length} valid records
                          </TableCell>
                          <TableCell className="text-right text-sm py-3">
                            {formatCurrency(totalAmount)}
                          </TableCell>
                          <TableCell colSpan={5} />
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Confirm dialog ── */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Import</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    You are about to import{' '}
                    <strong className="text-foreground">{validRows.length} records</strong> across{' '}
                    <strong className="text-foreground">{sessions.length} client(s)</strong>{' '}
                    totalling{' '}
                    <strong className="text-foreground">{formatCurrency(totalAmount)}</strong>.
                  </p>

                  {/* Per-client breakdown */}
                  <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                    {sessions.map((s) => {
                      const sValid = s.products.filter((p) => p.status === 'valid').length;
                      const sAmt = s.products
                        .filter((p) => p.status === 'valid')
                        .reduce((sum, p) => sum + p.finalAmount, 0);
                      return (
                        <div key={s.sessionKey} className="flex justify-between px-3 py-1.5 text-xs">
                          <span className="font-medium text-foreground truncate max-w-[55%]">
                            {s.clientName}
                          </span>
                          <span className="text-muted-foreground">
                            {sValid} item(s) · {formatCurrency(sAmt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {invalidRows.length > 0 && (
                    <p className="text-amber-600">
                      ⚠ {invalidRows.length} invalid record(s) will be skipped.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isImporting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmImport} disabled={isImporting}>
                {isImporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</>
                ) : 'Confirm Import'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}