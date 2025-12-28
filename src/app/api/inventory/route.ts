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

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { items } = body;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Smart import: Preserve existing images
  try {
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. BACKUP: Fetch existing images before deletion
      const existingItems = await tx.inventoryItem.findMany({
        select: {
          kd_brg: true,
          barcode: true,
          imageUrl: true
        }
      });

      // Create a map: kd_brg → imageUrl (and barcode as fallback)
      const imageMap = new Map<string, string>();
      existingItems.forEach((item: any) => {
        if (item.imageUrl) {
          if (item.kd_brg) imageMap.set(item.kd_brg, item.imageUrl);
          if (item.barcode) imageMap.set(item.barcode, item.imageUrl);
        }
      });

      console.log(`[Import] Found ${imageMap.size} existing images to preserve`);

      // 2. Delete all existing items
      await tx.inventoryItem.deleteMany();
      
      // 3. Map and insert new items WITH preserved images
      const data = items.map((item: any) => {
        const kd_brg = item.kd_brg || null;
        const barcode = item.barcode || null;
        
        // Try to restore image from backup
        let imageUrl = null;
        if (kd_brg && imageMap.has(kd_brg)) {
          imageUrl = imageMap.get(kd_brg)!;
        } else if (barcode && imageMap.has(barcode)) {
          imageUrl = imageMap.get(barcode)!;
        }

        return {
          kd_brg,
          barcode,
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
          imageUrl, // ✅ Restored image
        };
      });

      const imagesPreserved = data.filter(item => item.imageUrl).length;
      console.log(`[Import] Preserved ${imagesPreserved} images in new data`);

      // 4. Batch insert with preserved images
      return await tx.inventoryItem.createMany({
        data,
      });
    });

    return NextResponse.json({ 
      count: result.count,
      message: "Import successful with image preservation"
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Failed to import items" }, { status: 500 });
  }
}
