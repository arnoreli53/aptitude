// Random value generators for test scenarios

export const generateAircraftData = () => {
  return {
    altitude: Math.floor(Math.random() * 35000) + 5000,
    heading: Math.floor(Math.random() * 360),
    fuel: Math.floor(Math.random() * 8000) + 2000,
    airspeed: Math.floor(Math.random() * 300) + 150,
    frequency: (118 + Math.random() * 18).toFixed(2),
    waypoint: generateWaypoint()
  };
};

export const generateWaypoint = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array(5).fill(0).map(() => letters[Math.floor(Math.random() * 26)]).join('');
};

export const generateInstruction = (aircraftId, currentData) => {
  const instructions = [
    {
      type: 'altitude',
      text: `Increase Aircraft ${aircraftId} altitude by ${500 + Math.floor(Math.random() * 4) * 500} ft.`,
      change: (data) => ({ ...data, altitude: data.altitude + (500 + Math.floor(Math.random() * 4) * 500) })
    },
    {
      type: 'altitude',
      text: `Decrease Aircraft ${aircraftId} altitude by ${500 + Math.floor(Math.random() * 4) * 500} ft.`,
      change: (data) => ({ ...data, altitude: Math.max(1000, data.altitude - (500 + Math.floor(Math.random() * 4) * 500)) })
    },
    {
      type: 'heading',
      text: `Turn Aircraft ${aircraftId} right ${30 + Math.floor(Math.random() * 3) * 30} degrees.`,
      change: (data) => ({ ...data, heading: (data.heading + (30 + Math.floor(Math.random() * 3) * 30)) % 360 })
    },
    {
      type: 'heading',
      text: `Turn Aircraft ${aircraftId} left ${30 + Math.floor(Math.random() * 3) * 30} degrees.`,
      change: (data) => ({ ...data, heading: (data.heading - (30 + Math.floor(Math.random() * 3) * 30) + 360) % 360 })
    },
    {
      type: 'speed',
      text: `Increase Aircraft ${aircraftId} speed by ${10 + Math.floor(Math.random() * 4) * 10} knots.`,
      change: (data) => ({ ...data, airspeed: data.airspeed + (10 + Math.floor(Math.random() * 4) * 10) })
    },
    {
      type: 'speed',
      text: `Reduce Aircraft ${aircraftId} speed by ${10 + Math.floor(Math.random() * 4) * 10} knots.`,
      change: (data) => ({ ...data, airspeed: Math.max(100, data.airspeed - (10 + Math.floor(Math.random() * 4) * 10)) })
    },
    {
      type: 'fuel',
      text: `Transfer ${100 + Math.floor(Math.random() * 10) * 50} units of fuel from Aircraft ${aircraftId}.`,
      change: (data) => ({ ...data, fuel: Math.max(500, data.fuel - (100 + Math.floor(Math.random() * 10) * 50)) })
    },
    {
      type: 'fuel',
      text: `Add ${100 + Math.floor(Math.random() * 10) * 50} units of fuel to Aircraft ${aircraftId}.`,
      change: (data) => ({ ...data, fuel: data.fuel + (100 + Math.floor(Math.random() * 10) * 50) })
    }
  ];
  
  return instructions[Math.floor(Math.random() * instructions.length)];
};

