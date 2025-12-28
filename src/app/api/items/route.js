
import { NextResponse } from 'next/server';
import { getItems, saveItems } from '@/utils/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const items = getItems();
  return NextResponse.json(items);
}

export async function POST(request) {
  const body = await request.json();
  const items = getItems();
  
  const newItem = {
    id: uuidv4(),
    ...body,
    timestamp: new Date().toISOString()
  };
  
  items.push(newItem);
  saveItems(items);
  
  return NextResponse.json(newItem);
}
