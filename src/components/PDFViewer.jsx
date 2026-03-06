import { useEffect } from 'react';
import usePdfViewer from '../hooks/usePdfViewer';
import Sidebar from './Sidebar';
import Toolbar from './Toolbar';
import PDFCanvas from './PDFCanvas';
import Loader from './Loader';
import ErrorModal from './ErrorModal';

export default function PDFViewer({ file, onClose }) {
    const viewer = usePdfViewer();

    // Load the file when it changes or fall back to Supabase
    useEffect(() => {
        if (file) {
            viewer.handleFileSelect(file);
        } else {
            // Default Supabase PDF for Demo Reader
            const defaultPdfUrl = 'https://tilimltxgeucefxzerqi.supabase.co/storage/v1/object/public/pdf/Clinical%20Ai%20Architecture%20Diagrams.pdf';
            viewer.loadFromUrl(defaultPdfUrl, 'Clinical AI Architecture');
        }
    }, [file]);

    return (
        <div className="pdf-viewer-overlay">
            <div className={`viewer-container ${viewer.isDark ? 'dark-theme' : 'light-theme'} ${viewer.isFocusMode ? 'focus-mode' : ''}`}>
                <Sidebar
                    pdfDoc={viewer.pdfDoc}
                    pageNum={viewer.pageNum}
                    goToPage={viewer.goToPage}
                    isOpen={viewer.sidebarOpen}
                    onClose={viewer.toggleSidebar}
                    outline={viewer.outline}
                    searchIndices={viewer.searchIndices}
                    searchText={viewer.searchText}
                    toggleSidebar={viewer.toggleSidebar}
                />

                <div className="main-viewer">
                    <Toolbar
                        scale={viewer.scale}
                        pageNum={viewer.pageNum}
                        totalPages={viewer.totalPages}
                        zoomIn={viewer.zoomIn}
                        zoomOut={viewer.zoomOut}
                        prevPage={viewer.prevPage}
                        nextPage={viewer.nextPage}
                        rotate={viewer.rotate}
                        toggleFullscreen={viewer.toggleFullscreen}
                        downloadPDF={viewer.downloadPDF}
                        printPDF={viewer.printPDF}
                        pdfLoaded={viewer.pdfLoaded}
                        isFocusMode={viewer.isFocusMode}
                        toggleFocusMode={viewer.toggleFocusMode}
                        searchText={viewer.searchText}
                        handleSearch={viewer.handleSearch}
                    />

                    <div className="canvas-wrapper">
                        {viewer.isLoading && <Loader />}
                        {viewer.pdfLoaded ? (
                            <PDFCanvas
                                canvasRef={viewer.canvasRef}
                                textLayerRef={viewer.textLayerRef}
                                pageNum={viewer.pageNum}
                                totalPages={viewer.totalPages}
                                prevPage={viewer.prevPage}
                                nextPage={viewer.nextPage}
                                pdfLoaded={viewer.pdfLoaded}
                                isFocusMode={viewer.isFocusMode}
                            />
                        ) : (
                            <div className="viewer-empty-state">
                                <div className="spinner-glow"></div>
                                <p>Initializing Studio Reader...</p>
                            </div>
                        )}
                    </div>

                    <button className="close-viewer-btn" onClick={onClose} title="Close Reader">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                    <ErrorModal error={viewer.error} onClose={viewer.clearError} />
                </div>
            </div>
        </div>
    );
}