export const generateQuestion = (aircraftData, aircraftIds) => {
  const questionTypes = [
    {
      type: 'highest_altitude',
      generate: () => {
        const highest = aircraftIds.reduce((prev, curr) => 
          aircraftData[curr].altitude > aircraftData[prev].altitude ? curr : prev
        );
        return {
          question: 'Which aircraft has the highest altitude?',
          options: shuffleArray(aircraftIds),
          answer: highest
        };
      }
    },
    {
      type: 'specific_heading',
      generate: () => {
        const randomAircraft = aircraftIds[Math.floor(Math.random() * aircraftIds.length)];
        return {
          question: `What is Aircraft ${randomAircraft}'s heading?`,
          options: shuffleArray([
            aircraftData[randomAircraft].heading,
            (aircraftData[randomAircraft].heading + 30) % 360,
            (aircraftData[randomAircraft].heading + 60) % 360,
            (aircraftData[randomAircraft].heading - 30 + 360) % 360
          ]).map(h => `${h}°`),
          answer: `${aircraftData[randomAircraft].heading}°`
        };
      }
    },
    {
      type: 'frequency',
      generate: () => {
        const randomAircraft = aircraftIds[Math.floor(Math.random() * aircraftIds.length)];
        const targetFreq = aircraftData[randomAircraft].frequency;
        return {
          question: `Which aircraft is using frequency ${targetFreq}?`,
          options: shuffleArray(aircraftIds),
          answer: randomAircraft
        };
      }
    },
    {
      type: 'combined_fuel',
      generate: () => {
        const aircraft1 = aircraftIds[0];
        const aircraft2 = aircraftIds[1];
        const combined = aircraftData[aircraft1].fuel + aircraftData[aircraft2].fuel;
        return {
          question: `What is the combined fuel of Aircraft ${aircraft1} and Aircraft ${aircraft2}?`,
          options: shuffleArray([
            combined,
            combined + 500,
            combined - 500,
            combined + 1000
          ]).map(f => `${f} lbs`),
          answer: `${combined} lbs`
        };
      }
    },
    {
      type: 'lowest_speed',
      generate: () => {
        const lowest = aircraftIds.reduce((prev, curr) => 
          aircraftData[curr].airspeed < aircraftData[prev].airspeed ? curr : prev
        );
        return {
          question: 'Which aircraft has the lowest airspeed?',
          options: shuffleArray(aircraftIds),
          answer: lowest
        };
      }
    }
  ];
  
  const selectedType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
  return selectedType.generate();
};

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const generateSystemData = () => {
  const systems = {
    'Fuel System': {
      tankLevel: Math.floor(Math.random() * 100),
      pumpStatus: Math.random() > 0.3 ? 'OPERATIONAL' : 'FAULT',
      flowRate: (Math.random() * 500 + 100).toFixed(1),
      pressure: (Math.random() * 50 + 20).toFixed(1)
    },
    'Electrical System': {
      voltage: (Math.random() * 5 + 25).toFixed(1),
      amperage: (Math.random() * 100 + 50).toFixed(1),
      generatorStatus: Math.random() > 0.2 ? 'ONLINE' : 'OFFLINE',
      batteryCharge: Math.floor(Math.random() * 100)
    },
    'Hydraulic System': {
      pressure: Math.floor(Math.random() * 3000 + 1000),
      fluidLevel: Math.floor(Math.random() * 100),
      temperature: Math.floor(Math.random() * 150 + 50),
      pumpA: Math.random() > 0.25 ? 'ON' : 'OFF',
      pumpB: Math.random() > 0.25 ? 'ON' : 'OFF'
    },
    'Cooling System': {
      temperature: Math.floor(Math.random() * 100 + 50),
      fanSpeed: Math.floor(Math.random() * 100),
      coolantLevel: Math.floor(Math.random() * 100),
      status: Math.random() > 0.2 ? 'NORMAL' : 'WARNING'
    },
    'Navigation System': {
      gpsStatus: Math.random() > 0.1 ? 'ACTIVE' : 'INACTIVE',
      satelliteCount: Math.floor(Math.random() * 12 + 4),
      accuracy: (Math.random() * 10 + 2).toFixed(1),
      heading: Math.floor(Math.random() * 360)
    },
    'Engine 1': {
      rpm: Math.floor(Math.random() * 3000 + 2000),
      temperature: Math.floor(Math.random() * 800 + 400),
      oilPressure: Math.floor(Math.random() * 100 + 30),
      fuelFlow: (Math.random() * 500 + 200).toFixed(1)
    },
    'Engine 2': {
      rpm: Math.floor(Math.random() * 3000 + 2000),
      temperature: Math.floor(Math.random() * 800 + 400),
      oilPressure: Math.floor(Math.random() * 100 + 30),
      fuelFlow: (Math.random() * 500 + 200).toFixed(1)
    },
    'Pump Control': {
      primaryPump: Math.random() > 0.2 ? 'ACTIVE' : 'STANDBY',
      backupPump: Math.random() > 0.5 ? 'STANDBY' : 'ACTIVE',
      flowRate: (Math.random() * 100 + 50).toFixed(1),
      pressure: Math.floor(Math.random() * 100 + 50)
    },
    'Valve Status': {
      mainValve: Math.random() > 0.3 ? 'OPEN' : 'CLOSED',
      bypassValve: Math.random() > 0.6 ? 'OPEN' : 'CLOSED',
      reliefValve: Math.random() > 0.7 ? 'NORMAL' : 'RELIEF',
      position: Math.floor(Math.random() * 100)
    },
    'Sensor Array': {
      temperatureSensor: Math.random() > 0.15 ? 'OK' : 'FAULT',
      pressureSensor: Math.random() > 0.15 ? 'OK' : 'FAULT',
      flowSensor: Math.random() > 0.15 ? 'OK' : 'FAULT',
      levelSensor: Math.random() > 0.15 ? 'OK' : 'FAULT'
    },
    'Battery Management': {
      mainBattery: Math.floor(Math.random() * 100),
      backupBattery: Math.floor(Math.random() * 100),
      charging: Math.random() > 0.5 ? 'YES' : 'NO',
      voltage: (Math.random() * 5 + 23).toFixed(1)
    },
    'Generator Control': {
      generator1: Math.random() > 0.2 ? 'ONLINE' : 'OFFLINE',
      generator2: Math.random() > 0.2 ? 'ONLINE' : 'OFFLINE',
      loadBalance: Math.floor(Math.random() * 100),
      frequency: (Math.random() * 2 + 59).toFixed(1)
    },
    'Communications': {
      radio1: Math.random() > 0.1 ? 'ACTIVE' : 'FAULT',
      radio2: Math.random() > 0.1 ? 'ACTIVE' : 'FAULT',
      transponder: Math.random() > 0.05 ? 'ON' : 'OFF',
      signalStrength: Math.floor(Math.random() * 100)
    },
    'Flight Controls': {
      aileron: Math.random() > 0.1 ? 'NORMAL' : 'RESTRICTED',
      elevator: Math.random() > 0.1 ? 'NORMAL' : 'RESTRICTED',
      rudder: Math.random() > 0.1 ? 'NORMAL' : 'RESTRICTED',
      trim: (Math.random() * 10 - 5).toFixed(1)
    },
    'Environmental': {
      cabinPressure: (Math.random() * 5 + 10).toFixed(1),
      cabinTemp: Math.floor(Math.random() * 30 + 15),
      oxygenLevel: Math.floor(Math.random() * 20 + 80),
      humidity: Math.floor(Math.random() * 60 + 20)
    }
  };
  
  return systems;
};

