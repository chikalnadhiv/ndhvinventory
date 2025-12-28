"use client";

import { useState, useEffect, useCallback } from 'react';

export interface StockOpnameRecord {
  id?: string;
  inventoryId: string;
  kd_brg: string | null;
  barcode: string | null;
  nm_brg: string;
  systemQty: number;
  physicalQty: number;
  difference: number;
  satuan: string | null;
  hrg_beli: number;
  rackNo: string;
  userName: string;
  division: string | null;
  createdAt?: string;
}

export function useStockOpname() {
  const [records, setRecords] = useState<StockOpnameRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stock-opname');
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch stock opname records:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const addRecord = async (record: Omit<StockOpnameRecord, 'id' | 'createdAt'>) => {
    try {
      const response = await fetch('/api/stock-opname', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(record),
      });

      if (response.ok) {
        const newRecord = await response.json();
        setRecords(prev => [newRecord, ...prev]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to add stock opname record:', error);
      return false;
    }
  };

  const updateRecord = async (id: string, physicalQty: number) => {
    try {
      const record = records.find(r => r.id === id);
      if (!record) return false;

      const response = await fetch(`/api/stock-opname/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          physicalQty,
          difference: physicalQty - record.systemQty
        }),
      });

      if (response.ok) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, physicalQty, difference: physicalQty - record.systemQty } : r));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update stock opname record:', error);
      return false;
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const response = await fetch(`/api/stock-opname/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRecords(prev => prev.filter(r => r.id !== id));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete stock opname record:', error);
      return false;
    }
  };

  const clearHistory = async () => {
    try {
      const response = await fetch('/api/stock-opname', {
        method: 'DELETE',
      });

      if (response.ok) {
        setRecords([]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to clear stock opname history:', error);
      return false;
    }
  };

  return {
    records,
    isLoading,
    addRecord,
    updateRecord,
    deleteRecord,
    clearHistory,
    refreshRecords: fetchRecords
  };
}
