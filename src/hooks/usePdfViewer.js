import { useState, useRef, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export default function usePdfViewer() {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [pageNum, setPageNum] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const [fileName, setFileName] = useState('No file selected');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDark, setIsDark] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [pdfLoaded, setPdfLoaded] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [searchIndices, setSearchIndices] = useState([]); // Array of { pageNum, text }
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
    const [outline, setOutline] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);

    const pdfDataRef = useRef(null);
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const renderingRef = useRef(false);
    const pendingRef = useRef(null);
    const touchStateRef = useRef({
        startX: 0,
        startY: 0,
        initialDist: 0,
        initialScale: 1
    });

    // Render text layer
    const renderTextLayer = useCallback(async (page, viewport) => {
        if (!textLayerRef.current) return;
        const textLayerDiv = textLayerRef.current;
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.width = `${viewport.width}px`;

        const textContent = await page.getTextContent();

        // Use a document fragment for better performance
        const fragment = document.createDocumentFragment();

        // This is a simplified version of text layer rendering
        // In a real scenario, we might want to use a more robust library or the full pdf.js text layer builder
        textContent.items.forEach(item => {
            const span = document.createElement('span');
            const tx = pdfjsLib.Util.transform(
                viewport.transform,
                item.transform
            );

            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5]}px`;
            span.style.fontSize = `${item.height * viewport.scale}px`;
            span.style.fontFamily = item.fontName;
            span.textContent = item.str;

            // Basic search highlighting
            if (searchText && item.str && item.str.toLowerCase().includes(searchText.toLowerCase())) {
                span.classList.add('search-match');
            }

            fragment.appendChild(span);
        });

        textLayerDiv.appendChild(fragment);
    }, [searchText]);

    // Render a page on the canvas
    const renderPage = useCallback(async (num) => {
        if (!pdfDoc || !canvasRef.current) return;
        if (renderingRef.current) {
            pendingRef.current = num;
            return;
        }
        renderingRef.current = true;
        setIsLoading(true);

        try {
            const page = await pdfDoc.getPage(num);
            const dpr = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale, rotation });

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // Set display size (css pixels)
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            // Set actual size in memory (scaled to dpr)
            canvas.width = viewport.width * dpr;
            canvas.height = viewport.height * dpr;

            // Scale context to match dpr
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            // Render text layer after canvas is done
            if (textLayerRef.current) {
                await renderTextLayer(page, viewport);
            }
        } catch (err) {
            setError('Error rendering page: ' + err.message);
        } finally {
            renderingRef.current = false;
            setIsLoading(false);

            if (pendingRef.current !== null) {
                const next = pendingRef.current;
                pendingRef.current = null;
                renderPage(next);
            }
        }
    }, [pdfDoc, scale, rotation, renderTextLayer]);

    // Extract Outline
    const extractOutline = useCallback(async (doc) => {
        try {
            const outlineObj = await doc.getOutline();
            setOutline(outlineObj || []);
        } catch (err) {
            console.error("Error extracting outline:", err);
            setOutline([]);
        }
    }, []);

    // Load PDF from Uint8Array
    const loadPDF = useCallback(async (data) => {
        setIsLoading(true);
        try {
            const doc = await pdfjsLib.getDocument({ data }).promise;
            setPdfDoc(doc);
            setTotalPages(doc.numPages);
            setPageNum(1);
            setPdfLoaded(true);
            setIsFocusMode(false);
            extractOutline(doc);
        } catch (err) {
            setError('Error loading PDF: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }, [extractOutline]);

    // Load PDF from file input
    const handleFileSelect = useCallback((file) => {
        if (!file || file.type !== 'application/pdf') {
            setError('Please select a valid PDF file.');
            return;
        }
        setSelectedFile(file);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
            const arr = new Uint8Array(e.target.result);
            pdfDataRef.current = arr;
            loadPDF(arr);
        };
        reader.readAsArrayBuffer(file);
    }, [loadPDF]);

    // Load PDF from URL
    const loadFromUrl = useCallback(async (url, title) => {
        setIsLoading(true);
        if (title) setFileName(title);
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = await res.arrayBuffer();
            const arr = new Uint8Array(buf);
            pdfDataRef.current = arr;
            loadPDF(arr);
        } catch (err) {
            setError('Error loading PDF: ' + err.message);
            setIsLoading(false);
        }
    }, [loadPDF]);

    // Navigation
    const prevPage = useCallback(() => {
        if (pageNum > 1) setPageNum(p => p - 1);
    }, [pageNum]);

    const nextPage = useCallback(() => {
        if (pageNum < totalPages) setPageNum(p => p + 1);
    }, [pageNum, totalPages]);

    // Zoom
    const zoomIn = useCallback(() => {
        if (scale < 3.0) setScale(s => Math.round((s + 0.25) * 100) / 100);
    }, [scale]);

    const zoomOut = useCallback(() => {
        if (scale > 0.5) setScale(s => Math.round((s - 0.25) * 100) / 100);
    }, [scale]);

    // Rotate
    const rotate = useCallback(() => {
        setRotation(r => (r + 90) % 360);
    }, []);

    // Theme
    const toggleTheme = useCallback(() => setIsDark(d => !d), []);

    // Sidebar
    const toggleSidebar = useCallback(() => setSidebarOpen(o => !o), []);

    // Focus Mode
    const toggleFocusMode = useCallback(() => setIsFocusMode(f => !f), []);

    // Global Search
    const handleSearch = useCallback(async (text) => {
        setSearchText(text);
        if (!text || text.length < 2) {
            setSearchIndices([]);
            setCurrentSearchIndex(-1);
            if (pdfDoc) renderPage(pageNum);
            return;
        }

        if (!pdfDoc) return;

        const results = [];
        // Scan all pages for the text
        // Note: For very large PDFs, this might be slow, but it's a start
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            if (pageText.toLowerCase().includes(text.toLowerCase())) {
                results.push({
                    pageNum: i,
                    text: pageText.substring(0, 100) + '...' // Snippet
                });
            }
        }
        setSearchIndices(results);
        renderPage(pageNum);
    }, [pdfDoc, pageNum, renderPage]);

    // Fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen?.();
        }
    }, []);

    // Download
    const downloadPDF = useCallback(() => {
        if (!pdfDataRef.current) return;
        const blob = new Blob([pdfDataRef.current], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName !== 'No file selected' ? fileName : 'document.pdf';
        a.click();
        URL.revokeObjectURL(url);
    }, [fileName]);

    // Print
    const printPDF = useCallback(() => {
        if (!pdfDataRef.current) return;
        const blob = new Blob([pdfDataRef.current], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            iframe.contentWindow.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(url);
            }, 1000);
        };
    }, []);

    // Clear error
    const clearError = useCallback(() => setError(null), []);

    // Go to specific page
    const goToPage = useCallback((num) => {
        if (num >= 1 && num <= totalPages) setPageNum(num);
    }, [totalPages]);

    // Re-render when page/scale/rotation/searchText changes
    useEffect(() => {
        if (pdfDoc) renderPage(pageNum);
    }, [pageNum, pdfDoc, scale, rotation, searchText, renderPage]);

    // Touch Gestures
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const target = canvas.parentElement; // Watch parent to include text layer area
        if (!target) return;

        const getDist = (touch1, touch2) => {
            return Math.sqrt(
                Math.pow(touch1.clientX - touch2.clientX, 2) +
                Math.pow(touch1.clientY - touch2.clientY, 2)
            );
        };

        const handleTouchStart = (e) => {
            if (e.touches.length === 1) {
                touchStateRef.current.startX = e.touches[0].clientX;
                touchStateRef.current.startY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                touchStateRef.current.initialDist = getDist(e.touches[0], e.touches[1]);
                touchStateRef.current.initialScale = scale;
            }
        };

        const handleTouchMove = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = getDist(e.touches[0], e.touches[1]);
                const newScale = touchStateRef.current.initialScale * (dist / touchStateRef.current.initialDist);
                const clampedScale = Math.min(Math.max(newScale, 0.5), 3.0);
                setScale(Math.round(clampedScale * 100) / 100);
            }
        };

        const handleTouchEnd = (e) => {
            if (e.changedTouches.length === 1 && e.touches.length === 0) {
                const deltaX = e.changedTouches[0].clientX - touchStateRef.current.startX;
                const deltaY = Math.abs(e.changedTouches[0].clientY - touchStateRef.current.startY);

                // Horizontal swipe threshold: 40px for instant feel, vertical constraint: < 50px
                if (Math.abs(deltaX) > 40 && deltaY < 50) {
                    if (deltaX > 0) {
                        prevPage();
                    } else {
                        nextPage();
                    }
                }
            }
        };

        target.addEventListener('touchstart', handleTouchStart, { passive: true });
        target.addEventListener('touchmove', handleTouchMove, { passive: false });
        target.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            target.removeEventListener('touchstart', handleTouchStart);
            target.removeEventListener('touchmove', handleTouchMove);
            target.removeEventListener('touchend', handleTouchEnd);
        };
    }, [scale, pdfDoc, prevPage, nextPage]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e) => {
            if (!pdfDoc) return;
            // Ignore if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case 'ArrowLeft': prevPage(); break;
                case 'ArrowRight': nextPage(); break;
                case '+': case '=': zoomIn(); break;
                case '-': zoomOut(); break;
                case 'f': case 'F': toggleFullscreen(); break;
                case 't': case 'T': toggleTheme(); break;
                case 'z': case 'Z': toggleFocusMode(); break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [pdfDoc, prevPage, nextPage, zoomIn, zoomOut, toggleFullscreen, toggleTheme, toggleFocusMode]);

    return {
        // State
        pdfDoc, pageNum, totalPages, scale, rotation,
        fileName, isLoading, error, isDark, sidebarOpen, pdfLoaded,
        isFocusMode, searchText, searchIndices, outline, selectedFile,
        canvasRef, textLayerRef,
        // Actions
        handleFileSelect, loadFromUrl, prevPage, nextPage,
        zoomIn, zoomOut, rotate, toggleTheme, toggleSidebar,
        toggleFocusMode, handleSearch,
        toggleFullscreen, downloadPDF, printPDF, clearError, goToPage,
    };
}
