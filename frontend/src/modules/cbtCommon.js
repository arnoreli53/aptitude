// CFAST-native visual style — dark navy/black backgrounds, white text,
// dark blue title banners, A-E answer lists with "Answer:" input field.
// Matches the aesthetic of CFAST candidate guide screenshots.
import React, { useState, useEffect } from 'react';

export const CFAST_BG = '#000018';
export const CFAST_PANEL = '#000030';
export const CFAST_BANNER = '#0000B0';
export const CFAST_BUTTON = '#0000A0';
export const CFAST_BUTTON_HOVER = '#0000CC';
export const CFAST_ACCENT = '#FF3333';

export const cbtFont = { fontFamily: "'Arial', 'Helvetica', sans-serif" };
export const monoFont = { fontFamily: "'Courier New', 'Consolas', monospace" };
export const bevelOut = { borderStyle: 'outset', borderWidth: '2px', borderColor: '#4444AA' };
export const bevelIn = { borderStyle: 'inset', borderWidth: '2px', borderColor: '#000060' };

export const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
export const pad3 = (n) => String(Math.floor(n)).padStart(3, '0');
export const formatClock = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
export const formatTime = (s) => `${pad2(Math.floor(Math.max(0, s) / 60))}:${pad2(Math.floor(Math.max(0, s) % 60))}`;

export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const randFloat = (min, max) => Math.random() * (max - min) + min;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Simple bordered blue button
export const CFASTButton = ({ children, onClick, testid, disabled, active }) => (
  <button data-testid={testid} onClick={onClick} disabled={disabled}
    className={`text-white text-sm font-bold py-1 px-4 border-2 ${
      active ? 'border-white bg-[#0000CC]' : 'border-[#4444AA] bg-[#0000A0] hover:bg-[#0000CC]'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
    {children}
  </button>
);

// Blue-headed panel with dark navy content
export const CFASTPanel = ({ title, children, testId, className = '' }) => (
  <div className={`bg-[#000030] border border-[#4444AA] ${className}`} data-testid={testId}>
    {title && <div className="bg-[#0000B0] text-white px-2 py-0.5 text-xs font-bold border-b border-[#4444AA]">{title}</div>}
    <div className="p-2">{children}</div>
  </div>
);

// Menu list (like Airborne Numerical's left menu)
export const CFASTMenu = ({ items, active }) => (
  <div className="bg-[#000030] border border-[#4444AA]">
    <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold">Menu</div>
    <div className="p-0">
      {items.map((it, i) => (
        <div key={i}
          className={`px-2 py-1 text-xs text-white border-b border-[#222266] ${active === i ? 'bg-[#0000A0]' : ''}`}>
          {it}
        </div>
      ))}
    </div>
  </div>
);

// A/B/C/D/E options list — CFAST format
export const CFASTOptions = ({ options, prefix = 'answer' }) => (
  <div className="space-y-1" data-testid={`${prefix}-list`}>
    {options.map((opt, i) => (
      <div key={i} className="flex items-baseline text-white text-sm" data-testid={`${prefix}-${i}`}>
        <span className="font-bold text-white w-6">{String.fromCharCode(65 + i)}</span>
        <span className="font-mono">{typeof opt === 'object' ? opt.label : opt}</span>
      </div>
    ))}
  </div>
);

// Answer input field — user types letter (A-E) or number, presses Enter
export const CFASTAnswerInput = ({ options, onSubmit, testid = 'answer-input', optionCount = 5 }) => {
  const [value, setValue] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!value) return;
    const letter = value.trim().toUpperCase();
    const idx = 'ABCDE'.indexOf(letter);
    if (idx >= 0 && idx < optionCount) {
      const opt = options ? options[idx] : letter;
      onSubmit(opt, idx);
      setValue('');
    } else {
      // Try numeric match against option values
      if (options) {
        const num = value.trim();
        const foundIdx = options.findIndex(o => String(typeof o === 'object' ? o.label : o).replace(/[^\d.-]/g, '') === num);
        if (foundIdx >= 0) {
          onSubmit(options[foundIdx], foundIdx);
          setValue('');
        }
      }
    }
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <label className="text-white text-sm">Answer:</label>
      <input data-testid={testid} value={value} onChange={e => setValue(e.target.value)}
        className="bg-black text-white font-mono text-lg px-2 py-0.5 w-20 border border-white uppercase focus:outline-none"
        maxLength={4} autoFocus />
      <button type="submit" className="text-white text-xs bg-[#0000A0] px-2 py-0.5 border border-[#4444AA]">ENTER</button>
    </form>
  );
};

