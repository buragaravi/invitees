import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateSmartPDF = (guests: Record<string, any>[], stats: Record<string, number>) => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo-600

    // Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('INVITEQR', 15, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date().toLocaleString('en-IN');
    doc.text(`Generated on: ${dateStr}`, 15, 28);
    doc.text('PREMIUM GUEST MANAGEMENT REPORT', 15, 34);

    // Analytics Summary
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('EVENT ANALYTICS', 15, 55);

    // Stats Cards
    const cardWidth = 45;
    const cards = [
        {
            label: 'TOTAL GUESTS',
            value: stats.total.toString(),
            x: 15,
            bg: [239, 246, 255] as [number, number, number],
            text: [30, 64, 175] as [number, number, number]
        },
        {
            label: 'ATTENDED',
            value: stats.attended.toString(),
            x: 15 + cardWidth + 2.5,
            bg: [236, 253, 245] as [number, number, number],
            text: [6, 95, 70] as [number, number, number]
        },
        {
            label: 'UNATTENDED',
            value: (stats.total - stats.attended).toString(),
            x: 15 + (cardWidth + 2.5) * 2,
            bg: [254, 242, 242] as [number, number, number],
            text: [153, 27, 27] as [number, number, number]
        },
        {
            label: 'FOOD TAKEN',
            value: stats.foodTaken.toString(),
            x: 15 + (cardWidth + 2.5) * 3,
            bg: [255, 247, 237] as [number, number, number],
            text: [154, 52, 18] as [number, number, number]
        }
    ];

    cards.forEach(card => {
        // Draw card background
        doc.setFillColor(card.bg[0], card.bg[1], card.bg[2]);
        doc.rect(card.x, 60, cardWidth, 25, 'F');

        // Label shadow/accent line
        doc.setFillColor(card.text[0], card.text[1], card.text[2]);
        doc.rect(card.x, 60, 2, 25, 'F');

        // Text
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(card.label, card.x + 6, 68);

        doc.setTextColor(card.text[0], card.text[1], card.text[2]);
        doc.setFontSize(16);
        doc.text(card.value, card.x + 6, 78);
    });

    // Effectiveness Summary
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const efficiency = ((stats.foodTaken / (stats.attended || 1)) * 100).toFixed(1);
    doc.text(`Food Efficiency: ${efficiency}% of attended guests received food.`, 15, 92);

    // Formatting check-in time (Date + Time)
    const formatCheckIn = (time: string | Date | undefined) => {
        if (!time) return '-';
        return new Date(time).toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Table 1: Attended Guests
    const attended = guests.filter(g => g.attendanceStatus === 'ATTENDED');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(12);
    doc.text(`ATTENDED GUESTS (${attended.length})`, 15, 105);

    autoTable(doc, {
        startY: 110,
        head: [['Name', 'Contact No', 'Area', 'Check-in Time', 'Food Status']],
        body: attended.map(g => [
            g.name,
            g.phoneNumber || '-',
            g.area || '-',
            formatCheckIn(g.checkInTime),
            g.foodStatus === 'TAKEN' ? 'TAKEN' : 'NOT TAKEN'
        ]),
        headStyles: { fillColor: primaryColor, textColor: 255 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        styles: { fontSize: 7.5 },
        margin: { left: 15, right: 15 }
    });

    // Table 2: Unattended Guests (on new page if needed)
    const unattended = guests.filter(g => g.attendanceStatus !== 'ATTENDED');
    const finalY = ((doc as any).lastAutoTable?.finalY || 110) + 20;

    // Check if new page is needed
    let startY = finalY;
    if (startY > 250) {
        doc.addPage();
        startY = 20;
    }

    doc.setTextColor(220, 38, 38); // Red-600
    doc.setFontSize(12);
    doc.text(`UNATTENDED GUESTS (${unattended.length})`, 15, startY);

    autoTable(doc, {
        startY: startY + 5,
        head: [['Name', 'Contact No', 'Area', 'Remarks']],
        body: unattended.map(g => [
            g.name,
            g.phoneNumber || '-',
            g.area || '-',
            g.remarks || '-'
        ]),
        headStyles: { fillColor: [220, 38, 38], textColor: 255 },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        styles: { fontSize: 8 },
        margin: { left: 15, right: 15 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages() as number;
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`InviteQR_Report_${new Date().getTime()}.pdf`);
};
