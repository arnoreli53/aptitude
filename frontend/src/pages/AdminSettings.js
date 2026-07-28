import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveSettings, resetSettings, clearHistory } from '../utils/storage';
import { toast, Toaster } from 'sonner';
import { cbtFont, CFASTButton } from '../modules/cbtCommon';
import { MODULES, MODULE_BY_SETTINGS_KEY } from '../constants/modules';

const humanize = (key) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

const AdminSettings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(getSettings());
  const [expanded, setExpanded] = useState({});

  const handleSave = () => {
    if (saveSettings(settings)) toast.success('Settings saved');
    else toast.error('Failed to save settings');
  };
  const handleReset = () => {
    if (window.confirm('Reset ALL settings to default?')) {
      resetSettings();
      setSettings(getSettings());
      toast.success('Settings reset');
    }
  };
  const handleClearHistory = () => {
    if (window.confirm('Clear all test history? This cannot be undone.')) {
      clearHistory();
      toast.success('History cleared');
    }
  };

  const updateSetting = (module, difficulty, field, value) => {
    setSettings(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [difficulty]: { ...prev[module][difficulty], [field]: parseFloat(value) || 0 }
      }
    }));
  };

  const moduleKeys = MODULES.map(module => module.settingsKey);

  return (
    <div className="min-h-[calc(100vh-40px)] bg-[#000018] p-4" style={cbtFont}>
      <Toaster position="bottom-right" theme="dark" />
      <div className="max-w-6xl mx-auto border border-[#4444AA]">
        <div className="bg-[#0000B0] text-white text-center py-1 text-sm font-bold">
          TRAINING SETTINGS - CBAT BATTERY CONFIGURATION
        </div>
        <div className="bg-[#000030] p-3 text-white">
          <p className="text-white text-xs mb-3">
            Configure test parameters for each module and difficulty level.
          </p>

          <div className="mb-3 bg-black border border-[#4444AA] p-2 flex items-center justify-between">
            <span className="text-[10px] text-[#AACCFF]">Joystick / gamepad calibration is on a separate page.</span>
            <CFASTButton testid="admin-gamepad-link" onClick={() => navigate('/gamepad')}>Open Gamepad Calibration</CFASTButton>
          </div>

          <div className="space-y-1">
            {moduleKeys.map(mKey => {
              const isOpen = !!expanded[mKey];
              const cfg = settings[mKey];
              if (!cfg) return null;
              const fields = Object.keys(cfg.easy || {});
              return (
                <div key={mKey} className="bg-[#000030] border border-[#4444AA]">
                  <button
                    data-testid={`admin-toggle-${mKey}`}
                    onClick={() => setExpanded(p => ({ ...p, [mKey]: !p[mKey] }))}
                    className="w-full bg-[#0000B0] text-white text-left px-2 py-1 text-xs font-bold flex justify-between border-b border-[#4444AA]"
                  >
                    <span>{MODULE_BY_SETTINGS_KEY[mKey].name}</span>
                    <span className="font-mono">{isOpen ? '[-]' : '[+]'}</span>
                  </button>
                  {isOpen && (
                    <div className="p-2 space-y-2">
                      {['easy', 'medium', 'hard'].map(diff => (
                        <div key={diff} className="bg-black border border-[#4444AA] p-2">
                          <div className="text-[10px] font-bold text-[#AACCFF] uppercase mb-1">{diff} MODE</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {fields.map(field => (
                              <div key={field}>
                                <label className="block text-[10px] text-white mb-0.5">{humanize(field)}</label>
                                <input
                                  data-testid={`${mKey}-${diff}-${field}`}
                                  type="number"
                                  step="0.1"
                                  value={cfg[diff][field] ?? 0}
                                  onChange={e => updateSetting(mKey, diff, field, e.target.value)}
                                  className="w-full bg-black text-white font-mono px-1 py-0.5 text-xs border border-[#4444AA] focus:outline-none focus:border-white"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <CFASTButton testid="save-settings-btn" onClick={handleSave}>Save Settings</CFASTButton>
            <CFASTButton testid="reset-settings-btn" onClick={handleReset}>Reset to Default</CFASTButton>
            <CFASTButton testid="clear-history-btn" onClick={handleClearHistory}>Clear History</CFASTButton>
          </div>
        </div>
        <div className="bg-[#000050] px-3 py-0.5 flex justify-between text-[10px] text-white border-t border-[#4444AA]">
          <span>LOCAL TRAINING CONFIGURATION</span>
          <span>CBAT ACADEMY / SETTINGS</span>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
