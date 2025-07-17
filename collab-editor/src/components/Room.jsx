import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Editor from './Editor.jsx';
import VideoChat from './VideoChat.jsx';
import Chat from './Chat.jsx';
import { io } from 'socket.io-client';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const socket = io('http://localhost:5000');

export default function Room() {
  const { roomId } = useParams();
  const [code, setCode] = useState('// Loading...');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [chatVisible, setChatVisible] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [fontSize, setFontSize] = useState(14);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/history/${roomId}`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('❌ Error loading history:', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('You must login first!');
      window.location.href = '/';
      return;
    }

    socket.emit('joinRoom', { roomId, token });

    socket.on('loadDocument', ({ code, language }) => {
      setCode(code);
      setLanguage(language);
    });

    socket.on('codeUpdate', (newCode) => setCode(newCode));
    socket.on('codeResult', (result) => {
      setOutput(result);
      setIsRunning(false);
      toast.dismiss();
      toast.success('✅ Code execution completed!', { 
        autoClose: 2000,
        className: 'premium-toast-success'
      });
    });

    fetchHistory();

    return () => {
      socket.off('codeUpdate');
      socket.off('loadDocument');
      socket.off('codeResult');
    };
  }, [roomId]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit('codeChange', { roomId, code: newCode, language });
    fetchHistory();
  };

  const handleRunCode = () => {
    setOutput('⏳ Executing code...');
    setIsRunning(true);
    const runningToastId = toast.loading('💻 Compiling and executing...', {
      className: 'premium-toast-loading'
    });
    socket.emit('runCode', { roomId, code, language });

    socket.once('codeResult', (result) => {
      setOutput(result);
      setIsRunning(false);
      toast.update(runningToastId, { 
        render: '✅ Execution completed successfully!', 
        type: 'success', 
        isLoading: false, 
        autoClose: 2000,
        className: 'premium-toast-success'
      });
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const savingToastId = toast.loading('💾 Saving document...', {
      className: 'premium-toast-loading'
    });
    try {
      const res = await fetch('http://localhost:5000/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, code, language }),
      });
      const data = await res.json();
      if (data.success) {
        toast.update(savingToastId, { 
          render: '✅ Document saved successfully!', 
          type: 'success', 
          isLoading: false, 
          autoClose: 2000,
          className: 'premium-toast-success'
        });
        setOutput('✅ Document saved successfully!');
        fetchHistory();
      } else {
        toast.update(savingToastId, { 
          render: '❌ Failed to save document.', 
          type: 'error', 
          isLoading: false, 
          autoClose: 2000,
          className: 'premium-toast-error'
        });
        setOutput('❌ Failed to save document.');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.update(savingToastId, { 
        render: '❌ Error saving document.', 
        type: 'error', 
        isLoading: false, 
        autoClose: 2000,
        className: 'premium-toast-error'
      });
      setOutput('❌ Error saving document.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoPlay = () => {
    let i = currentStep;
    const interval = setInterval(() => {
      i++;
      setCurrentStep(i);
      if (i >= history.length - 1) clearInterval(interval);
    }, 1000);
  };

  const languageIcons = {
    javascript: '🟨',
    python: '🐍',
    cpp: '⚡',
    java: '☕',
    go: '🔵',
    rust: '🦀'
  };

  const getLanguageColor = (lang) => {
    const colors = {
      javascript: '#f7df1e',
      python: '#306998',
      cpp: '#00599c',
      java: '#ed8b00',
      go: '#00add8',
      rust: '#dea584'
    };
    return colors[lang] || '#666';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: theme === 'dark' 
        ? 'linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%)' 
        : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
      color: theme === 'dark' ? '#e0e0e0' : '#2d3748',
      fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", Consolas, monospace',
      transition: 'all 0.3s ease',
      overflow: 'auto'
    }}>
      <style>{`
        .premium-header {
          background: ${theme === 'dark' 
            ? 'rgba(13, 13, 13, 0.95)' 
            : 'rgba(255, 255, 255, 0.95)'};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${theme === 'dark' ? '#333' : '#e2e8f0'};
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
        }
        
        .premium-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          padding: 10px 20px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          position: relative;
          overflow: hidden;
        }
        
        .premium-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }
        
        .premium-button:active {
          transform: translateY(0);
        }
        
        .premium-button.success {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
        }
        
        .premium-button.success:hover {
          box-shadow: 0 8px 25px rgba(72, 187, 120, 0.4);
        }
        
        .premium-button.danger {
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
          box-shadow: 0 4px 15px rgba(245, 101, 101, 0.3);
        }
        
        .premium-button.secondary {
          background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
          box-shadow: 0 4px 15px rgba(74, 85, 104, 0.3);
        }
        
        .premium-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .premium-select {
          background: ${theme === 'dark' ? '#2d3748' : '#fff'};
          border: 2px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
          border-radius: 8px;
          color: ${theme === 'dark' ? '#e0e0e0' : '#2d3748'};
          font-size: 14px;
          font-weight: 500;
          padding: 10px 15px;
          transition: all 0.3s ease;
          appearance: none;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 10px center;
          background-repeat: no-repeat;
          background-size: 16px;
          padding-right: 40px;
        }
        
        .premium-select:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          outline: none;
        }
        
        .premium-output {
          background: ${theme === 'dark' 
            ? 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)' 
            : 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)'};
          border: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
          border-radius: 12px;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.1);
          color: ${theme === 'dark' ? '#00ff88' : '#38a169'};
          font-family: "Fira Code", monospace;
          font-size: ${fontSize}px;
          line-height: 1.6;
          height: 200px;
          max-height: 300px;
          padding: 20px;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
        }
        
        .premium-output::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, #667eea, #764ba2, #667eea);
          border-radius: 12px 12px 0 0;
        }
        
        .premium-history-controls {
          background: ${theme === 'dark' ? '#2d3748' : '#fff'};
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          border: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
        }
        
        .premium-sidebar {
          background: ${theme === 'dark' 
            ? 'rgba(26, 32, 44, 0.95)' 
            : 'rgba(247, 250, 252, 0.95)'};
          backdrop-filter: blur(20px);
          border-right: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .premium-toast-success .Toastify__toast {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        }
        
        .premium-toast-error .Toastify__toast {
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
        }
        
        .premium-toast-loading .Toastify__toast {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .language-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: ${theme === 'dark' ? '#4a5568' : '#f7fafc'};
          border: 1px solid;
          border-color: ${getLanguageColor(language)}40;
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          color: ${getLanguageColor(language)};
          margin-left: 12px;
        }
        
        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${isRunning ? '#f6ad55' : '#48bb78'};
          box-shadow: 0 0 8px ${isRunning ? '#f6ad55' : '#48bb78'};
          animation: ${isRunning ? 'pulse 2s infinite' : 'none'};
        }
        
          /* Custom Scrollbar Styling */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: ${theme === 'dark' ? '#1a202c' : '#f1f5f9'};
            border-radius: 4px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: ${theme === 'dark' ? '#4a5568' : '#cbd5e0'};
            border-radius: 4px;
            transition: background 0.3s ease;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: ${theme === 'dark' ? '#667eea' : '#667eea'};
          }
          
          /* Ensure smooth scrolling */
          * {
            scroll-behavior: smooth;
          }
          
          body {
            overflow-x: hidden;
          }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .editor-container {
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          border: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
          height: 400px;
          max-height: 500px;
        }
        
        .main-content {
          display: flex;
          min-height: calc(100vh - 160px);
          gap: 20px;
          padding: 20px;
          max-width: 100vw;
          margin: 0 auto;
          overflow-x: hidden;
          position: relative;
        }
        
        .editor-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
          max-width: ${chatVisible ? 'calc(100vw - 410px)' : '100%'};
        }
        
        .chat-panel {
          position: ${chatVisible ? 'relative' : 'absolute'};
          right: ${chatVisible ? '0' : '-350px'};
          top: 0;
          width: ${chatVisible ? '350px' : '0'};
          min-width: ${chatVisible ? '350px' : '0'};
          height: ${chatVisible ? 'fit-content' : '0'};
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          opacity: ${chatVisible ? '1' : '0'};
          visibility: ${chatVisible ? 'visible' : 'hidden'};
          z-index: 10;
        }
      `}</style>

      {/* Premium Header */}
      <header className="premium-header" style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '15px 30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '24px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            <span style={{ fontSize: '28px' }}>⚡</span>
            CodeSync Pro
          </div>
          <div className="status-indicator"></div>
          <span style={{ 
            fontSize: '12px', 
            color: theme === 'dark' ? '#a0aec0' : '#718096',
            fontWeight: '500'
          }}>
            {isRunning ? 'Running...' : 'Ready'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600' }}>Language:</label>
            <select
              className="premium-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ minWidth: '140px' }}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
            </select>
            <div className="language-badge">
              {languageIcons[language] || '📄'}
              {language.toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="premium-button secondary"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            
            <button
              className="premium-button"
              onClick={() => setChatVisible(!chatVisible)}
            >
              {chatVisible ? '✕ Close Chat' : '💬 Open Chat'}
            </button>
          </div>
        </div>
      </header>

      {/* Video Chat Section */}
      <div style={{ margin: '0 30px' }}>
        <VideoChat roomId={roomId} />
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="editor-panel">
          {/* Code Editor */}
          <div className="editor-container">
            <Editor
            code={code}
            onCodeChange={handleCodeChange}
            language={language}
          />

          </div>

          {/* History Controls */}
          {history.length > 0 ? (
            <div className="premium-history-controls">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '15px',
                marginBottom: '15px'
              }}>
                <button
                  className="premium-button secondary"
                  onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                >
                  ⏮ Previous
                </button>
                <button
                  className="premium-button"
                  onClick={handleAutoPlay}
                >
                  ▶️ Auto-Replay
                </button>
                <button
                  className="premium-button secondary"
                  onClick={() => setCurrentStep((prev) => Math.min(history.length - 1, prev + 1))}
                  disabled={currentStep === history.length - 1}
                >
                  Next ⏭
                </button>
              </div>
              <div style={{ 
                textAlign: 'center',
                fontSize: '14px',
                color: theme === 'dark' ? '#a0aec0' : '#718096',
                fontWeight: '500'
              }}>
                <span style={{ color: '#667eea', fontWeight: '700' }}>
                  Step {currentStep + 1} of {history.length}
                </span>
                {' '}by{' '}
                <span style={{ color: getLanguageColor(language), fontWeight: '600' }}>
                  {history[currentStep].username}
                </span>
                {' '}at{' '}
                <span style={{ fontStyle: 'italic' }}>
                  {new Date(history[currentStep].created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: theme === 'dark' ? '#a0aec0' : '#718096',
              fontSize: '16px',
              fontWeight: '500'
            }}>
              🚀 Start coding to build your history timeline!
            </div>
          )}

          {/* Premium Output Terminal */}
          <div className="premium-output">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '15px',
              paddingBottom: '10px',
              borderBottom: `1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'}`
            }}>
              <span style={{ fontSize: '16px', fontWeight: '700' }}>🖥️ Terminal Output</span>
              <div style={{
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '12px',
                background: isRunning ? '#fed7007a' : '#68d39178',
                color: isRunning ? '#744210' : '#22543d',
                fontWeight: '600'
              }}>
                {isRunning ? 'EXECUTING' : 'READY'}
              </div>
            </div>
            {output || 'Ready for code execution... ⚡'}
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '20px',
            marginTop: '20px'
          }}>
            <button
              className="premium-button success"
              onClick={handleSave}
              disabled={isSaving}
              style={{ minWidth: '140px' }}
            >
              {isSaving ? '💾 Saving...' : '💾 Save Code'}
            </button>
            <button
              className="premium-button"
              onClick={handleRunCode}
              disabled={isRunning}
              style={{ minWidth: '140px' }}
            >
              {isRunning ? '⏳ Running...' : '▶️ Execute'}
            </button>
          </div>
        </div>

        {/* Chat Panel */}
        {chatVisible && (
          <div className="chat-panel">
            <div style={{
              height: '600px',
              background: theme === 'dark' ? '#2d3748' : '#fff',
              borderRadius: '12px',
              border: `1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'}`,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'sticky',
              top: '20px'
            }}>
              <div style={{
                padding: '15px 20px',
                borderBottom: `1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'}`,
                background: theme === 'dark' ? '#1a202c' : '#f7fafc',
                fontWeight: '600',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexShrink: 0
              }}>
                💬 Team Chat
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#48bb78',
                  boxShadow: '0 0 8px #48bb78'
                }}></div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Chat socket={socket} roomId={roomId} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Premium Toast Container */}
      <ToastContainer 
        position="bottom-right" 
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={theme}
        style={{
          fontSize: '14px',
          fontWeight: '500'
        }}
      />
    </div>
  );
}