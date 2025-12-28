import * as XLSX from 'xlsx';

export interface InventoryItem {
  id: string;
  kd_brg: string;      // Kd Brg
  barcode: string;     // Barcode
  nm_brg: string;      // Nm Brg
  satuan: string;      // Satuan
  hrg_beli: number;    // Hrg Beli
  qty: number;         // Qty
  gol1: number;        // Gol1 (Selling Price usually)
  golongan: string;    // Golongan
  sub_gol: string;     // Sub Gol
  qty_min: number;     // Qty Min
  qty_max: number;     // Qty Max
  kode_supl: string;   // Kode Supl
  imageUrl?: string;   // Product Image URL
}

// Headers mapping based on User's image
const EXCEL_HEADERS = [
  "Kd Brg", "Barcode", "Nm Brg", "Satuan", "Hrg Beli", 
  "Qty", "Gol1", "Golongan", "Sub Gol", "Qty Min", "Qty Max", "Kode Supl"
];

export const exportToExcel = (data: InventoryItem[], filename: string = 'inventory.xlsx') => {
  // Map data to array of arrays or array of objects with correct keys
  const excelData = data.map(item => ({
    "Kd Brg": item.kd_brg,
    "Barcode": item.barcode,
    "Nm Brg": item.nm_brg,
    "Satuan": item.satuan,
    "Hrg Beli": item.hrg_beli,
    "Qty": item.qty,
    "Gol1": item.gol1,
    "Golongan": item.golongan,
    "Sub Gol": item.sub_gol,
    "Qty Min": item.qty_min,
    "Qty Max": item.qty_max,
    "Kode Supl": item.kode_supl
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  XLSX.writeFile(workbook, filename, { compression: true });
};

export const importFromExcel = async (file: File): Promise<InventoryItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        // Transform raw Excel data to InventoryItem
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: InventoryItem[] = json.map((row: any, index: number) => ({
          id: `IMPORTED-${Date.now()}-${index}`,
          kd_brg: row["Kd Brg"] || "",
          barcode: row["Barcode"] || "",
          nm_brg: row["Nm Brg"] || "Unknown Item",
          satuan: row["Satuan"] || "pcs",
          hrg_beli: Number(row["Hrg Beli"]) || 0,
          qty: Number(row["Qty"]) || 0,
          gol1: Number(row["Gol1"]) || 0,
          golongan: row["Golongan"] || "General",
          sub_gol: row["Sub Gol"] || "",
          qty_min: Number(row["Qty Min"]) || 0,
          qty_max: Number(row["Qty Max"]) || 0,
          kode_supl: row["Kode Supl"] || ""
        }));

        resolve(items);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
