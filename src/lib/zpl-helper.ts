/**
 * Utility to generate ZPL (Zebra Programming Language) strings for Zebra ZD230.
 * Designed for 2x1 inch or 4x2 inch label stock.
 */

export const generateZPL = (guest: { name: string; uniqueId: string }) => {
    // Custom template provided by the user for precise printer calibration
    const zpl = `
^XA
^LH0,0
^LS0
^LT0

^BY3,3,100
^FO0,0^BCN,100,Y,N,N^FD${guest.uniqueId}^FS

^CF0,20,20
^XZ
`.trim();

    return zpl;
};

/**
 * Downloads ZPL as a file for manual printing or helper-based processing.
 */
export const downloadZPLFile = (guestName: string, zpl: string) => {
    const blob = new Blob([zpl], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `label_${guestName.replace(/\s+/g, '_')}.lbl`;
    a.click();

    URL.revokeObjectURL(url);
};
