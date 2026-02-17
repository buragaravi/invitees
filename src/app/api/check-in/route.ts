import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/connect';
import Guest from '@/lib/db/models/Guest';

export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const body = await req.json();
        const rawId = body.uniqueId;

        if (!rawId) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        const idString = String(rawId).toUpperCase().trim();
        console.log(`Automatic Scan attempt for ID:`, idString);

        const guest = await Guest.findOne({ uniqueId: idString });

        if (!guest) {
            console.warn('Guest not found for ID:', idString);
            return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
        }

        // 1. If NOT Checked In -> Do Attendance
        if (guest.attendanceStatus !== 'ATTENDED') {
            guest.attendanceStatus = 'ATTENDED';
            guest.checkInTime = new Date();
            await guest.save();

            console.log('Auto Check-in success for:', guest.name);
            return NextResponse.json({
                success: true,
                message: 'Check-in successful',
                guest
            });
        }

        // 2. If Checked In but NO Food -> Try Food Session
        if (guest.foodStatus !== 'TAKEN') {
            // Enforce 2 minute margin (120000 ms)
            const checkInTime = guest.checkInTime ? new Date(guest.checkInTime).getTime() : 0;
            const currentTime = new Date().getTime();
            const timeDiffRaw = currentTime - checkInTime;
            const timeDiffMins = Math.floor(timeDiffRaw / 60000);
            const timeDiffSecs = Math.floor((timeDiffRaw % 60000) / 1000);

            if (timeDiffRaw < 120000) {
                return NextResponse.json({
                    success: false,
                    error: 'Wait 2 Mins',
                    details: `Checked in ${timeDiffMins}m ${timeDiffSecs}s ago. Please wait 2 mins for food.`
                });
            }

            guest.foodStatus = 'TAKEN';
            guest.foodTime = new Date();
            await guest.save();

            console.log('Auto Food Issue success for:', guest.name);
            return NextResponse.json({
                success: true,
                message: 'Food issued successfully',
                guest
            });
        }

        // 3. Both already done
        return NextResponse.json({
            success: false,
            error: 'Already Processed',
            details: 'Guest has already checked in and taken food.',
            guest
        });
    } catch (error: any) {
        console.error('Check-in error:', error);
        return NextResponse.json({
            error: 'Server error',
            details: error.message
        }, { status: 500 });
    }
}
