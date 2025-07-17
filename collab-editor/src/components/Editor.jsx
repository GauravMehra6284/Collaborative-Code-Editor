import React, { useEffect, useRef, useState } from 'react';
import MonacoEditor from 'react-monaco-editor';

export default function Editor({ code, onCodeChange, language }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [internalCode, setInternalCode] = useState(code); // local state

  const options = {
    selectOnLineNumbers: true,
    automaticLayout: true,
    fontSize: 16,
    minimap: { enabled: false },
  };

  const editorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // 👇 Listen to user changes only
    editor.onDidChangeModelContent(() => {
      const newCode = editor.getValue();
      if (newCode !== internalCode) {
        setInternalCode(newCode);
        onCodeChange(newCode); // only emit user changes
      }
    });
  };

  // 👇 Update editor only when external code changes
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && code !== internalCode) {
      const pos = editor.getPosition();
      setInternalCode(code);
      editor.setValue(code);
      if (pos) editor.setPosition(pos);
    }
  }, [code]);

  return (
    <MonacoEditor
      width="100%"
      height="90vh"
      language={language}
      theme="vs-dark"
      value={internalCode}
      options={options}
      editorDidMount={editorDidMount}
    />
  );
}
