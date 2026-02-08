'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
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
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Loader2,
} from 'lucide-react';

import { toast } from 'sonner';

import {
  ExcelUploadRow,
  validateExcelRow,
  formatCurrency,
  formatSaleDate,
} from '@/data/salesData';

interface SalesSession {
  date: string;
  name: string;
  voucherType: string;
  voucherNo: string;
  totalAmount: number;
  sales: Array<{
    product: string;
    pieces: number;
    pricePerPiece: number;
    totalPrice: number;
  }>;
}

interface ParsedSalesData {
  sessions: SalesSession[];
  flatData: ExcelUploadRow[];
}

interface FinishedProduct {
  id: string;
  name: string;
  formulationId: string;
  formulationName: string;
  batchId?: string | null;
  batchNumber?: string | null;
  availableQuantity: number; // in packets
  unit: 'packets';
  productionCostPerPacket: number;
  containerSize?: number | null;
  containerLabel?: string | null;
  createdAt: string;
  formulation: {
    name: string;
    baseQuantity: number;
    baseUnit: 'kg' | 'gm';
    status: 'active' | 'inactive';
  };
  batches?: any[];
}

/* -------------------- COMPONENT -------------------- */

export default function SalesUpload() {
  const router = useRouter();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSalesData | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/sales/products');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Failed to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const validRows = parsedData?.flatData.filter((r: ExcelUploadRow) => r.status === 'valid') || [];
  const invalidRows = parsedData?.flatData.filter((r: ExcelUploadRow) => r.status === 'invalid') || [];
  const totalAmount = validRows.reduce(
    (sum: number, row: ExcelUploadRow) => sum + row.finalAmount,
    0
  );

  /* -------------------- DRAG & DROP -------------------- */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  /* -------------------- FILE PROCESSING -------------------- */

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Invalid file type', {
        description: 'Please upload an Excel file (.xlsx or .xls)',
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/sales/parse', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse file');
      }

      const result = await response.json();
      
      console.log('Parsed data:', result.data);

      // Create ParsedSalesData object from the response
      const parsedSalesData: ParsedSalesData = {
        sessions: [], // We could reconstruct sessions if needed, but for now focus on flat data
        flatData: result.data
      };

      setUploadedFile(file);
      setParsedData(parsedSalesData);

      toast.success('File uploaded successfully', {
        description: `${file.name} has been processed with ${result.count} records`,
      });
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process file', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    toast.info('Template download started', {
      description: 'sales_template.xlsx will be downloaded',
    });
  };

  const handleUpdateRow = (rowNumber: number, field: keyof ExcelUploadRow, value: any) => {
    setParsedData(prevData => {
      if (!prevData) return prevData;
      
      return {
        ...prevData,
        flatData: prevData.flatData.map(row => {
          if (row.rowNumber === rowNumber) {
            const updatedRow = { ...row, [field]: value };
            
            // Recalculate values if editable fields change
            if (field === 'productName' || field === 'numberOfPackets' || field === 'sellingPricePerPacket' || field === 'discount') {
              const product = products.find((fp: FinishedProduct) => fp.name === updatedRow.productName);
              const productionCost = product ? (product.productionCostPerPacket * updatedRow.numberOfPackets) : 0;
              const finalAmount = (updatedRow.sellingPricePerPacket * updatedRow.numberOfPackets) - (updatedRow.discount * updatedRow.sellingPricePerPacket * updatedRow.numberOfPackets / 100);
              const isFree = finalAmount === 0;
              const profitLoss = isFree ? 0 : finalAmount - productionCost;
              
              updatedRow.productionCost = productionCost;
              updatedRow.finalAmount = finalAmount;
              updatedRow.profitLoss = profitLoss;
              updatedRow.isFree = isFree;
              updatedRow.availableQuantity = product?.availableQuantity || 0;
              updatedRow.id = product?.id || '';
              
              // Revalidate
              const errors: string[] = [];
              if (!updatedRow.productName) errors.push('Product name is required');
              if (!product) errors.push('Product not found');
              if (updatedRow.numberOfPackets <= 0) errors.push('Invalid number of packets');
              if (!isFree && updatedRow.sellingPricePerPacket <= 0) errors.push('Invalid selling price');
              if (product && updatedRow.numberOfPackets > product.availableQuantity) {
                errors.push(`Insufficient stock. Available: ${product.availableQuantity} ${product.unit}`);
              }
              
              updatedRow.status = errors.length > 0 ? 'invalid' : 'valid';
              updatedRow.errors = errors.length > 0 ? errors : undefined;
            }
            
            return updatedRow;
          }
          return row;
        })
      };
    });
  };

  const handleClearUpload = () => {
    setUploadedFile(null);
    setParsedData(null);
  };

  const handleConfirmImport = async () => {
    setShowConfirmDialog(false);
    setIsImporting(true);

    try {
      // Prepare sales data for bulk upload
      const salesData = validRows.map(row => ({
        productId: row.id,
        numberOfPackets: row.numberOfPackets,
        sellingPricePerPacket: row.sellingPricePerPacket,
        discount: row.discount,
        productionCost: row.productionCost,
        remarks: `Bulk import - ${uploadedFile?.name || 'Excel file'}`,
      }));

      const response = await fetch('/api/sales/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sales: salesData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import sales');
      }

      const result = await response.json();

      if (result.successCount > 0) {
        toast.success('Sales imported successfully', {
          description: `${result.successCount} sales records have been imported${result.errorCount > 0 ? ` (${result.errorCount} failed)` : ''}`,
        });
      }

      if (result.errorCount > 0) {
        toast.error('Some sales failed to import', {
          description: `${result.errorCount} records failed. Check console for details.`,
        });
        console.error('Bulk import errors:', result.errors);
      }

      router.push('/sales');
    } catch (error) {
      console.error('Error importing sales:', error);
      toast.error('Failed to import sales', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsImporting(false);
    }
  };

  /* -------------------- UI -------------------- */

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/sales')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Upload Sales</h1>
            <p className="text-sm text-muted-foreground">
              Import sales records from Excel
            </p>
          </div>
        </div>

        {/* Upload / Preview */}
        {!uploadedFile ? (
          <Card
            className={`border-2 border-dashed ${
              isDragOver ? 'border-primary bg-primary/5' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CardContent className="py-12 text-center">
              {isUploading ? (
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Uploading and processing Excel file...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-4" />
                  <p className="mb-4">Drag & drop Excel file or browse</p>
                  <label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id='file-input'
                      disabled={isUploading}
                    />
                    <Button variant="outline" onClick={() => document.getElementById('file-input')?.click()} disabled={isUploading}>
                      Choose File
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-4">
                      Supported formats: .xlsx, .xls
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Records</p>
                      <p className="text-2xl font-bold">{parsedData?.flatData.length || 0}</p>
                    </div>
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Valid Records</p>
                      <p className="text-2xl font-bold text-green-600">{validRows.length}</p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Invalid Records</p>
                      <p className="text-2xl font-bold text-red-600">{invalidRows.length}</p>
                    </div>
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Parsed Data Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Parsed Excel Data</CardTitle>
                    <CardDescription>
                      Review the parsed data from {uploadedFile.name}
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
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          `Import ${validRows.length} Valid Records`
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Si No</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Number of Packets</TableHead>
                        <TableHead>Production Cost</TableHead>
                        <TableHead>Selling Price/Packet</TableHead>
                        <TableHead>Discount (%)</TableHead>
                        <TableHead>Final Amount</TableHead>
                        <TableHead>Profit/Loss</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData?.flatData.map((row: ExcelUploadRow) => (
                        <TableRow key={row.rowNumber}>
                          <TableCell className="font-medium">{row.siNo}</TableCell>
                          <TableCell>
                            <Select
                              value={row.productName}
                              onValueChange={(value) => handleUpdateRow(row.rowNumber, 'productName', value)}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product: FinishedProduct) => (
                                  <SelectItem key={product.id} value={product.name}>
                                    {product.name} (Available: {product.availableQuantity} {product.unit})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.numberOfPackets}
                              onChange={(e) => handleUpdateRow(row.rowNumber, 'numberOfPackets', parseFloat(e.target.value) || 0)}
                              className="w-24"
                              min="0"
                            />
                          </TableCell>
                          <TableCell>{formatCurrency(row.productionCost)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.sellingPricePerPacket}
                              onChange={(e) => handleUpdateRow(row.rowNumber, 'sellingPricePerPacket', parseFloat(e.target.value) || 0)}
                              className="w-24"
                              min="0"
                              step="0.01"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.discount}
                              onChange={(e) => handleUpdateRow(row.rowNumber, 'discount', parseFloat(e.target.value) || 0)}
                              className="w-20"
                              min="0"
                              max="100"
                              step="0.01"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(row.finalAmount)}</TableCell>
                          <TableCell className={row.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(row.profitLoss)}
                          </TableCell>
                          <TableCell>
                            {row.isFree ? (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                FREE
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600">
                                PAID
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.status === 'valid' ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Valid
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Invalid
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.errors && row.errors.length > 0 && (
                              <div className="space-y-1">
                                {row.errors.map((error: string, index: number) => (
                                  <div key={index} className="text-xs text-red-600 flex items-center">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    {error}
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Confirm Dialog */}
        <AlertDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Import</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to import {validRows.length} records totaling{' '}
                {formatCurrency(totalAmount)}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isImporting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Confirm Import'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
