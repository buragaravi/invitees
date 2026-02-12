"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    Upload, Search, QrCode, UserCheck, Users, Download,
    ShieldCheck, Trash2, AlertTriangle, Sun, Moon, Edit3, X, Save,
    Printer, UserPlus, Loader2
} from 'lucide-react';
import IDCard from '@/components/IDCard';
import Barcode from '@/components/Barcode';
import { toPng } from 'html-to-image';
import { useTheme } from '@/components/ThemeProvider';
import { generateSmartPDF } from '@/lib/pdf-export';
import { generateZPL, downloadZPLFile } from '@/lib/zpl-helper';
import JsBarcode from 'jsbarcode';

interface DashboardGuest {
    _id: string;
    name: string;
    phoneNumber?: string;
    area?: string;
    remarks?: string;
    attendanceStatus: 'ATTENDED' | 'NOT ATTENDED';
    invitedStatus: 'INVITED' | 'NOT INVITED';
    checkInTime?: any;
    uniqueId: string;
}

export default function Dashboard() {
    const { theme, toggleTheme } = useTheme();
    const [file, setFile] = useState<File | null>(null);
    const [guests, setGuests] = useState<DashboardGuest[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stats, setStats] = useState({ total: 0, attended: 0, invited: 0 });
    const [searchTerm, setSearchTerm] = useState('');

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGuest, setEditingGuest] = useState<DashboardGuest | null>(null);
    // Label Preview State
    const [previewingLabel, setPreviewingLabel] = useState<DashboardGuest | null>(null);

    // Add Guest State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        name: '',
        phoneNumber: '',
        area: '',
        remarks: '',
        invitedStatus: 'NOT INVITED' as 'INVITED' | 'NOT INVITED'
    });

    const [editForm, setEditForm] = useState({
        name: '',
        phoneNumber: '',
        area: '',
        remarks: '',
        invitedStatus: 'NOT INVITED' as 'INVITED' | 'NOT INVITED'
    });

    // Generic Feedback State
    const [isHardwareScannerDetected, setIsHardwareScannerDetected] = useState(false);

    // Audio Refs for Pre-loading
    const successAudio = useRef<HTMLAudioElement | null>(null);
    const errorAudio = useRef<HTMLAudioElement | null>(null);
    const isAudioUnlocked = useRef(false);

    useEffect(() => {
        successAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        errorAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2873/2873-preview.mp3');

        const unlock = () => {
            if (isAudioUnlocked.current) return;
            [successAudio.current, errorAudio.current].forEach(a => {
                if (a) {
                    a.muted = true;
                    a.play().then(() => {
                        a.pause();
                        a.muted = false;
                    }).catch(() => { });
                }
            });
            isAudioUnlocked.current = true;
            window.removeEventListener('click', unlock);
        };

        window.addEventListener('click', unlock);
        return () => window.removeEventListener('click', unlock);
    }, []);

    const [toast, setToast] = useState<{ show: boolean, name: string, message: string, type: 'success' | 'error' }>({
        show: false,
        name: '',
        message: '',
        type: 'success'
    });

    // Confirm Dialog State
    const [confirmDialog, setConfirmDialog] = useState<{
        show: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'warning';
    }>({
        show: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'danger'
    });

    const showToast = (name: string, message: string, type: 'success' | 'error') => {
        setToast({ show: true, name, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
    };

    const fetchGuests = async () => {
        try {
            const res = await fetch('/api/guests');
            const data = await res.json();
            setGuests(data.guests || []);
            setStats(data.stats || { total: 0, attended: 0, invited: 0 });
        } catch (err) {
            console.error('Failed to fetch guests', err);
        }
    };

    useEffect(() => {
        fetchGuests();
    }, []);

    const deleteGuest = (id: string, name: string) => {
        setConfirmDialog({
            show: true,
            title: 'Delete Guest',
            message: `Are you sure you want to delete ${name}? This will permanently remove their record and check-in history.`,
            type: 'danger',
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    const res = await fetch(`/api/guests?id=${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        showToast(name, 'Guest deleted successfully', 'success');
                        fetchGuests();
                    } else {
                        showToast('Error', 'Failed to delete guest', 'error');
                    }
                } catch (err) {
                    console.error('Delete failed', err);
                    showToast('System Error', 'Delete operation failed', 'error');
                } finally {
                    setIsSubmitting(false);
                    setConfirmDialog(prev => ({ ...prev, show: false }));
                }
            }
        });
    };

    const deleteAllGuests = () => {
        setConfirmDialog({
            show: true,
            title: 'CRITICAL: Delete All Guests',
            message: 'This will permanently remove EVERY guest record. This action is extremely dangerous and cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    const res = await fetch('/api/guests', { method: 'DELETE' });
                    if (res.ok) {
                        showToast('Bulk Delete', 'All guest records removed', 'success');
                        fetchGuests();
                    } else {
                        showToast('Error', 'Failed to delete all guests', 'error');
                    }
                } catch (err) {
                    console.error('Bulk delete failed', err);
                    showToast('System Error', 'Bulk delete failed', 'error');
                } finally {
                    setIsSubmitting(false);
                    setConfirmDialog(prev => ({ ...prev, show: false }));
                }
            }
        });
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/import', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                showToast('Import Success', data.message, 'success');
                fetchGuests();
                setFile(null);
            } else {
                showToast('Import Failed', data.error, 'error');
            }
        } catch (err) {
            console.error('Upload failed', err);
            showToast('System Error', 'Upload failed', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (guest: DashboardGuest) => {
        setEditingGuest(guest);
        // Cast or provide invitedStatus if missing (default NOT INVITED)
        const invitedStatus = guest.invitedStatus || 'NOT INVITED';
        setEditForm({
            name: guest.name,
            phoneNumber: guest.phoneNumber || '',
            area: guest.area || '',
            remarks: guest.remarks || '',
            invitedStatus: invitedStatus
        });
        setIsEditModalOpen(true);
    };

    // Hardware Scanner Listener
    useEffect(() => {
        let buffer = '';
        let lastKeyTime = Date.now();

        const handleKeyDown = (e: KeyboardEvent) => {
            const currentTime = Date.now();

            // Scanner usually sends characters very fast (< 50ms)
            if (currentTime - lastKeyTime > 100) {
                buffer = ''; // Reset if too slow
            }

            if (e.key === 'Enter') {
                if (buffer.length > 5) { // Valid IDs are usually long
                    setIsHardwareScannerDetected(true);
                    handleScannerCheckIn(buffer);
                }
                buffer = '';
            } else if (e.key.length === 1) {
                buffer += e.key;

                // If we get 3+ chars very fast, it's definitely a scanner
                if (buffer.length > 3 && (currentTime - lastKeyTime < 50)) {
                    if (!isHardwareScannerDetected) setIsHardwareScannerDetected(true);
                }
            }
            lastKeyTime = currentTime;
        };


        const handleScannerCheckIn = async (uniqueId: string) => {
            setIsSubmitting(true);
            try {
                const res = await fetch('/api/check-in', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uniqueId }),
                });
                const data = await res.json();
                if (data.success) {
                    fetchGuests(); // Refresh list
                    showToast(data.guest.name, 'Check-in Successful', 'success');

                    // Success Feedback
                    if (successAudio.current) {
                        successAudio.current.currentTime = 0;
                        successAudio.current.play().catch(() => { });
                    }
                    if (navigator.vibrate) navigator.vibrate(200);
                } else {
                    showToast(uniqueId, data.error || 'Invalid Security ID', 'error');

                    // Error Feedback
                    if (errorAudio.current) {
                        errorAudio.current.currentTime = 0;
                        errorAudio.current.play().catch(() => { });
                    }
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                }
            } catch (err) {
                console.error("Scanner check-in failed", err);
                showToast('Scanner Error', 'Connection failed', 'error');
            } finally {
                setIsSubmitting(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isHardwareScannerDetected]);


    const printLabel = () => {
        if (!previewingLabel) return;

        // Create a temporary canvas to generate the barcode data URL
        const canvas = document.createElement('canvas');
        try {
            JsBarcode(canvas, previewingLabel.uniqueId, {
                format: "CODE128",
                width: 1.5,
                height: 50,
                displayValue: true,
                fontSize: 16
            });
            const barcodeDataUrl = canvas.toDataURL("image/png");

            const printWindow = window.open('', '_blank');
            if (!printWindow) return;

            const labelHtml = `
            <html>
                <head>
                    <title>2-Up Label - ${previewingLabel.name}</title>
                    <style>
                        @page { 
                            size: 45mm 45mm; /* Width of row (20+5+20) x Length (45) */
                            margin: 0; 
                        }
                        body { 
                            width: 45mm; 
                            height: 44.5mm; /* Safe length to prevent 2nd row feed */
                            margin: 0; 
                            padding: 0; 
                            display: flex; 
                            flex-direction: row; 
                            align-items: center; 
                            justify-content: flex-start;
                            background: white;
                            overflow: hidden;
                        }
                        .label-unit {
                            width: 20mm;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-sizing: border-box;
                        }
                        .gap {
                            width: 5mm;
                        }
                        .barcode-img { 
                            max-width: 95%; 
                            height: auto; 
                            display: block;
                        }
                    </style>
                </head>
                <body>
                    <div class="label-unit">
                        <img src="${barcodeDataUrl}" class="barcode-img" />
                    </div>
                    <div class="gap"></div>
                    <div class="label-unit">
                        <img src="${barcodeDataUrl}" class="barcode-img" />
                    </div>
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `;

            printWindow.document.write(labelHtml);
            printWindow.document.close();
        } catch (err) {
            console.error("Barcode generation for print failed", err);
            showToast('Print Error', 'Could not generate barcode. Please try again.', 'error');
        }
    };

    const handleAddGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/guests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addForm)
            });
            if (res.ok) {
                showToast(addForm.name, 'Guest added successfully', 'success');
                setIsAddModalOpen(false);
                setAddForm({
                    name: '',
                    phoneNumber: '',
                    area: '',
                    remarks: '',
                    invitedStatus: 'NOT INVITED'
                });
                fetchGuests();
            } else {
                const data = await res.json();
                showToast('Creation Failed', data.details || 'Check details and try again', 'error');
            }
        } catch (err) {
            console.error('Creation failed', err);
            showToast('System Error', 'Could not save guest', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGuest) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/guests?id=${editingGuest._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                showToast(editForm.name, 'Changes saved successfully', 'success');
                setIsEditModalOpen(false);
                fetchGuests();
            } else {
                showToast('Update Failed', 'Could not save changes', 'error');
            }
        } catch (err) {
            console.error('Update failed', err);
            showToast('System Error', 'Update operation failed', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExportExcel = () => {
        window.open('/api/export/excel', '_blank');
    };

    const handleExportPDF = () => {
        generateSmartPDF(guests, stats);
    };

    const downloadIDCard = async (guestId: string, name: string) => {
        const node = document.getElementById(`card-${guestId}`);
        if (!node) return;

        try {
            const dataUrl = await toPng(node, { quality: 1.0, pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `ID_${name.replace(/\s+/g, '_')}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Download failed', err);
        }
    };

    const filteredGuests = guests.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.phoneNumber?.includes(searchTerm) ||
        g.uniqueId.includes(searchTerm.toUpperCase())
    );

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8 font-sans transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 md:gap-3">
                                INVITE<span className="text-indigo-600 dark:text-indigo-500">QR</span>
                                <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-indigo-600 dark:text-indigo-500" />
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-slate-500 dark:text-slate-400 uppercase text-[10px] md:text-xs tracking-[0.2em] font-medium">Party guest management</p>
                                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isHardwareScannerDetected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                                    <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500">Scanner: {isHardwareScannerDetected ? 'Active' : 'Standby'}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={toggleTheme}
                            className="p-1.5 md:p-2 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-all shadow-sm"
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 px-3 md:px-5 py-1.5 md:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg md:rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-[10px] md:text-xs font-bold uppercase tracking-widest"
                        >
                            <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            Add Guest
                        </button>
                        <button
                            onClick={deleteAllGuests}
                            disabled={isSubmitting}
                            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl border border-red-500/20 transition-all flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                            Delete All
                        </button>

                        <form onSubmit={handleUpload} className="flex-1 md:flex-none flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 md:p-2 rounded-xl md:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <input
                                type="file"
                                accept=".xlsx,.csv"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="flex-1 text-[10px] md:text-xs text-slate-500 dark:text-slate-400 file:mr-2 md:file:mr-4 file:py-1 md:file:py-2 file:px-2 md:file:px-4 file:rounded-lg file:border-0 file:text-[10px] md:file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                            />
                            <button
                                type="submit"
                                disabled={!file || isSubmitting}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-1.5 md:p-2 rounded-lg md:rounded-xl transition-all shadow-lg"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Upload className="w-4 h-4 md:w-5 md:h-5" />}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                    {[
                        { label: 'Total Guests', value: stats.total, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', span: 'col-span-2 md:col-span-1' },
                        { label: 'Invited', value: stats.invited, icon: QrCode, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10', span: 'col-span-1' },
                        { label: 'Attended', value: stats.attended, icon: UserCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', span: 'col-span-1' },
                    ].map((stat, i) => (
                        <div key={i} className={`${stat.span} bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-between shadow-sm dark:shadow-lg backdrop-blur-sm`}>
                            <div>
                                <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                                <p className="text-2xl md:text-3xl font-black mt-1">{stat.value.toLocaleString()}</p>
                            </div>
                            <div className={`${stat.bg} ${stat.color} p-3 md:p-4 rounded-xl md:rounded-2xl shadow-inner`}>
                                <stat.icon className="w-6 h-6 md:w-8 md:h-8" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Guest List controls */}
                <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-xl dark:shadow-2xl backdrop-blur-sm">
                    <div className="p-4 md:p-8 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                        <div className="relative flex-1 w-full md:max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4 md:w-5 md:h-5" />
                            <input
                                type="text"
                                placeholder="Search guests..."
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl md:rounded-2xl py-2.5 md:py-3 pl-11 md:pl-12 pr-4 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50 transition-all text-slate-900 dark:text-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 md:flex gap-2.5 md:gap-4">
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center justify-center gap-2 px-3 md:px-6 py-2 md:py-3 bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg md:rounded-2xl text-[10px] md:text-sm font-bold transition-all"
                            >
                                <Download className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
                                <span className="hidden sm:inline">Export</span> Excel
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center justify-center gap-2 px-3 md:px-6 py-2 md:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500/20 rounded-lg md:rounded-2xl text-[10px] md:text-sm font-bold transition-all shadow-lg"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                <span className="hidden sm:inline">Export</span> PDF
                            </button>
                        </div>
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                                    <th className="px-8 py-5">Guest Info</th>
                                    <th className="px-8 py-5">Area & Remarks</th>
                                    <th className="px-8 py-5">Check-in</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                                {filteredGuests.map((guest) => (
                                    <tr key={guest._id} className="hover:bg-indigo-600/[0.03] dark:hover:bg-indigo-600/5 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 dark:text-slate-500 transform group-hover:scale-110 transition-transform">
                                                    {guest.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white text-base">{guest.name}</p>
                                                    <p className="text-slate-500 text-xs font-medium tracking-wide">{guest.phoneNumber || 'No phone'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{guest.area || '-'}</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 italic max-w-xs truncate">{guest.remarks || '-'}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            {guest.checkInTime ? (
                                                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">
                                                    {new Date(guest.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-slate-400 dark:text-slate-700">-</p>
                                            )}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg w-max shadow-sm ${guest.attendanceStatus === 'ATTENDED'
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500'
                                                    }`}>
                                                    {guest.attendanceStatus}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => downloadIDCard(guest._id, guest.name)}
                                                    className="p-1.5 md:p-2 bg-indigo-500/10 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                    title="Download ID Card"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setPreviewingLabel(guest)}
                                                    className="p-1.5 md:p-2 bg-slate-500/10 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-600 hover:text-white transition-all shadow-sm"
                                                    title="Print Zebra Label"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(guest)}
                                                    className="p-3 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"
                                                    title="Edit Guest"
                                                >
                                                    <Edit3 className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteGuest(guest._id, guest.name)}
                                                    disabled={isSubmitting}
                                                    className="p-3 bg-red-600/10 text-red-600 dark:text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm disabled:opacity-50"
                                                    title="Delete Guest"
                                                >
                                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View: Cards */}
                    <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredGuests.map((guest) => (
                            <div key={guest._id} className="p-4 space-y-4 active:bg-slate-50 dark:active:bg-slate-900 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500">
                                            {guest.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 dark:text-white text-sm leading-tight">{guest.name}</h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{guest.phoneNumber || 'No phone'}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black tracking-widest px-2 py-1 rounded-full ${guest.attendanceStatus === 'ATTENDED'
                                        ? 'bg-emerald-500/10 text-emerald-600'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                        }`}>
                                        {guest.attendanceStatus}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Area</p>
                                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{guest.area || 'General'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Check-in</p>
                                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                            {guest.checkInTime ? new Date(guest.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(guest)}
                                            className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => deleteGuest(guest._id, guest.name)}
                                            className="p-2 bg-red-500/10 text-red-500 rounded-lg"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => downloadIDCard(guest._id, guest.name)}
                                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Card
                                    </button>
                                    <button
                                        onClick={() => setPreviewingLabel(guest)}
                                        className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-black uppercase tracking-widest"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        Label
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredGuests.length === 0 && (
                        <div className="py-20 text-center text-slate-400 dark:text-slate-600">
                            <p className="text-lg font-medium">No guests found</p>
                            <p className="text-sm uppercase tracking-widest mt-1">Upload a file to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Guest Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-in slide-in-from-bottom-8 duration-500">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-600/5">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    Edit Guest
                                    <ShieldCheck className="w-6 h-6 text-indigo-500" />
                                </h2>
                                <p className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1">
                                    ID: {editingGuest?.uniqueId}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-inner"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateGuest} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Guest Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Contact No</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        value={editForm.phoneNumber}
                                        onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Area</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        value={editForm.area}
                                        onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Remarks</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        value={editForm.remarks}
                                        onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-4 pt-2">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Invited Status</p>
                                            <p className="text-[10px] text-slate-400 font-bold">Has the guest been sent an invite?</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditForm({ ...editForm, invitedStatus: editForm.invitedStatus === 'INVITED' ? 'NOT INVITED' : 'INVITED' })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.invitedStatus === 'INVITED' ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.invitedStatus === 'INVITED' ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="fixed top-0 -left-[5000px] pointer-events-none opacity-0">
                {filteredGuests.map((guest) => (
                    <IDCard key={guest._id} guest={guest as any} id={`card-${guest._id}`} />
                ))}
            </div>
            {/* Label Preview Modal */}
            {previewingLabel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setPreviewingLabel(null)}></div>
                    <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8 space-y-8 text-center">
                            <div className="space-y-2">
                                <h3 className="text-xl font-black uppercase tracking-tight">Label Preview</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Zebra ZD230 Compatibility</p>
                            </div>

                            {/* Actual Visual Barcode */}
                            <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[2rem] border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center">
                                <div className="bg-white p-6 rounded-xl shadow-inner w-full flex justify-center">
                                    <Barcode
                                        value={previewingLabel.uniqueId}
                                        height={100}
                                        width={2}
                                        displayValue={true}
                                        fontSize={14}
                                    />
                                </div>
                                <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Security Barcode Only</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPreviewingLabel(null)}
                                    className="px-4 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={printLabel}
                                    className="px-4 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
                                >
                                    <Printer className="w-4 h-4" />
                                    Direct Print
                                </button>
                                <button
                                    onClick={() => {
                                        const zpl = generateZPL({ name: previewingLabel.name, uniqueId: previewingLabel.uniqueId });
                                        downloadZPLFile(previewingLabel.name, zpl);
                                    }}
                                    className="col-span-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
                                >
                                    <Download className="w-3 h-3" />
                                    Download ZPL File (ZD230)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Guest Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-in slide-in-from-bottom-8 duration-500">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-600/5">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    Add New Guest
                                    <UserPlus className="w-6 h-6 text-emerald-500" />
                                </h2>
                                <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-widest mt-1">
                                    Manual Entry Pass
                                </p>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-inner"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddGuest} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Guest Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Full Name"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                        value={addForm.name}
                                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Contact No</label>
                                    <input
                                        type="text"
                                        placeholder="+91..."
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                        value={addForm.phoneNumber}
                                        onChange={(e) => setAddForm({ ...addForm, phoneNumber: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Area</label>
                                    <input
                                        type="text"
                                        placeholder="General / VIP"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                        value={addForm.area}
                                        onChange={(e) => setAddForm({ ...addForm, area: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Remarks</label>
                                    <input
                                        type="text"
                                        placeholder="Special handling?"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                        value={addForm.remarks}
                                        onChange={(e) => setAddForm({ ...addForm, remarks: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-4 pt-2">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Invited Status</p>
                                            <p className="text-[10px] text-slate-400 font-bold">Has the guest been sent an invite?</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAddForm({ ...addForm, invitedStatus: addForm.invitedStatus === 'INVITED' ? 'NOT INVITED' : 'INVITED' })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${addForm.invitedStatus === 'INVITED' ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addForm.invitedStatus === 'INVITED' ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 px-4 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Add Guest
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Notification Toast */}
            {toast.show && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5 duration-300">
                    <div className={`px-6 py-4 rounded-[2rem] shadow-2xl border flex items-center gap-4 backdrop-blur-md ${toast.type === 'success'
                        ? 'bg-emerald-500/90 border-emerald-400 text-white'
                        : 'bg-red-500/90 border-red-400 text-white'
                        }`}>
                        <div className="bg-white/20 p-2 rounded-full">
                            {toast.type === 'success' ? <UserCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{toast.message}</p>
                            <p className="text-sm font-black uppercase tracking-tight">{toast.name}</p>
                        </div>
                        <button
                            onClick={() => setToast(prev => ({ ...prev, show: false }))}
                            className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Confirmation Modal */}
            {confirmDialog.show && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-in zoom-in duration-300">
                        <div className="p-8 text-center space-y-6">
                            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${confirmDialog.type === 'danger' ? 'bg-red-50 dark:bg-red-500/10 text-red-600' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'}`}>
                                <AlertTriangle className="w-10 h-10" />
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                    {confirmDialog.title}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                    {confirmDialog.message}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button
                                    onClick={() => setConfirmDialog(prev => ({ ...prev, show: false }))}
                                    className="px-6 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-all border border-slate-200 dark:border-slate-700"
                                >
                                    No, Keep it
                                </button>
                                <button
                                    onClick={confirmDialog.onConfirm}
                                    disabled={isSubmitting}
                                    className="px-6 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-600/20 flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
