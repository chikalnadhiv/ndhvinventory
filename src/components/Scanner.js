
"use client";
import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

export default function ScannerModal({ onClose, onScan }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScan(decodedText);
      },
      (error) => {
        // console.warn(error);
      }
    );

    return () => {
      try {
        scanner.clear();
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, [onScan]);

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Scan Barcode</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X />
            </button>
        </div>
        <div id="reader"></div>
      </div>
    </div>
  );
}
