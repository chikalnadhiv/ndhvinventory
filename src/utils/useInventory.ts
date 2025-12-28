import { useState, useEffect } from 'react';
import { InventoryItem } from './excelHandler';

export const useInventory = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from API on mount
  useEffect(() => {
    const loadData = async () => {
        try {
            const response = await fetch('/api/inventory');
            if (response.ok) {
                const savedItems = await response.json();
                setItems(savedItems || []);
            }
        } catch (error) {
            console.error("Failed to load items from API:", error);
        } finally {
            setIsLoaded(true);
        }
    };
    loadData();
  }, []);

  // Sync function to refresh data
  const refreshItems = async () => {
    try {
        const response = await fetch('/api/inventory');
        if (response.ok) {
            const savedItems = await response.json();
            setItems(savedItems || []);
        }
    } catch (error) {
        console.error("Failed to refresh items:", error);
    }
  };

  // Save multiple items (Import)
  const saveItems = async (newItems: InventoryItem[]) => {
    // Note: This replaces/adds items via API
    try {
        const response = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: newItems })
        });
        if (response.ok) {
            await refreshItems();
        }
    } catch (error) {
        console.error("Failed to save items to API:", error);
    }
  };

  // Update single item qty (Opname)
  const updateItemQty = async (id: string, newQty: number) => {
    try {
        const response = await fetch(`/api/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qty: newQty })
        });
        if (response.ok) {
            setItems(prev => prev.map(item => item.id === id ? { ...item, qty: newQty } : item));
            return true;
        }
    } catch (error) {
        console.error("Failed to update qty via API:", error);
    }
    return false;
  };

  return { items, saveItems, updateItemQty, isLoaded, refreshItems };
};
