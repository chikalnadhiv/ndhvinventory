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

  // Batch import with robust flow: Backup -> Clear -> Insert
  const saveItemsInBatches = async (
    newItems: InventoryItem[], 
    onProgress?: (current: number, total: number) => void
  ) => {
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(newItems.length / BATCH_SIZE);
    
    console.log(`Starting smart batch import for ${newItems.length} items...`);
    
    try {
      // 1. BACKUP IMAGES
      if (onProgress) onProgress(0, totalBatches); // Initial 0%
      console.log("Fetching existing images for backup...");
      const imagesResponse = await fetch('/api/inventory/images');
      if (!imagesResponse.ok) throw new Error("Failed to backup images");
      
      const existingImages = await imagesResponse.json();
      const imageMap = new Map<string, string>();
      existingImages.forEach((item: any) => {
        if (item.imageUrl) {
          if (item.kd_brg) imageMap.set(item.kd_brg, item.imageUrl);
          if (item.barcode) imageMap.set(item.barcode, item.imageUrl);
        }
      });
      console.log(`Backed up ${imageMap.size} images locally.`);

      // 2. CLEAR DATABASE
      console.log("Clearing existing database...");
      const clearResponse = await fetch('/api/inventory', { method: 'DELETE' });
      if (!clearResponse.ok) throw new Error("Failed to clear database");
      console.log("Database cleared successfully.");

      // 3. MERGE IMAGES & START BATCH IMPORT
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, newItems.length);
        
        // Prepare batch with restored images
        const batch = newItems.slice(start, end).map(item => {
          let imageUrl = null;
          // Restore image logic
          if (item.kd_brg && imageMap.has(item.kd_brg)) {
            imageUrl = imageMap.get(item.kd_brg);
          } else if (item.barcode && imageMap.has(item.barcode)) {
            imageUrl = imageMap.get(item.barcode);
          }
          return { ...item, imageUrl };
        });
        
        console.log(`Uploading batch ${i + 1}/${totalBatches}`);
        
        const response = await fetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch }) // No need for isFirstBatch flag anymore
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Batch ${i + 1} failed: ${response.status} ${errorText}`);
        }
        
        // Update progress
        if (onProgress) {
          onProgress(i + 1, totalBatches);
        }
        
        // Very small delay just to breathe
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
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
