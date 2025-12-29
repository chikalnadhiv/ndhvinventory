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

  // Save multiple items (Import) - Legacy method for small imports
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
        } else {
            throw new Error(`Server error: ${response.status}`);
        }
    } catch (error) {
        console.error("Failed to save items to API:", error);
        throw error;
    }
  };

  // Batch import for large datasets
  const saveItemsInBatches = async (
    newItems: InventoryItem[], 
    onProgress?: (current: number, total: number) => void
  ) => {
    const BATCH_SIZE = 100; // Reduced from 500 for Vercel timeout limits
    const totalBatches = Math.ceil(newItems.length / BATCH_SIZE);
    
    console.log(`Starting batch import: ${newItems.length} items in ${totalBatches} batches`);
    
    try {
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, newItems.length);
        const batch = newItems.slice(start, end);
        const isFirstBatch = i === 0; // Only first batch should delete existing data
        
        console.log(`Uploading batch ${i + 1}/${totalBatches} (${batch.length} items)${isFirstBatch ? ' - FIRST BATCH' : ''}`);
        
        const response = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            items: batch,
            isFirstBatch // Tell API whether to delete existing data
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Batch ${i + 1} failed: ${response.status} ${errorText}`);
        }
        
        // Update progress
        if (onProgress) {
          onProgress(i + 1, totalBatches);
        }
        
        // Small delay between batches to avoid overwhelming the server
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 200ms
        }
      }
      
      // Refresh data after all batches complete
      await refreshItems();
      console.log('Batch import completed successfully');
      
    } catch (error) {
      console.error("Batch import failed:", error);
      throw error;
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

  return { items, saveItems, saveItemsInBatches, updateItemQty, isLoaded, refreshItems };
};