// Menu screen for a module — practice/assessment + difficulty selector
export const ModuleMenu = ({ title, description, mode, setMode, difficulty, setDifficulty, onStart, onCancel }) => (
  <div className="min-h-screen bg-[#000018] flex items-center justify-center p-6" style={cbtFont}>
    <div className="w-[720px] bg-[#000030] border border-[#4444AA]">
      <div className="bg-[#0000B0] text-white text-center py-1 text-sm font-bold">{title}</div>
      <div className="p-6 text-white">
        <p className="mb-4 text-sm">{description}</p>
        <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold">Mode</div>
        <div className="p-2 grid grid-cols-2 gap-2 mb-3 bg-[#000050]">
          {[{ v: 'practice', l: 'Practice' }, { v: 'assessment', l: 'Assessment' }].map(o => (
            <button key={o.v} data-testid={`${o.v}-mode-btn`} onClick={() => setMode(o.v)}
              className={`py-1 text-xs font-bold border-2 ${
                mode === o.v ? 'bg-[#0000CC] border-white text-white' : 'bg-[#0000A0] border-[#4444AA] text-white'
              }`}>{o.l}</button>
          ))}
        </div>
        {mode && (<>
          <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold">Difficulty</div>
          <div className="p-2 grid grid-cols-3 gap-2 bg-[#000050]">
            {['easy', 'medium', 'hard'].map(d => (
              <button key={d} data-testid={`difficulty-${d}-btn`} onClick={() => setDifficulty(d)}
                className={`py-1 text-xs font-bold uppercase border-2 ${
                  difficulty === d ? 'bg-[#0000CC] border-white text-white' : 'bg-[#0000A0] border-[#4444AA] text-white'
                }`}>{d}</button>
            ))}
          </div>
        </>)}
      </div>
      <div className="bg-[#000030] p-3 border-t border-[#4444AA] flex justify-end gap-2">
        <CFASTButton testid="back-to-dashboard" onClick={onCancel}>Cancel</CFASTButton>
        {mode && difficulty && <CFASTButton testid="start-test-btn" onClick={onStart}>Continue &gt;&gt;</CFASTButton>}
      </div>
    </div>
  </div>
);

