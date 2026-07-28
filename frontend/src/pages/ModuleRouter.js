import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import AirborneNumerical from '../modules/AirborneNumerical';
import AnglesBearingsDegrees from '../modules/AnglesBearingsDegrees';
import AuditoryCapacity from '../modules/AuditoryCapacity';
import CognitiveUpdating from '../modules/CognitiveUpdating';
import ColoursLettersNumbers from '../modules/ColoursLettersNumbers';
import DigitRecognition from '../modules/DigitRecognition';
import DynamicProjection from '../modules/DynamicProjection';
import InstrumentComprehension from '../modules/InstrumentComprehension';
import MathematicsReasoning from '../modules/MathematicsReasoning';
import NumericalOperations from '../modules/NumericalOperations';
import RapidTracking from '../modules/RapidTracking';
import SensoryMotor from '../modules/SensoryMotor';
import SituationalAwareness from '../modules/SituationalAwareness';
import SpatialIntegration from '../modules/SpatialIntegration';
import SystemLogic from '../modules/SystemLogic';
import TableReading from '../modules/TableReading';
import TargetRecognition from '../modules/TargetRecognition';
import TraceTest from '../modules/TraceTest';
import TraceTest2 from '../modules/TraceTest2';
import Vigilance from '../modules/Vigilance';
import VisualSearch from '../modules/VisualSearch';
import {
  DirectionsAndDistances,
  FiguresLogisticsGroups,
  VerbalLogic,
  VisualisationTests
} from '../modules/MissingRafModules';

const ROUTES = {
  'airborne-numerical':       AirborneNumerical,
  'angles-bearings-degrees':  AnglesBearingsDegrees,
  'auditory-capacity':        AuditoryCapacity,
  'cognitive-updating':       CognitiveUpdating,
  'colours-letters-numbers':  ColoursLettersNumbers,
  'digit-recognition':        DigitRecognition,
  'directions-distances':     DirectionsAndDistances,
  'dynamic-projection':       DynamicProjection,
  'figures-logistics-groups': FiguresLogisticsGroups,
  'instrument-comprehension': InstrumentComprehension,
  'mathematics-reasoning':    MathematicsReasoning,
  'numerical-operations':     NumericalOperations,
  'rapid-tracking':           RapidTracking,
  'sensory-motor':            SensoryMotor,
  'situational-awareness':    SituationalAwareness,
  'spatial-integration':      SpatialIntegration,
  'system-logic':             SystemLogic,
  'table-reading':            TableReading,
  'target-recognition':       TargetRecognition,
  'trace-test':               TraceTest,
  'trace-test-2':             TraceTest2,
  'verbal-logic':             VerbalLogic,
  'vigilance':                Vigilance,
  'visual-search':            VisualSearch,
  'visualisation-tests':      VisualisationTests
};

const ModuleRouter = () => {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const Component = ROUTES[moduleId];

  useEffect(() => {
    const blockDeleteKeys = (event) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      event.preventDefault();
      event.stopPropagation();
    };
    const blockDeleteInput = (event) => {
      if (!event.inputType?.startsWith('delete')) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', blockDeleteKeys, true);
    window.addEventListener('beforeinput', blockDeleteInput, true);
    return () => {
      window.removeEventListener('keydown', blockDeleteKeys, true);
      window.removeEventListener('beforeinput', blockDeleteInput, true);
    };
  }, []);

  if (!Component) {
    return (
      <div className="min-h-screen bg-[#000080] flex items-center justify-center text-white"
        style={{ fontFamily: "'Arial', sans-serif" }}>
        <div className="text-center">
          <h2 className="text-xl mb-2">Module Not Found</h2>
          <p className="text-sm opacity-70 mb-4">Module '{moduleId}' is not implemented.</p>
          <button data-testid="return-dashboard-btn" onClick={() => navigate('/')} className="bg-[#C0C0C0] text-black px-4 py-1 text-xs font-bold">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  return <Component />;
};

export default ModuleRouter;
