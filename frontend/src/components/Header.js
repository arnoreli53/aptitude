import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChartNoAxesCombined,
  CircleUserRound,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LOGOUT } from '../constants/testIds/auth';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, syncStatus } = useAuth();

  const NavBtn = ({ to, label, testid, icon: Icon }) => {
    const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <button
        data-testid={testid}
        onClick={() => navigate(to)}
        title={label}
        className={`h-8 min-w-8 px-2 text-[11px] font-bold border flex items-center justify-center gap-1.5 sm:px-3 ${
          active ? 'bg-[#0000CC] border-white text-white' : 'bg-[#0000A0] border-[#4444AA] text-white hover:bg-[#0000CC]'
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden md:inline">{label}</span>
      </button>
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const displayName = profile?.display_name
    || user?.user_metadata?.display_name
    || user?.email?.split('@')[0]
    || 'Account';

  return (
    <header className="bg-[#000030] border-b border-[#4444AA] px-2 py-1.5"
      style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}>
      <div className="flex items-center justify-between gap-2 max-w-6xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-left"
          title="CBAT Academy dashboard"
        >
          <div className="bg-[#0000B0] text-white px-2 py-1 text-xs font-bold border border-white">
            CBAT
          </div>
          <h1 className="hidden text-white text-xs font-bold sm:block">
            CBAT Academy
          </h1>
        </button>
        <nav className="flex gap-1" aria-label="Primary navigation">
          <NavBtn to="/" label="Dashboard" testid="nav-dashboard" icon={LayoutDashboard} />
          <NavBtn to="/scores" label="Scores" testid="nav-scores" icon={ChartNoAxesCombined} />
          <NavBtn to="/gamepad" label="Gamepad" testid="nav-gamepad-header" icon={Gamepad2} />
          <NavBtn to="/settings" label="Settings" testid="nav-settings" icon={SlidersHorizontal} />
        </nav>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate('/account')}
            title="Account"
            className={`h-8 max-w-[150px] px-2 border flex items-center gap-1.5 text-white ${
              location.pathname.startsWith('/account')
                ? 'bg-[#0000CC] border-white'
                : 'bg-[#0000A0] border-[#4444AA] hover:bg-[#0000CC]'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                syncStatus === 'synced' ? 'bg-[#00DD88]' : 'bg-[#FFCC00]'
              }`}
              aria-hidden="true"
            />
            <CircleUserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden max-w-[86px] truncate text-[11px] font-bold lg:inline">
              {displayName}
            </span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            data-testid={LOGOUT.button}
            title="Sign out"
            aria-label="Sign out"
            className="h-8 w-8 border border-[#4444AA] bg-[#0000A0] text-white flex items-center justify-center hover:bg-[#881F32]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
