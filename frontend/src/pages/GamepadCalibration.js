import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGamepad, saveGamepad, DEFAULT_GAMEPAD } from '../utils/storage';
import { useGamepad } from '../hooks/useGamepad';
import { cbtFont, CFASTButton } from '../modules/cbtCommon';
import { toast, Toaster } from 'sonner';

const GamepadCalibration = () => {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState(getGamepad());
  const { connected, rawState } = useGamepad(cfg);

  const update = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const save = () => {
    saveGamepad(cfg);
    toast.success('Gamepad calibration saved');
  };
  const reset = () => {
    setCfg({ ...DEFAULT_GAMEPAD });
    saveGamepad(DEFAULT_GAMEPAD);
    toast.success('Reset to defaults');
  };

  // Calibrated preview (applies current cfg)
  const rx = rawState.axes[cfg.axisX] || 0;
  const ry = rawState.axes[cfg.axisY] || 0;
  const rp = rawState.axes[cfg.axisPedals] || 0;
  let dx = cfg.invertX ? -rx : rx;
  let dy = cfg.invertY ? -ry : ry;
  let dp = cfg.invertPedals ? -rp : rp;
  if (Math.abs(dx) < cfg.deadzone) dx = 0;
  if (Math.abs(dy) < cfg.deadzone) dy = 0;
  if (Math.abs(dp) < cfg.deadzone) dp = 0;
  dx *= cfg.sensitivity;
  dy *= cfg.sensitivity;
  dp *= cfg.pedalSensitivity || cfg.sensitivity;
  const cx = 100 + Math.max(-1, Math.min(1, dx)) * 80;
  const cy = 100 + Math.max(-1, Math.min(1, dy)) * 80;
  const pedalPct = 50 + Math.max(-1, Math.min(1, dp)) * 50;
  const axisOptions = Array.from({ length: Math.max(8, rawState.axes.length || 0) }, (_, i) => i);

  return (
    <div className="min-h-[calc(100vh-40px)] bg-[#000018] p-4" style={cbtFont}>
      <Toaster position="bottom-right" theme="dark" />
      <div className="max-w-4xl mx-auto border border-[#4444AA]">
        <div className="bg-[#0000B0] text-white text-center py-1 text-sm font-bold">
          GAMEPAD / JOYSTICK CALIBRATION
        </div>
        <div className="bg-[#000030] p-4 text-white">
          <div className="grid grid-cols-2 gap-4">
            {/* Live Preview */}
            <div className="bg-black border border-[#4444AA]">
              <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold border-b border-[#4444AA]">Live Preview</div>
              <div className="p-3">
                <div className="text-xs mb-2 flex justify-between">
                  <span>Status</span>
                  <span data-testid="gp-status" className={connected ? 'text-[#00FF00]' : 'text-[#FF3333]'}>
                    {connected ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                </div>
                <svg viewBox="0 0 200 200" className="w-full" style={{ height: '200px' }}>
                  <rect x="0" y="0" width="200" height="200" fill="#001030" />
                  <circle cx="100" cy="100" r="80" stroke="#4444AA" strokeWidth="1" fill="none" />
                  <circle cx="100" cy="100" r={cfg.deadzone * 80} stroke="#FF3333" strokeWidth="1" fill="none" strokeDasharray="3 2" />
                  <line x1="20" y1="100" x2="180" y2="100" stroke="#333366" strokeWidth="0.5" />
                  <line x1="100" y1="20" x2="100" y2="180" stroke="#333366" strokeWidth="0.5" />
                  {/* Raw dot */}
                  <circle cx={100 + rx * 80} cy={100 + ry * 80} r="4" fill="#FFCC00" data-testid="gp-raw-dot" />
                  {/* Calibrated dot */}
                  <circle cx={cx} cy={cy} r="6" fill="#00FF00" stroke="white" data-testid="gp-cal-dot" />
                </svg>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono mt-2">
                  <div>Raw X: <span data-testid="gp-raw-x">{rx.toFixed(3)}</span></div>
                  <div>Raw Y: <span data-testid="gp-raw-y">{ry.toFixed(3)}</span></div>
                  <div>Cal X: <span className="text-[#00FF00]">{dx.toFixed(3)}</span></div>
                  <div>Cal Y: <span className="text-[#00FF00]">{dy.toFixed(3)}</span></div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span>Pedals / Rudder</span>
                    <span className="text-[#00FF00]" data-testid="gp-pedal-value">{dp.toFixed(3)}</span>
                  </div>
                  <div className="relative h-5 bg-[#001030] border border-[#4444AA]">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#7788CC]" />
                    <div
                      className="absolute top-0 bottom-0 w-1.5 bg-[#00FF00]"
                      style={{ left: `calc(${pedalPct}% - 3px)` }}
                      data-testid="gp-pedal-marker"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-[10px] mb-1">Raw Axes</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono">
                    {axisOptions.map(i => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="text-[#AACCFF]">Axis {i}</span>
                        <span>{(rawState.axes[i] || 0).toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[10px] mb-1">Buttons Pressed</div>
                  <div className="flex flex-wrap gap-1">
                    {rawState.buttons.slice(0, 16).map((b, i) => (
                      <span key={i} data-testid={`gp-btn-${i}`}
                        className={`inline-block w-5 h-5 text-[9px] flex items-center justify-center border ${b ? 'bg-[#00CC00] text-black' : 'bg-[#001030] text-[#556677] border-[#4444AA]'}`}>
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-black border border-[#4444AA]">
              <div className="bg-[#0000B0] text-white text-center py-0.5 text-xs font-bold border-b border-[#4444AA]">Calibration Controls</div>
              <div className="p-3 space-y-3 text-xs">
                <div>
                  <label className="block mb-1">Deadzone: <span className="font-mono text-[#FFCC00]">{cfg.deadzone.toFixed(2)}</span></label>
                  <input type="range" min="0" max="0.5" step="0.01" value={cfg.deadzone}
                    onChange={e => update('deadzone', parseFloat(e.target.value))}
                    className="w-full" data-testid="gp-deadzone" />
                </div>
                <div>
                  <label className="block mb-1">Sensitivity: <span className="font-mono text-[#FFCC00]">{cfg.sensitivity.toFixed(2)}</span></label>
                  <input type="range" min="0.2" max="3.0" step="0.05" value={cfg.sensitivity}
                    onChange={e => update('sensitivity', parseFloat(e.target.value))}
                    className="w-full" data-testid="gp-sensitivity" />
                </div>
                <div>
                  <label className="block mb-1">Axis X (index)</label>
                  <select value={cfg.axisX} onChange={e => update('axisX', parseInt(e.target.value))}
                    className="w-full bg-black text-white border border-[#4444AA] px-1 py-0.5" data-testid="gp-axis-x">
                    {axisOptions.map(i => <option key={i} value={i}>Axis {i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Axis Y (index)</label>
                  <select value={cfg.axisY} onChange={e => update('axisY', parseInt(e.target.value))}
                    className="w-full bg-black text-white border border-[#4444AA] px-1 py-0.5" data-testid="gp-axis-y">
                    {axisOptions.map(i => <option key={i} value={i}>Axis {i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Foot Pedals / Twist Rudder Axis</label>
                  <select value={cfg.axisPedals} onChange={e => update('axisPedals', parseInt(e.target.value))}
                    className="w-full bg-black text-white border border-[#4444AA] px-1 py-0.5" data-testid="gp-axis-pedals">
                    {axisOptions.map(i => <option key={i} value={i}>Axis {i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1">Pedal Sensitivity: <span className="font-mono text-[#FFCC00]">{(cfg.pedalSensitivity || cfg.sensitivity).toFixed(2)}</span></label>
                  <input type="range" min="0.2" max="3.0" step="0.05" value={cfg.pedalSensitivity || cfg.sensitivity}
                    onChange={e => update('pedalSensitivity', parseFloat(e.target.value))}
                    className="w-full" data-testid="gp-pedal-sensitivity" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={cfg.invertX} onChange={e => update('invertX', e.target.checked)}
                    id="invx" data-testid="gp-invert-x" />
                  <label htmlFor="invx">Invert X</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={cfg.invertY} onChange={e => update('invertY', e.target.checked)}
                    id="invy" data-testid="gp-invert-y" />
                  <label htmlFor="invy">Invert Y</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={cfg.invertPedals} onChange={e => update('invertPedals', e.target.checked)}
                    id="invpedals" data-testid="gp-invert-pedals" />
                  <label htmlFor="invpedals">Invert Pedals / Rudder</label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-[10px] text-[#AACCFF] bg-[#000050] border border-[#4444AA] p-2">
            Connect a USB / Bluetooth joystick, gamepad, or flight controller, then move the stick and pedals. The yellow dot shows the raw stick axes, green shows calibrated output, and the pedal bar can be bound to physical pedals or a twist/rudder axis. Save to persist.
          </div>

          <div className="mt-3 flex gap-2 justify-end">
            <CFASTButton testid="gp-save" onClick={save}>Save Calibration</CFASTButton>
            <CFASTButton testid="gp-reset" onClick={reset}>Reset Defaults</CFASTButton>
            <CFASTButton testid="gp-back" onClick={() => navigate('/')}>Back to Dashboard</CFASTButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamepadCalibration;