// Standard results screen
export const ModuleAnswerSummary = ({ summary = [] }) => {
  if (!summary.length) return null;
  return (
    <div className="mt-3 bg-[#000020] border border-[#4444AA]" data-testid="answer-summary">
      <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold">Answer Summary</div>
      <div className="max-h-[360px] overflow-y-auto p-2 space-y-2">
        {summary.map((item, i) => (
          <div
            key={i}
            className={`border px-2 py-1 text-xs ${item.correct ? 'bg-[#002800] border-[#008000]' : 'bg-[#300000] border-[#AA4444]'}`}
            data-testid={`answer-summary-${i}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold">Q{i + 1}: {item.prompt || item.question || item.task || 'Response'}</div>
              <div className={`font-bold ${item.correct ? 'text-[#66FF66]' : 'text-[#FF7777]'}`}>
                {item.correct ? 'CORRECT' : 'INCORRECT'}
              </div>
            </div>
            {item.detail && <div className="mt-1 text-[#CCCCCC]">{item.detail}</div>}
            {item.given !== undefined && (
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div>Given: <span className="font-mono" data-testid={`answer-summary-given-${i}`}>{String(item.given)}</span></div>
                <div>Correct: <span className="font-mono" data-testid={`answer-summary-correct-${i}`}>{String(item.answer ?? item.correctAnswer)}</span></div>
              </div>
            )}
            {item.explanation && <div className="mt-1 text-[#DDDDDD]">{item.explanation}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ModuleResults = ({ title, rows, overallScore, onRetry, onDashboard, summary = [] }) => (
  <div className="min-h-screen bg-[#000018] flex items-center justify-center p-6" style={cbtFont}>
    <div className="w-[860px] max-w-full bg-[#000030] border border-[#4444AA]">
      <div className="bg-[#0000B0] text-white text-center py-1 text-sm font-bold">{title}</div>
      <div className="p-4 text-white space-y-1">
        {rows.map(([l, v], i) => (
          <div key={i} className="flex justify-between px-3 py-1 bg-[#000050] border border-[#4444AA]" data-testid={`result-${i}`}>
            <span>{l}</span><span className="font-mono">{v}</span>
          </div>
        ))}
        <div className="flex justify-between px-3 py-2 bg-[#0000B0] mt-2 border border-white">
          <span className="font-bold">OVERALL SCORE</span>
          <span className="font-mono font-bold text-lg" data-testid="overall-score">{overallScore.toFixed(1)}%</span>
        </div>
        <ModuleAnswerSummary summary={summary} />
      </div>
      <div className="bg-[#000030] p-3 border-t border-[#4444AA] flex justify-end gap-2">
        <CFASTButton testid="return-menu-btn" onClick={onRetry}>Try Again</CFASTButton>
        <CFASTButton testid="return-dashboard-btn" onClick={onDashboard}>Dashboard</CFASTButton>
      </div>
    </div>
  </div>
);

// CFAST-native test shell: dark navy background + top banner + content + bottom bar
export const CFASTShell = ({ title, mode, difficulty, questionNum, questionCount, remaining, children, showTimer = true }) => (
  <div className="min-h-screen bg-[#000018] p-4" style={cbtFont}>
    <div className="max-w-[1100px] mx-auto">
      <div className="bg-[#0000B0] text-white px-3 py-1 text-sm font-bold flex justify-between items-center border border-[#4444AA]">
        <span>{title}</span>
        {showTimer && <span className="font-mono text-xs" data-testid="time-remaining">Time Left: {formatTime(remaining)}</span>}
      </div>
      <div className="bg-[#000030] border border-[#4444AA] border-t-0 p-3">
        {children}
      </div>
      <div className="bg-[#000050] border border-[#4444AA] border-t-0 px-3 py-0.5 flex justify-between text-white text-xs">
        <span>{mode === 'practice' ? 'Practice' : 'Question'}: {questionNum} of {questionCount}</span>
        <span className="uppercase">{difficulty}</span>
      </div>
    </div>
  </div>
);

// ---- Back-compat aliases ----
// Older modules import these names. They render the same CFAST dark-navy visuals.
export const CBTReasonShell = ({ title, testTag, practice, remaining, questionNum, questionCount, children }) => (
  <CFASTShell title={title} mode={practice ? 'practice' : 'assessment'} difficulty=""
    questionNum={questionNum} questionCount={questionCount} remaining={remaining}>
    {children}
  </CFASTShell>
);

export const CBTPanel = ({ title, children, testId }) => (
  <div className="bg-[#000030] border border-[#4444AA]" data-testid={testId}>
    {title && <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold border-b border-[#4444AA]">{title}</div>}
    <div className="p-2">{children}</div>
  </div>
);

export const CBTSubPanel = ({ title, children }) => (
  <div className="bg-[#000030] border border-[#4444AA]">
    {title && <div className="bg-[#000080] text-white text-center py-0.5 text-[11px] font-bold border-b border-[#4444AA]">{title}</div>}
    <div className="p-2">{children}</div>
  </div>
);

export const CBTButton = ({ children, onClick, testid, disabled, wide }) => (
  <button data-testid={testid} onClick={onClick} disabled={disabled}
    className={`text-white text-xs font-bold py-1 ${wide ? 'px-6' : 'px-3'} bg-[#0000A0] border-2 border-[#4444AA] hover:bg-[#0000CC] disabled:opacity-40`}>
    {children}
  </button>
);

export const CBTGreenButton = ({ children, onClick, testid }) => (
  <button data-testid={testid} onClick={onClick}
    className="bg-[#008000] text-white px-6 py-1 text-xs font-bold border-2 border-[#00B000] hover:bg-[#00A000]">
    {children}
  </button>
);

export const LcdDigit = ({ ch, testId, small }) => (
  <div className={`${small ? 'w-5 h-5' : 'w-6 h-6'} bg-black text-white flex items-center justify-center font-mono ${small ? 'text-xs' : 'text-sm'} font-bold border border-[#4444AA]`}
    data-testid={testId}>{ch}</div>
);

// Clickable A-E answer choices (dark theme). Kept as-is for backwards compat.
export const AnswerChoices = ({ options, onPick, prefix = 'answer' }) => (
  <div className="space-y-1">
    {options.map((opt, i) => (
      <button key={i} data-testid={`${prefix}-${i}`} onClick={() => onPick(opt, i)}
        className="w-full text-left px-3 py-1.5 bg-[#000050] text-white text-sm font-mono border border-[#4444AA] hover:bg-[#0000A0]">
        <span className="font-bold mr-3">{String.fromCharCode(65 + i)}</span>
        <span>{typeof opt === 'object' ? opt.label : opt}{typeof opt === 'object' && opt.suffix ? ` ${opt.suffix}` : ''}</span>
      </button>
    ))}
  </div>
);

export const CBTTestShell = ({ title, warnings, clockDisplay, mode, difficulty, elapsed, remaining, children }) => (
  <CFASTComplexShell title={title} warnings={warnings} clockDisplay={clockDisplay} mode={mode}
    difficulty={difficulty} elapsed={elapsed} remaining={remaining}>{children}</CFASTComplexShell>
);

export const CBTWindow = ({ title, children, footer, wide }) => (
  <div className="min-h-screen bg-[#000018] flex items-center justify-center p-6" style={cbtFont}>
    <div className={wide ? 'w-[900px]' : 'w-[720px]'} style={{ border: '1px solid #4444AA' }}>
      <div className="bg-[#0000B0] text-white text-center py-1 text-sm font-bold">{title}</div>
      <div className="bg-[#000030] text-white">{children}</div>
      {footer && <div className="bg-[#000030] p-3 border-t border-[#4444AA] flex justify-end gap-2">{footer}</div>}
    </div>
  </div>
);

// Live test shell with warnings panel + clock (for complex sim tests like Cognitive Updating)
export const CFASTComplexShell = ({ title, warnings, clockDisplay, mode, difficulty, elapsed, remaining, children }) => (
  <div className="min-h-screen bg-[#000018] p-3" style={cbtFont}>
    <div className="max-w-[1100px] mx-auto">
      <div className="bg-[#0000B0] text-white text-center py-1 text-sm font-bold border border-[#4444AA]">{title}</div>
      <div className="bg-[#000030] border border-[#4444AA] border-t-0 p-2">
        <div className="flex gap-2 mb-2">
          <div className="flex-1 bg-black border border-[#4444AA]">
            <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold border-b border-[#4444AA]">Warning Panel</div>
            <div className="h-14 px-2 py-1 overflow-hidden" data-testid="warning-list">
              <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-[11px]">
                {(warnings || []).map((w, i) => (
                  <div key={i} className={w.red ? 'text-[#FF3333]' : 'text-[#FFCC00]'}>{w.text}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="w-32 bg-black border border-[#4444AA]">
            <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold">Clock</div>
            <div className="h-14 flex items-center justify-center">
              <span className="text-white font-mono text-lg" data-testid="clock-display">{clockDisplay}</span>
            </div>
          </div>
        </div>
        {children}
        <div className="mt-2 bg-[#000050] border border-[#4444AA] text-white text-[11px] px-2 py-0.5 flex justify-between">
          <span>{mode?.toUpperCase()} / {difficulty?.toUpperCase()}</span>
          <span>Elapsed: {formatTime(elapsed)}</span>
          <span data-testid="time-remaining">Time Left: {formatTime(remaining)}</span>
        </div>
      </div>
    </div>
  </div>
);