export const generateSystemQuestion = (systemData) => {
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const questionTemplates = [
    {
      generate: () => {
        const system = 'Hydraulic System';
        const isHealthy = systemData[system].pumpA === 'ON' && 
                         systemData[system].pumpB === 'ON' && 
                         systemData[system].pressure > 2000;
        return {
          question: 'Is the hydraulic system operating normally?',
          options: ['Yes', 'No', 'Insufficient Data', 'Partial Operation'],
          answer: isHealthy ? 'Yes' : 'No',
          requiredTabs: ['Hydraulic System']
        };
      }
    },
    {
      generate: () => {
        const gen1Online = systemData['Generator Control'].generator1 === 'ONLINE';
        const gen2Online = systemData['Generator Control'].generator2 === 'ONLINE';
        let answer;
        if (gen1Online && gen2Online) answer = 'Both generators online';
        else if (gen1Online) answer = 'Generator 1 only';
        else if (gen2Online) answer = 'Generator 2 only';
        else answer = 'No generators online';
        
        return {
          question: 'What is the current generator configuration?',
          options: shuffleArray(['Both generators online', 'Generator 1 only', 'Generator 2 only', 'No generators online']),
          answer,
          requiredTabs: ['Generator Control']
        };
      }
    },
    {
      generate: () => {
        const eng1Temp = systemData['Engine 1'].temperature;
        const eng2Temp = systemData['Engine 2'].temperature;
        const answer = eng1Temp > eng2Temp ? 'Engine 1' : 'Engine 2';
        
        return {
          question: 'Which engine is running hotter?',
          options: shuffleArray(['Engine 1', 'Engine 2', 'Both Equal', 'Cannot Determine']),
          answer,
          requiredTabs: ['Engine 1', 'Engine 2']
        };
      }
    },
    {
      generate: () => {
        const mainBatt = systemData['Battery Management'].mainBattery;
        const backupBatt = systemData['Battery Management'].backupBattery;
        const totalCharge = mainBatt + backupBatt;
        
        return {
          question: 'What is the total battery capacity available?',
          options: shuffleArray([
            `${totalCharge}%`,
            `${totalCharge + 20}%`,
            `${totalCharge - 20}%`,
            `${Math.floor(totalCharge / 2)}%`
          ]),
          answer: `${totalCharge}%`,
          requiredTabs: ['Battery Management']
        };
      }
    },
    {
      generate: () => {
        const radio1 = systemData['Communications'].radio1 === 'ACTIVE';
        const radio2 = systemData['Communications'].radio2 === 'ACTIVE';
        const answer = (radio1 && radio2) ? 'Full' : (radio1 || radio2) ? 'Partial' : 'None';
        
        return {
          question: 'What is the communication capability status?',
          options: shuffleArray(['Full', 'Partial', 'None', 'Degraded']),
          answer,
          requiredTabs: ['Communications']
        };
      }
    },
    {
      generate: () => {
        const eng1Rpm = systemData['Engine 1'].rpm;
        const eng2Rpm = systemData['Engine 2'].rpm;
        const totalRpm = eng1Rpm + eng2Rpm;
        
        return {
          question: 'What is the combined RPM of both engines?',
          options: shuffleArray([
            totalRpm,
            totalRpm + 500,
            totalRpm - 500,
            totalRpm + 1000
          ]).map(r => `${r} RPM`),
          answer: `${totalRpm} RPM`,
          requiredTabs: ['Engine 1', 'Engine 2']
        };
      }
    },
    {
      generate: () => {
        const fuelLevel = systemData['Fuel System'].tankLevel;
        const pumpStatus = systemData['Fuel System'].pumpStatus;
        let answer;
        if (fuelLevel > 50 && pumpStatus === 'OPERATIONAL') answer = 'Fully Operational';
        else if (fuelLevel > 25 && pumpStatus === 'OPERATIONAL') answer = 'Reduced Capacity';
        else if (pumpStatus === 'FAULT') answer = 'Critical Fault';
        else answer = 'Low Fuel Warning';
        
        return {
          question: 'What is the fuel system operational status?',
          options: shuffleArray(['Fully Operational', 'Reduced Capacity', 'Critical Fault', 'Low Fuel Warning']),
          answer,
          requiredTabs: ['Fuel System']
        };
      }
    },
    {
      generate: () => {
        const voltage = parseFloat(systemData['Electrical System'].voltage);
        const genStatus = systemData['Electrical System'].generatorStatus;
        const answer = (voltage >= 27 && genStatus === 'ONLINE') ? 'Normal' :
                      (voltage < 27 && genStatus === 'ONLINE') ? 'Low Voltage' :
                      genStatus === 'OFFLINE' ? 'Generator Offline' : 'Critical';
        
        return {
          question: 'What is the electrical system status?',
          options: shuffleArray(['Normal', 'Low Voltage', 'Generator Offline', 'Critical']),
          answer,
          requiredTabs: ['Electrical System']
        };
      }
    },
    {
      generate: () => {
        const sensors = systemData['Sensor Array'];
        const faultCount = Object.values(sensors).filter(v => v === 'FAULT').length;
        
        return {
          question: 'How many sensors are currently in FAULT state?',
          options: shuffleArray(['0', '1', '2', '3', '4']).slice(0, 4),
          answer: `${faultCount}`,
          requiredTabs: ['Sensor Array']
        };
      }
    },
    {
      generate: () => {
        const gpsStatus = systemData['Navigation System'].gpsStatus;
        const satCount = systemData['Navigation System'].satelliteCount;
        const answer = (gpsStatus === 'ACTIVE' && satCount >= 6) ? 'Accurate Navigation' :
                      (gpsStatus === 'ACTIVE' && satCount < 6) ? 'Degraded Signal' :
                      'Navigation Lost';
        
        return {
          question: 'What is the navigation system reliability?',
          options: shuffleArray(['Accurate Navigation', 'Degraded Signal', 'Navigation Lost', 'Backup Mode']),
          answer,
          requiredTabs: ['Navigation System']
        };
      }
    },
    {
      generate: () => {
        const coolTemp = systemData['Cooling System'].temperature;
        const coolLevel = systemData['Cooling System'].coolantLevel;
        const answer = (coolTemp > 120 || coolLevel < 30) ? 'Overheating Risk' :
                      (coolTemp > 100) ? 'Elevated Temperature' :
                      'Normal Operation';
        
        return {
          question: 'What is the cooling system assessment?',
          options: shuffleArray(['Overheating Risk', 'Elevated Temperature', 'Normal Operation', 'Coolant Loss']),
          answer,
          requiredTabs: ['Cooling System']
        };
      }
    },
    {
      generate: () => {
        const mainValve = systemData['Valve Status'].mainValve;
        const bypassValve = systemData['Valve Status'].bypassValve;
        let answer;
        if (mainValve === 'OPEN' && bypassValve === 'CLOSED') answer = 'Normal Flow';
        else if (mainValve === 'CLOSED' && bypassValve === 'OPEN') answer = 'Bypass Active';
        else if (mainValve === 'OPEN' && bypassValve === 'OPEN') answer = 'Both Valves Open';
        else answer = 'Flow Blocked';
        
        return {
          question: 'What is the current valve configuration?',
          options: shuffleArray(['Normal Flow', 'Bypass Active', 'Both Valves Open', 'Flow Blocked']),
          answer,
          requiredTabs: ['Valve Status']
        };
      }
    },
    {
      generate: () => {
        const aileron = systemData['Flight Controls'].aileron;
        const elevator = systemData['Flight Controls'].elevator;
        const rudder = systemData['Flight Controls'].rudder;
        const restrictedCount = [aileron, elevator, rudder].filter(c => c === 'RESTRICTED').length;
        const answer = restrictedCount === 0 ? 'All Controls Normal' :
                      restrictedCount === 1 ? 'One Control Restricted' :
                      restrictedCount === 2 ? 'Multiple Restrictions' : 'Severe Restriction';
        
        return {
          question: 'What is the flight control status?',
          options: shuffleArray(['All Controls Normal', 'One Control Restricted', 'Multiple Restrictions', 'Severe Restriction']),
          answer,
          requiredTabs: ['Flight Controls']
        };
      }
    },
    {
      generate: () => {
        const cabinPress = parseFloat(systemData['Environmental'].cabinPressure);
        const oxygen = systemData['Environmental'].oxygenLevel;
        const answer = (cabinPress >= 12 && oxygen >= 90) ? 'Safe' :
                      (cabinPress < 12 && oxygen >= 90) ? 'Pressure Warning' :
                      (oxygen < 90) ? 'Oxygen Warning' : 'Emergency';
        
        return {
          question: 'What is the cabin environmental status?',
          options: shuffleArray(['Safe', 'Pressure Warning', 'Oxygen Warning', 'Emergency']),
          answer,
          requiredTabs: ['Environmental']
        };
      }
    },
    {
      generate: () => {
        const primary = systemData['Pump Control'].primaryPump;
        const backup = systemData['Pump Control'].backupPump;
        let answer;
        if (primary === 'ACTIVE' && backup === 'STANDBY') answer = 'Primary Active';
        else if (primary === 'STANDBY' && backup === 'ACTIVE') answer = 'Backup Active';
        else if (primary === 'ACTIVE' && backup === 'ACTIVE') answer = 'Both Active';
        else answer = 'Both Standby';
        
        return {
          question: 'What is the current pump configuration?',
          options: shuffleArray(['Primary Active', 'Backup Active', 'Both Active', 'Both Standby']),
          answer,
          requiredTabs: ['Pump Control']
        };
      }
    },
    {
      generate: () => {
        const hydraulicPressure = systemData['Hydraulic System'].pressure;
        const fuelPressure = parseFloat(systemData['Fuel System'].pressure);
        const higher = hydraulicPressure > fuelPressure ? 'Hydraulic' : 'Fuel';
        
        return {
          question: 'Which system has higher pressure reading?',
          options: shuffleArray(['Hydraulic', 'Fuel', 'Equal', 'Cannot Compare']),
          answer: higher,
          requiredTabs: ['Hydraulic System', 'Fuel System']
        };
      }
    },
    {
      generate: () => {
        const trans = systemData['Communications'].transponder;
        const signal = systemData['Communications'].signalStrength;
        const answer = (trans === 'ON' && signal >= 70) ? 'Strong Signal' :
                      (trans === 'ON' && signal >= 40) ? 'Moderate Signal' :
                      (trans === 'ON') ? 'Weak Signal' : 'No Signal';
        
        return {
          question: 'What is the transponder signal quality?',
          options: shuffleArray(['Strong Signal', 'Moderate Signal', 'Weak Signal', 'No Signal']),
          answer,
          requiredTabs: ['Communications']
        };
      }
    }
  ];
  
  const template = questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
  return template.generate();
};
