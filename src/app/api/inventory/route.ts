import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

export const maxDuration = 60; // Allow 60 seconds max execution time
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.inventoryItem.findMany({
    orderBy: { updatedAt: 'desc' }
  });
  return NextResponse.json(items);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Delete all inventory items
    await prisma.inventoryItem.deleteMany();
    return NextResponse.json({ message: "All inventory items cleared" });
  } catch (error) {
    console.error("Clear database failed:", error);
    return NextResponse.json({ error: "Failed to clear database" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { items } = body;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  try {
    // Pure batch insert - no deletion logic here anymore
    const result = await prisma.inventoryItem.createMany({
      data: items.map((item: any) => ({
          kd_brg: item.kd_brg ? String(item.kd_brg) : null,
          barcode: item.barcode ? String(item.barcode) : null,
          nm_brg: item.nm_brg ? String(item.nm_brg) : "Unknown Item",
          satuan: item.satuan ? String(item.satuan) : null,
          hrg_beli: isNaN(Number(item.hrg_beli)) ? 0 : Number(item.hrg_beli),
          qty: isNaN(Number(item.qty)) ? 0 : Number(item.qty),
          gol1: isNaN(Number(item.gol1)) ? 0 : Number(item.gol1),
          golongan: item.golongan ? String(item.golongan) : null,
          sub_gol: item.sub_gol ? String(item.sub_gol) : null,
          qty_min: isNaN(Number(item.qty_min)) ? 0 : Number(item.qty_min),
          qty_max: isNaN(Number(item.qty_max)) ? 0 : Number(item.qty_max),
          kode_supl: item.kode_supl ? String(item.kode_supl) : null, // Fix potential Excel date/number issue
          imageUrl: item.imageUrl ? String(item.imageUrl) : null,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ 
      count: result.count,
      message: "Batch inserted successfully"
    });
  } catch (error: any) { // Type as any to access properties
    // Log the first item of the failing batch to debug data issues
    console.error("Failed Batch First Item Sample:", items[0]);
    
    console.error("Import Batch Error Detail:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    
    // Return the specific error message to the client for debugging
    return NextResponse.json({ 
      error: `Import failed: ${error.message || "Unknown error"}`,
      details: error.code ? `Code: ${error.code}` : undefined
    }, { status: 500 });
  }
}
