/**
 * Utility to generate ZPL (Zebra Programming Language) strings for Zebra ZD230.
 * Designed for 2x1 inch or 4x2 inch label stock.
 */

export const generateZPL = (guest: { name: string; uniqueId: string }) => {
    // 203 DPI conversion for 20mm(160 dots) x 45mm(360 dots)
    const zpl = `
^XA
^PW160
^LL360
^LH0,0

^BY2,2,80
^FO10,40
^BCN,80,Y,N,N
^FD${guest.uniqueId}^FS

^XZ
`.trim();

    return zpl;
};

/**
 * Downloads ZPL as a file for manual printing or helper-based processing.
 */
export const downloadZPLFile = (guestName: string, zpl: string) => {
    const blob = new Blob([zpl], { type: "application/zpl" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `label_${guestName.replace(/\s+/g, '_')}.zpl`;
    a.click();

    URL.revokeObjectURL(url);
};
