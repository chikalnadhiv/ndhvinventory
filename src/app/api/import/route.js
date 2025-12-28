
import { NextResponse } from 'next/server';
import { getItems, saveItems } from '@/utils/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  const { items: newItems } = await request.json();
  const currentItems = getItems();
  
  const formattedItems = newItems.map(item => ({
    id: uuidv4(),
    name: item.name || item.Name || 'Unknown',
    sku: item.sku || item.SKU || item.barcode || 'No SKU',
    price: item.price || item.Price || 0,
    stock: item.stock || item.Stock || 0,
    category: item.category || item.Category || 'General',
    timestamp: new Date().toISOString()
  }));

  const updatedItems = [...currentItems, ...formattedItems];
  saveItems(updatedItems);
  
  return NextResponse.json({ success: true, count: formattedItems.length });
}
