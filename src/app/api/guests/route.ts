import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/connect';
import Guest from '@/lib/db/models/Guest';

export async function GET() {
    try {
        await connectDB();

        const guests = await Guest.find().sort({ createdAt: -1 }).limit(100);
        const stats = {
            total: await Guest.countDocuments(),
            attended: await Guest.countDocuments({ attendanceStatus: 'ATTENDED' }),
            invited: await Guest.countDocuments({ invitedStatus: 'INVITED' }),
            foodTaken: await Guest.countDocuments({ foodStatus: 'TAKEN' }),
        };

        return NextResponse.json({ guests, stats });
    } catch (error) {
        console.error('Check-in error:', error);
        return NextResponse.json({
            error: 'Server error',
            details: (error as any).message
        }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (id) {
            await Guest.findByIdAndDelete(id);
            return NextResponse.json({ success: true, message: 'Guest deleted' });
        } else {
            // Delete All
            await Guest.deleteMany({});
            return NextResponse.json({ success: true, message: 'All guests deleted' });
        }
    } catch (error) {
        console.error('Deletion error:', error);
        return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const updates = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        const guest = await Guest.findByIdAndUpdate(id, updates, { new: true });
        return NextResponse.json({ success: true, guest });
    } catch (error) {
        console.error('Update failed:', error);
        return NextResponse.json({
            error: 'Update failed',
            details: (error as any).message
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await connectDB();
        const data = await req.json();

        // Generate a unique ID if not provided (for manual entry)
        if (!data.uniqueId) {
            const { generateGuestId } = await import('@/lib/excel-processor');
            data.uniqueId = generateGuestId();
        }

        const guest = await Guest.create(data);
        return NextResponse.json({ success: true, guest });
    } catch (error) {
        console.error('Creation failed:', error);
        return NextResponse.json({
            error: 'Creation failed',
            details: (error as any).code === 11000 ? 'Guest with this ID already exists' : (error as any).message
        }, { status: 500 });
    }
}
