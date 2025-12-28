import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  
  try {
    const body = await req.json();
    console.log(`[API] Attempting update for ${id}. Body fields:`, Object.keys(body));
    
    // BUILD CLEAN DATA OBJECT - EXPLICITLY NO 'ID' FIELD
    const updateData: any = {};
    
    if (body.kd_brg !== undefined) updateData.kd_brg = body.kd_brg;
    if (body.barcode !== undefined) updateData.barcode = body.barcode;
    if (body.nm_brg !== undefined) updateData.nm_brg = body.nm_brg;
    if (body.satuan !== undefined) updateData.satuan = body.satuan;
    if (body.golongan !== undefined) updateData.golongan = body.golongan;
    
    // Image handling
    if (body.imageUrl !== undefined) {
      console.log(`[API] Received image data (${body.imageUrl?.length || 0} chars)`);
      updateData.imageUrl = body.imageUrl;
    }

    // Numeric fields - strictly convert to numbers
    if (body.qty !== undefined) updateData.qty = parseInt(body.qty) || 0;
    if (body.gol1 !== undefined) updateData.gol1 = parseFloat(body.gol1) || 0;
    if (body.hrg_beli !== undefined) updateData.hrg_beli = parseFloat(body.hrg_beli) || 0;
    if (body.qty_min !== undefined) updateData.qty_min = parseInt(body.qty_min) || 0;

    console.log(`[API] Final update data fields:`, Object.keys(updateData));

    const updated = await prisma.inventoryItem.update({
      where: { id: id },
      data: updateData
    });

    console.log(`[API] Successfully updated ${id}`);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH Inventory Error:", error);
    
    // Specific error handling for Prisma
    if (error.code === 'P2002') {
       return NextResponse.json({ error: "Duplicate value violates unique constraint" }, { status: 400 });
    }

    return NextResponse.json({ 
      error: error.message || "Database Error",
      code: error.code,
      meta: error.meta
    }, { status: 500 });
  }
}
