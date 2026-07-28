import { useEffect, useRef, useState } from 'react';
import { getGamepad } from '../utils/storage';

// Applies calibration (deadzone, sensitivity, inverts, axis remap) to raw gamepad state.
// stateRef.current = { axes: [dx, dy], pedals, buttons: [bool,...] }  (calibrated view)
export const useGamepad = (configOverride = null) => {
  const [connected, setConnected] = useState(false);
  const [rawState, setRawState] = useState({ axes: [0, 0, 0, 0], buttons: [] });
  const stateRef = useRef({ axes: [0, 0], pedals: 0, buttons: [] });
  const rawRef = useRef({ axes: [0, 0, 0, 0], buttons: [] });
  const rafRef = useRef(null);
  const connectedRef = useRef(false);
  const configRef = useRef(configOverride);

  useEffect(() => {
    configRef.current = configOverride;
  }, [configOverride]);

  useEffect(() => {
    const setConnection = (nextConnected) => {
      connectedRef.current = nextConnected;
      setConnected(nextConnected);
    };
    const onConnect = () => setConnection(true);
    const onDisconnect = () => setConnection(false);
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    const readAxis = (axes, index) => axes[Number.isFinite(index) ? index : 0] || 0;
    const calibrateAxis = (value, { invert = false, deadzone = 0.1, sensitivity = 1 }) => {
      let output = invert ? -value : value;
      if (Math.abs(output) < deadzone) output = 0;
      output *= sensitivity;
      return Math.max(-1, Math.min(1, output));
    };

    const loop = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads && pads[0];
      if (pad) {
        if (!connectedRef.current) setConnection(true);
        const cfg = configRef.current || getGamepad();
        const axes = pad.axes || [0, 0, 0, 0];
        const buttons = (pad.buttons || []).map(b => b.pressed);

        rawRef.current = { axes: [...axes], buttons };
        setRawState(rawRef.current);

        const dx = calibrateAxis(readAxis(axes, cfg.axisX), {
          invert: cfg.invertX,
          deadzone: cfg.deadzone,
          sensitivity: cfg.sensitivity
        });
        const dy = calibrateAxis(readAxis(axes, cfg.axisY), {
          invert: cfg.invertY,
          deadzone: cfg.deadzone,
          sensitivity: cfg.sensitivity
        });
        const pedals = calibrateAxis(readAxis(axes, cfg.axisPedals), {
          invert: cfg.invertPedals,
          deadzone: cfg.deadzone,
          sensitivity: cfg.pedalSensitivity || cfg.sensitivity
        });

        stateRef.current = { axes: [dx, dy], pedals, buttons, rawAxes: [...axes] };
      } else if (connectedRef.current) {
        setConnection(false);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line

  return { connected, stateRef, rawState };
};
