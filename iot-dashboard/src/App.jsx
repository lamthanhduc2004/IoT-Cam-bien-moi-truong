import { useState } from 'react';
import Home from './pages/Home';
import DataSensor from './pages/DataSensor';
import ActionHistory from './pages/ActionHistory';
import Profile from './pages/Profile';
import './App.css';

function App() {
  const [activePage, setActivePage] = useState('home');

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <Home />;
      case 'data':
        return <DataSensor />;
      case 'history':
        return <ActionHistory />;
      case 'profile':
        return <Profile />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="app">
      <nav className="navbar">
        <button
          className={`nav-button ${activePage === 'home' ? 'active' : ''}`}
          onClick={() => setActivePage('home')}
        >
          HOME
        </button>
        <button
          className={`nav-button ${activePage === 'data' ? 'active' : ''}`}
          onClick={() => setActivePage('data')}
        >
          Data_Sensor
        </button>
        <button
          className={`nav-button ${activePage === 'history' ? 'active' : ''}`}
          onClick={() => setActivePage('history')}
        >
          Action History
        </button>
        <button
          className={`nav-button ${activePage === 'profile' ? 'active' : ''}`}
          onClick={() => setActivePage('profile')}
        >
          Profile
        </button>
      </nav>

      <div className="page-content">
        {renderPage()}
      </div>
    </div>
  );
}

export default App;
