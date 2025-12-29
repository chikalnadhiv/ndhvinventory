import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

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
          kd_brg: item.kd_brg || null,
          barcode: item.barcode || null,
          nm_brg: item.nm_brg || "Unknown Item",
          satuan: item.satuan || null,
          hrg_beli: Number(item.hrg_beli) || 0,
          qty: Number(item.qty) || 0,
          gol1: Number(item.gol1) || 0,
          golongan: item.golongan || null,
          sub_gol: item.sub_gol || null,
          qty_min: Number(item.qty_min) || 0,
          qty_max: Number(item.qty_max) || 0,
          kode_supl: item.kode_supl || null,
          imageUrl: item.imageUrl || null, // Image URL must be provided by frontend now
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ 
      count: result.count,
      message: "Batch inserted successfully"
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Failed to import items" }, { status: 500 });
  }
}
