import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ACTIVITIES_FILE = path.join(process.cwd(), 'activities.json');

// Ensure file exists
if (!fs.existsSync(ACTIVITIES_FILE)) {
  fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify([]));
}

export async function GET() {
  try {
    const data = fs.readFileSync(ACTIVITIES_FILE, 'utf8');
    const activities = JSON.parse(data);
    // Return last 20 activities
    return NextResponse.json(activities.slice(0, 20));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, user, rack, message } = body;

    const newActivity = {
      id: Date.now().toString(),
      type,
      user,
      rack,
      message,
      createdAt: new Date().toISOString()
    };

    const data = fs.readFileSync(ACTIVITIES_FILE, 'utf8');
    const activities = JSON.parse(data);
    
    // Add to beginning
    activities.unshift(newActivity);
    
    // Keep only last 50
    const limitedActivities = activities.slice(0, 50);
    
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(limitedActivities, null, 2));

    return NextResponse.json(newActivity);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}
