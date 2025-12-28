
"use client";
import { utils, writeFile } from 'xlsx';
import { Download, Upload } from 'lucide-react';

export default function ActionBar({ onImport, items }) {
    const handleExport = () => {
        // Filter out internal fields if needed, or just dump all
        const dataToExport = items.map(({ id, timestamp, ...rest }) => rest);
        const ws = utils.json_to_sheet(dataToExport);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Inventory");
        writeFile(wb, "inventory_export.xlsx");
    };

    const triggerImport = (e) => {
        const file = e.target.files[0];
        if(file) onImport(file);
    };

    return (
        <div style={{ display: 'flex', gap: '1rem' }}>
            <label className="btn btn-primary">
                <Upload size={18} /> Import
                <input type="file" onChange={triggerImport} accept=".xlsx, .xls" style={{display:'none'}} />
            </label>
            <button className="btn btn-success" onClick={handleExport}>
                <Download size={18} /> Export
            </button>
        </div>
    )
}
