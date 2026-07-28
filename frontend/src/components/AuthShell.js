import React from 'react';
import { Activity, Compass, ShieldCheck } from 'lucide-react';
import './AuthShell.css';

const AuthShell = ({ children }) => (
  <div className="auth-page">
    <header className="auth-topbar">
      <div className="auth-topbar-brand">
        <span className="auth-mini-mark"><Compass aria-hidden="true" /></span>
        <span>CBAT Academy</span>
      </div>
      <div className="auth-system-state">
        <span className="auth-state-light" aria-hidden="true" />
        Account services online
      </div>
    </header>

    <main className="auth-main">
      <section className="auth-brand-panel" aria-labelledby="auth-brand-title">
        <div className="auth-brand-copy">
          <div className="auth-kicker">Independent training platform</div>
          <h1 id="auth-brand-title">CBAT Academy</h1>
          <p>Aircrew aptitude practice with one training record across every module.</p>
        </div>

        <div className="auth-instrument" aria-hidden="true">
          <div className="auth-instrument-axis auth-instrument-axis-x" />
          <div className="auth-instrument-axis auth-instrument-axis-y" />
          <div className="auth-instrument-ring auth-instrument-ring-outer" />
          <div className="auth-instrument-ring auth-instrument-ring-inner" />
          <div className="auth-instrument-pointer">
            <Compass />
          </div>
          <span className="auth-bearing auth-bearing-n">N</span>
          <span className="auth-bearing auth-bearing-e">E</span>
          <span className="auth-bearing auth-bearing-s">S</span>
          <span className="auth-bearing auth-bearing-w">W</span>
        </div>

        <div className="auth-brand-status">
          <div>
            <Activity aria-hidden="true" />
            <span>Training record</span>
            <strong>Ready</strong>
          </div>
          <div>
            <ShieldCheck aria-hidden="true" />
            <span>Account access</span>
            <strong>Protected</strong>
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        {children}
        <p className="auth-disclaimer">
          Independent practice software. Not affiliated with or endorsed by the
          Royal Air Force or Ministry of Defence.
        </p>
      </section>
    </main>
  </div>
);

export default AuthShell;
