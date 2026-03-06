import React, { useState, useRef } from 'react';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import usePdfViewer from './hooks/usePdfViewer';
import PDFViewer from './components/PDFViewer';
import ErrorModal from './components/ErrorModal';
import Background from './components/Background';
import Marketplace from './components/Marketplace';
import About from './components/About';
import Footer from './components/Footer';

export default function App() {
  const fileInputRef = useRef(null);
  const viewer = usePdfViewer();
  const [view, setView] = useState('landing');

  const handleStartLearning = () => {
    setView('marketplace');
  };

  const handleFileSelect = (file) => {
    viewer.handleFileSelect(file);
    setView('viewer');
  };

  const openReader = () => {
    if (viewer.pdfLoaded) {
      setView('viewer');
    } else {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={viewer.isDark ? 'dark-theme' : 'light-theme'}>
      <div className="app-container" style={{ position: 'relative', minHeight: '100vh' }}>
        <Background />
        
        {/* Main Glass Layout wrapper */}
        <div className="liquid-glass-root" style={{ position: 'relative', zindex: 1 }}>
          <Navbar 
            onReaderClick={openReader} 
            pdfLoaded={viewer.pdfLoaded} 
            setView={setView} 
            currentView={view} 
          />

          <main className="content-area">
            {view === 'landing' && <LandingPage onStartLearning={handleStartLearning} />}
            {view === 'marketplace' && <Marketplace onFileSelect={handleFileSelect} />}
            {view === 'viewer' && (
              <PDFViewer 
                file={viewer.selectedFile} 
                onClose={() => setView('marketplace')} 
              />
            )}
            {view === 'about' && <About />}
          </main>

          <Footer />
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileSelect(e.target.files[0])}
          accept="application/pdf"
          style={{ display: 'none' }}
        />
        <ErrorModal error={viewer.error} onClose={viewer.clearError} />
      </div>
    </div>
  );
}
